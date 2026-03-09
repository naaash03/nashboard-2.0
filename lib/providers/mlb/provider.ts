import { randomUUID } from "node:crypto";
import { fetchMlbJson, getMlbDataMode } from "@/lib/providers/mlb/client";
import { MLB_TEAM_OPTIONS, resolveMlbTeam } from "@/lib/providers/mlb/teamMap";
import type { Meta, Mode } from "@/lib/providers/types";

type ModeArg = "auto" | "live" | "fixture";
type CacheBustArg = string | number | null | undefined;

export type MlbNextGame = {
  date: string;
  opponent: string;
  homeAway: "home" | "away";
  gamePk?: number;
  probablePitcherName?: string;
  probablePitcherId?: string;
};

export type MlbNextGames = {
  teamKey: string;
  games: MlbNextGame[];
};

export type MlbArsenalPitch = {
  type: string;
  usagePct?: number;
  velocityMph?: number;
};

export type PitcherArsenal = {
  playerId: string;
  playerName?: string;
  pitches: MlbArsenalPitch[];
};

export type MlbScheduledProbableStarter = {
  playerId?: string;
  fullName?: string;
};

export type MlbScheduledTeam = {
  id?: number;
  key: string;
  name: string;
  probableStarter?: MlbScheduledProbableStarter;
};

export type MlbScheduledGame = {
  gamePk?: number;
  gameDate: string;
  status: "scheduled" | "live" | "final";
  detailedState?: string;
  venue?: string;
  awayTeam: MlbScheduledTeam;
  homeTeam: MlbScheduledTeam;
};

export interface MlbProvider {
  getNextSevenGames(teamKey: string, mode: Mode, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ data: MlbNextGames | null; meta: Meta }>;
  getPitcherArsenal(playerId: string, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ data: PitcherArsenal | null; meta: Meta }>;
}

type MlbScheduleGame = {
  gamePk?: number;
  gameDate?: string;
  status?: {
    abstractGameState?: string;
    detailedState?: string;
  };
  venue?: {
    name?: string;
  };
  teams?: {
    away?: {
      team?: { id?: number; name?: string };
      probablePitcher?: { id?: number; fullName?: string };
    };
    home?: {
      team?: { id?: number; name?: string };
      probablePitcher?: { id?: number; fullName?: string };
    };
  };
};

type MlbScheduleResponse = {
  dates?: Array<{
    date?: string;
    games?: MlbScheduleGame[];
  }>;
};

type MlbPitchArsenalResponse = {
  people?: Array<{
    id?: number;
    fullName?: string;
    stats?: Array<{
      splits?: Array<{
        stat?: {
          percentage?: number;
          averageSpeed?: number;
          type?: {
            code?: string;
            description?: string;
          };
        };
      }>;
    }>;
  }>;
};

const TEAM_KEY_BY_ID = MLB_TEAM_OPTIONS.reduce<Record<number, string>>((acc, team) => {
  acc[team.id] = team.key;
  return acc;
}, {});

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(baseDate: Date, days: number): Date {
  const next = new Date(baseDate);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isUpcoming(gameDate?: string, abstractState?: string): boolean {
  if (!gameDate) return false;
  const parsed = new Date(gameDate).getTime();
  if (!Number.isFinite(parsed)) return false;
  if ((abstractState ?? "").toLowerCase() === "final") return false;
  return true;
}

function statusFromScheduleState(state?: string): "scheduled" | "live" | "final" {
  const normalized = (state ?? "").toLowerCase();
  if (normalized === "final") {
    return "final";
  }
  if (normalized === "live" || normalized === "inprogress") {
    return "live";
  }
  return "scheduled";
}

function teamKeyFromRaw(team?: { id?: number; name?: string }): string {
  if (team?.id && TEAM_KEY_BY_ID[team.id]) {
    return TEAM_KEY_BY_ID[team.id];
  }
  const name = (team?.name ?? "").trim();
  if (!name) {
    return "TBD";
  }
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 3).toUpperCase();
  }
  return parts.slice(-2).map((part) => (part[0] ?? "")).join("").toUpperCase();
}

function normalizeUpcomingScheduleGames(teamId: number, payload: MlbScheduleResponse): MlbScheduledGame[] {
  const rows: Array<{ gameDate: string; game: MlbScheduleGame }> = [];

  for (const dateBucket of payload.dates ?? []) {
    for (const game of dateBucket.games ?? []) {
      if (!isUpcoming(game.gameDate, game.status?.abstractGameState)) {
        continue;
      }
      if (!game.gameDate) {
        continue;
      }

      const homeTeamId = game.teams?.home?.team?.id;
      const awayTeamId = game.teams?.away?.team?.id;
      if (homeTeamId !== teamId && awayTeamId !== teamId) {
        continue;
      }

      rows.push({ gameDate: game.gameDate, game });
    }
  }

  rows.sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());

  return rows.map(({ gameDate, game }) => ({
    gamePk: game.gamePk,
    gameDate,
    status: statusFromScheduleState(game.status?.abstractGameState),
    detailedState: game.status?.detailedState,
    venue: game.venue?.name,
    awayTeam: {
      id: game.teams?.away?.team?.id,
      key: teamKeyFromRaw(game.teams?.away?.team),
      name: game.teams?.away?.team?.name ?? "TBD",
      probableStarter: {
        playerId: game.teams?.away?.probablePitcher?.id ? String(game.teams?.away?.probablePitcher?.id) : undefined,
        fullName: game.teams?.away?.probablePitcher?.fullName,
      },
    },
    homeTeam: {
      id: game.teams?.home?.team?.id,
      key: teamKeyFromRaw(game.teams?.home?.team),
      name: game.teams?.home?.team?.name ?? "TBD",
      probableStarter: {
        playerId: game.teams?.home?.probablePitcher?.id ? String(game.teams?.home?.probablePitcher?.id) : undefined,
        fullName: game.teams?.home?.probablePitcher?.fullName,
      },
    },
  }));
}

