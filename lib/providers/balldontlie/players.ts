import type { Meta } from "@/lib/providers/types";
import type { BallDontLieTeam } from "./teams";
import { currentNbaSeason } from "./teams";
import { fetchBallDontLieJson } from "./client";

type ModeArg = "auto" | "live" | "fixture";
type CacheBustArg = string | number | null | undefined;

export type BallDontLiePlayer = {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height?: string;
  weight?: string;
  jersey_number?: string;
  college?: string;
  country?: string;
  draft_year?: number;
  draft_round?: number;
  draft_number?: number;
  team?: BallDontLieTeam;
  team_id?: number;
};

export type BallDontLiePlayerStat = {
  id: number;
  min: string;
  fgm: number;
  fga: number;
  fg_pct: number;
  fg3m: number;
  fg3a: number;
  fg3_pct: number;
  ftm: number;
  fta: number;
  ft_pct: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  pf: number;
  pts: number;
  plus_minus: number;
  player?: BallDontLiePlayer;
  team?: BallDontLieTeam;
  game: {
    id: number;
    date: string;
    season: number;
    status: string;
    period: number;
    postseason: boolean;
    home_team_id: number;
    visitor_team_id: number;
    home_team_score: number;
    visitor_team_score: number;
  };
};

type ListResponse<T> = {
  data: T[];
  meta?: {
    next_cursor?: number | null;
    per_page?: number;
  };
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]|_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fullName(player: BallDontLiePlayer): string {
  return `${player.first_name} ${player.last_name}`.trim();
}

function playerSearchScore(query: string, player: BallDontLiePlayer, teamKey?: string): number {
  const normalizedQuery = normalizeName(query);
  const normalizedPlayer = normalizeName(fullName(player));
  let score = 0;

  if (normalizedPlayer === normalizedQuery) {
    score += 150;
  } else if (normalizedPlayer.startsWith(normalizedQuery)) {
    score += 100;
  } else if (normalizedPlayer.includes(normalizedQuery)) {
    score += 70;
  }

  if (teamKey && player.team?.abbreviation?.toUpperCase() === teamKey.toUpperCase()) {
    score += 35;
  }

  if (player.team?.abbreviation) {
    score += 10;
  }
  if (player.position) {
    score += 5;
  }

  return score;
}

export async function searchNbaPlayers(
  query: string,
  args?: {
    teamId?: number;
    dataMode?: ModeArg;
    cacheBust?: CacheBustArg;
    activeOnly?: boolean;
  },
): Promise<{ data: BallDontLiePlayer[]; meta: Meta }> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Player search query is required.");
  }

  const endpoint = args?.activeOnly ? "/v1/players/active" : "/v1/players";
  const response = await fetchBallDontLieJson<ListResponse<BallDontLiePlayer>>({
    endpoint,
    params: {
      search: trimmed,
      per_page: 25,
      "team_ids[]": args?.teamId ? [args.teamId] : undefined,
    },
    ttlSeconds: 300,
    dataMode: args?.dataMode,
    cacheBust: args?.cacheBust,
  });

  return {
    data: response.data.data ?? [],
    meta: response.meta,
  };
}

export async function findBestNbaPlayerMatch(
  query: string,
  args?: {
    teamKey?: string;
    teamId?: number;
    dataMode?: ModeArg;
    cacheBust?: CacheBustArg;
  },
): Promise<{ data: BallDontLiePlayer | null; meta: Meta }> {
  const response = await searchNbaPlayers(query, {
    activeOnly: true,
    teamId: args?.teamId,
    dataMode: args?.dataMode,
    cacheBust: args?.cacheBust,
  });

  const ranked = [...response.data].sort((left, right) => {
    return playerSearchScore(query, right, args?.teamKey) - playerSearchScore(query, left, args?.teamKey);
  });

  return {
    data: ranked[0] ?? null,
    meta: response.meta,
  };
}

export async function getNbaPlayer(
  playerId: number,
  dataMode: ModeArg = "auto",
  cacheBust?: CacheBustArg,
): Promise<{ data: BallDontLiePlayer | null; meta: Meta }> {
  const response = await fetchBallDontLieJson<{ data: BallDontLiePlayer }>({
    endpoint: `/v1/players/${playerId}`,
    ttlSeconds: 600,
    dataMode,
    cacheBust,
  });

  return {
    data: response.data.data ?? null,
    meta: response.meta,
  };
}

export async function getNbaPlayerSeasonStats(
  playerId: number,
  args?: {
    season?: number;
    limit?: number;
    dataMode?: ModeArg;
    cacheBust?: CacheBustArg;
  },
): Promise<{ data: BallDontLiePlayerStat[]; meta: Meta }> {
  const season = args?.season ?? currentNbaSeason();
  const response = await fetchBallDontLieJson<ListResponse<BallDontLiePlayerStat>>({
    endpoint: "/v1/stats",
    params: {
      per_page: Math.min(100, Math.max(10, args?.limit ?? 100)),
      "player_ids[]": [playerId],
      "seasons[]": [season],
    },
    ttlSeconds: 180,
    dataMode: args?.dataMode,
    cacheBust: args?.cacheBust,
  });

  const stats = [...(response.data.data ?? [])].sort((left, right) => {
    return new Date(right.game.date).getTime() - new Date(left.game.date).getTime();
  });

  return {
    data: stats,
    meta: response.meta,
  };
}
