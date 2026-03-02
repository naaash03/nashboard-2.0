import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { searchPlayers } from "@/lib/providers/espn/nfl";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = (searchParams.get("sport") ?? "NFL").toUpperCase();
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.max(1, Math.min(8, Number(searchParams.get("limit") ?? "8")));
  const { resolvedDataMode } = resolveDataModeFromRequest(req);
  const providerMode = resolvedDataMode === "auto" ? "live" : resolvedDataMode;
  const requestId = randomUUID();

  if (sport !== "NFL") {
    return NextResponse.json({
      results: [],
      warning: "Only NFL search is enabled",
      diagnostics: {
        provider: "espn-athlete-index",
        cacheHit: false,
        indexAgeSeconds: 0,
        source: resolvedDataMode === "fixture" ? "disk" : "network",
        requestId,
        finalUrl: null,
        attemptedUrls: [],
        endpointAttempts: [],
      },
    });
  }

  if (q.length < 3) {
    return NextResponse.json({
      results: [],
      meta: {
        sourceUsed: resolvedDataMode === "fixture" ? "fixture" : "espn",
        updatedAt: new Date().toISOString(),
        requestId,
        warning: "Type at least 3 characters to search.",
        dataMode: resolvedDataMode,
      },
      diagnostics: {
        provider: "espn-athlete-index",
        cacheHit: false,
        indexAgeSeconds: 0,
        source: resolvedDataMode === "fixture" ? "disk" : "network",
        requestId,
        finalUrl: null,
        attemptedUrls: [],
        endpointAttempts: [],
      },
    });
  }

  try {
    const result = await searchPlayers(q, limit, providerMode);
    return NextResponse.json({
      results: result.results,
      userFacingMessage: result.diagnostics.userFacingMessage ?? null,
      meta: {
        ...result.meta,
        warning: result.results.length === 0 ? result.meta.warning ?? "No results from ESPN NFL athletes index for this query." : result.meta.warning,
      },
      diagnostics: result.diagnostics,
    });
  } catch (error) {
    return NextResponse.json({
      results: [],
      userFacingMessage: "Player index not available right now; try again in a minute.",
      meta: {
        sourceUsed: resolvedDataMode === "fixture" ? "fixture" : "espn",
        updatedAt: new Date().toISOString(),
        requestId,
        warning: `Player search failed: ${String(error)}`,
        dataMode: resolvedDataMode,
      },
      diagnostics: {
        provider: "espn-athlete-index",
        cacheHit: false,
        indexAgeSeconds: 0,
        source: resolvedDataMode === "fixture" ? "disk" : "network",
        requestId,
        finalUrl: null,
        attemptedUrls: [],
        endpointAttempts: [],
        userFacingMessage: "Player index not available right now; try again in a minute.",
      },
    });
  }
}
