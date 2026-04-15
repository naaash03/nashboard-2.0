import { createHash, randomUUID } from "node:crypto";
import { getBallDontLieKey } from "@/lib/config/env";
import type { Meta } from "@/lib/providers/types";

type QueryPrimitive = string | number | boolean;
type QueryValue = QueryPrimitive | QueryPrimitive[] | undefined | null;

type FetchOptions = {
  endpoint: string;
  params?: Record<string, QueryValue>;
  ttlSeconds?: number;
  dataMode?: "auto" | "live" | "fixture";
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

const BALLDONTLIE_BASE = "https://api.balldontlie.io/v1";
const inMemory = new Map<string, InMemoryCacheEntry>();
const inFlight = new Map<string, Promise<FetchResult<unknown>>>();

function resolvedDataMode(override?: "auto" | "live" | "fixture"): "live" | "fixture" {
  if (override === "live" || override === "fixture") {
    return override;
  }

  if (override === "auto") {
    return (process.env.NASHBOARD_DATA_MODE ?? "live").toLowerCase() === "fixture" ? "fixture" : "live";
  }

  return (process.env.NASHBOARD_DATA_MODE ?? "live").toLowerCase() === "fixture" ? "fixture" : "live";
}

function stableParams(params: FetchOptions["params"]): string {
  const entries = Object.entries(params ?? {})
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]);
  return JSON.stringify(entries);
}

function keyFor(endpoint: string, params: FetchOptions["params"]): string {
  return `${endpoint}?${stableParams(params)}`;
}

function hashParams(params: FetchOptions["params"]): string {
  return createHash("sha256").update(stableParams(params)).digest("hex");
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
    if (endpoint.startsWith("/v1/") || endpoint.startsWith("/nba/")) {
      return `https://api.balldontlie.io${endpoint}`;
    }
    return `${BALLDONTLIE_BASE}${endpoint}`;
  }

  return `${BALLDONTLIE_BASE}/${endpoint}`;
}

function buildUrl(endpoint: string, params: FetchOptions["params"]): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, String(item));
      }
      continue;
    }

    search.append(key, String(value));
  }

  const upstreamBaseUrl = baseUrl(endpoint);
  const separator = upstreamBaseUrl.includes("?") ? "&" : "?";
  return `${upstreamBaseUrl}${search.size ? `${separator}${search}` : ""}`;
}

async function storePersistentCache<T>(
  endpoint: string,
  params: FetchOptions["params"],
  payload: T,
  requestId: string,
  ttlSeconds: number,
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
        provider: "balldontlie",
        endpoint,
        paramsHash: hashParams(params),
      },
    },
    update: {
      payload: payload as never,
      fetchedAt: now,
      expiresAt,
      sourceUsed: "ESPN" as never,
      requestId,
    },
    create: {
      provider: "balldontlie",
      endpoint,
      paramsHash: hashParams(params),
      payload: payload as never,
      fetchedAt: now,
      expiresAt,
      sourceUsed: "ESPN" as never,
      requestId,
    },
  });
}

async function readPersistentCache<T>(
  endpoint: string,
  params: FetchOptions["params"],
): Promise<{ payload: T; ageSeconds: number } | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const { prisma } = await import("@/lib/db/prisma");
  const item = await prisma.cachedResponse.findUnique({
    where: {
      provider_endpoint_paramsHash: {
        provider: "balldontlie",
        endpoint,
        paramsHash: hashParams(params),
      },
    },
  });
  if (!item) {
    return null;
  }

  return {
    payload: item.payload as T,
    ageSeconds: Math.max(0, Math.floor((Date.now() - item.fetchedAt.getTime()) / 1000)),
  };
}

function staleCacheWarning(status: number | undefined): string {
  if (status === 429) {
    return "Using last cached BALLDONTLIE response because the API rate limit was hit.";
  }
  if (status === 401 || status === 403) {
    return "Using last cached BALLDONTLIE response because the current API key was rejected upstream.";
  }
  return "Using last cached BALLDONTLIE response because the upstream request failed.";
}

