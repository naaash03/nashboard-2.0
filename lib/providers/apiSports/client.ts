import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getApiSportsConfig, resolveApiSportsKey } from "@/lib/providers/apiSports/config";
import { resolveCacheBustToken, sha256, stableParams } from "@/lib/providers/fetchShared";
import type { Meta } from "@/lib/providers/types";
import type { SportKey } from "@/lib/types/players";

export type ApiSportsMode = "live" | "fixture";

type FetchOptions = {
  sport: SportKey;
  endpoint: string;
  params?: Record<string, string | number | undefined | null>;
  dataMode?: ApiSportsMode;
  fixtureFile?: string;
  ttlSeconds?: number;
  cacheBust?: string | number | null;
};

type CacheEntry = {
  payload: unknown;
  updatedAt: string;
  expiresAtMs: number;
};

type EndpointHealth = {
  endpoint: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;
  lastStatus?: number;
  cacheHit?: boolean;
  cacheAgeSeconds?: number;
  lastSourceUsed?: "apiSports" | "fixture" | "cache";
  lastUrl?: string;
};

const inMemory = new Map<string, CacheEntry>();
const endpointHealth = new Map<string, EndpointHealth>();

function cacheKeyFor(sport: SportKey, endpoint: string, params: FetchOptions["params"]): string {
  return `${sport}:${endpoint}:${stableParams(params)}`;
}

function hashParams(sport: SportKey, params: FetchOptions["params"]): string {
  return sha256(`${sport}:${stableParams(params)}`);
}

// The Prisma DataSource enum only models ESPN/FIXTURE/DEMO/CACHE, so — like the
// MLB client — apiSports live responses are stored under the generic "ESPN"
// marker while the provider column keeps them namespaced as "apiSports".
async function storePersistentCache<T>(endpoint: string, sport: SportKey, params: FetchOptions["params"], payload: T, requestId: string, ttlSeconds: number): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }
  const { prisma } = await import("@/lib/db/prisma");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const paramsHash = hashParams(sport, params);
  await prisma.cachedResponse.upsert({
    where: { provider_endpoint_paramsHash: { provider: "apiSports", endpoint, paramsHash } },
    update: { payload: payload as never, fetchedAt: now, expiresAt, sourceUsed: "ESPN" as never, requestId },
    create: { provider: "apiSports", endpoint, paramsHash, payload: payload as never, fetchedAt: now, expiresAt, sourceUsed: "ESPN" as never, requestId },
  });
}

async function readPersistentCache<T>(endpoint: string, sport: SportKey, params: FetchOptions["params"]): Promise<{ payload: T; ageSeconds: number } | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  const { prisma } = await import("@/lib/db/prisma");
  const item = await prisma.cachedResponse.findUnique({
    where: { provider_endpoint_paramsHash: { provider: "apiSports", endpoint, paramsHash: hashParams(sport, params) } },
  });
  if (!item) {
    return null;
  }
  const ageSeconds = Math.max(0, Math.floor((Date.now() - item.fetchedAt.getTime()) / 1000));
  return { payload: item.payload as T, ageSeconds };
}

function trackSuccess(
  endpoint: string,
  sourceUsed: "apiSports" | "fixture" | "cache",
  url: string,
  status: number,
  cacheHit: boolean,
  cacheAgeSeconds?: number,
): void {
  const current = endpointHealth.get(endpoint) ?? { endpoint };
  endpointHealth.set(endpoint, {
    ...current,
    endpoint,
    lastSuccessAt: new Date().toISOString(),
    lastStatus: status,
    cacheHit,
    cacheAgeSeconds,
    lastSourceUsed: sourceUsed,
    lastUrl: url,
  });
}

function trackError(endpoint: string, url: string, status: number | undefined, message: string): void {
  const current = endpointHealth.get(endpoint) ?? { endpoint };
  endpointHealth.set(endpoint, {
    ...current,
    endpoint,
    lastErrorAt: new Date().toISOString(),
    lastErrorMessage: message,
    lastStatus: status,
    lastUrl: url,
  });
}

async function loadFixture<T>(sport: SportKey, fixtureFile: string): Promise<T> {
  const filePath = path.join(process.cwd(), "tests", "fixtures", "apiSports", sport, fixtureFile);
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content.replace(/^\uFEFF/, "")) as T;
}

function buildUrl(baseUrl: string, endpoint: string, params: FetchOptions["params"]): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }

  const trimmed = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(trimmed, normalizedBase);
  if (search.size > 0) {
    url.search = search.toString();
  }
  return url.toString();
}

