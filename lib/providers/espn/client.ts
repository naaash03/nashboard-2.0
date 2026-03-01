import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DataSource, Meta } from "@/lib/providers/types";

type FetchOptions = {
  endpoint: string;
  params?: Record<string, string | number | undefined | null>;
  fixtureFile?: string;
  fixtureSubdir?: string;
  ttlSeconds?: number;
  dataMode?: "live" | "fixture";
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

type EndpointHealth = {
  endpoint: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;
  lastStatus?: number;
  cacheHit?: boolean;
  cacheAgeSeconds?: number;
  lastSourceUsed?: DataSource;
  lastUrl?: string;
};

const inMemory = new Map<string, InMemoryCacheEntry>();
const endpointHealth = new Map<string, EndpointHealth>();

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

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

function resolvedDataMode(override?: "live" | "fixture"): "live" | "fixture" {
  if (override) {
    return override;
  }
  return (process.env.NASHBOARD_DATA_MODE ?? "live").toLowerCase() === "fixture" ? "fixture" : "live";
}

function trackSuccess(endpoint: string, sourceUsed: DataSource, url?: string, status?: number, cacheHit?: boolean, cacheAgeSeconds?: number): void {
  const current = endpointHealth.get(endpoint) ?? { endpoint };
  endpointHealth.set(endpoint, {
    ...current,
    endpoint,
    lastSuccessAt: new Date().toISOString(),
    lastStatus: status,
    cacheHit,
    cacheAgeSeconds: typeof cacheAgeSeconds === "number" ? Math.max(0, cacheAgeSeconds) : undefined,
    lastSourceUsed: sourceUsed,
    lastUrl: url ?? current.lastUrl,
  });
}

function trackError(endpoint: string, message: string, status?: number, url?: string): void {
  const current = endpointHealth.get(endpoint) ?? { endpoint };
  endpointHealth.set(endpoint, {
    ...current,
    endpoint,
    lastErrorAt: new Date().toISOString(),
    lastErrorMessage: message,
    lastStatus: status,
    lastUrl: url ?? current.lastUrl,
  });
}

async function loadFixture<T>(fixtureFile: string, fixtureSubdir = "nfl"): Promise<T> {
  const filePath = path.join(process.cwd(), "tests", "fixtures", "espn", fixtureSubdir, fixtureFile);
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content.replace(/^\uFEFF/, "")) as T;
}

async function storePersistentCache<T>(provider: string, endpoint: string, params: FetchOptions["params"], payload: T, sourceUsed: DataSource, requestId: string, ttlSeconds: number, warning?: string): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const { prisma } = await import("@/lib/db/prisma");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  await prisma.cachedResponse.upsert({
    where: {
      provider_endpoint_paramsHash: {
        provider,
        endpoint,
        paramsHash: hashParams(params),
      },
    },
    update: {
      payload: payload as never,
      fetchedAt: now,
      expiresAt,
      sourceUsed: sourceUsed.toUpperCase() as never,
      requestId,
      warning,
    },
    create: {
      provider,
      endpoint,
      paramsHash: hashParams(params),
      payload: payload as never,
      fetchedAt: now,
      expiresAt,
      sourceUsed: sourceUsed.toUpperCase() as never,
      requestId,
      warning,
    },
  });
}

async function readPersistentCache<T>(provider: string, endpoint: string, params: FetchOptions["params"]): Promise<{ payload: T; ageSeconds: number } | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const { prisma } = await import("@/lib/db/prisma");
  const item = await prisma.cachedResponse.findUnique({
    where: {
      provider_endpoint_paramsHash: {
        provider,
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

export async function fetchEspnJson<T>(options: FetchOptions): Promise<FetchResult<T>> {
  const requestId = randomUUID();
  const ttlSeconds = options.ttlSeconds ?? 60;
  const cacheKey = keyFor(options.endpoint, options.params);
  const dataMode = resolvedDataMode(options.dataMode);

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(options.params ?? {})) {
    if (v !== undefined && v !== null) {
      search.set(k, String(v));
    }
  }

  const baseUrl = options.endpoint.startsWith("http") ? options.endpoint : `${ESPN_BASE}${options.endpoint}`;
  const separator = baseUrl.includes("?") ? "&" : "?";
  const url = `${baseUrl}${search.size ? `${separator}${search}` : ""}`;

  if (dataMode === "fixture") {
    if (!options.fixtureFile) {
      throw new Error(`Fixture file missing for endpoint ${options.endpoint}`);
    }
    const payload = await loadFixture<T>(options.fixtureFile, options.fixtureSubdir ?? "nfl");
    trackSuccess(options.endpoint, "fixture", url, 200, false, 0);
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

  const mem = inMemory.get(cacheKey);
  if (mem && mem.expiresAtMs > Date.now()) {
    const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(mem.updatedAt).getTime()) / 1000));
    trackSuccess(options.endpoint, "cache", url, 200, true, ageSeconds);
    return {
      data: mem.payload as T,
      meta: {
        sourceUsed: "cache",
        updatedAt: mem.updatedAt,
        requestId,
        cacheHit: true,
        cacheAgeSeconds: ageSeconds,
        endpointUrl: url,
        upstreamStatus: 200,
        dataMode,
      },
    };
  }

  let lastError: unknown;
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      clearTimeout(timeout);
      lastStatus = response.status;

      if (!response.ok) {
        const text = await response.text();
        trackError(options.endpoint, `ESPN ${response.status}: ${text.slice(0, 200)}`, response.status, url);
        throw new Error(`ESPN ${response.status}: ${text.slice(0, 200)}`);
      }

      const payload = (await response.json()) as T;
      inMemory.set(cacheKey, {
        payload,
        expiresAtMs: Date.now() + ttlSeconds * 1000,
        updatedAt: new Date().toISOString(),
      });

      await storePersistentCache("espn", options.endpoint, options.params, payload, "espn", requestId, ttlSeconds);
      trackSuccess(options.endpoint, "espn", url, response.status, false, 0);

      return {
        data: payload,
        meta: {
          sourceUsed: "espn",
          updatedAt: new Date().toISOString(),
          requestId,
          endpointUrl: url,
          upstreamStatus: response.status,
          dataMode,
        },
      };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (String(error).toLowerCase().includes("abort")) {
        trackError(options.endpoint, "timeout", 408, url);
      }
    }
  }

  const cached = await readPersistentCache<T>("espn", options.endpoint, options.params);
  if (cached) {
    trackSuccess(options.endpoint, "cache", url, lastStatus ?? 200, true, cached.ageSeconds);
    return {
      data: cached.payload,
      meta: {
        sourceUsed: "cache",
        updatedAt: new Date(Date.now() - cached.ageSeconds * 1000).toISOString(),
        warning: "Using last cached response because ESPN is currently unavailable.",
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

  trackError(options.endpoint, String(lastError), lastStatus, url);
  throw new Error(`ESPN fetch failed with no cache fallback: ${String(lastError)}`);
}

export function getDataMode(override?: "live" | "fixture"): "live" | "fixture" {
  return resolvedDataMode(override);
}

export function getEspnHealthSnapshot(): Record<string, EndpointHealth> {
  return Object.fromEntries(endpointHealth.entries());
}

