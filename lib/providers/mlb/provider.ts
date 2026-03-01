import { randomUUID } from "node:crypto";
import { fetchMlbJson, getMlbDataMode } from "@/lib/providers/mlb/client";
import { MLB_TEAM_OPTIONS, resolveMlbTeam } from "@/lib/providers/mlb/teamMap";
import type { Meta, Mode } from "@/lib/providers/types";

type ModeArg = "live" | "fixture";

export type MlbNextGame = {
  date: string;
  opponent: string;
  homeAway: "home" | "away";
  gamePk?: number;
  probablePitcherName?: string;
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

export interface MlbProvider {
  getNextSevenGames(teamKey: string, mode: Mode, dataMode?: ModeArg): Promise<{ data: MlbNextGames | null; meta: Meta }>;
  getPitcherArsenal(playerId: string, dataMode?: ModeArg): Promise<{ data: PitcherArsenal | null; meta: Meta }>;
}

type MlbScheduleGame = {
  gamePk?: number;
  gameDate?: string;
  status?: {
    abstractGameState?: string;
    detailedState?: string;
  };
  teams?: {
    away?: {
      team?: { id?: number; name?: string };
      probablePitcher?: { fullName?: string };
    };
    home?: {
      team?: { id?: number; name?: string };
      probablePitcher?: { fullName?: string };
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

function normalizeUpcomingGames(teamId: number, payload: MlbScheduleResponse, mode: Mode): MlbNextGame[] {
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

  return rows.slice(0, 7).map(({ gameDate, game }) => {
    const homeTeamId = game.teams?.home?.team?.id;
    const homeAway: "home" | "away" = homeTeamId === teamId ? "home" : "away";
    const opponentTeam = homeAway === "home" ? game.teams?.away?.team : game.teams?.home?.team;
    const opponent = opponentTeam?.name ?? TEAM_KEY_BY_ID[opponentTeam?.id ?? -1] ?? "TBD";
    const probablePitcherName = homeAway === "home"
      ? game.teams?.home?.probablePitcher?.fullName
      : game.teams?.away?.probablePitcher?.fullName;

    if (mode === "advanced") {
      return {
        date: gameDate,
        opponent,
        homeAway,
        gamePk: game.gamePk,
        probablePitcherName,
      };
    }

    return {
      date: gameDate,
      opponent,
      homeAway,
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

export const mlbProvider: MlbProvider = {
  async getNextSevenGames(teamKey: string, mode: Mode, dataMode?: ModeArg) {
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
      },
      fixtureFile: "next7_nym.json",
      ttlSeconds: 300,
      dataMode: resolved,
    });

    const games = normalizeUpcomingGames(team.id, response.data, mode);
    const warning = games.length === 0 ? `No upcoming games found in the selected ${resolved} data window.` : response.meta.warning;

    return {
      data: {
        teamKey: team.key,
        games,
      },
      meta: {
        ...response.meta,
        warning,
      },
    };
  },

  async getPitcherArsenal(playerId: string, dataMode?: ModeArg) {
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
