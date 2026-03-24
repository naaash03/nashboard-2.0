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
// New types — Feature 1: Recent Results
// ---------------------------------------------------------------------------

export type MlbRecentResult = {
  gamePk: number;
  date: string;
  opponent: string;
  opponentKey: string;
  homeAway: "home" | "away";
  result: "W" | "L" | null;
  teamScore: number | null;
  opponentScore: number | null;
  status: string;
};

export type MlbRecentResults = {
  teamKey: string;
  teamName: string;
  results: MlbRecentResult[];
};

// ---------------------------------------------------------------------------
// New types — Feature 2: Season Stats Explorer
// ---------------------------------------------------------------------------

export type MlbPlayerYearStats = {
  season: number;
  gamesPlayed?: number;
  // Hitting
  avg?: string;
  hr?: number;
  rbi?: number;
  ops?: string;
  obp?: string;
  slg?: string;
  strikeOutsHitting?: number;
  baseOnBallsHitting?: number;
  stolenBases?: number;
  babip?: string;
  // Pitching
  wins?: number;
  losses?: number;
  era?: string;
  whip?: string;
  inningsPitched?: string;
  strikeOuts?: number;
  gamesStarted?: number;
};

export type MlbPlayerSeasonStats = {
  playerId: string;
  playerName?: string;
  position?: string;
  hitting: MlbPlayerYearStats[];
  pitching: MlbPlayerYearStats[];
};

export type MlbTeamSeasonStatsData = {
  teamKey: string;
  teamName: string;
  season: number;
  record: { wins: number; losses: number; pct: string; divisionRank?: number; gamesBack?: string };
  hitting: {
    avg?: string;
    obp?: string;
    slg?: string;
    ops?: string;
    runsScored?: number;
    hr?: number;
    strikeOuts?: number;
    baseOnBalls?: number;
  };
  pitching: {
    era?: string;
    whip?: string;
    strikeOuts?: number;
    runsAllowed?: number;
    saves?: number;
    blownSaves?: number;
  };
};

// ---------------------------------------------------------------------------
// New types — Feature 3: Platoon Advantage
// ---------------------------------------------------------------------------

export type MlbPitcherSplits = {
  vsLeft: { era?: string; whip?: string; avg?: string; ops?: string; sample?: number } | null;
  vsRight: { era?: string; whip?: string; avg?: string; ops?: string; sample?: number } | null;
};

export type MlbPlatoonAdvantage = {
  game: {
    gameId: string;
    gamePk: number;
    officialDate: string;
    homeTeam: { key: string; name: string };
    awayTeam: { key: string; name: string };
  };
  homePitcher: { playerId: string; fullName: string; throwsHand: string; splits: MlbPitcherSplits } | null;
  awayPitcher: { playerId: string; fullName: string; throwsHand: string; splits: MlbPitcherSplits } | null;
  advantage: "home" | "away" | "neutral";
  advantageScore: number;
  explanation: string;
};

// ---------------------------------------------------------------------------
// New types — Feature 4: Recent Form Rating
// ---------------------------------------------------------------------------

export type MlbFormPeriod = {
  days: number;
  wins: number;
  losses: number;
  runsScored: number;
  runsAllowed: number;
  runDiff: number;
  winPct: number;
};

export type MlbRecentForm = {
  teamKey: string;
  teamName: string;
  rating: "hot" | "warm" | "cool" | "cold";
  ratingScore: number;
  weightedWinPct: number;
  last7: MlbFormPeriod;
  last14: MlbFormPeriod;
  last30: MlbFormPeriod;
  explanation: string;
};

// ---------------------------------------------------------------------------
// New types — Feature 5: Bullpen Fatigue
// ---------------------------------------------------------------------------

export type MlbRelieverFatigue = {
  playerId: string;
  fullName: string;
  fatigue: "fatigued" | "tired" | "available" | "fresh" | "rested";
  daysRest: number;
  lastAppearance: string | null;
  lastAppearancePitches: number | null;
  recentAppearances: Array<{
    date: string;
    inningsPitched: string;
    numberOfPitches: number;
  }>;
};

