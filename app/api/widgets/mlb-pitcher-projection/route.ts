import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import {
  resolveMlbPitcherProjection,
  type ProjectionMode,
} from "@/lib/sports/resolvers/mlbPitcherProjection";

function normalizeMode(value: string | null): ProjectionMode {
  return (value ?? "").toUpperCase() === "ADVANCED" ? "ADVANCED" : "BEGINNER";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pitcherTeamKey = (searchParams.get("pitcherTeamKey") ?? "").trim().toUpperCase();
  const gameIdRaw = (searchParams.get("gameId") ?? "").trim();
  const gameId = gameIdRaw.length > 0 ? gameIdRaw : undefined;
  const mode = normalizeMode(searchParams.get("mode"));
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!pitcherTeamKey) {
    const requestId = randomUUID();
    return NextResponse.json({
      data: null,
      meta: {
        sourceUsed: "mlb",
        generatedAt: new Date().toISOString(),
        isFallback: true,
        requestId,
      },
      error: "pitcherTeamKey query param is required",
    }, { status: 400 });
  }

  const result = await resolveMlbPitcherProjection({
    pitcherTeamKey,
    gameId,
    mode,
    dataMode: resolvedDataMode,
  });

  const status = result.ok ? 200 : (result.error?.code === "MISSING_TEAM_KEY" ? 400 : 502);

  return NextResponse.json({
    data: result.data,
    meta: {
      sourceUsed: result.meta.sourceUsed,
      generatedAt: result.meta.generatedAt,
      isFallback: result.meta.isFallback,
      fallbackReason: result.meta.fallbackReason,
      requestId: result.meta.requestId,
      pitcherName: result.meta.pitcherName,
      venue: result.meta.venue,
      warning: result.meta.warning,
    },
    error: result.error?.message ?? null,
  }, { status });
}
