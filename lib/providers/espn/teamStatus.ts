import { randomUUID } from "node:crypto";
import { getDataMode } from "@/lib/providers/espn/client";
import { getScoreboard } from "@/lib/providers/espn/playerDirectory";
import type { Envelope, SportKey } from "@/lib/types/players";
import type { TeamStatus, TeamStatusBatch } from "@/lib/types/teamStatus";

type ModeArg = "auto" | "live" | "fixture";
type CacheBustArg = string | number | null | undefined;

type ScoreboardPayload = {
  events?: Array<{
    id?: string;
    competitions?: Array<{
      status?: {
        type?: {
          state?: string;
          name?: string;
          detail?: string;
          shortDetail?: string;
        };
        displayClock?: string;
        period?: number;
      };
      competitors?: Array<{
        homeAway?: "home" | "away";
        score?: string | number;
        team?: {
          abbreviation?: string;
          displayName?: string;
        };
      }>;
    }>;
  }>;
};

function normalizeSportKey(input: string | null | undefined): SportKey {
  if (input === "mlb" || input === "nba" || input === "nfl") {
    return input;
  }
  return "nfl";
}

function toGameState(value: string | undefined): "pre" | "in" | "post" {
  const key = (value ?? "").toLowerCase();
  if (key === "pre") return "pre";
  if (key === "in") return "in";
  if (key === "post") return "post";

  if (key.includes("scheduled") || key.includes("pre")) return "pre";
  if (key.includes("in") || key.includes("progress")) return "in";
  return "post";
}

function toScore(value: string | number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function normalizeClock(
  sport: SportKey,
  status: NonNullable<NonNullable<ScoreboardPayload["events"]>[number]["competitions"]>[number]["status"] | undefined,
): string | undefined {
  if (!status) {
    return undefined;
  }

  const detail = status.type?.detail ?? status.type?.shortDetail;
  if (detail) {
    return detail;
  }

  if ((sport === "nfl" || sport === "nba") && status.displayClock) {
    const period = typeof status.period === "number" ? `Q${status.period}` : "";
    return `${period} ${status.displayClock}`.trim();
  }

  return status.displayClock;
}

function findStatusForTeam(sport: SportKey, teamKey: string, payload: ScoreboardPayload): TeamStatus {
  const normalizedTeamKey = teamKey.trim().toUpperCase();
  const fallback: TeamStatus = {
    sport,
    teamKey: normalizedTeamKey,
    hasGameToday: false,
  };

  for (const event of payload.events ?? []) {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors ?? [];
    const team = competitors.find((row) => row.team?.abbreviation?.toUpperCase() === normalizedTeamKey);

    if (!team) {
      continue;
    }

    const opponent = competitors.find((row) => row !== team);
    const state = toGameState(competition?.status?.type?.state ?? competition?.status?.type?.name);

    return {
      sport,
      teamKey: normalizedTeamKey,
      hasGameToday: true,
      state,
      opponent: opponent?.team?.abbreviation ?? opponent?.team?.displayName,
      homeAway: team.homeAway,
      displayClock: normalizeClock(sport, competition?.status),
      score: {
        team: toScore(team.score),
        opp: toScore(opponent?.score),
      },
      eventId: event.id,
    };
  }

  return fallback;
}

export async function getTeamStatus(
  sportInput: SportKey,
  teamAbbrevOrKey: string,
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<Envelope<TeamStatus>> {
  const sport = normalizeSportKey(sportInput);
  const teamKey = teamAbbrevOrKey.trim().toUpperCase();
  const mode = getDataMode(dataMode);

  if (!teamKey) {
    return {
      data: null,
      meta: {
        sourceUsed: mode === "fixture" ? "fixture" : "espn",
        updatedAt: new Date().toISOString(),
        requestId: randomUUID(),
        warning: "teamKey is required",
        dataMode: mode,
      },
      error: {
        message: "teamKey is required",
        code: "MISSING_TEAM_KEY",
      },
    };
  }

  try {
    const fetched = await getScoreboard({ sport, dataMode: mode, cacheBust });
    if (fetched.error || !fetched.data) {
      return {
        data: null,
        meta: fetched.meta,
        error: {
          message: fetched.error?.message ?? "Failed to fetch scoreboard data",
          code: fetched.error?.code ?? "UPSTREAM_ERROR",
        },
      };
    }

    return {
      data: findStatusForTeam(sport, teamKey, fetched.data as ScoreboardPayload),
      meta: fetched.meta,
    };
  } catch (error) {
    return {
      data: null,
      meta: {
        sourceUsed: mode === "fixture" ? "fixture" : "espn",
        updatedAt: new Date().toISOString(),
        requestId: randomUUID(),
        warning: String(error),
        dataMode: mode,
      },
      error: {
        message: `Failed to fetch team status: ${String(error)}`,
        code: "UPSTREAM_ERROR",
      },
    };
  }
}

export async function getTeamStatusBatch(
  sportInput: SportKey,
  teamKeys: string[],
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<Envelope<TeamStatusBatch>> {
  const sport = normalizeSportKey(sportInput);
  const normalizedKeys = teamKeys.map((key) => key.trim().toUpperCase()).filter(Boolean);
  const mode = getDataMode(dataMode);

  if (normalizedKeys.length === 0) {
    return {
      data: null,
      meta: {
        sourceUsed: mode === "fixture" ? "fixture" : "espn",
        updatedAt: new Date().toISOString(),
        requestId: randomUUID(),
        warning: "teamKeys is required",
        dataMode: mode,
      },
      error: {
        message: "teamKeys is required",
        code: "MISSING_TEAM_KEYS",
      },
    };
  }

  try {
    const fetched = await getScoreboard({ sport, dataMode: mode, cacheBust });
    if (fetched.error || !fetched.data) {
      return {
        data: null,
        meta: fetched.meta,
        error: {
          message: fetched.error?.message ?? "Failed to fetch scoreboard data",
          code: fetched.error?.code ?? "UPSTREAM_ERROR",
        },
      };
    }

    const statuses = normalizedKeys.map((key) => findStatusForTeam(sport, key, fetched.data as ScoreboardPayload));
    return {
      data: {
        sport,
        statuses,
      },
      meta: fetched.meta,
    };
  } catch (error) {
    return {
      data: null,
      meta: {
        sourceUsed: mode === "fixture" ? "fixture" : "espn",
        updatedAt: new Date().toISOString(),
        requestId: randomUUID(),
        warning: String(error),
        dataMode: mode,
      },
      error: {
        message: `Failed to fetch team status batch: ${String(error)}`,
        code: "UPSTREAM_ERROR",
      },
    };
  }
}

export function normalizeTeamStatusSport(input: string | null | undefined): SportKey {
  return normalizeSportKey(input);
}
