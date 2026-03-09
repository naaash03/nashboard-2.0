import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import type { Meta } from "@/lib/providers/types";
import { resolveCanonicalTeam } from "@/lib/sports/mappings/teamMap";
import {
  resolveMlbStartingPitcherMatchup,
  type MlbStartingPitcherMatchupData,
  type MlbStartingPitcherMatchupMeta,
} from "@/lib/sports/resolvers/mlbStartingPitcherMatchup";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";

type MatchupMode = "beginner" | "advanced";
type MatchupState = "success" | "partial" | "failed";

type ContractMatchup = {
  gameId: string;
  league: "MLB";
  startTime: string;
  status: string;
  venue?: string;
  awayTeamId: string;
  homeTeamId: string;
  pitchers: MlbStartingPitcherMatchupData["pitchers"];
  edge: MlbStartingPitcherMatchupData["edge"];
  state: MatchupState;
  selectableGames?: Array<{ gameId: string; label: string }>;
};

function normalizeMode(value: string | null): MatchupMode {
  return (value ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
}

function toSourceUsed(value: string, dataMode: "auto" | "live" | "fixture"): Meta["sourceUsed"] {
  if (value === "apiSports" || value === "espn" || value === "fixture" || value === "cache" || value === "demo" || value === "mlb") {
    return value;
  }
  return dataMode === "fixture" ? "fixture" : "apiSports";
}

function toContractMeta(meta: MlbStartingPitcherMatchupMeta, dataMode: "auto" | "live" | "fixture"): Meta {
  return {
    sourceUsed: toSourceUsed(meta.sourceUsed, dataMode),
    updatedAt: meta.updatedAt,
    requestId: meta.requestId || randomUUID(),
    warning: meta.warning,
    warnings: meta.warnings,
    notes: meta.notes,
    dataMode: meta.dataMode ?? dataMode,
    hydrationUsed: meta.fallbackUsed || undefined,
    attemptedSources: meta.fallbackUsed ? ["apiSports", "espn"] : undefined,
  };
}

function toContractData(data: MlbStartingPitcherMatchupData | null): ContractMatchup | null {
  if (!data) {
    return null;
  }
  const awayTeam = resolveCanonicalTeam({
    league: "MLB",
    abbreviation: data.game.awayTeam.key,
    name: data.game.awayTeam.name,
  });
  const homeTeam = resolveCanonicalTeam({
    league: "MLB",
    abbreviation: data.game.homeTeam.key,
    name: data.game.homeTeam.name,
  });

  return {
    gameId: data.game.gameId,
    league: "MLB",
    startTime: data.game.gameTime,
    status: data.game.status,
    venue: data.game.venue,
    awayTeamId: awayTeam.id,
    homeTeamId: homeTeam.id,
    pitchers: data.pitchers,
    edge: data.edge,
    state: data.state,
    selectableGames: data.selectableGames,
  };
}

function statusCode(errorCode: string | undefined, state: MatchupState): number {
  if (errorCode === "MISSING_TEAM_KEY") {
    return 400;
  }
  return state === "failed" ? 502 : 200;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = (searchParams.get("sport") ?? "mlb").trim().toLowerCase();
  const teamKey = (searchParams.get("teamKey") ?? "").trim().toUpperCase();
  const gameIdRaw = (searchParams.get("gameId") ?? "").trim();
  const gameId = gameIdRaw.length > 0 ? gameIdRaw : undefined;
  const mode = normalizeMode(searchParams.get("mode"));
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (sport !== "mlb") {
    const error = "sport must be mlb";
    const meta: Meta = {
      sourceUsed: resolvedDataMode === "fixture" ? "fixture" : "apiSports",
      updatedAt: new Date().toISOString(),
      requestId: randomUUID(),
      warning: error,
      dataMode: resolvedDataMode,
    };
    return NextResponse.json({
      data: null,
      meta,
      contract: toWidgetPayload({
        data: null,
        error,
        meta,
        primaryProvider: "apiSports",
      }),
      error,
    }, { status: 400 });
  }

  const result = await resolveMlbStartingPitcherMatchup({
    teamKey,
    gameId,
    mode,
    dataMode: resolvedDataMode,
    cacheBust,
  });

  const meta = toContractMeta(result.meta, resolvedDataMode);
  const contractData = toContractData(result.data);
  const error = result.error?.message ?? null;
  const state: MatchupState = result.data?.state ?? result.meta.state;
  const status = statusCode(result.error?.code, state);

  return NextResponse.json({
    data: result.data,
    meta: result.meta,
    contract: toWidgetPayload({
      data: contractData,
      error,
      meta,
      primaryProvider: "apiSports",
      notes: result.data?.notes,
    }),
    error,
  }, { status });
}
