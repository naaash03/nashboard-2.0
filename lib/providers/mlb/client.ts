import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type MlbFetchOptions = {
  /** Path appended to MLB_BASE (e.g. "/schedule"), or a full URL starting with "http" */
  endpoint: string;
  params?: Record<string, string | number | undefined | null>;
  /** Filename inside tests/fixtures/mlb/ used when dataMode === "fixture" */
  fixtureFile?: string;
  /** Cache TTL in seconds (default 120) */
  ttlSeconds?: number;
  dataMode?: "live" | "fixture";
  /** Include in cache key to bypass in-memory cache for this call */
  cacheBust?: string;
};

export type MlbFetchMeta = {
  sourceUsed: "mlb" | "fixture" | "cache" | "demo";
  updatedAt: string;
  requestId: string;
  cacheHit?: boolean;
  cacheAgeSeconds?: number;
  endpointUrl?: string;
  upstreamStatus?: number;
  upstreamMessage?: string;
  warning?: string;
  dataMode?: "live" | "fixture";
};

export type MlbFetchResult<T> = {
  data: T;
  meta: MlbFetchMeta;
};

type InMemoryCacheEntry = {
  expiresAtMs: number;
  payload: unknown;
  updatedAt: string;
};

const inMemory = new Map<string, InMemoryCacheEntry>();

export const MLB_BASE = "https://statsapi.mlb.com/api/v1";
const PROVIDER = "mlb";

function stableParams(params: MlbFetchOptions["params"]): string {
  const entries = Object.entries(params ?? {})
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

function buildCacheKey(endpoint: string, params: MlbFetchOptions["params"], cacheBust?: string): string {
  return `${PROVIDER}:${endpoint}?${stableParams(params)}${cacheBust ? `:bust=${cacheBust}` : ""}`;
}

function hashParams(params: MlbFetchOptions["params"], cacheBust?: string): string {
  const raw = stableParams(params) + (cacheBust ? `:bust=${cacheBust}` : "");
  return createHash("sha256").update(raw).digest("hex");
}

export function resolveDataMode(override?: "live" | "fixture"): "live" | "fixture" {
  if (override) return override;
  return (process.env.NASHBOARD_DATA_MODE ?? "live").toLowerCase() === "fixture" ? "fixture" : "live";
}

export async function loadMlbFixture<T>(fixtureFile: string): Promise<T> {
  const filePath = path.join(process.cwd(), "tests", "fixtures", "mlb", fixtureFile);
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

async function storePersistentCache<T>(
  endpoint: string,
  params: MlbFetchOptions["params"],
  payload: T,
  requestId: string,
  ttlSeconds: number,
  cacheBust?: string,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const ph = hashParams(params, cacheBust);
    // Prisma DataSource enum does not yet include MLB; ESPN is used as stand-in for "live external API"
    await prisma.cachedResponse.upsert({
      where: { provider_endpoint_paramsHash: { provider: PROVIDER, endpoint, paramsHash: ph } },
      update: { payload: payload as never, fetchedAt: now, expiresAt, sourceUsed: "ESPN" as never, requestId },
      create: { provider: PROVIDER, endpoint, paramsHash: ph, payload: payload as never, fetchedAt: now, expiresAt, sourceUsed: "ESPN" as never, requestId },
    });
  } catch {
    // Best-effort — swallow errors (e.g. Prisma enum mismatch until schema migration adds MLB)
  }
}

async function readPersistentCache<T>(
  endpoint: string,
  params: MlbFetchOptions["params"],
  cacheBust?: string,
): Promise<{ payload: T; ageSeconds: number } | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const ph = hashParams(params, cacheBust);
    const item = await prisma.cachedResponse.findUnique({
      where: { provider_endpoint_paramsHash: { provider: PROVIDER, endpoint, paramsHash: ph } },
    });
    if (!item) return null;
    const ageSeconds = Math.max(0, Math.floor((Date.now() - item.fetchedAt.getTime()) / 1000));
    return { payload: item.payload as T, ageSeconds };
  } catch {
    return null;
  }
}

