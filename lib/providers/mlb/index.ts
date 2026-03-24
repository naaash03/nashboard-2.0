import "server-only";
import { randomUUID } from "node:crypto";
import { fetchMlbJson, resolveDataMode } from "@/lib/providers/mlb/client";
import type { Meta } from "@/lib/providers/types";
import type { MlbFetchMeta } from "@/lib/providers/mlb/client";

// ---------------------------------------------------------------------------
// Current season
// ---------------------------------------------------------------------------

const MLB_SEASON = 2026;

// ---------------------------------------------------------------------------
// Team maps — abbreviation → MLB Stats API team ID (all 30 teams)
// ---------------------------------------------------------------------------

export const MLB_TEAM_IDS: Record<string, number> = {
  // AL East
  NYY: 147, BOS: 111, TOR: 141, BAL: 110, TB: 139,
  // AL Central
  CWS: 145, CLE: 114, DET: 116, KC: 118, MIN: 142,
  // AL West
  HOU: 117, LAA: 108, OAK: 133, SEA: 136, TEX: 140,
  // NL East
  ATL: 144, MIA: 146, NYM: 121, PHI: 143, WSH: 120,
  // NL Central
  CHC: 112, CIN: 113, MIL: 158, PIT: 134, STL: 138,
  // NL West
  ARI: 109, COL: 115, LAD: 119, SD: 135, SF: 137,
  // Common aliases
  WAS: 120,  // Washington (alternate)
  SFG: 137,  // San Francisco Giants (alternate)
  SDP: 135,  // San Diego Padres (alternate)
  LV:  133,  // Las Vegas / Oakland Athletics (transitional)
};

/** MLB Stats API team ID → canonical abbreviation */
export const MLB_TEAM_ABBREVS: Record<number, string> = {
  147: "NYY", 111: "BOS", 141: "TOR", 110: "BAL", 139: "TB",
  145: "CWS", 114: "CLE", 116: "DET", 118: "KC",  142: "MIN",
  117: "HOU", 108: "LAA", 133: "OAK", 136: "SEA", 140: "TEX",
  144: "ATL", 146: "MIA", 121: "NYM", 143: "PHI", 120: "WSH",
  112: "CHC", 113: "CIN", 158: "MIL", 134: "PIT", 138: "STL",
  109: "ARI", 115: "COL", 119: "LAD", 135: "SD",  137: "SF",
};

// ---------------------------------------------------------------------------
// Public exported types
// ---------------------------------------------------------------------------

export type MlbNextGames = {
  teamKey: string;
  teamName: string;
  games: Array<{
    gamePk: number;
    date: string;
    gameTime: string;
    opponent: string;
    opponentKey: string;
    homeAway: "home" | "away";
    status: string;
    venue?: string;
    seriesDescription?: string;
  }>;
};

export type PitcherArsenal = {
  playerId: string;
  playerName?: string;
  season: number;
  pitches: Array<{
    type: string;
    usagePct?: number;
    velocityMph?: number;
    spinRpm?: number;
  }>;
  seasonStats?: {
    era?: string;
    whip?: string;
    inningsPitched?: string;
    strikeOuts?: number;
    wins?: number;
    losses?: number;
    gamesStarted?: number;
  };
};

export type MlbSeriesGame = {
  gamePk: number;
  date: string;
  gameTime: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
};

export type MlbSeriesTracker = {
  teamKey: string;
  teamName: string;
  currentSeriesOrNextSeries: {
    opponent: string;
    opponentKey: string;
    homeAway: "home" | "away";
    games: MlbSeriesGame[];
    teamWins: number;
    teamLosses: number;
    seriesDescription: string;
  } | null;
};

export type MlbPitcherInfo = {
  playerId: string;
  fullName: string;
  throwsHand?: string;
  era?: string;
  whip?: string;
  inningsPitched?: string;
  strikeOuts?: number;
  wins?: number;
  losses?: number;
};

export type MlbPitcherMatchup = {
  game: {
    gameId: string;
    gamePk: number;
    gameTime: string;
    officialDate: string;
    status: string;
    homeTeam: { key: string; name: string; id: number };
    awayTeam: { key: string; name: string; id: number };
    venue?: string;
    seriesDescription?: string;
  };
  pitchers: {
    home: MlbPitcherInfo | null;
    away: MlbPitcherInfo | null;
  };
};