function mapScheduleToNextSevenGames(teamId: number, games: MlbScheduledGame[], mode: Mode): MlbNextGame[] {
  return games.slice(0, 7).map((game) => {
    const homeAway: "home" | "away" = game.homeTeam.id === teamId ? "home" : "away";
    const opponentTeam = homeAway === "home" ? game.awayTeam : game.homeTeam;
    const probableStarter = homeAway === "home" ? game.homeTeam.probableStarter : game.awayTeam.probableStarter;
    if (mode === "advanced") {
      return {
        date: game.gameDate,
        opponent: opponentTeam.name ?? opponentTeam.key ?? "TBD",
        homeAway,
        gamePk: game.gamePk,
        probablePitcherName: probableStarter?.fullName,
        probablePitcherId: probableStarter?.playerId,
      };
    }
    return {
      date: game.gameDate,
      opponent: opponentTeam.name ?? opponentTeam.key ?? "TBD",
      homeAway,
      probablePitcherName: probableStarter?.fullName,
      probablePitcherId: probableStarter?.playerId,
    };
  });
}

function toUsagePct(value?: number): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }
  const normalized = value <= 1 ? value * 100 : value;
  return Math.round(normalized * 10) / 10;
}

function toVelocity(value?: number): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }
  return Math.round(value * 10) / 10;
}

function fallbackMeta(sourceDataMode: ModeArg, warning: string): Meta {
  return {
    sourceUsed: sourceDataMode === "fixture" ? "fixture" : "mlb",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: sourceDataMode,
  };
}

export async function getMlbUpcomingScheduleWithProbables(
  teamKey: string,
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<{ data: { teamKey: string; teamId: number; games: MlbScheduledGame[] } | null; meta: Meta }> {
  const resolved = getMlbDataMode(dataMode);
  const team = resolveMlbTeam(teamKey);

  if (!team) {
    return {
      data: null,
      meta: fallbackMeta(resolved, `Unknown MLB team key: ${teamKey.toUpperCase()}`),
    };
  }

  const today = new Date();
  const startDate = isoDate(today);
  const endDate = isoDate(addDays(today, 14));

  const response = await fetchMlbJson<MlbScheduleResponse>({
    endpoint: "/schedule",
    params: {
      teamId: team.id,
      sportId: 1,
      startDate,
      endDate,
      hydrate: "probablePitcher",
    },
    fixtureFile: "next7_nym.json",
    ttlSeconds: 300,
    dataMode: resolved,
    cacheBust,
  });

  const games = normalizeUpcomingScheduleGames(team.id, response.data);
  const warning = games.length === 0 ? `No upcoming games found in the selected ${resolved} data window.` : response.meta.warning;
  return {
    data: {
      teamKey: team.key,
      teamId: team.id,
      games,
    },
    meta: {
      ...response.meta,
      warning,
    },
  };
}

export const mlbProvider: MlbProvider = {
  async getNextSevenGames(teamKey: string, mode: Mode, dataMode?: ModeArg, cacheBust?: CacheBustArg) {
    const schedule = await getMlbUpcomingScheduleWithProbables(teamKey, dataMode, cacheBust);
    const games = schedule.data ? mapScheduleToNextSevenGames(schedule.data.teamId, schedule.data.games, mode) : [];

    return {
      data: schedule.data ? { teamKey: schedule.data.teamKey, games } : null,
      meta: {
        ...schedule.meta,
      },
    };
  },

  async getPitcherArsenal(playerId: string, dataMode?: ModeArg, cacheBust?: CacheBustArg) {
    const resolved = getMlbDataMode(dataMode);
    const currentYear = new Date().getUTCFullYear();

    const response = await fetchMlbJson<MlbPitchArsenalResponse>({
      endpoint: `/people/${encodeURIComponent(playerId)}`,
      params: {
        hydrate: `stats(group=[pitching],type=[pitchArsenal],season=${currentYear})`,
      },
      fixtureFile: "pitcher_arsenal_sample.json",
      ttlSeconds: 300,
      dataMode: resolved,
      cacheBust,
    });

    const player = response.data.people?.[0];
    const splits = player?.stats?.flatMap((item) => item.splits ?? []) ?? [];

    const pitches: MlbArsenalPitch[] = [];
    for (const split of splits) {
      const pitchType = split.stat?.type?.description ?? split.stat?.type?.code;
      if (!pitchType) {
        continue;
      }

      const pitch: MlbArsenalPitch = { type: pitchType };
      const usagePct = toUsagePct(split.stat?.percentage);
      const velocityMph = toVelocity(split.stat?.averageSpeed);
      if (typeof usagePct === "number") {
        pitch.usagePct = usagePct;
      }
      if (typeof velocityMph === "number") {
        pitch.velocityMph = velocityMph;
      }
      pitches.push(pitch);
    }

    if (!player?.id || pitches.length === 0) {
      return {
        data: null,
        meta: {
          ...response.meta,
          warning: response.meta.warning ?? "Pitch arsenal not available from upstream for this player yet",
        },
      };
    }

    return {
      data: {
        playerId: String(player.id),
        playerName: player.fullName,
        pitches,
      },
      meta: response.meta,
    };
  },
};
