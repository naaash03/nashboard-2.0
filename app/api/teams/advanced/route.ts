import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getTeamsAdvanced } from "@/lib/providers/espn/teamAdvanced";
import { normalizeTeamStatusSport } from "@/lib/providers/espn/teamStatus";
import type { Meta } from "@/lib/providers/types";
import type { Envelope } from "@/lib/types/players";
import type { SportKey, TeamAdvanced } from "@/lib/types/playerInsights";

type TeamsAdvancedResponse = {
  sport: SportKey;
  teams: TeamAdvanced[];
};

function fallbackMeta(dataMode: "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: dataMode === "fixture" ? "fixture" : "espn",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode,
  };
}

function errorStatus(code?: string): number {
  if (code === "MISSING_TEAM_KEYS") {
    return 400;
  }
  return 502;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = normalizeTeamStatusSport(searchParams.get("sport"));
  const teamKeys = (searchParams.get("teamKeys") ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (teamKeys.length === 0) {
    const envelope: Envelope<TeamsAdvancedResponse> = {
      data: null,
      meta: fallbackMeta(resolvedDataMode, "teamKeys is required"),
      error: {
        message: "teamKeys is required",
        code: "MISSING_TEAM_KEYS",
      },
    };
    return NextResponse.json(envelope, { status: 400 });
  }

  try {
    const envelope = await getTeamsAdvanced(sport, teamKeys, mode, resolvedDataMode, cacheBust);
    if (envelope.error) {
      return NextResponse.json(envelope, { status: errorStatus(envelope.error.code) });
    }
    return NextResponse.json(envelope);
  } catch (error) {
    const message = `Unexpected error in teams advanced route: ${String(error)}`;
    const envelope: Envelope<TeamsAdvancedResponse> = {
      data: null,
      meta: fallbackMeta(resolvedDataMode, message),
      error: {
        message,
        code: "ROUTE_UNHANDLED",
      },
    };
    return NextResponse.json(envelope, { status: 500 });
  }
}