export type MlbScheduledGame = {
  gamePk: number;
  gameTime: string;
  status: string;
  homeTeam: { key: string; name: string; id: number; wins: number; losses: number };
  awayTeam: { key: string; name: string; id: number; wins: number; losses: number };
  venue?: string;
  seriesDescription?: string;
  gameNumber?: number;
};

export type MlbTodaysSchedule = {
  date: string;
  games: MlbScheduledGame[];
};

export type MlbPlayerSearchResult = {
  playerId: string;
  fullName: string;
  teamKey?: string;
  teamName?: string;
  position?: string;
  throwsHand?: string;
  batsHand?: string;
};

// ---------------------------------------------------------------------------
// MlbProvider interface
// ---------------------------------------------------------------------------

export interface MlbProvider {
  /** Next 7 scheduled games for a team */
  getNextSevenGames(
    teamKey: string,
    mode?: "beginner" | "advanced",
    dataMode?: "live" | "fixture",
    cacheBust?: string,
  ): Promise<{ data: MlbNextGames | null; meta: Meta }>;

  /** Pitch-type usage breakdown + season stats for a pitcher */
  getPitcherArsenal(
    playerId: string,
    dataMode?: "live" | "fixture",
    cacheBust?: string,
  ): Promise<{ data: PitcherArsenal | null; meta: Meta }>;

  /** Current or upcoming series context (last 4 days + next 10 days) */
  getSeriesTracker(
    teamKey: string,
    dataMode?: "live" | "fixture",
    cacheBust?: string,
  ): Promise<{ data: MlbSeriesTracker | null; meta: Meta }>;

  /** Probable starting pitchers for a specific game by gamePk */
  getStartingPitcherMatchup(
    gamePk: string | number,
    dataMode?: "live" | "fixture",
    cacheBust?: string,
  ): Promise<{ data: MlbPitcherMatchup | null; meta: Meta }>;

  /** Full league schedule for today */
  getTodaysSchedule(
    dataMode?: "live" | "fixture",
    cacheBust?: string,
  ): Promise<{ data: MlbTodaysSchedule | null; meta: Meta }>;

  /** Search MLB players by name (min 2 chars) */
  searchPlayers(
    query: string,
    limit?: number,
    dataMode?: "live" | "fixture",
    cacheBust?: string,
  ): Promise<{ data: MlbPlayerSearchResult[]; meta: Meta }>;
}

// ---------------------------------------------------------------------------
// Internal MLB Stats API response types
// ---------------------------------------------------------------------------

type MlbTeamRef = { id: number; name: string };
type MlbLeagueRecord = { wins: number; losses: number; pct: string };

type MlbProbablePitcherEntry = {
  id: number;
  fullName: string;
  pitchHand?: { code: string; description: string };
};

type MlbGameEntry = {
  gamePk: number;
  gameDate: string;
  officialDate: string;
  status: {
    abstractGameState: string;
    codedGameState: string;
    detailedState: string;
    statusCode: string;
    startTimeTBD: boolean;
  };
  teams: {
    away: {
      team: MlbTeamRef;
      leagueRecord: MlbLeagueRecord;
      score?: number;
      probablePitcher?: MlbProbablePitcherEntry;
    };
    home: {
      team: MlbTeamRef;
      leagueRecord: MlbLeagueRecord;
      score?: number;
      probablePitcher?: MlbProbablePitcherEntry;
    };
  };
  venue?: { id?: number; name: string };
  seriesDescription?: string;
  gamesInSeries?: number;
  seriesGameNumber?: number;
  scheduledInnings?: number;
};

type MlbScheduleResponse = {
  totalItems?: number;
  dates?: Array<{
    date: string;
    games: MlbGameEntry[];
  }>;
};

type MlbPitchArsenalResponse = {
  stats?: Array<{
    type?: { displayName?: string };
    group?: { displayName?: string };
    splits?: Array<{
      stat?: {
        pitchType?: { code?: string; description?: string };
        percentage?: number;
        averageSpeed?: number;
        averageSpin?: number;
        averageVerticalBreak?: number;
        averageHorizontalBreak?: number;
        totalPitches?: number;
      };
    }>;
  }>;
};

type MlbSeasonStatsResponse = {
  stats?: Array<{
    type?: { displayName?: string };
    group?: { displayName?: string };
    splits?: Array<{
      season?: string;
      stat?: {
        gamesPlayed?: number;
        gamesStarted?: number;
        wins?: number;
        losses?: number;
        era?: string;
        whip?: string;
        inningsPitched?: string;
        strikeOuts?: number;
        baseOnBalls?: number;
        homeRuns?: number;
        hits?: number;
        saves?: number;
      };
    }>;
  }>;
};