export async function fetchApiSportsJson<T>(options: FetchOptions): Promise<{ data: T; meta: Meta }> {
  const mode = options.dataMode ?? "live";
  const requestId = randomUUID();
  const cacheBustToken = resolveCacheBustToken(options.cacheBust);
  const bypassCache = typeof cacheBustToken === "string";
  const ttlSeconds = options.ttlSeconds ?? 120;
  const key = cacheKeyFor(options.sport, options.endpoint, options.params);

  const config = getApiSportsConfig(options.sport);
  const baseUrl = config.baseUrl;
  const url = baseUrl ? buildUrl(baseUrl, options.endpoint, options.params) : options.endpoint;

  if (mode === "fixture") {
    if (!options.fixtureFile) {
      throw new Error(`Fixture file missing for API-Sports endpoint ${options.endpoint}`);
    }
    const payload = await loadFixture<T>(options.sport, options.fixtureFile);
    trackSuccess(options.endpoint, "fixture", url, 200, false, 0);
    return {
      data: payload,
      meta: {
        sourceUsed: "fixture",
        updatedAt: new Date().toISOString(),
        requestId,
        endpointUrl: url,
        upstreamStatus: 200,
        cacheHit: false,
        dataMode: mode,
        dataModeEffective: mode,
      },
    };
  }

  if (!bypassCache) {
    const cached = inMemory.get(key);
    if (cached && cached.expiresAtMs > Date.now()) {
      const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(cached.updatedAt).getTime()) / 1000));
      trackSuccess(options.endpoint, "cache", url, 200, true, ageSeconds);
      return {
        data: cached.payload as T,
        meta: {
          sourceUsed: "cache",
          updatedAt: cached.updatedAt,
          requestId,
          endpointUrl: url,
          upstreamStatus: 200,
          cacheHit: true,
          cacheAgeSeconds: ageSeconds,
          dataMode: mode,
          dataModeEffective: mode,
        },
      };
    }
  }

  if (!baseUrl) {
    const message = `API-Sports base URL is not configured for ${options.sport.toUpperCase()}.`;
    trackError(options.endpoint, url, 0, message);
    throw new Error(message);
  }

  const apiKey = resolveApiSportsKey();
  if (!apiKey) {
    const message = "API-Sports key is not configured.";
    trackError(options.endpoint, url, 0, message);
    throw new Error(message);
  }

  let lastError: unknown;
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "x-rapidapi-key": apiKey,
          "x-apisports-key": apiKey,
          accept: "application/json",
        },
      });
      clearTimeout(timeout);
      lastStatus = response.status;

      if (!response.ok) {
        const text = (await response.text()).slice(0, 300);
        const message = `API-Sports ${response.status}: ${text}`;
        trackError(options.endpoint, url, response.status, message);
        throw new Error(message);
      }

      const payload = (await response.json()) as T;
      const updatedAt = new Date().toISOString();
      inMemory.set(key, {
        payload,
        updatedAt,
        expiresAtMs: Date.now() + ttlSeconds * 1000,
      });
      await storePersistentCache(options.endpoint, options.sport, options.params, payload, requestId, ttlSeconds);
      trackSuccess(options.endpoint, "apiSports", url, response.status, false, 0);
      return {
        data: payload,
        meta: {
          sourceUsed: "apiSports",
          updatedAt,
          requestId,
          endpointUrl: url,
          upstreamStatus: response.status,
          cacheHit: false,
          warning: bypassCache ? "Cache bypass requested via cacheBust." : undefined,
          dataMode: mode,
          dataModeEffective: mode,
        },
      };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
    }
  }

  // All live attempts failed — fall back to the last persisted response so a
  // transient API-Sports outage degrades gracefully instead of 500-ing.
  if (!bypassCache) {
    const cached = await readPersistentCache<T>(options.endpoint, options.sport, options.params);
    if (cached) {
      trackSuccess(options.endpoint, "cache", url, lastStatus ?? 200, true, cached.ageSeconds);
      return {
        data: cached.payload,
        meta: {
          sourceUsed: "cache",
          updatedAt: new Date(Date.now() - cached.ageSeconds * 1000).toISOString(),
          requestId,
          endpointUrl: url,
          upstreamStatus: lastStatus,
          upstreamMessage: String(lastError),
          warning: "Using last cached response because API-Sports is currently unavailable.",
          cacheHit: true,
          cacheAgeSeconds: cached.ageSeconds,
          dataMode: mode,
          dataModeEffective: mode,
        },
      };
    }
  }

  trackError(options.endpoint, url, lastStatus, String(lastError));
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function getApiSportsHealthSnapshot(): Record<string, EndpointHealth> {
  return Object.fromEntries(endpointHealth.entries());
}

