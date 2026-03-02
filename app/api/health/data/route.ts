import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { fetchEspnJson, getDataMode, getEspnHealthSnapshot } from "@/lib/providers/espn/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const probe = searchParams.get("probe") === "1";
  const cacheBust = searchParams.get("cacheBust");
  const modeResolution = resolveDataModeFromRequest(req);
  const mode = getDataMode(modeResolution.resolvedDataMode);

  if (probe) {
    try {
      await fetchEspnJson<{ events?: unknown[] }>({
        endpoint: "/scoreboard",
        params: { dates: new Date().toISOString().slice(0, 10).replaceAll("-", "") },
        fixtureFile: "scoreboard_with_games.json",
        ttlSeconds: 30,
        dataMode: mode,
        cacheBust,
      });
    } catch {
      // keep health snapshot diagnostics
    }
  }

  const snapshot = getEspnHealthSnapshot();
  const hasErrors = Object.values(snapshot).some((item) => Boolean(item.lastErrorAt));
  const anySuccess = Object.values(snapshot).some((item) => Boolean(item.lastSuccessAt));
  const timeoutSeen = Object.values(snapshot).some((item) => (item.lastErrorMessage ?? "").toLowerCase().includes("timeout"));
  const blockedSeen = Object.values(snapshot).some((item) => {
    const status = item.lastStatus ?? 0;
    return status === 401 || status === 403 || status === 429;
  });

  let persistedCacheAge: number | null = null;
  let persistedEndpoints: Record<string, { fetchedAt: string; ageSeconds: number; sourceUsed: string; warning?: string }> = {};

  if (process.env.DATABASE_URL) {
    const { prisma } = await import("@/lib/db/prisma");
    const latest = await prisma.cachedResponse.findMany({
      where: { provider: "espn" },
      orderBy: { fetchedAt: "desc" },
      take: 20,
    });

    const now = Date.now();
    persistedCacheAge = latest[0] ? Math.max(0, Math.floor((now - latest[0].fetchedAt.getTime()) / 1000)) : null;

    persistedEndpoints = latest.reduce<Record<string, { fetchedAt: string; ageSeconds: number; sourceUsed: string; warning?: string }>>((acc, item) => {
      if (!acc[item.endpoint]) {
        acc[item.endpoint] = {
          fetchedAt: item.fetchedAt.toISOString(),
          ageSeconds: Math.max(0, Math.floor((now - item.fetchedAt.getTime()) / 1000)),
          sourceUsed: String(item.sourceUsed).toLowerCase(),
          warning: item.warning ?? undefined,
        };
      }
      return acc;
    }, {});
  }

  return NextResponse.json({
    resolvedDataMode: modeResolution.resolvedDataMode,
    resolutionSource: modeResolution.source,
    queryDataMode: modeResolution.queryDataMode,
    devOverrideDataMode: modeResolution.devOverrideDataMode,
    preferenceDataMode: modeResolution.preferenceDataMode,
    fallbackDataMode: modeResolution.fallbackDataMode,
    isDevEnvironment: modeResolution.isDevEnvironment,
    providerMode: mode,
    status: {
      db: process.env.DATABASE_URL ? "configured" : "unconfigured",
      fixture: mode === "fixture" ? "enabled" : "disabled",
      espn: anySuccess ? "ok" : timeoutSeen ? "timeout" : blockedSeen ? "blocked" : hasErrors ? "error" : "empty",
    },
    cache: {
      hit: Object.values(snapshot).some((item) => Boolean(item.cacheHit)),
      lastCacheAgeSeconds: persistedCacheAge,
      miss: Object.values(snapshot).some((item) => item.cacheHit === false),
    },
    endpoints: snapshot,
    lastFetchTimestamps: persistedEndpoints,
  });
}
