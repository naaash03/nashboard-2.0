import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { resolvePlayersSearch } from "@/lib/providers";
import { fetchApiSportsJson, getApiSportsHealthSnapshot } from "@/lib/providers/apiSports/client";
import { fetchBallDontLieJson, getBallDontLieHealthSnapshot, isBallDontLieConfigured } from "@/lib/providers/balldontlie/client";
import { fetchMlbJson, getMlbHealthSnapshot } from "@/lib/providers/mlb/client";
import { buildDateRange } from "@/lib/providers/scheduleWindow";
import { CACHE_TTL_SECONDS } from "@/lib/sports/cachePolicy";
import { canAutoUseFixtureFallback } from "@/lib/sports/utils/fixturePolicy";
import { fetchEspnJson, getDataMode, getEspnHealthSnapshot } from "@/lib/providers/espn/client";
import type { DataSource } from "@/lib/providers/types";

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

type ProviderStatus = "ok" | "error" | "timeout" | "blocked" | "empty";

function providerStatus(snapshot: Record<string, EndpointHealth>): ProviderStatus {
  const rows = Object.values(snapshot);
  const anySuccess = rows.some((item) => Boolean(item.lastSuccessAt));
  if (anySuccess) {
    return "ok";
  }

  const hasErrors = rows.some((item) => Boolean(item.lastErrorAt));
  if (!hasErrors) {
    return "empty";
  }

  const timeoutSeen = rows.some((item) => {
    const message = (item.lastErrorMessage ?? "").toLowerCase();
    return message.includes("timeout") || message.includes("abort");
  });
  if (timeoutSeen) {
    return "timeout";
  }

  const blockedSeen = rows.some((item) => {
    const status = item.lastStatus ?? 0;
    return status === 401 || status === 403 || status === 429;
  });
  if (blockedSeen) {
    return "blocked";
  }

  return "error";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const probe = searchParams.get("probe") === "1";
  const cacheBust = searchParams.get("cacheBust") ?? undefined;
  const modeResolution = resolveDataModeFromRequest(req);
  const requestedMode = modeResolution.resolvedDataMode;

  let effectiveDataMode: "live" | "fixture" = requestedMode === "fixture" ? "fixture" : "live";
  let effectiveSource: DataSource | "unknown" = requestedMode === "fixture" ? "fixture" : "apiSports";
  let hydrationOccurred = false;
  const hydrationNotes: string[] = [];

  if (probe) {
    const probeMode = requestedMode === "fixture" ? "fixture" : "live";

    try {
      await fetchApiSportsJson<unknown>({
        sport: "mlb",
        endpoint: "teams",
        params: { search: "Mets" },
        fixtureFile: "teams_search_sample.json",
        ttlSeconds: 30,
        dataMode: probeMode,
        cacheBust,
      });
    } catch {
      // diagnostics are recorded in provider snapshot
    }

    try {
      await fetchEspnJson<unknown>({
        endpoint: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
        params: { dates: new Date().toISOString().slice(0, 10).replaceAll("-", "") },
        fixtureFile: "mlb_scoreboard_sample.json",
        fixtureSubdir: "scoreboard",
        ttlSeconds: 30,
        dataMode: getDataMode(probeMode),
        cacheBust,
      });
    } catch {
      // diagnostics are recorded in provider snapshot
    }

    try {
      await fetchMlbJson<unknown>({
        endpoint: "sports",
        ttlSeconds: 30,
        dataMode: probeMode,
        cacheBust,
      });
    } catch {
      // diagnostics recorded in provider snapshot
    }

    if (isBallDontLieConfigured()) {
      try {
        await fetchBallDontLieJson<unknown>({
          endpoint: "teams",
          params: { per_page: 1 },
          ttlSeconds: 30,
          dataMode: probeMode === "fixture" ? "fixture" : "live",
          cacheBust,
        });
      } catch {
        // diagnostics recorded in provider snapshot
      }
    }

    try {
      const probeEnvelope = await resolvePlayersSearch("mlb", "Soto", 1, {
        dataMode: requestedMode,
        cacheBust,
      });
      effectiveSource = probeEnvelope.meta.sourceUsed;
      effectiveDataMode = probeEnvelope.meta.dataModeEffective
        ?? (probeEnvelope.meta.sourceUsed === "fixture" ? "fixture" : "live");
      hydrationOccurred = Boolean(probeEnvelope.meta.hydrationUsed);
      if (probeEnvelope.meta.notes?.length) {
        hydrationNotes.push(...probeEnvelope.meta.notes);
      }
      if (probeEnvelope.meta.warnings?.length) {
        hydrationNotes.push(...probeEnvelope.meta.warnings);
      }
      if (probeEnvelope.meta.warning) {
        hydrationNotes.push(probeEnvelope.meta.warning);
      }
    } catch {
      // keep defaults
    }
  }

  const espnSnapshot = getEspnHealthSnapshot();
  const apiSportsSnapshot = getApiSportsHealthSnapshot();
  const mlbSnapshot = getMlbHealthSnapshot();
  const ballDontLieSnapshot = getBallDontLieHealthSnapshot();
  const allSnapshotRows = [
    ...Object.values(espnSnapshot),
    ...Object.values(apiSportsSnapshot),
    ...Object.values(mlbSnapshot),
    ...Object.values(ballDontLieSnapshot),
  ];
  const scheduleWindow = buildDateRange();

  let persistedCacheAge: number | null = null;
  type PersistedEndpointSnapshot = {
    fetchedAt: string;
    ageSeconds: number;
    sourceUsed: string;
    warning?: string;
  };
  type PersistedEndpointByProvider = Record<string, Record<string, PersistedEndpointSnapshot>>;
  type CachedResponseRow = {
    provider: string;
    endpoint: string;
    fetchedAt: Date;
    sourceUsed: unknown;
    warning: string | null;
  };
  let persistedEndpoints: PersistedEndpointByProvider = {};

  if (process.env.DATABASE_URL) {
    const { prisma } = await import("@/lib/db/prisma");
    const latest = await prisma.cachedResponse.findMany({
      where: {
        provider: {
          in: ["espn", "apiSports", "mlb", "balldontlie"],
        },
      },
      orderBy: { fetchedAt: "desc" },
      take: 40,
    });

    const now = Date.now();
    persistedCacheAge = latest[0] ? Math.max(0, Math.floor((now - latest[0].fetchedAt.getTime()) / 1000)) : null;

    persistedEndpoints = (latest as CachedResponseRow[]).reduce((acc: PersistedEndpointByProvider, item: CachedResponseRow) => {
      if (!acc[item.provider]) {
        acc[item.provider] = {};
      }

      if (!acc[item.provider][item.endpoint]) {
        acc[item.provider][item.endpoint] = {
          fetchedAt: item.fetchedAt.toISOString(),
          ageSeconds: Math.max(0, Math.floor((now - item.fetchedAt.getTime()) / 1000)),
          sourceUsed: String(item.sourceUsed).toLowerCase(),
          warning: item.warning ?? undefined,
        };
      }
      return acc;
    }, {} as PersistedEndpointByProvider);
  }

  return NextResponse.json({
    resolvedDataMode: modeResolution.resolvedDataMode,
    resolutionSource: modeResolution.source,
    effectiveDataMode,
    effectiveSource,
    hydrationOccurred,
    hydrationNotes,
    requestedDataMode: requestedMode,
    queryDataMode: modeResolution.queryDataMode,
    preferenceDataMode: modeResolution.preferenceDataMode,
    fallbackDataMode: modeResolution.fallbackDataMode,
    status: {
      db: process.env.DATABASE_URL ? "configured" : "unconfigured",
      fixture: effectiveDataMode === "fixture" ? "enabled" : "disabled",
      apiSports: providerStatus(apiSportsSnapshot),
      espn: providerStatus(espnSnapshot),
      mlb: providerStatus(mlbSnapshot),
      balldontlie: isBallDontLieConfigured() ? providerStatus(ballDontLieSnapshot) : "unconfigured",
    },
    cache: {
      hit: allSnapshotRows.some((item) => item.cacheHit === true),
      miss: allSnapshotRows.some((item) => item.cacheHit === false),
      lastCacheAgeSeconds: persistedCacheAge,
    },
    schedule: {
      timezone: scheduleWindow.timeZone,
      today: scheduleWindow.today,
      windowStart: scheduleWindow.startDate,
      windowEnd: scheduleWindow.endDate,
      lookbackDays: scheduleWindow.lookbackDays,
      lookaheadDays: scheduleWindow.lookaheadDays,
      strategy: "windowed-range",
      note: "Today-only schedule probing was replaced with a buffered yesterday/today/next window.",
    },
    endpoints: {
      apiSports: apiSportsSnapshot,
      espn: espnSnapshot,
      mlb: mlbSnapshot,
      balldontlie: ballDontLieSnapshot,
    },
    lastFetchTimestamps: persistedEndpoints,
    architecture: {
      canonicalContracts: "enabled",
      fixturePolicy: {
        explicitModeRequired: true,
        autoFallbackAllowedInRuntime: canAutoUseFixtureFallback(),
      },
      cacheTtlSeconds: CACHE_TTL_SECONDS,
      providerPriority: ["mlb", "espn", "apiSports", "balldontlie", "fixture"],
    },
  });
}
