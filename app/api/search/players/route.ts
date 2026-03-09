import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { searchPlayers } from "@/lib/providers/espn/nfl";
import { normalizePlayerFromEspn } from "@/lib/sports/adapters";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import type { Meta } from "@/lib/providers/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = (searchParams.get("sport") ?? "NFL").toUpperCase();
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.max(1, Math.min(8, Number(searchParams.get("limit") ?? "8")));
  const { resolvedDataMode } = resolveDataModeFromRequest(req);
  const providerMode = resolvedDataMode === "auto" ? "live" : resolvedDataMode;
  const requestId = randomUUID();

  if (sport !== "NFL") {
    const meta: Meta = {
      sourceUsed: resolvedDataMode === "fixture" ? "fixture" : "espn",
      updatedAt: new Date().toISOString(),
      requestId,
      warning: "Only NFL search is enabled",
      dataMode: resolvedDataMode,
    };
    return NextResponse.json({
      results: [],
      warning: "Only NFL search is enabled",
      contract: toWidgetPayload({
        data: [],
        error: null,
        meta,
        primaryProvider: "apiSports",
      }),
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
    const meta: Meta = {
      sourceUsed: resolvedDataMode === "fixture" ? "fixture" : "espn",
      updatedAt: new Date().toISOString(),
      requestId,
      warning: "Type at least 3 characters to search.",
      dataMode: resolvedDataMode,
    };
    return NextResponse.json({
      results: [],
      meta,
      contract: toWidgetPayload({
        data: [],
        error: null,
        meta,
        primaryProvider: "apiSports",
      }),
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
    const meta = {
      ...result.meta,
      warning: result.results.length === 0 ? result.meta.warning ?? "No results from ESPN NFL athletes index for this query." : result.meta.warning,
    };
    return NextResponse.json({
      results: result.results,
      userFacingMessage: result.diagnostics.userFacingMessage ?? null,
      meta,
      contract: toWidgetPayload({
        data: result.results.map((row) => normalizePlayerFromEspn(row, "NFL")),
        error: null,
        meta,
        primaryProvider: "apiSports",
      }),
      diagnostics: result.diagnostics,
    });
  } catch (error) {
    const message = "Player index not available right now; try again in a minute.";
    const meta: Meta = {
      sourceUsed: resolvedDataMode === "fixture" ? "fixture" : "espn",
      updatedAt: new Date().toISOString(),
      requestId,
      warning: `Player search failed: ${String(error)}`,
      dataMode: resolvedDataMode,
    };
    return NextResponse.json({
      results: [],
      userFacingMessage: message,
      meta,
      contract: toWidgetPayload({
        data: [],
        error: message,
        meta,
        primaryProvider: "apiSports",
      }),
      diagnostics: {
        provider: "espn-athlete-index",
        cacheHit: false,
        indexAgeSeconds: 0,
        source: resolvedDataMode === "fixture" ? "disk" : "network",
        requestId,
        finalUrl: null,
        attemptedUrls: [],
        endpointAttempts: [],
        userFacingMessage: message,
      },
    });
  }
}
