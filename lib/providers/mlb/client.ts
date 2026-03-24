import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Meta } from "@/lib/providers/types";

type MlbSource = "mlb" | "fixture" | "cache" | "demo";

type FetchOptions = {
  endpoint: string;
  params?: Record<string, string | number | undefined | null>;
  fixtureFile?: string;
  ttlSeconds?: number;
  dataMode?: "live" | "fixture";
  cacheBust?: string | number | null;
};

type FetchResult<T> = {
  data: T;
  meta: Meta;
};

type InMemoryCacheEntry = {
  expiresAtMs: number;
  payload: unknown;
  updatedAt: string;
};

const MLB_BASE = "https://statsapi.mlb.com/api/v1";
const inMemory = new Map<string, InMemoryCacheEntry>();

function stableParams(params: FetchOptions["params"]): string {
  const entries = Object.entries(params ?? {})
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

function keyFor(endpoint: string, params: FetchOptions["params"]): string {
  return `${endpoint}?${stableParams(params)}`;
}

function hashParams(params: FetchOptions["params"]): string {
  return createHash("sha256").update(stableParams(params)).digest("hex");
}

function resolvedDataMode(override?: "auto" | "live" | "fixture"): "live" | "fixture" {
  if (override === "live" || override === "fixture") {
    return override;
  }
  if (override === "auto") {
    return (process.env.NASHBOARD_DATA_MODE ?? "live").toLowerCase() === "fixture" ? "fixture" : "live";
  }
  return (process.env.NASHBOARD_DATA_MODE ?? "live").toLowerCase() === "fixture" ? "fixture" : "live";
}

function resolveCacheBustToken(value: FetchOptions["cacheBust"]): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function baseUrl(endpoint: string): string {
  if (endpoint.startsWith("http")) {
    return endpoint;
  }

  if (endpoint.startsWith("/")) {
    return `${MLB_BASE}${endpoint}`;
  }

  return `${MLB_BASE}/${endpoint}`;
}

async function loadFixture<T>(fixtureFile: string): Promise<T> {
  const filePath = path.join(process.cwd(), "tests", "fixtures", "mlb", fixtureFile);
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content.replace(/^\uFEFF/, "")) as T;
}

function toPrismaSourceUsed(sourceUsed: MlbSource): "ESPN" | "FIXTURE" | "DEMO" | "CACHE" {
  if (sourceUsed === "fixture") return "FIXTURE";
  if (sourceUsed === "cache") return "CACHE";
  if (sourceUsed === "demo") return "DEMO";
  return "ESPN";
}

async function storePersistentCache<T>(
  endpoint: string,
  params: FetchOptions["params"],
  payload: T,
  sourceUsed: MlbSource,
  requestId: string,
  ttlSeconds: number,
  warning?: string,
): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const { prisma } = await import("@/lib/db/prisma");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  await prisma.cachedResponse.upsert({
    where: {
      provider_endpoint_paramsHash: {
        provider: "mlb",
        endpoint,
        paramsHash: hashParams(params),
      },
    },
    update: {
      payload: payload as never,
      fetchedAt: now,
      expiresAt,
      sourceUsed: toPrismaSourceUsed(sourceUsed),
      requestId,
      warning,
    },
    create: {
      provider: "mlb",
      endpoint,
      paramsHash: hashParams(params),
      payload: payload as never,
      fetchedAt: now,
      expiresAt,
      sourceUsed: toPrismaSourceUsed(sourceUsed),
      requestId,
      warning,
    },
  });
}

async function readPersistentCache<T>(endpoint: string, params: FetchOptions["params"]): Promise<{ payload: T; ageSeconds: number } | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const { prisma } = await import("@/lib/db/prisma");
  const item = await prisma.cachedResponse.findUnique({
    where: {
      provider_endpoint_paramsHash: {
        provider: "mlb",
        endpoint,
        paramsHash: hashParams(params),
      },
    },
  });

  if (!item) {
    return null;
  }

  const ageSeconds = Math.max(0, Math.floor((Date.now() - item.fetchedAt.getTime()) / 1000));
  return {
    payload: item.payload as T,
    ageSeconds,
  };
}

export async function fetchMlbJson<T>(options: FetchOptions): Promise<FetchResult<T>> {
  const requestId = randomUUID();
  const ttlSeconds = options.ttlSeconds ?? 300;
  const cacheKey = keyFor(options.endpoint, options.params);
  const dataMode = resolvedDataMode(options.dataMode);
  const cacheBustToken = resolveCacheBustToken(options.cacheBust);
  const bypassCache = typeof cacheBustToken === "string";

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }

  const upstreamBaseUrl = baseUrl(options.endpoint);
  const separator = upstreamBaseUrl.includes("?") ? "&" : "?";
  const endpointUrl = `${upstreamBaseUrl}${search.size ? `${separator}${search}` : ""}`;

  if (dataMode === "fixture") {
    if (!options.fixtureFile) {
      throw new Error(`Fixture file missing for endpoint ${options.endpoint}`);
    }

    const payload = await loadFixture<T>(options.fixtureFile);
    return {
      data: payload,
      meta: {
        sourceUsed: "fixture",
        updatedAt: new Date().toISOString(),
        requestId,
        endpointUrl,
        upstreamStatus: 200,
        dataMode,
      },
    };
  }

  if (!bypassCache) {
    const mem = inMemory.get(cacheKey);
    if (mem && mem.expiresAtMs > Date.now()) {
      const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(mem.updatedAt).getTime()) / 1000));
      return {
        data: mem.payload as T,
        meta: {
          sourceUsed: "cache",
          updatedAt: mem.updatedAt,
          requestId,
          endpointUrl,
          upstreamStatus: 200,
          cacheHit: true,
          cacheAgeSeconds: ageSeconds,
          dataMode,
        },
      };
    }
  }

  let lastError: unknown;
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch(endpointUrl, { cache: "no-store", signal: controller.signal });
      clearTimeout(timeout);
      lastStatus = response.status;

      if (!response.ok) {
        const text = (await response.text()).slice(0, 200);
        throw new Error(`MLB Stats API ${response.status}: ${text}`);
      }

      const payload = (await response.json()) as T;
      const updatedAt = new Date().toISOString();

      inMemory.set(cacheKey, {
        payload,
        expiresAtMs: Date.now() + ttlSeconds * 1000,
        updatedAt,
      });

      await storePersistentCache(options.endpoint, options.params, payload, "mlb", requestId, ttlSeconds);

      return {
        data: payload,
        meta: {
          sourceUsed: "mlb",
          updatedAt,
          requestId,
          endpointUrl,
          upstreamStatus: response.status,
          cacheHit: false,
          warning: bypassCache ? "Cache bypass requested via cacheBust." : undefined,
          dataMode,
        },
      };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
    }
  }

  if (!bypassCache) {
    const cached = await readPersistentCache<T>(options.endpoint, options.params);
    if (cached) {
      return {
        data: cached.payload,
        meta: {
          sourceUsed: "cache",
          updatedAt: new Date(Date.now() - cached.ageSeconds * 1000).toISOString(),
          requestId,
          endpointUrl,
          upstreamStatus: lastStatus,
          upstreamMessage: String(lastError),
          warning: "Using last cached response because MLB Stats API is currently unavailable.",
          cacheHit: true,
          cacheAgeSeconds: cached.ageSeconds,
          dataMode,
        },
      };
    }
  }

  throw new Error(`MLB fetch failed with no cache fallback: ${String(lastError)}`);
}

export function getMlbDataMode(override?: "auto" | "live" | "fixture"): "live" | "fixture" {
  return resolvedDataMode(override);
}
