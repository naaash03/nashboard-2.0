import { randomUUID } from "node:crypto";
import { fetchEspnJson, getDataMode } from "@/lib/providers/espn/client";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, SportKey } from "@/lib/types/players";
import type { TeamStatus, TeamStatusBatch } from "@/lib/types/teamStatus";

type ModeArg = "live" | "fixture";

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

const SPORT_ENDPOINTS: Record<SportKey, string> = {
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
};

const SPORT_FIXTURES: Record<SportKey, { file: string; subdir: string }> = {
  nfl: { file: "scoreboard_with_games.json", subdir: "nfl" },
  mlb: { file: "mlb_scoreboard_sample.json", subdir: "scoreboard" },
  nba: { file: "nba_scoreboard_sample.json", subdir: "scoreboard" },
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

async function fetchScoreboard(sport: SportKey, dataMode: ModeArg): Promise<{ payload: ScoreboardPayload; meta: Meta }> {
  const fixture = SPORT_FIXTURES[sport];
  const response = await fetchEspnJson<ScoreboardPayload>({
    endpoint: SPORT_ENDPOINTS[sport],
    fixtureFile: fixture.file,
    fixtureSubdir: fixture.subdir,
    ttlSeconds: 45,
    dataMode,
  });

  return {
    payload: response.data,
    meta: response.meta,
  };
}

export async function getTeamStatus(
  sportInput: SportKey,
  teamAbbrevOrKey: string,
  dataMode?: ModeArg,
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
    const fetched = await fetchScoreboard(sport, mode);
    return {
      data: findStatusForTeam(sport, teamKey, fetched.payload),
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
    const fetched = await fetchScoreboard(sport, mode);
    const statuses = normalizedKeys.map((key) => findStatusForTeam(sport, key, fetched.payload));
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
