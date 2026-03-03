import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { resolveTeamAdvanced } from "@/lib/providers";
import { normalizeTeamStatusSport } from "@/lib/providers/espn/teamStatus";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, TeamProviderRef } from "@/lib/types/players";
import type { SportKey, TeamAdvanced } from "@/lib/types/playerInsights";

type TeamsAdvancedResponse = {
  sport: SportKey;
  teams: TeamAdvanced[];
};

function fallbackMeta(dataMode: "auto" | "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: dataMode === "fixture" ? "fixture" : "apiSports",
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

function parseTeamRefs(raw: string | null): TeamProviderRef[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const refs: TeamProviderRef[] = [];
    for (const rawRow of parsed) {
      if (!rawRow || typeof rawRow !== "object") {
        continue;
      }
      const row = rawRow as Record<string, unknown>;
      const teamKey = typeof row.teamKey === "string" ? row.teamKey.trim().toUpperCase() : "";
      if (!teamKey) {
        continue;
      }
      const teamName = typeof row.teamName === "string" ? row.teamName.trim() : undefined;
      const apiSportsTeamId = typeof row.apiSportsTeamId === "string"
        ? row.apiSportsTeamId.trim()
        : (typeof row.apiSportsTeamId === "number" && Number.isFinite(row.apiSportsTeamId) ? String(row.apiSportsTeamId) : undefined);
      const espnTeamId = typeof row.espnTeamId === "string"
        ? row.espnTeamId.trim()
        : (typeof row.espnTeamId === "number" && Number.isFinite(row.espnTeamId) ? String(row.espnTeamId) : undefined);
      refs.push({
        teamKey,
        teamName: teamName && teamName.length > 0 ? teamName : undefined,
        apiSportsTeamId: apiSportsTeamId && apiSportsTeamId.length > 0 ? apiSportsTeamId : undefined,
        espnTeamId: espnTeamId && espnTeamId.length > 0 ? espnTeamId : undefined,
      });
    }
    return refs;
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = normalizeTeamStatusSport(searchParams.get("sport"));
  const teamKeysFromQuery = (searchParams.get("teamKeys") ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const teamRefs = parseTeamRefs(searchParams.get("teamRefs"));
  const teamKeys = Array.from(
    new Set([
      ...teamKeysFromQuery.map((key) => key.toUpperCase()),
      ...teamRefs.map((row) => row.teamKey.toUpperCase()),
    ]),
  );
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
    const envelope = await resolveTeamAdvanced(sport, teamKeys, mode, {
      dataMode: resolvedDataMode,
      cacheBust,
      mode,
      teamRefs,
    });
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