/**
 * Fetches from the MLB Stats API with multi-layer caching:
 *   1. In-memory (TTL-based)
 *   2. Live fetch from statsapi.mlb.com (3 attempts, 8s timeout each)
 *   3. Persistent DB cache fallback on upstream failure
 * In fixture mode, reads from tests/fixtures/mlb/{fixtureFile} instead.
 */
export async function fetchMlbJson<T>(options: MlbFetchOptions): Promise<MlbFetchResult<T>> {
  const requestId = randomUUID();
  const ttlSeconds = options.ttlSeconds ?? 120;
  const dataMode = resolveDataMode(options.dataMode);
  const key = buildCacheKey(options.endpoint, options.params, options.cacheBust);

  // Build full URL
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(options.params ?? {})) {
    if (v !== undefined && v !== null) search.set(k, String(v));
  }
  const baseUrl = options.endpoint.startsWith("http")
    ? options.endpoint
    : `${MLB_BASE}${options.endpoint}`;
  const sep = baseUrl.includes("?") ? "&" : "?";
  const url = `${baseUrl}${search.size ? `${sep}${search}` : ""}`;

  // Fixture mode — read from disk, skip network entirely
  if (dataMode === "fixture") {
    if (!options.fixtureFile) {
      throw new Error(`Fixture file missing for MLB endpoint: ${options.endpoint}`);
    }
    const payload = await loadMlbFixture<T>(options.fixtureFile);
    return {
      data: payload,
      meta: {
        sourceUsed: "fixture",
        updatedAt: new Date().toISOString(),
        requestId,
        endpointUrl: url,
        upstreamStatus: 200,
        dataMode,
      },
    };
  }

  // In-memory cache hit
  const mem = inMemory.get(key);
  if (mem && mem.expiresAtMs > Date.now()) {
    const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(mem.updatedAt).getTime()) / 1000));
    return {
      data: mem.payload as T,
      meta: {
        sourceUsed: "cache",
        updatedAt: mem.updatedAt,
        requestId,
        cacheHit: true,
        cacheAgeSeconds: ageSeconds,
        endpointUrl: url,
        dataMode,
      },
    };
  }

  // Live fetch — up to 3 attempts, 8s timeout each
  let lastError: unknown;
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      clearTimeout(timeout);
      lastStatus = response.status;
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`MLB Stats API ${response.status}: ${text.slice(0, 200)}`);
      }
      const payload = (await response.json()) as T;
      const now = new Date().toISOString();
      inMemory.set(key, { payload, expiresAtMs: Date.now() + ttlSeconds * 1_000, updatedAt: now });
      await storePersistentCache(options.endpoint, options.params, payload, requestId, ttlSeconds, options.cacheBust);
      return {
        data: payload,
        meta: {
          sourceUsed: "mlb",
          updatedAt: now,
          requestId,
          endpointUrl: url,
          upstreamStatus: response.status,
          dataMode,
        },
      };
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
    }
  }

  // DB persistent cache fallback when all live attempts fail
  const cached = await readPersistentCache<T>(options.endpoint, options.params, options.cacheBust);
  if (cached) {
    return {
      data: cached.payload,
      meta: {
        sourceUsed: "cache",
        updatedAt: new Date(Date.now() - cached.ageSeconds * 1_000).toISOString(),
        warning: "Using cached MLB data because the live API is currently unavailable.",
        requestId,
        cacheHit: true,
        cacheAgeSeconds: Math.max(0, cached.ageSeconds),
        endpointUrl: url,
        upstreamStatus: lastStatus,
        upstreamMessage: String(lastError),
        dataMode,
      },
    };
  }

  throw new Error(`MLB Stats API fetch failed with no cache fallback: ${String(lastError)}`);
}