type MlbPlayerSearchResponse = {
  people?: Array<{
    id: number;
    fullName: string;
    firstName?: string;
    lastName?: string;
    currentTeam?: { id: number; name: string };
    primaryPosition?: { code?: string; name?: string; type?: string; abbreviation?: string };
    pitchHand?: { code?: string; description?: string };
    batSide?: { code?: string; description?: string };
    jerseyNumber?: string;
    active?: boolean;
  }>;
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nowISO(): string {
  return new Date().toISOString();
}

function abbrevFromName(name: string): string {
  const words = name.split(" ");
  return (words[words.length - 1] ?? name).slice(0, 3).toUpperCase();
}

function flattenSchedule(data: MlbScheduleResponse): MlbGameEntry[] {
  return (data.dates ?? [])
    .flatMap((d) => d.games ?? [])
    .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
}

function asMeta(fetchMeta: MlbFetchMeta): Meta {
  return {
    sourceUsed: fetchMeta.sourceUsed as Meta["sourceUsed"],
    updatedAt: fetchMeta.updatedAt,
    requestId: fetchMeta.requestId,
    cacheHit: fetchMeta.cacheHit,
    cacheAgeSeconds: fetchMeta.cacheAgeSeconds,
    endpointUrl: fetchMeta.endpointUrl,
    upstreamStatus: fetchMeta.upstreamStatus,
    upstreamMessage: fetchMeta.upstreamMessage,
    warning: fetchMeta.warning,
    dataMode: fetchMeta.dataMode,
  };
}

function errorMeta(context: string, error: unknown, dataMode?: "live" | "fixture"): Meta {
  return {
    sourceUsed: "demo",
    updatedAt: nowISO(),
    requestId: randomUUID(),
    warning: `${context} failed: ${String(error)}`,
    dataMode,
  };
}

function unknownTeamMeta(teamKey: string, dataMode?: "live" | "fixture"): Meta {
  return {
    sourceUsed: "demo",
    updatedAt: nowISO(),
    requestId: randomUUID(),
    warning: `Unknown MLB team key: "${teamKey}". See MLB_TEAM_IDS for valid keys.`,
    dataMode,
  };
}

function extractPitchArsenal(data: MlbPitchArsenalResponse): PitcherArsenal["pitches"] {
  const arsenalGroup = data.stats?.find(
    (s) =>
      s.type?.displayName?.toLowerCase().includes("pitcharsenal") ||
      s.type?.displayName?.toLowerCase().includes("pitch_arsenal"),
  );
  return (arsenalGroup?.splits ?? [])
    .filter((s) => s.stat?.pitchType?.code)
    .map((s) => ({
      type: s.stat?.pitchType?.description ?? s.stat?.pitchType?.code ?? "Unknown",
      usagePct:
        s.stat?.percentage !== undefined
          ? Math.round(s.stat.percentage * 100 * 10) / 10
          : undefined,
      velocityMph:
        s.stat?.averageSpeed !== undefined
          ? Math.round(s.stat.averageSpeed * 10) / 10
          : undefined,
      spinRpm: s.stat?.averageSpin !== undefined ? Math.round(s.stat.averageSpin) : undefined,
    }))
    .sort((a, b) => (b.usagePct ?? 0) - (a.usagePct ?? 0));
}

function extractSeasonStats(data: MlbSeasonStatsResponse): PitcherArsenal["seasonStats"] {
  const group = data.stats?.find((s) => s.group?.displayName?.toLowerCase() === "pitching");
  const split = group?.splits?.[0];
  if (!split?.stat) return undefined;
  const s = split.stat;
  return {
    era: s.era,
    whip: s.whip,
    inningsPitched: s.inningsPitched,
    strikeOuts: s.strikeOuts,
    wins: s.wins,
    losses: s.losses,
    gamesStarted: s.gamesStarted,
  };
}

/** Fetch season stats for a pitcher; used inside getStartingPitcherMatchup */
async function fetchPitcherStats(
  pitcherId: number,
  dataMode: "live" | "fixture",
): Promise<Pick<MlbPitcherInfo, "era" | "whip" | "inningsPitched" | "strikeOuts" | "wins" | "losses"> | undefined> {
  try {
    const result = await fetchMlbJson<MlbSeasonStatsResponse>({
      endpoint: `/people/${pitcherId}/stats`,
      params: { stats: "season", group: "pitching", season: MLB_SEASON },
      fixtureFile: "pitcher_season_stats.json",
      ttlSeconds: 3_600,
      dataMode,
    });
    return extractSeasonStats(result.data);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Concrete provider implementation
// ---------------------------------------------------------------------------

export const mlbProvider: MlbProvider = {

  async getNextSevenGames(teamKey, _mode, dataMode, cacheBust) {
    const dm = resolveDataMode(dataMode);
    const teamId = MLB_TEAM_IDS[teamKey];
    if (!teamId) return { data: null, meta: unknownTeamMeta(teamKey, dm) };

    const startDate = todayISO();
    const endDate = addDays(startDate, 7);

    try {
      const result = await fetchMlbJson<MlbScheduleResponse>({
        endpoint: "/schedule",
        params: { sportId: 1, teamId, startDate, endDate },
        fixtureFile: "team_next_7.json",
        ttlSeconds: 300,
        dataMode: dm,
        cacheBust,
      });

      const games = flattenSchedule(result.data);
      const firstGame = games[0];
      const teamName = firstGame
        ? firstGame.teams.home.team.id === teamId
          ? firstGame.teams.home.team.name
          : firstGame.teams.away.team.name
        : teamKey;

      return {
        data: {
          teamKey,
          teamName,
          games: games.map((game) => {
            const isHome = game.teams.home.team.id === teamId;
            const opponent = isHome ? game.teams.away.team : game.teams.home.team;
            const opponentKey = MLB_TEAM_ABBREVS[opponent.id] ?? abbrevFromName(opponent.name);
            return {
              gamePk: game.gamePk,
              date: game.officialDate,
              gameTime: game.gameDate,
              opponent: opponent.name,
              opponentKey,
              homeAway: (isHome ? "home" : "away") as "home" | "away",
              status: game.status.detailedState,
              venue: game.venue?.name,
              seriesDescription: game.seriesDescription,
            };
          }),
        },
        meta: asMeta(result.meta),
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getNextSevenGames", error, dm) };
    }
  },

  async getPitcherArsenal(playerId, dataMode, cacheBust) {
    const dm = resolveDataMode(dataMode);
    if (!playerId) {
      return {
        data: null,
        meta: {
          sourceUsed: "demo",
          updatedAt: nowISO(),
          requestId: randomUUID(),
          warning: "playerId is required",
          dataMode: dm,
        },
      };
    }

    try {
      const arsenalResult = await fetchMlbJson<MlbPitchArsenalResponse>({
        endpoint: `/people/${encodeURIComponent(playerId)}/stats`,
        params: { stats: "pitchArsenal", season: MLB_SEASON },
        fixtureFile: "pitcher_arsenal.json",
        ttlSeconds: 3_600,
        dataMode: dm,
        cacheBust,
      });

      const pitches = extractPitchArsenal(arsenalResult.data);

      let seasonStats: PitcherArsenal["seasonStats"];
      try {
        const statsResult = await fetchMlbJson<MlbSeasonStatsResponse>({
          endpoint: `/people/${encodeURIComponent(playerId)}/stats`,
          params: { stats: "season", group: "pitching", season: MLB_SEASON },
          fixtureFile: "pitcher_season_stats.json",
          ttlSeconds: 3_600,
          dataMode: dm,
          cacheBust,
        });
        seasonStats = extractSeasonStats(statsResult.data);
      } catch {
        // Season stats are supplemental — swallow errors
      }

      return {
        data: { playerId, season: MLB_SEASON, pitches, seasonStats },
        meta: asMeta(arsenalResult.meta),
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getPitcherArsenal", error, dm) };
    }
  },

  async getSeriesTracker(teamKey, dataMode, cacheBust) {
    const dm = resolveDataMode(dataMode);
    const teamId = MLB_TEAM_IDS[teamKey];
    if (!teamId) return { data: null, meta: unknownTeamMeta(teamKey, dm) };

    const today = todayISO();
    const startDate = addDays(today, -4);
    const endDate = addDays(today, 10);

    try {
      const result = await fetchMlbJson<MlbScheduleResponse>({
        endpoint: "/schedule",
        params: { sportId: 1, teamId, startDate, endDate },
        fixtureFile: "team_next_7.json",
        ttlSeconds: 300,
        dataMode: dm,
        cacheBust,
      });

      const allGames = flattenSchedule(result.data);
      const firstGame = allGames[0];
      const teamName = firstGame
        ? firstGame.teams.home.team.id === teamId
          ? firstGame.teams.home.team.name
          : firstGame.teams.away.team.name
        : teamKey;

      // Group consecutive games against the same opponent into series
      type SeriesGroup = {
        opponentId: number;
        opponentName: string;
        homeAway: "home" | "away";
        games: MlbGameEntry[];
      };
      const seriesGroups: SeriesGroup[] = [];
      for (const game of allGames) {
        const isHome = game.teams.home.team.id === teamId;
        const opponent = isHome ? game.teams.away.team : game.teams.home.team;
        const last = seriesGroups[seriesGroups.length - 1];
        if (last && last.opponentId === opponent.id) {
          last.games.push(game);
        } else {
          seriesGroups.push({
            opponentId: opponent.id,
            opponentName: opponent.name,
            homeAway: isHome ? "home" : "away",
            games: [game],
          });
        }
      }

      // Prefer the series that contains today, else the most recent
      const relevantSeries =
        seriesGroups.find((sg) => sg.games.some((g) => g.officialDate >= today)) ??
        seriesGroups[seriesGroups.length - 1] ??
        null;

      if (!relevantSeries) {
        return {
          data: { teamKey, teamName, currentSeriesOrNextSeries: null },
          meta: asMeta(result.meta),
        };
      }

      let teamWins = 0;
      let teamLosses = 0;
      for (const g of relevantSeries.games) {
        if (
          g.status.abstractGameState === "Final" &&
          g.teams.home.score !== undefined &&
          g.teams.away.score !== undefined
        ) {
          const isHome = g.teams.home.team.id === teamId;
          const teamScore = isHome ? g.teams.home.score : g.teams.away.score;
          const oppScore = isHome ? g.teams.away.score : g.teams.home.score;
          if (teamScore > oppScore) teamWins++;
          else teamLosses++;
        }
      }

      const opponentKey =
        MLB_TEAM_ABBREVS[relevantSeries.opponentId] ?? abbrevFromName(relevantSeries.opponentName);

      return {
        data: {
          teamKey,
          teamName,
          currentSeriesOrNextSeries: {
            opponent: relevantSeries.opponentName,
            opponentKey,
            homeAway: relevantSeries.homeAway,
            games: relevantSeries.games.map((g) => ({
              gamePk: g.gamePk,
              date: g.officialDate,
              gameTime: g.gameDate,
              status: g.status.detailedState,
              homeScore: g.teams.home.score,
              awayScore: g.teams.away.score,
            })),
            teamWins,
            teamLosses,
            seriesDescription: relevantSeries.games[0]?.seriesDescription ?? "Series",
          },
        },
        meta: asMeta(result.meta),
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getSeriesTracker", error, dm) };
    }
  },

  async getStartingPitcherMatchup(gamePk, dataMode, cacheBust) {
    const dm = resolveDataMode(dataMode);

    try {
      const result = await fetchMlbJson<MlbScheduleResponse>({
        endpoint: "/schedule",
        params: { sportId: 1, gamePk, hydrate: "probablePitcher" },
        fixtureFile: "game_with_pitchers.json",
        ttlSeconds: 300,
        dataMode: dm,
        cacheBust,
      });

      const games = flattenSchedule(result.data);
      const game = games[0];
      if (!game) {
        return {
          data: null,
          meta: { ...asMeta(result.meta), warning: `No game found for gamePk ${gamePk}` },
        };
      }

      const awayRef = game.teams.away;
      const homeRef = game.teams.home;
      const awayKey = MLB_TEAM_ABBREVS[awayRef.team.id] ?? abbrevFromName(awayRef.team.name);
      const homeKey = MLB_TEAM_ABBREVS[homeRef.team.id] ?? abbrevFromName(homeRef.team.name);

      const [awayStats, homeStats] = await Promise.all([
        awayRef.probablePitcher
          ? fetchPitcherStats(awayRef.probablePitcher.id, dm)
          : Promise.resolve(undefined),
        homeRef.probablePitcher
          ? fetchPitcherStats(homeRef.probablePitcher.id, dm)
          : Promise.resolve(undefined),
      ]);

      const buildPitcherInfo = (
        probable: MlbProbablePitcherEntry | undefined,
        stats: PitcherArsenal["seasonStats"],
      ): MlbPitcherInfo | null => {
        if (!probable) return null;
        return {
          playerId: String(probable.id),
          fullName: probable.fullName,
          throwsHand: probable.pitchHand?.code,
          ...stats,
        };
      };

      return {
        data: {
          game: {
            gameId: String(game.gamePk),
            gamePk: game.gamePk,
            gameTime: game.gameDate,
            officialDate: game.officialDate,
            status: game.status.detailedState,
            homeTeam: { key: homeKey, name: homeRef.team.name, id: homeRef.team.id },
            awayTeam: { key: awayKey, name: awayRef.team.name, id: awayRef.team.id },
            venue: game.venue?.name,
            seriesDescription: game.seriesDescription,
          },
          pitchers: {
            away: buildPitcherInfo(awayRef.probablePitcher, awayStats),
            home: buildPitcherInfo(homeRef.probablePitcher, homeStats),
          },
        },
        meta: asMeta(result.meta),
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getStartingPitcherMatchup", error, dm) };
    }
  },

  async getTodaysSchedule(dataMode, cacheBust) {
    const dm = resolveDataMode(dataMode);
    const today = todayISO();

    try {
      const result = await fetchMlbJson<MlbScheduleResponse>({
        endpoint: "/schedule",
        params: { sportId: 1, date: today },
        fixtureFile: "schedule_today.json",
        ttlSeconds: 120,
        dataMode: dm,
        cacheBust,
      });

      const games = flattenSchedule(result.data);
      return {
        data: {
          date: today,
          games: games.map((game) => {
            const awayKey =
              MLB_TEAM_ABBREVS[game.teams.away.team.id] ?? abbrevFromName(game.teams.away.team.name);
            const homeKey =
              MLB_TEAM_ABBREVS[game.teams.home.team.id] ?? abbrevFromName(game.teams.home.team.name);
            return {
              gamePk: game.gamePk,
              gameTime: game.gameDate,
              status: game.status.detailedState,
              homeTeam: {
                key: homeKey,
                name: game.teams.home.team.name,
                id: game.teams.home.team.id,
                wins: game.teams.home.leagueRecord.wins,
                losses: game.teams.home.leagueRecord.losses,
              },
              awayTeam: {
                key: awayKey,
                name: game.teams.away.team.name,
                id: game.teams.away.team.id,
                wins: game.teams.away.leagueRecord.wins,
                losses: game.teams.away.leagueRecord.losses,
              },
              venue: game.venue?.name,
              seriesDescription: game.seriesDescription,
              gameNumber: game.seriesGameNumber,
            };
          }),
        },
        meta: asMeta(result.meta),
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getTodaysSchedule", error, dm) };
    }
  },

  async searchPlayers(query, limit = 8, dataMode, cacheBust) {
    const dm = resolveDataMode(dataMode);
    const q = query.trim();

    if (q.length < 2) {
      return {
        data: [],
        meta: {
          sourceUsed: "demo",
          updatedAt: nowISO(),
          requestId: randomUUID(),
          warning: "Type at least 2 characters to search.",
          dataMode: dm,
        },
      };
    }

    try {
      const result = await fetchMlbJson<MlbPlayerSearchResponse>({
        endpoint: "/people/search",
        params: { names: q, sportId: 1 },
        fixtureFile: "player_search.json",
        ttlSeconds: 300,
        dataMode: dm,
        cacheBust,
      });

      const cap = Math.max(1, Math.min(20, limit));
      const people = (result.data.people ?? []).slice(0, cap);

      const results: MlbPlayerSearchResult[] = people.map((p) => ({
        playerId: String(p.id),
        fullName: p.fullName,
        teamKey: p.currentTeam
          ? (MLB_TEAM_ABBREVS[p.currentTeam.id] ?? abbrevFromName(p.currentTeam.name))
          : undefined,
        teamName: p.currentTeam?.name,
        position: p.primaryPosition?.abbreviation ?? p.primaryPosition?.name,
        throwsHand: p.pitchHand?.code,
        batsHand: p.batSide?.code,
      }));

      return {
        data: results,
        meta: {
          ...asMeta(result.meta),
          warning: results.length === 0 ? "No MLB players found matching that query." : undefined,
        },
      };
    } catch (error) {
      return { data: [], meta: errorMeta("searchPlayers", error, dm) };
    }
  },
};

// ---------------------------------------------------------------------------
// Legacy alias — keeps any existing import of mlbProviderStub working
// ---------------------------------------------------------------------------
/** @deprecated Use mlbProvider instead */
export const mlbProviderStub = mlbProvider;