function shouldRetry(status: number | undefined, attempt: number): boolean {
  if (attempt >= 2) {
    return false;
  }
  if (status === 401 || status === 403 || status === 429) {
    return false;
  }
  return true;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function getBallDontLieDataMode(override?: "auto" | "live" | "fixture"): "live" | "fixture" {
  return resolvedDataMode(override);
}

export function isBallDontLieConfigured(): boolean {
  return getBallDontLieKey().length > 0;
}

export async function fetchBallDontLieJson<T>(options: FetchOptions): Promise<FetchResult<T>> {
  const requestId = randomUUID();
  const ttlSeconds = options.ttlSeconds ?? 180;
  const dataMode = resolvedDataMode(options.dataMode);
  const cacheKey = keyFor(options.endpoint, options.params);
  const cacheBustToken = resolveCacheBustToken(options.cacheBust);
  const bypassCache = typeof cacheBustToken === "string";
  const endpointUrl = buildUrl(options.endpoint, options.params);

  if (dataMode === "fixture") {
    throw new Error(`BALLDONTLIE live fetch skipped because dataMode=fixture for ${options.endpoint}`);
  }

  const apiKey = getBallDontLieKey();
  if (!apiKey) {
    throw new Error("BALL_DONT_LIE_KEY is not configured.");
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
          dataMode: options.dataMode ?? "auto",
          dataModeEffective: "live",
        },
      };
    }

    const persisted = await readPersistentCache<T>(options.endpoint, options.params);
    if (persisted && persisted.ageSeconds <= ttlSeconds) {
      return {
        data: persisted.payload,
        meta: {
          sourceUsed: "cache",
          updatedAt: new Date(Date.now() - persisted.ageSeconds * 1000).toISOString(),
          requestId,
          endpointUrl,
          upstreamStatus: 200,
          cacheHit: true,
          cacheAgeSeconds: persisted.ageSeconds,
          dataMode: options.dataMode ?? "auto",
          dataModeEffective: "live",
        },
      };
    }
  }

  if (!bypassCache) {
    const existing = inFlight.get(cacheKey) as Promise<FetchResult<T>> | undefined;
    if (existing) {
      return existing;
    }
  }

  const execute = async (): Promise<FetchResult<T>> => {
    let lastError: unknown;
    let lastStatus: number | undefined;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);

      try {
        const response = await fetch(endpointUrl, {
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Authorization: apiKey,
            accept: "application/json",
          },
        });
        clearTimeout(timeout);
        lastStatus = response.status;

        if (!response.ok) {
          const text = (await response.text()).slice(0, 200);
          throw new Error(`BALLDONTLIE ${response.status}: ${text}`);
        }

        const payload = (await response.json()) as T;
        const updatedAt = new Date().toISOString();
        inMemory.set(cacheKey, {
          payload,
          expiresAtMs: Date.now() + ttlSeconds * 1000,
          updatedAt,
        });
        await storePersistentCache(options.endpoint, options.params, payload, requestId, ttlSeconds);

        return {
          data: payload,
          meta: {
            sourceUsed: "balldontlie",
            updatedAt,
            requestId,
            endpointUrl,
            upstreamStatus: response.status,
            cacheHit: false,
            warning: bypassCache ? "Cache bypass requested via cacheBust." : undefined,
            dataMode: options.dataMode ?? "auto",
            dataModeEffective: "live",
          },
        };
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        const statusMatch = String(error).match(/BALLDONTLIE\s+(\d{3})/i);
        lastStatus = statusMatch ? Number(statusMatch[1]) : lastStatus;
        if (!shouldRetry(lastStatus, attempt)) {
          break;
        }
        await sleep(250 * (attempt + 1));
      }
    }

    if (!bypassCache) {
      const mem = inMemory.get(cacheKey);
      if (mem) {
        const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(mem.updatedAt).getTime()) / 1000));
        return {
          data: mem.payload as T,
          meta: {
            sourceUsed: "cache",
            updatedAt: mem.updatedAt,
            requestId,
            endpointUrl,
            upstreamStatus: lastStatus,
            upstreamMessage: String(lastError),
            cacheHit: true,
            cacheAgeSeconds: ageSeconds,
            warning: staleCacheWarning(lastStatus),
            dataMode: options.dataMode ?? "auto",
            dataModeEffective: "live",
          },
        };
      }

      const persisted = await readPersistentCache<T>(options.endpoint, options.params);
      if (persisted) {
        return {
          data: persisted.payload,
          meta: {
            sourceUsed: "cache",
            updatedAt: new Date(Date.now() - persisted.ageSeconds * 1000).toISOString(),
            requestId,
            endpointUrl,
            upstreamStatus: lastStatus,
            upstreamMessage: String(lastError),
            cacheHit: true,
            cacheAgeSeconds: persisted.ageSeconds,
            warning: staleCacheWarning(lastStatus),
            dataMode: options.dataMode ?? "auto",
            dataModeEffective: "live",
          },
        };
      }
    }

    throw new Error(`BALLDONTLIE fetch failed with no cache fallback: ${lastStatus ?? "ERR"} ${String(lastError)}`);
  };

  if (bypassCache) {
    return execute();
  }

  const promise = execute().finally(() => {
    inFlight.delete(cacheKey);
  }) as Promise<FetchResult<unknown>>;
  inFlight.set(cacheKey, promise);
  return promise as Promise<FetchResult<T>>;
}
