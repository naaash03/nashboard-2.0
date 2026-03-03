import { randomUUID } from "node:crypto";
import { getApiSportsConfig } from "@/lib/providers/apiSports/config";
import { fetchApiSportsJson } from "@/lib/providers/apiSports/client";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, SportKey } from "@/lib/types/players";
import type { TeamAdvanced } from "@/lib/types/playerInsights";

type ModeArg = "live" | "fixture";
type ViewMode = "beginner" | "advanced";
type CacheBustArg = string | number | null | undefined;

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function fallbackMeta(mode: ModeArg, warning: string): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : "apiSports",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: mode,
    dataModeEffective: mode,
  };
}

function normalizeTeamKey(teamKey: string): string {
  return teamKey.trim().toUpperCase();
}

function mapTeamName(payload: unknown, teamKey: string): string {
  const typed = asObject(payload);
  const rows = Array.isArray(typed?.response) ? typed.response : [];
  for (const row of rows) {
    const typedRow = asObject(row);
    const team = asObject(typedRow?.team) ?? typedRow;
    const code = readString(team?.code) ?? readString(team?.abbreviation) ?? "";
    if (code.trim().toUpperCase() === teamKey) {
      return readString(team?.name) ?? teamKey;
    }
  }
  return teamKey;
}

function mapStandings(payload: unknown, teamKey: string): {
  record: TeamAdvanced["record"];
  standings: TeamAdvanced["standings"];
} {
  const typed = asObject(payload);
  const rows = Array.isArray(typed?.response) ? typed.response : [];
  for (const row of rows) {
    const typedRow = asObject(row);
    const team = asObject(typedRow?.team);
    const code = readString(team?.code) ?? readString(team?.abbreviation) ?? "";
    if (code.trim().toUpperCase() !== teamKey) {
      continue;
    }
    const all = asObject(typedRow?.all);
    const win = readNumber(all?.win);
    const lose = readNumber(all?.lose);
    const league = asObject(typedRow?.league);
    const standings = asObject(league?.standings) ?? asObject(typedRow?.position);
    return {
      record: typeof win === "number" && typeof lose === "number"
        ? {
            wins: win,
            losses: lose,
            pct: readString(all?.percentage),
            streak: readString(all?.streak),
          }
        : null,
      standings: {
        rank: readString(standings?.position) ?? readNumber(standings?.position)?.toString(),
        division: readString(standings?.group) ?? readString(standings?.division),
        conference: readString(standings?.conference),
      },
    };
  }

  return {
    record: null,
    standings: null,
  };
}

export async function getTeamsAdvanced(
  sport: SportKey,
  teamKeys: string[],
  _mode: ViewMode,
  dataMode: ModeArg = "live",
  cacheBust?: CacheBustArg,
): Promise<Envelope<{ sport: SportKey; teams: TeamAdvanced[] }>> {
  const normalized = Array.from(new Set(teamKeys.map((teamKey) => normalizeTeamKey(teamKey)).filter(Boolean)));
  if (normalized.length === 0) {
    return {
      data: null,
      meta: fallbackMeta(dataMode, "teamKeys is required"),
      error: {
        message: "teamKeys is required",
        code: "MISSING_TEAM_KEYS",
      },
    };
  }

  const config = getApiSportsConfig(sport);
  const teams: TeamAdvanced[] = [];
  const warnings: string[] = [];

  for (const teamKey of normalized) {
    let teamName = teamKey;
    let record: TeamAdvanced["record"] = null;
    let standings: TeamAdvanced["standings"] = null;

    try {
      const teamsResponse = await fetchApiSportsJson<unknown>({
        sport,
        endpoint: "teams",
        params: {
          search: teamKey,
          league: config.league,
          season: config.season,
        },
        dataMode,
        ttlSeconds: 240,
        cacheBust,
        fixtureFile: "teams_search_sample.json",
      });
      teamName = mapTeamName(teamsResponse.data, teamKey);
    } catch (error) {
      warnings.push(`Team lookup failed for ${teamKey}: ${String(error)}`);
    }

    try {
      const standingsResponse = await fetchApiSportsJson<unknown>({
        sport,
        endpoint: "standings",
        params: {
          team: teamKey,
          league: config.league,
          season: config.season,
        },
        dataMode,
        ttlSeconds: 240,
        cacheBust,
        fixtureFile: "team_advanced_sample.json",
      });
      const mapped = mapStandings(standingsResponse.data, teamKey);
      record = mapped.record;
      standings = mapped.standings;
    } catch (error) {
      warnings.push(`Standings lookup failed for ${teamKey}: ${String(error)}`);
    }

    teams.push({
      teamKey,
      teamName,
      status: {
        sport,
        teamKey,
        hasGameToday: false,
      },
      nextGame: null,
      record,
      standings,
      lastGame: null,
      metaNotes: warnings.length > 0 ? warnings : undefined,
    });
  }

  return {
    data: {
      sport,
      teams,
    },
    meta: {
      sourceUsed: dataMode === "fixture" ? "fixture" : "apiSports",
      updatedAt: new Date().toISOString(),
      requestId: randomUUID(),
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      dataMode,
      dataModeEffective: dataMode,
    },
  };
}
