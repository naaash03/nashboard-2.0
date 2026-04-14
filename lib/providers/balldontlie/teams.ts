import type { Meta } from "@/lib/providers/types";
import { fetchBallDontLieJson } from "./client";

type ModeArg = "auto" | "live" | "fixture";
type CacheBustArg = string | number | null | undefined;

export type BallDontLieTeam = {
  id: number;
  conference: string;
  division: string;
  city: string;
  name: string;
  full_name: string;
  abbreviation: string;
};

export type BallDontLieGame = {
  id: number;
  date: string;
  season: number;
  status: string;
  period: number;
  time: string;
  postseason: boolean;
  postponed: boolean;
  home_team_score: number;
  visitor_team_score: number;
  datetime: string;
  home_team: BallDontLieTeam;
  visitor_team: BallDontLieTeam;
};

type ListResponse<T> = {
  data: T[];
  meta?: {
    next_cursor?: number | null;
    per_page?: number;
  };
};

function normalizeKey(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function seasonWindow(season: number): { startDate: string; endDate: string } {
  return {
    startDate: `${season}-09-15`,
    endDate: `${season + 1}-07-15`,
  };
}

export function currentNbaSeason(now = new Date()): number {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return month >= 8 ? year : year - 1;
}

export async function getNbaTeams(
  dataMode: ModeArg = "auto",
  cacheBust?: CacheBustArg,
): Promise<{ data: BallDontLieTeam[]; meta: Meta }> {
  const response = await fetchBallDontLieJson<ListResponse<BallDontLieTeam>>({
    endpoint: "/v1/teams",
    ttlSeconds: 86_400,
    dataMode,
    cacheBust,
  });

  return {
    data: response.data.data ?? [],
    meta: response.meta,
  };
}

export async function findNbaTeamByKey(
  teamKey: string,
  dataMode: ModeArg = "auto",
  cacheBust?: CacheBustArg,
): Promise<{ data: BallDontLieTeam | null; meta: Meta }> {
  const response = await getNbaTeams(dataMode, cacheBust);
  const normalizedKey = normalizeKey(teamKey);
  const normalizedName = normalizeName(teamKey);

  const match = response.data.find((team) => {
    if (normalizeKey(team.abbreviation) === normalizedKey) {
      return true;
    }
    if (normalizeName(team.full_name) === normalizedName) {
      return true;
    }
    return normalizeName(`${team.city} ${team.name}`) === normalizedName;
  }) ?? null;

  return {
    data: match,
    meta: response.meta,
  };
}

export async function getNbaGames(args: {
  params?: Record<string, string | number | boolean | Array<string | number | boolean> | undefined | null>;
  dataMode?: ModeArg;
  cacheBust?: CacheBustArg;
  ttlSeconds?: number;
}): Promise<{ data: BallDontLieGame[]; meta: Meta }> {
  const response = await fetchBallDontLieJson<ListResponse<BallDontLieGame>>({
    endpoint: "/v1/games",
    params: {
      per_page: 100,
      ...(args.params ?? {}),
    },
    ttlSeconds: args.ttlSeconds ?? 180,
    dataMode: args.dataMode,
    cacheBust: args.cacheBust,
  });

  const games = [...(response.data.data ?? [])].sort((left, right) => {
    return new Date(left.datetime ?? left.date).getTime() - new Date(right.datetime ?? right.date).getTime();
  });

  return {
    data: games,
    meta: response.meta,
  };
}

export async function getNbaTeamSeasonGames(
  teamId: number,
  season = currentNbaSeason(),
  dataMode: ModeArg = "auto",
  cacheBust?: CacheBustArg,
): Promise<{ data: BallDontLieGame[]; meta: Meta }> {
  const { startDate, endDate } = seasonWindow(season);
  return getNbaGames({
    params: {
      "team_ids[]": [teamId],
      "seasons[]": [season],
      start_date: startDate,
      end_date: endDate,
    },
    dataMode,
    cacheBust,
    ttlSeconds: 300,
  });
}

export async function getNbaTeamScheduleWindow(
  teamId: number,
  startDate: string,
  endDate: string,
  dataMode: ModeArg = "auto",
  cacheBust?: CacheBustArg,
): Promise<{ data: BallDontLieGame[]; meta: Meta }> {
  return getNbaGames({
    params: {
      "team_ids[]": [teamId],
      start_date: startDate,
      end_date: endDate,
    },
    dataMode,
    cacheBust,
    ttlSeconds: 180,
  });
}