export type MlbBullpenFatigue = {
  teamKey: string;
  teamName: string;
  relievers: MlbRelieverFatigue[];
  fetchedAt: string;
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

  /** Last N completed games for a team (most recent first) */
  getRecentResults(
    teamKey: string,
    limit?: number,
    dataMode?: "live" | "fixture",
    cacheBust?: string,
  ): Promise<{ data: MlbRecentResults | null; meta: Meta }>;

  /** Year-by-year hitting and pitching stats for a player */
  getPlayerSeasonStats(
    playerId: string,
    dataMode?: "live" | "fixture",
  ): Promise<{ data: MlbPlayerSeasonStats | null; meta: Meta }>;

  /** Team hitting, pitching, and standings for a given season */
  getTeamSeasonStats(
    teamKey: string,
    season: number,
    dataMode?: "live" | "fixture",
  ): Promise<{ data: MlbTeamSeasonStatsData | null; meta: Meta }>;

  /** Platoon advantage analysis for a team's next game */
  getPlatoonAdvantage(
    teamKey: string,
    dataMode?: "live" | "fixture",
    cacheBust?: string,
  ): Promise<{ data: MlbPlatoonAdvantage | null; meta: Meta }>;

  /** Recent form rating based on last 7/14/30 days of results */
  getRecentForm(
    teamKey: string,
    dataMode?: "live" | "fixture",
    cacheBust?: string,
  ): Promise<{ data: MlbRecentForm | null; meta: Meta }>;

  /** Bullpen fatigue tracker for all active pitchers on a team */
  getBullpenFatigue(
    teamKey: string,
    dataMode?: "live" | "fixture",
    cacheBust?: string,
  ): Promise<{ data: MlbBullpenFatigue | null; meta: Meta }>;
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

type MlbYearByYearStatsResponse = {
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
        rbi?: number;
        avg?: string;
        obp?: string;
        slg?: string;
        ops?: string;
        stolenBases?: number;
        babip?: string;
        atBats?: number;
        hits?: number;
        saves?: number;
      };
    }>;
  }>;
};

type MlbTeamStatsResponse = {
  stats?: Array<{
    type?: { displayName?: string };
    group?: { displayName?: string };
    splits?: Array<{
      team?: { id: number; name: string };
      stat?: {
        gamesPlayed?: number;
        avg?: string;
        obp?: string;
        slg?: string;
        ops?: string;
        runs?: number;
        homeRuns?: number;
        strikeOuts?: number;
        baseOnBalls?: number;
        era?: string;
        whip?: string;
        saves?: number;
        blownSaves?: number;
      };
    }>;
  }>;
};

type MlbStandingsResponse = {
  records?: Array<{
    standingsType?: string;
    division?: { id: number; name: string };
    teamRecords?: Array<{
      team?: { id: number; name: string };
      wins?: number;
      losses?: number;
      pct?: string;
      divisionRank?: string;
      gamesBack?: string;
    }>;
  }>;
};

type MlbPitcherSplitsResponse = {
  stats?: Array<{
    type?: { displayName?: string };
    group?: { displayName?: string };
    splits?: Array<{
      split?: { code?: string; description?: string };
      stat?: {
        era?: string;
        whip?: string;
        avg?: string;
        ops?: string;
        battersFaced?: number;
      };
    }>;
  }>;
};

type MlbRosterResponse = {
  roster?: Array<{
    person?: { id: number; fullName: string };
    position?: { code?: string; name?: string; type?: string; abbreviation?: string };
    status?: { code?: string; description?: string };
  }>;
  rosterType?: string;
  teamId?: number;
  season?: string;
};

type MlbGameLogResponse = {
  stats?: Array<{
    type?: { displayName?: string };
    group?: { displayName?: string };
    splits?: Array<{
      date?: string;
      stat?: {
        inningsPitched?: string;
        numberOfPitches?: number;
        strikeOuts?: number;
        baseOnBalls?: number;
        hits?: number;
        earnedRuns?: number;
        era?: string;
      };
    }>;
  }>;
};

