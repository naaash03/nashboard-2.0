import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import type { Meta } from "@/lib/providers/types";
import { resolveCanonicalTeam } from "@/lib/sports/mappings/teamMap";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import {
  resolveMlbSeriesTracker,
  type MlbSeriesTrackerData,
  type MlbSeriesTrackerMeta,
} from "@/lib/sports/resolvers/mlbSeriesTracker";

type TrackerMode = "beginner" | "advanced";
type TrackerState = "success" | "partial" | "failed";

type ContractSeries = {
  seriesId: string;
  league: "MLB";
  teamId: string;
  opponentTeamId: string;
  groupingMode: MlbSeriesTrackerData["groupingMode"];
  state: TrackerState;
  statusLine: string;
  gameTimeline: Array<{
    gameId: string;
    startTime: string;
    status: string;
  }>;
};

function normalizeMode(value: string | null): TrackerMode {
  return (value ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
}

function toSourceUsed(value: string, dataMode: "auto" | "live" | "fixture"): Meta["sourceUsed"] {
  if (value === "apiSports" || value === "espn" || value === "fixture" || value === "cache" || value === "demo" || value === "mlb") {
    return value;
  }
  return dataMode === "fixture" ? "fixture" : "mlb";
}

function toContractMeta(meta: MlbSeriesTrackerMeta, dataMode: "auto" | "live" | "fixture"): Meta {
  return {
    sourceUsed: toSourceUsed(meta.sourceUsed, dataMode),
    updatedAt: meta.updatedAt,
    requestId: meta.requestId || randomUUID(),
    warning: meta.warning,
    warnings: meta.warnings,
    notes: meta.notes,
    dataMode: meta.dataMode ?? dataMode,
  };
}

function toContractData(data: MlbSeriesTrackerData | null): ContractSeries | null {
  if (!data) {
    return null;
  }

  const team = resolveCanonicalTeam({
    league: "MLB",
    abbreviation: data.team.key,
    name: data.team.name,
  });
  const opponent = resolveCanonicalTeam({
    league: "MLB",
    abbreviation: data.opponent.key,
    name: data.opponent.name,
  });

  return {
    seriesId: data.seriesId,
    league: "MLB",
    teamId: team.id,
    opponentTeamId: opponent.id,
    groupingMode: data.groupingMode,
    state: data.state,
    statusLine: data.statusLine,
    gameTimeline: data.gameTimeline.map((game) => ({
      gameId: game.gameId,
      startTime: game.dateTime,
      status: game.status,
    })),
  };
}

function statusCode(errorCode: string | undefined, state: TrackerState): number {
  if (errorCode === "MISSING_TEAM_KEY") {
    return 400;
  }
  return state === "failed" ? 502 : 200;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamKey = (searchParams.get("teamKey") ?? "NYM").trim().toUpperCase();
  const mode = normalizeMode(searchParams.get("mode"));
  const seriesIdRaw = (searchParams.get("seriesId") ?? "").trim();
  const seriesId = seriesIdRaw.length > 0 ? seriesIdRaw : undefined;
  const selectionPinnedRaw = (searchParams.get("selectionPinned") ?? "").trim().toLowerCase();
  const selectionPinned = selectionPinnedRaw === "1" || selectionPinnedRaw === "true" || selectionPinnedRaw === "yes";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  const result = await resolveMlbSeriesTracker({
    teamKey,
    mode,
    dataMode: resolvedDataMode,
    seriesId,
    selectionPinned,
    cacheBust,
  });

  const meta = toContractMeta(result.meta, resolvedDataMode);
  const contractData = toContractData(result.data);
  const error = result.error?.message ?? null;
  const state: TrackerState = result.data?.state ?? result.meta.state;
  const status = statusCode(result.error?.code, state);

  return NextResponse.json({
    data: result.data,
    meta: {
      ...result.meta,
      sourceUsed: meta.sourceUsed,
      updatedAt: meta.updatedAt,
      requestId: meta.requestId,
    },
    contract: toWidgetPayload({
      data: contractData,
      error,
      meta,
      primaryProvider: "mlb",
      notes: result.data?.notes,
    }),
    error,
  }, { status });
}