type MlbLinescoreScheduleResponse = {
  totalItems?: number;
  dates?: Array<{
    date: string;
    games: Array<MlbGameEntry & {
      linescore?: {
        teams?: {
          home?: { runs?: number; hits?: number; errors?: number };
          away?: { runs?: number; hits?: number; errors?: number };
        };
      };
    }>;
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

  async getRecentResults(teamKey, limit = 5, dataMode, cacheBust) {
    const dm = resolveDataMode(dataMode);
    const teamId = MLB_TEAM_IDS[teamKey];
    if (!teamId) return { data: null, meta: unknownTeamMeta(teamKey, dm) };

    const endDate = todayISO();
    const startDate = addDays(endDate, -14);

    try {
      const result = await fetchMlbJson<MlbScheduleResponse>({
        endpoint: "/schedule",
        params: { sportId: 1, teamId, startDate, endDate },
        fixtureFile: "team_recent_results.json",
        ttlSeconds: 300,
        dataMode: dm,
        cacheBust,
      });

      const allGames = flattenSchedule(result.data);
      const finalGames = allGames.filter((g) => g.status.abstractGameState === "Final");

      // Determine team name from first game found
      const firstGame = allGames[0];
      const teamName = firstGame
        ? firstGame.teams.home.team.id === teamId
          ? firstGame.teams.home.team.name
          : firstGame.teams.away.team.name
        : teamKey;

      const results: MlbRecentResult[] = finalGames.map((game) => {
        const isHome = game.teams.home.team.id === teamId;
        const opponent = isHome ? game.teams.away.team : game.teams.home.team;
        const opponentKey = MLB_TEAM_ABBREVS[opponent.id] ?? abbrevFromName(opponent.name);
        const teamScore = isHome ? game.teams.home.score : game.teams.away.score;
        const opponentScore = isHome ? game.teams.away.score : game.teams.home.score;
        let result: "W" | "L" | null = null;
        if (teamScore !== undefined && opponentScore !== undefined) {
          result = teamScore > opponentScore ? "W" : "L";
        }
        return {
          gamePk: game.gamePk,
          date: game.officialDate,
          opponent: opponent.name,
          opponentKey,
          homeAway: (isHome ? "home" : "away") as "home" | "away",
          result,
          teamScore: teamScore ?? null,
          opponentScore: opponentScore ?? null,
          status: game.status.detailedState,
        };
      });

      // Most recent first, then cap at limit
      const capped = results.reverse().slice(0, limit);

      return {
        data: { teamKey, teamName, results: capped },
        meta: asMeta(result.meta),
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getRecentResults", error, dm) };
    }
  },

  async getPlayerSeasonStats(playerId, dataMode) {
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
      const [hittingResult, pitchingResult] = await Promise.all([
        fetchMlbJson<MlbYearByYearStatsResponse>({
          endpoint: `/people/${encodeURIComponent(playerId)}/stats`,
          params: { stats: "yearByYear", group: "hitting", sportId: 1 },
          fixtureFile: "season_stats_player.json",
          ttlSeconds: 3600,
          dataMode: dm,
        }),
        fetchMlbJson<MlbYearByYearStatsResponse>({
          endpoint: `/people/${encodeURIComponent(playerId)}/stats`,
          params: { stats: "yearByYear", group: "pitching", sportId: 1 },
          fixtureFile: "season_stats_player.json",
          ttlSeconds: 3600,
          dataMode: dm,
        }),
      ]);

      const mapHittingSplits = (data: MlbYearByYearStatsResponse): MlbPlayerYearStats[] => {
        const group = data.stats?.find((s) => s.group?.displayName?.toLowerCase() === "hitting");
        return (group?.splits ?? []).map((split) => ({
          season: parseInt(split.season ?? "0", 10),
          gamesPlayed: split.stat?.gamesPlayed,
          avg: split.stat?.avg,
          hr: split.stat?.homeRuns,
          rbi: split.stat?.rbi,
          ops: split.stat?.ops,
          obp: split.stat?.obp,
          slg: split.stat?.slg,
          strikeOutsHitting: split.stat?.strikeOuts,
          baseOnBallsHitting: split.stat?.baseOnBalls,
          stolenBases: split.stat?.stolenBases,
          babip: split.stat?.babip,
        }));
      };

      const mapPitchingSplits = (data: MlbYearByYearStatsResponse): MlbPlayerYearStats[] => {
        const group = data.stats?.find((s) => s.group?.displayName?.toLowerCase() === "pitching");
        return (group?.splits ?? []).map((split) => ({
          season: parseInt(split.season ?? "0", 10),
          gamesPlayed: split.stat?.gamesPlayed,
          gamesStarted: split.stat?.gamesStarted,
          wins: split.stat?.wins,
          losses: split.stat?.losses,
          era: split.stat?.era,
          whip: split.stat?.whip,
          inningsPitched: split.stat?.inningsPitched,
          strikeOuts: split.stat?.strikeOuts,
        }));
      };

      return {
        data: {
          playerId,
          hitting: mapHittingSplits(hittingResult.data),
          pitching: mapPitchingSplits(pitchingResult.data),
        },
        meta: asMeta(hittingResult.meta),
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getPlayerSeasonStats", error, dm) };
    }
  },

  async getTeamSeasonStats(teamKey, season, dataMode) {
    const dm = resolveDataMode(dataMode);
    const teamId = MLB_TEAM_IDS[teamKey];
    if (!teamId) return { data: null, meta: unknownTeamMeta(teamKey, dm) };

    try {
      const [hittingResult, pitchingResult, standingsResult] = await Promise.all([
        fetchMlbJson<MlbTeamStatsResponse>({
          endpoint: "/teams/stats",
          params: { stats: "season", group: "hitting", season, sportId: 1 },
          fixtureFile: "season_stats_team.json",
          ttlSeconds: 3600,
          dataMode: dm,
        }),
        fetchMlbJson<MlbTeamStatsResponse>({
          endpoint: "/teams/stats",
          params: { stats: "season", group: "pitching", season, sportId: 1 },
          fixtureFile: "season_stats_team.json",
          ttlSeconds: 3600,
          dataMode: dm,
        }),
        fetchMlbJson<MlbStandingsResponse>({
          endpoint: "/standings",
          params: { leagueId: "103,104", season, sportId: 1 },
          fixtureFile: "season_stats_team.json",
          ttlSeconds: 3600,
          dataMode: dm,
        }),
      ]);

      // Find team hitting stats
      const hittingGroup = hittingResult.data.stats?.find(
        (s) => s.group?.displayName?.toLowerCase() === "hitting",
      );
      const hittingSplit = hittingGroup?.splits?.find((s) => s.team?.id === teamId);
      const teamName = hittingSplit?.team?.name ?? teamKey;

      // Find team pitching stats
      const pitchingGroup = pitchingResult.data.stats?.find(
        (s) => s.group?.displayName?.toLowerCase() === "pitching",
      );
      const pitchingSplit = pitchingGroup?.splits?.find((s) => s.team?.id === teamId);

      // Find standings record - check both top-level records and embedded standings
      let teamRecord: { wins: number; losses: number; pct: string; divisionRank?: number; gamesBack?: string } = {
        wins: 0,
        losses: 0,
        pct: ".000",
      };

      // The fixture embeds standings under a "standings" key; real API returns them at top level
      const standingsData = standingsResult.data as unknown as { records?: MlbStandingsResponse["records"]; standings?: { records?: MlbStandingsResponse["records"] } };
      const recordsSource = standingsData.records ?? standingsData.standings?.records ?? [];
      for (const divRecord of recordsSource) {
        const found = divRecord.teamRecords?.find((tr) => tr.team?.id === teamId);
        if (found) {
          teamRecord = {
            wins: found.wins ?? 0,
            losses: found.losses ?? 0,
            pct: found.pct ?? ".000",
            divisionRank: found.divisionRank ? parseInt(found.divisionRank, 10) : undefined,
            gamesBack: found.gamesBack,
          };
          break;
        }
      }

      return {
        data: {
          teamKey,
          teamName,
          season,
          record: teamRecord,
          hitting: {
            avg: hittingSplit?.stat?.avg,
            obp: hittingSplit?.stat?.obp,
            slg: hittingSplit?.stat?.slg,
            ops: hittingSplit?.stat?.ops,
            runsScored: hittingSplit?.stat?.runs,
            hr: hittingSplit?.stat?.homeRuns,
            strikeOuts: hittingSplit?.stat?.strikeOuts,
            baseOnBalls: hittingSplit?.stat?.baseOnBalls,
          },
          pitching: {
            era: pitchingSplit?.stat?.era,
            whip: pitchingSplit?.stat?.whip,
            strikeOuts: pitchingSplit?.stat?.strikeOuts,
            runsAllowed: pitchingSplit?.stat?.runs,
            saves: pitchingSplit?.stat?.saves,
            blownSaves: pitchingSplit?.stat?.blownSaves,
          },
        },
        meta: asMeta(hittingResult.meta),
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getTeamSeasonStats", error, dm) };
    }
  },

  async getPlatoonAdvantage(teamKey, dataMode, cacheBust) {
    const dm = resolveDataMode(dataMode);
    const teamId = MLB_TEAM_IDS[teamKey];
    if (!teamId) return { data: null, meta: unknownTeamMeta(teamKey, dm) };

    try {
      // Fetch next scheduled game for the team
      const startDate = todayISO();
      const endDate = addDays(startDate, 7);
      const schedResult = await fetchMlbJson<MlbScheduleResponse>({
        endpoint: "/schedule",
        params: { sportId: 1, teamId, startDate, endDate, hydrate: "probablePitcher" },
        fixtureFile: "game_with_pitchers.json",
        ttlSeconds: 300,
        dataMode: dm,
        cacheBust,
      });

      const games = flattenSchedule(schedResult.data);
      const nextGame = games[0];
      if (!nextGame) {
        return {
          data: null,
          meta: { ...asMeta(schedResult.meta), warning: "No upcoming games found." },
        };
      }

      const homeRef = nextGame.teams.home;
      const awayRef = nextGame.teams.away;
      const homeKey = MLB_TEAM_ABBREVS[homeRef.team.id] ?? abbrevFromName(homeRef.team.name);
      const awayKey = MLB_TEAM_ABBREVS[awayRef.team.id] ?? abbrevFromName(awayRef.team.name);

      // Fetch pitcher splits concurrently
      async function fetchSplits(pitcherId: number): Promise<MlbPitcherSplits> {
        try {
          const res = await fetchMlbJson<MlbPitcherSplitsResponse>({
            endpoint: `/people/${pitcherId}/stats`,
            params: { stats: "statSplits", group: "pitching", season: MLB_SEASON, sitCodes: "vl,vr" },
            fixtureFile: "pitcher_splits.json",
            ttlSeconds: 3600,
            dataMode: dm,
          });
          const group = res.data.stats?.find(
            (s) => s.group?.displayName?.toLowerCase() === "pitching",
          );
          const splits = group?.splits ?? [];
          const vl = splits.find((s) => s.split?.code === "vl");
          const vr = splits.find((s) => s.split?.code === "vr");
          return {
            vsLeft: vl ? {
              era: vl.stat?.era,
              whip: vl.stat?.whip,
              avg: vl.stat?.avg,
              ops: vl.stat?.ops,
              sample: vl.stat?.battersFaced,
            } : null,
            vsRight: vr ? {
              era: vr.stat?.era,
              whip: vr.stat?.whip,
              avg: vr.stat?.avg,
              ops: vr.stat?.ops,
              sample: vr.stat?.battersFaced,
            } : null,
          };
        } catch {
          return { vsLeft: null, vsRight: null };
        }
      }

      const [homeSplits, awaySplits] = await Promise.all([
        homeRef.probablePitcher ? fetchSplits(homeRef.probablePitcher.id) : Promise.resolve({ vsLeft: null, vsRight: null }),
        awayRef.probablePitcher ? fetchSplits(awayRef.probablePitcher.id) : Promise.resolve({ vsLeft: null, vsRight: null }),
      ]);

      // Compute advantage score
      // Positive = home advantage, negative = away advantage
      let advantageScore = 0;
      let explanation = "Platoon splits are not available for one or both starters.";

      const homeEraVsL = parseFloat(homeSplits.vsLeft?.era ?? "NaN");
      const homeEraVsR = parseFloat(homeSplits.vsRight?.era ?? "NaN");
      const awayEraVsL = parseFloat(awaySplits.vsLeft?.era ?? "NaN");
      const awayEraVsR = parseFloat(awaySplits.vsRight?.era ?? "NaN");

      const homeHasSplits = !Number.isNaN(homeEraVsL) && !Number.isNaN(homeEraVsR);
      const awayHasSplits = !Number.isNaN(awayEraVsL) && !Number.isNaN(awayEraVsR);

      if (homeHasSplits || awayHasSplits) {
        // Home pitcher: positive gap means they dominate lefties more than righties
        const homeGap = homeHasSplits ? homeEraVsR - homeEraVsL : 0; // positive = better vs L
        // Away pitcher: positive gap means they dominate lefties more than righties
        const awayGap = awayHasSplits ? awayEraVsR - awayEraVsL : 0; // positive = better vs L

        // If home pitcher is better vs L (homeGap > 0) it favors home (away batters skew L)
        // If away pitcher is better vs L (awayGap > 0) it favors away (home batters skew L)
        advantageScore = Math.round((homeGap - awayGap) * 10) / 10;

        const homeThrows = homeRef.probablePitcher?.pitchHand?.code ?? "?";
        const awayThrows = awayRef.probablePitcher?.pitchHand?.code ?? "?";

        if (Math.abs(advantageScore) < 0.3) {
          explanation = `${homeRef.team.name} (${homeThrows}HP) and ${awayRef.team.name} (${awayThrows}HP) starters show similar platoon splits — no clear advantage.`;
        } else if (advantageScore > 0) {
          explanation = `${homeRef.team.name}'s starter (${homeThrows}HP) has a stronger platoon edge vs left-handed batters (ERA vs L: ${homeSplits.vsLeft?.era ?? "-"} vs R: ${homeSplits.vsRight?.era ?? "-"}), giving a slight home advantage.`;
        } else {
          explanation = `${awayRef.team.name}'s starter (${awayThrows}HP) has a stronger platoon edge vs left-handed batters (ERA vs L: ${awaySplits.vsLeft?.era ?? "-"} vs R: ${awaySplits.vsRight?.era ?? "-"}), giving a slight away advantage.`;
        }
      }

      const advantage: "home" | "away" | "neutral" =
        advantageScore > 0.3 ? "home" : advantageScore < -0.3 ? "away" : "neutral";

      const homePitcherData = homeRef.probablePitcher
        ? {
            playerId: String(homeRef.probablePitcher.id),
            fullName: homeRef.probablePitcher.fullName,
            throwsHand: homeRef.probablePitcher.pitchHand?.code ?? "?",
            splits: homeSplits,
          }
        : null;

      const awayPitcherData = awayRef.probablePitcher
        ? {
            playerId: String(awayRef.probablePitcher.id),
            fullName: awayRef.probablePitcher.fullName,
            throwsHand: awayRef.probablePitcher.pitchHand?.code ?? "?",
            splits: awaySplits,
          }
        : null;

      return {
        data: {
          game: {
            gameId: String(nextGame.gamePk),
            gamePk: nextGame.gamePk,
            officialDate: nextGame.officialDate,
            homeTeam: { key: homeKey, name: homeRef.team.name },
            awayTeam: { key: awayKey, name: awayRef.team.name },
          },
          homePitcher: homePitcherData,
          awayPitcher: awayPitcherData,
          advantage,
          advantageScore,
          explanation,
        },
        meta: asMeta(schedResult.meta),
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getPlatoonAdvantage", error, dm) };
    }
  },

  async getRecentForm(teamKey, dataMode, cacheBust) {
    const dm = resolveDataMode(dataMode);
    const teamId = MLB_TEAM_IDS[teamKey];
    if (!teamId) return { data: null, meta: unknownTeamMeta(teamKey, dm) };

    const endDate = todayISO();
    const startDate = addDays(endDate, -30);

    try {
      const result = await fetchMlbJson<MlbLinescoreScheduleResponse>({
        endpoint: "/schedule",
        params: { sportId: 1, teamId, startDate, endDate, hydrate: "linescore" },
        fixtureFile: "recent_form_schedule.json",
        ttlSeconds: 300,
        dataMode: dm,
        cacheBust,
      });

      // Flatten all games with linescore support
      type LinescoreGame = MlbGameEntry & {
        linescore?: {
          teams?: {
            home?: { runs?: number };
            away?: { runs?: number };
          };
        };
      };
      const allGames: LinescoreGame[] = (result.data.dates ?? [])
        .flatMap((d) => d.games as LinescoreGame[])
        .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());

      const finalGames = allGames.filter((g) => g.status.abstractGameState === "Final");

      // Determine team name
      const firstGame = allGames[0];
      const teamName = firstGame
        ? firstGame.teams.home.team.id === teamId
          ? firstGame.teams.home.team.name
          : firstGame.teams.away.team.name
        : teamKey;

      const today = endDate;

      function computePeriod(days: number): MlbFormPeriod {
        const cutoff = addDays(today, -days);
        const games = finalGames.filter((g) => g.officialDate >= cutoff && g.officialDate <= today);
        let wins = 0;
        let losses = 0;
        let runsScored = 0;
        let runsAllowed = 0;

        for (const g of games) {
          const isHome = g.teams.home.team.id === teamId;
          // Prefer linescore runs, fall back to score
          const teamRuns = isHome
            ? (g.linescore?.teams?.home?.runs ?? g.teams.home.score ?? 0)
            : (g.linescore?.teams?.away?.runs ?? g.teams.away.score ?? 0);
          const oppRuns = isHome
            ? (g.linescore?.teams?.away?.runs ?? g.teams.away.score ?? 0)
            : (g.linescore?.teams?.home?.runs ?? g.teams.home.score ?? 0);

          runsScored += teamRuns;
          runsAllowed += oppRuns;
          if (teamRuns > oppRuns) wins++;
          else losses++;
        }

        const total = wins + losses;
        const winPct = total > 0 ? wins / total : 0;
        return {
          days,
          wins,
          losses,
          runsScored,
          runsAllowed,
          runDiff: runsScored - runsAllowed,
          winPct: Math.round(winPct * 1000) / 1000,
        };
      }

      const last7 = computePeriod(7);
      const last14 = computePeriod(14);
      const last30 = computePeriod(30);

      const weightedWinPct =
        Math.round((0.5 * last7.winPct + 0.3 * last14.winPct + 0.2 * last30.winPct) * 1000) / 1000;

      const rating: MlbRecentForm["rating"] =
        weightedWinPct >= 0.6
          ? "hot"
          : weightedWinPct >= 0.5
          ? "warm"
          : weightedWinPct >= 0.4
          ? "cool"
          : "cold";

      const ratingScore = Math.round(weightedWinPct * 100);

      const explanation =
        rating === "hot"
          ? `${teamName} is on fire — ${last7.wins}-${last7.losses} over the last 7 days with a +${last7.runDiff} run differential.`
          : rating === "warm"
          ? `${teamName} is playing solid ball — ${last7.wins}-${last7.losses} in the last 7 days.`
          : rating === "cool"
          ? `${teamName} is struggling a bit — ${last7.wins}-${last7.losses} over the last 7 days.`
          : `${teamName} is in a cold stretch — ${last7.wins}-${last7.losses} over the last 7 days with a ${last7.runDiff} run differential.`;

      return {
        data: {
          teamKey,
          teamName,
          rating,
          ratingScore,
          weightedWinPct,
          last7,
          last14,
          last30,
          explanation,
        },
        meta: asMeta(result.meta),
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getRecentForm", error, dm) };
    }
  },

  async getBullpenFatigue(teamKey, dataMode, cacheBust) {
    const dm = resolveDataMode(dataMode);
    const teamId = MLB_TEAM_IDS[teamKey];
    if (!teamId) return { data: null, meta: unknownTeamMeta(teamKey, dm) };

    try {
      // Fetch active roster
      const rosterResult = await fetchMlbJson<MlbRosterResponse>({
        endpoint: `/teams/${teamId}/roster`,
        params: { rosterType: "active", season: MLB_SEASON },
        fixtureFile: "team_roster.json",
        ttlSeconds: 1800,
        dataMode: dm,
        cacheBust,
      });

      const roster = rosterResult.data.roster ?? [];
      const teamName =
        roster.length > 0
          ? (roster[0]?.person?.fullName ? teamKey : teamKey) // We'll derive from team ID
          : teamKey;

      // Filter to pitchers only
      const pitchers = roster.filter(
        (p) =>
          p.position?.type === "Pitcher" || p.position?.abbreviation === "P",
      );

      const today = new Date(todayISO());

      // Fetch game logs concurrently for all pitchers
      const gameLogResults = await Promise.all(
        pitchers.map((pitcher) =>
          fetchMlbJson<MlbGameLogResponse>({
            endpoint: `/people/${pitcher.person?.id}/stats`,
            params: { stats: "gameLog", group: "pitching", season: MLB_SEASON },
            fixtureFile: "pitcher_game_log.json",
            ttlSeconds: 900,
            dataMode: dm,
          }).catch(() => null),
        ),
      );

      const fatigueLevelOrder: Record<MlbRelieverFatigue["fatigue"], number> = {
        fatigued: 0,
        tired: 1,
        available: 2,
        fresh: 3,
        rested: 4,
      };

      const relievers: MlbRelieverFatigue[] = pitchers.map((pitcher, idx) => {
        const logResult = gameLogResults[idx];
        const group = logResult?.data.stats?.find(
          (s) => s.group?.displayName?.toLowerCase() === "pitching",
        );
        const splits = group?.splits ?? [];

        // Filter to last 5 days
        const recentSplits = splits
          .filter((s) => {
            if (!s.date) return false;
            const gameDate = new Date(s.date);
            const diffMs = today.getTime() - gameDate.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            return diffDays >= 0 && diffDays <= 5;
          })
          .sort((a, b) => new Date(b.date ?? "").getTime() - new Date(a.date ?? "").getTime());

        const recentAppearances = recentSplits.map((s) => ({
          date: s.date ?? "",
          inningsPitched: s.stat?.inningsPitched ?? "0.0",
          numberOfPitches: s.stat?.numberOfPitches ?? 0,
        }));

        // Determine days rest
        let daysRest = 999;
        let lastAppearance: string | null = null;
        let lastAppearancePitches: number | null = null;

        if (recentSplits.length > 0) {
          const last = recentSplits[0];
          lastAppearance = last.date ?? null;
          lastAppearancePitches = last.stat?.numberOfPitches ?? null;
          if (lastAppearance) {
            const lastDate = new Date(lastAppearance);
            daysRest = Math.floor(
              (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
            );
          }
        }

        // Determine fatigue level
        let fatigue: MlbRelieverFatigue["fatigue"];
        if (daysRest === 999) {
          fatigue = "rested";
        } else if (daysRest <= 1 && (lastAppearancePitches ?? 0) >= 30) {
          fatigue = "fatigued";
        } else if (daysRest <= 1) {
          fatigue = "tired";
        } else if (daysRest === 2) {
          fatigue = "available";
        } else if (daysRest <= 4) {
          fatigue = "fresh";
        } else {
          fatigue = "rested";
        }

        return {
          playerId: String(pitcher.person?.id ?? ""),
          fullName: pitcher.person?.fullName ?? "Unknown",
          fatigue,
          daysRest: daysRest === 999 ? 99 : daysRest,
          lastAppearance,
          lastAppearancePitches,
          recentAppearances,
        };
      });

      // Sort: fatigued first, rested last
      relievers.sort(
        (a, b) => fatigueLevelOrder[a.fatigue] - fatigueLevelOrder[b.fatigue],
      );

      return {
        data: {
          teamKey,
          teamName,
          relievers,
          fetchedAt: nowISO(),
        },
        meta: asMeta(rosterResult.meta),
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getBullpenFatigue", error, dm) };
    }
  },
};

// ---------------------------------------------------------------------------
// Legacy alias — keeps any existing import of mlbProviderStub working
// ---------------------------------------------------------------------------
/** @deprecated Use mlbProvider instead */
export const mlbProviderStub = mlbProvider;
