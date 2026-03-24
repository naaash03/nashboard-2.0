<<<<<<< HEAD
﻿import "server-only";
import { randomUUID } from "node:crypto";
import { fetchMlbJson, resolveDataMode } from "@/lib/providers/mlb/client";
import type { Meta } from "@/lib/providers/types";
import type { MlbFetchMeta } from "@/lib/providers/mlb/client";

// ---------------------------------------------------------------------------
// Current season
// ---------------------------------------------------------------------------

const MLB_SEASON = 2026;

// ---------------------------------------------------------------------------
// Team maps â€” abbreviation â†’ MLB Stats API team ID (all 30 teams)
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

/** MLB Stats API team ID â†’ canonical abbreviation */
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
    gameType?: string;
    gameTypeLabel?: string;
    venue?: string;
    seriesDescription?: string;
    probableStarter?: {
      playerId: string;
      fullName: string;
      throwsHand?: string;
    } | null;
  }>;
};

export type PitcherArsenal = {
  playerId: string;
  playerName?: string;
  season: number;
  seasonLabel?: string;
  fallbackSeason?: number;
  status: "current" | "fallback" | "unavailable";
  message?: string;
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
  opponent: string;
  opponentKey: string;
  homeAway: "home" | "away";
  gameType?: string;
  gameTypeLabel?: string;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  duration?: string;
  startingPitcher?: string | null;
};

export type MlbSeriesInfo = {
  seriesId: string;
  opponent: string;
  opponentKey: string;
  homeAway: "home" | "away";
  games: MlbSeriesGame[];
  teamWins: number;
  teamLosses: number;
  seriesDescription: string;
  gameTypeFilter: "R" | "S";
  gameTypeLabel: string;
};

export type MlbSeriesTracker = {
  teamKey: string;
  teamName: string;
  gameTypeFilter: "R" | "S";
  availableSeries: MlbSeriesInfo[];
  selectedSeries: MlbSeriesInfo | null;
};

export type MlbPitcherInfo = {
  playerId: string;
  fullName: string;
  teamKey?: string;
  teamName?: string;
  throwsHand?: string;
  era?: string;
  whip?: string;
  inningsPitched?: string;
  strikeOuts?: number;
  wins?: number;
  losses?: number;
  baseOnBalls?: number;
  kPer9?: string;
  bbPer9?: string;
  fip?: string;
  seasonUsed?: number;
  scoutingNote?: string;
  last5Starts?: {
    starts: number;
    inningsPitched?: string;
    era?: string;
    trend: "up" | "down" | "steady" | "n/a";
    summary: string;
  };
};

export type MlbPitcherMatchup = {
  options: Array<{
    gamePk: number;
    label: string;
    gameDate: string;
    gameType?: string;
    gameTypeLabel?: string;
    status: string;
    isUpcoming: boolean;
  }>;
  selectedGamePk: number;
  game: {
    gameId: string;
    gamePk: number;
    gameTime: string;
    officialDate: string;
    status: string;
    gameType?: string;
    gameTypeLabel?: string;
    homeTeam: { key: string; name: string; id: number };
    awayTeam: { key: string; name: string; id: number };
    venue?: string;
    seriesDescription?: string;
  };
  pitchers: {
    home: MlbPitcherInfo | null;
    away: MlbPitcherInfo | null;
  };
  scoutingSummary: string;
  advancedSummary: string;
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
// New types â€” Feature 1: Recent Results
// ---------------------------------------------------------------------------

export type MlbRecentResult = {
  gamePk: number;
  date: string;
  opponent: string;
  opponentKey: string;
  homeAway: "home" | "away";
  gameType?: string;
  gameTypeLabel?: string;
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
// New types â€” Feature 2: Season Stats Explorer
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
// New types â€” Feature 3: Platoon Advantage
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
  analysisMode: "splits" | "handedness";
  handednessAnalyses: Array<{
    pitcherTeamKey: string;
    lineupTeamKey: string;
    pitcherName: string;
    pitcherHand: string;
    lineupHandedness: "left" | "right" | "balanced" | "unknown";
    lineupSummary: string;
    edge: "pitcher" | "hitter" | "neutral" | "unknown";
    summary: string;
    reasoning: string;
  }>;
};

// ---------------------------------------------------------------------------
// New types â€” Feature 4: Recent Form Rating
// ---------------------------------------------------------------------------

export type MlbFormPeriod = {
  days: number;
  wins: number;
  losses: number;
  runsScored: number;
  runsAllowed: number;
  runDiff: number;
  winPct: number;
  games: number;
  runDiffPerGame: number;
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
  sampleContext: string;
  primaryGameType: "R" | "S" | "mixed" | "unknown";
  primaryGameTypeLabel: string;
};

// ---------------------------------------------------------------------------
// New types â€” Feature 5: Bullpen Fatigue
// ---------------------------------------------------------------------------

export type MlbPitcherAvailability = {
  playerId: string;
  fullName: string;
  fatigue: "fatigued" | "tired" | "available" | "fresh" | "rested";
  daysRest: number;
  lastAppearance: string | null;
  lastAppearancePitches: number | null;
  lastAppearanceStrikes: number | null;
  inningsLastAppearance?: string | null;
  seasonKPer9?: string;
  seasonUsed?: number;
  recentAppearances: Array<{
    date: string;
    inningsPitched: string;
    numberOfPitches: number;
    strikes?: number;
  }>;
};

export type MlbBullpenFatigue = {
  teamKey: string;
  teamName: string;
  starters: Array<{
    playerId: string;
    fullName: string;
    lastStartDate: string | null;
    daysRest: number;
    inningsLastStart: string | null;
    pitchesLastStart: number | null;
    strikesLastStart: number | null;
    seasonKPer9?: string;
    seasonUsed?: number;
  }>;
  relievers: MlbPitcherAvailability[];
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
    gameTypeFilter?: "R" | "S",
    seriesId?: string,
  ): Promise<{ data: MlbSeriesTracker | null; meta: Meta }>;

  /** Probable starting pitchers for a specific game by gamePk */
  getStartingPitcherMatchup(
    gamePk: string | number,
    dataMode?: "live" | "fixture",
    cacheBust?: string,
    teamKey?: string,
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
  gameGuid?: string;
  link?: string;
  gameType?: string;
  season?: string;
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

type MlbPeopleResponse = {
  people?: Array<{
    id: number;
    fullName: string;
    pitchHand?: { code?: string; description?: string };
    batSide?: { code?: string; description?: string };
    primaryPosition?: { code?: string; name?: string; type?: string; abbreviation?: string };
    currentTeam?: { id?: number; name?: string };
  }>;
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
        pitchesThrown?: number;
        strikes?: number;
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

type MlbBoxscoreTeamPlayer = {
  person?: { id: number; fullName: string };
  stats?: {
    pitching?: {
      inningsPitched?: string;
      numberOfPitches?: number;
      pitchesThrown?: number;
      strikes?: number;
      strikeOuts?: number;
      baseOnBalls?: number;
      earnedRuns?: number;
      era?: string;
    };
  };
  seasonStats?: {
    pitching?: {
      gamesPlayed?: number;
      gamesStarted?: number;
      wins?: number;
      losses?: number;
      era?: string;
      whip?: string;
      inningsPitched?: string;
      strikeOuts?: number;
      baseOnBalls?: number;
      strikeoutsPer9Inn?: string;
      walksPer9Inn?: string;
      homeRuns?: number;
    };
  };
};

type MlbBoxscoreTeam = {
  team?: MlbTeamRef & { abbreviation?: string };
  pitchers?: number[];
  players?: Record<string, MlbBoxscoreTeamPlayer>;
  info?: Array<{ title?: string; label?: string; value?: string }>;
};

type MlbBoxscoreResponse = {
  teams?: {
    home?: MlbBoxscoreTeam;
    away?: MlbBoxscoreTeam;
  };
  info?: Array<{ label?: string; value?: string }>;
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

function gameTypeLabel(gameType?: string): string {
  if (gameType === "S") return "Spring Training";
  if (gameType === "R") return "Regular Season";
  return "Season Unspecified";
}

function inningsToNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const [wholePart, remainderPart = "0"] = value.split(".");
  const whole = Number.parseInt(wholePart, 10);
  const remainder = Number.parseInt(remainderPart, 10);
  if (Number.isNaN(whole) || Number.isNaN(remainder)) return undefined;
  return whole + remainder / 3;
}

function formatPerNine(value: number | undefined, inningsPitched?: string): string | undefined {
  if (value === undefined) return undefined;
  const innings = inningsToNumber(inningsPitched);
  if (!innings || innings <= 0) return undefined;
  return ((value * 9) / innings).toFixed(1);
}

function pitchCountFromStat(stat?: {
  numberOfPitches?: number;
  pitchesThrown?: number;
}): number | undefined {
  return stat?.pitchesThrown ?? stat?.numberOfPitches;
}

function strikesFromStat(stat?: { strikes?: number }): number | undefined {
  return stat?.strikes;
}

function summarizePitcherScouting(pitcher: Pick<MlbPitcherInfo, "era" | "kPer9" | "bbPer9">): string {
  const era = Number.parseFloat(pitcher.era ?? "NaN");
  const kPer9 = Number.parseFloat(pitcher.kPer9 ?? "NaN");
  const bbPer9 = Number.parseFloat(pitcher.bbPer9 ?? "NaN");

  if (Number.isNaN(era) && Number.isNaN(kPer9)) {
    return "Season line is still sparse, so this is mostly a role and handedness read right now.";
  }
  if (!Number.isNaN(era) && era <= 3.5 && !Number.isNaN(kPer9) && kPer9 >= 9) {
    return "He has missed bats and limited damage, which points to a strong current run-prevention profile.";
  }
  if (!Number.isNaN(kPer9) && kPer9 >= 9.5) {
    return "The strikeout rate is the carrying tool here, so hitters need to survive swing-and-miss pressure.";
  }
  if (!Number.isNaN(bbPer9) && bbPer9 >= 3.5) {
    return "Command is the swing factor because the walk rate leaves room for traffic.";
  }
  if (!Number.isNaN(era) && era <= 4.0) {
    return "He has mostly kept games under control, even without an overpowering strikeout profile.";
  }
  return "This looks more like a contact-management outing than a pure bat-missing matchup.";
}

function buildLast5StartsSummary(
  pitcherName: string,
  splits: Array<{
    date?: string;
    stat?: {
      inningsPitched?: string;
      earnedRuns?: number;
      strikeOuts?: number;
    };
  }>,
): MlbPitcherInfo["last5Starts"] {
  const recent = [...splits]
    .filter((split) => Boolean(split.date))
    .sort((a, b) => new Date(b.date ?? "").getTime() - new Date(a.date ?? "").getTime())
    .slice(0, 5);

  if (recent.length === 0) {
    return {
      starts: 0,
      trend: "n/a",
      summary: `${pitcherName} does not have a recent five-start sample posted yet.`,
    };
  }

  const totalInnings = recent.reduce((sum, split) => sum + (inningsToNumber(split.stat?.inningsPitched) ?? 0), 0);
  const totalEarnedRuns = recent.reduce((sum, split) => sum + (split.stat?.earnedRuns ?? 0), 0);
  const era = totalInnings > 0 ? ((totalEarnedRuns * 9) / totalInnings).toFixed(2) : undefined;

  const newestTwo = recent.slice(0, Math.min(2, recent.length));
  const olderThree = recent.slice(Math.min(2, recent.length));
  const newestEra =
    newestTwo.length > 0
      ? (() => {
          const innings = newestTwo.reduce(
            (sum, split) => sum + (inningsToNumber(split.stat?.inningsPitched) ?? 0),
            0,
          );
          const earnedRuns = newestTwo.reduce((sum, split) => sum + (split.stat?.earnedRuns ?? 0), 0);
          return innings > 0 ? (earnedRuns * 9) / innings : undefined;
        })()
      : undefined;
  const olderEra =
    olderThree.length > 0
      ? (() => {
          const innings = olderThree.reduce(
            (sum, split) => sum + (inningsToNumber(split.stat?.inningsPitched) ?? 0),
            0,
          );
          const earnedRuns = olderThree.reduce((sum, split) => sum + (split.stat?.earnedRuns ?? 0), 0);
          return innings > 0 ? (earnedRuns * 9) / innings : undefined;
        })()
      : undefined;

  let trend: "up" | "down" | "steady" | "n/a" = "steady";
  if (newestEra === undefined || olderEra === undefined) {
    trend = "n/a";
  } else if (newestEra + 0.75 < olderEra) {
    trend = "up";
  } else if (newestEra - 0.75 > olderEra) {
    trend = "down";
  }

  const inningsLabel = totalInnings > 0 ? totalInnings.toFixed(1) : undefined;
  const summary =
    recent.length === 1
      ? `${pitcherName} has only one recent start logged, so trend context is limited.`
      : `${pitcherName} has a ${era ?? "-"} ERA over the last ${recent.length} starts${
          inningsLabel ? ` (${inningsLabel} IP)` : ""
        }.`;

  return {
    starts: recent.length,
    inningsPitched: inningsLabel,
    era,
    trend,
    summary,
  };
}

type PitchingSeasonSummary = NonNullable<PitcherArsenal["seasonStats"]> & {
  baseOnBalls?: number;
  kPer9?: string;
  bbPer9?: string;
  fip?: string;
  seasonUsed?: number;
};

function extractSeasonStats(data: MlbSeasonStatsResponse, seasonUsed?: number): PitchingSeasonSummary | undefined {
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
    baseOnBalls: s.baseOnBalls,
    kPer9: formatPerNine(s.strikeOuts, s.inningsPitched),
    bbPer9: formatPerNine(s.baseOnBalls, s.inningsPitched),
    seasonUsed,
  };
}

async function fetchPitcherSeasonSummary(
  pitcherId: number,
  dataMode: "live" | "fixture",
  cacheBust?: string,
  seasons: number[] = [MLB_SEASON, MLB_SEASON - 1],
): Promise<PitchingSeasonSummary | undefined> {
  for (const season of seasons) {
    try {
      const result = await fetchMlbJson<MlbSeasonStatsResponse>({
        endpoint: `/people/${pitcherId}/stats`,
        params: { stats: "season", group: "pitching", season },
        fixtureFile: "pitcher_season_stats.json",
        ttlSeconds: 3_600,
        dataMode,
        cacheBust,
      });
      const summary = extractSeasonStats(result.data, season);
      if (summary) return summary;
    } catch {
      // Keep trying earlier seasons
    }
  }
  return undefined;
}

async function fetchPitcherGameLog(
  pitcherId: number,
  dataMode: "live" | "fixture",
  cacheBust?: string,
  seasons: number[] = [MLB_SEASON, MLB_SEASON - 1],
): Promise<{
  seasonUsed?: number;
  splits: NonNullable<MlbGameLogResponse["stats"]>[number]["splits"];
}> {
  for (const season of seasons) {
    try {
      const result = await fetchMlbJson<MlbGameLogResponse>({
        endpoint: `/people/${pitcherId}/stats`,
        params: { stats: "gameLog", group: "pitching", season },
        fixtureFile: "pitcher_game_log.json",
        ttlSeconds: 900,
        dataMode,
        cacheBust,
      });
      const splits = result.data.stats?.[0]?.splits ?? [];
      if (splits.length > 0) {
        return { seasonUsed: season, splits };
      }
    } catch {
      // Keep trying earlier seasons
    }
  }
  return { seasonUsed: undefined, splits: [] };
}

async function fetchPitcherThrowingHand(
  pitcherId: number,
  dataMode: "live" | "fixture",
  cacheBust?: string,
): Promise<string | undefined> {
  try {
    const result = await fetchMlbJson<MlbPeopleResponse>({
      endpoint: `/people/${pitcherId}`,
      fixtureFile: "player_search.json",
      ttlSeconds: 3_600,
      dataMode,
      cacheBust,
    });
    return (
      result.data.people?.find((person) => person.id === pitcherId)?.pitchHand?.code ??
      result.data.people?.[0]?.pitchHand?.code
    );
  } catch {
    return undefined;
  }
}

async function fetchTeamLineupHandedness(
  teamId: number,
  dataMode: "live" | "fixture",
  cacheBust?: string,
): Promise<{
  lineupHandedness: "left" | "right" | "balanced" | "unknown";
  lineupSummary: string;
}> {
  try {
    const rosterResult = await fetchMlbJson<MlbRosterResponse>({
      endpoint: `/teams/${teamId}/roster`,
      params: { rosterType: "active", season: MLB_SEASON },
      fixtureFile: "team_roster.json",
      ttlSeconds: 1_800,
      dataMode,
      cacheBust,
    });
    const hitterIds = (rosterResult.data.roster ?? [])
      .filter((player) => player.position?.type !== "Pitcher" && player.person?.id)
      .slice(0, 13)
      .map((player) => player.person!.id);

    if (hitterIds.length === 0) {
      return {
        lineupHandedness: "unknown",
        lineupSummary: "The active lineup hand split could not be determined from the active roster.",
      };
    }

    const peopleResult = await fetchMlbJson<MlbPeopleResponse>({
      endpoint: "/people",
      params: { personIds: hitterIds.join(",") },
      fixtureFile: "player_search.json",
      ttlSeconds: 1_800,
      dataMode,
      cacheBust,
    });

    let left = 0;
    let right = 0;
    let switchHitters = 0;
    const requestedIds = new Set(hitterIds);
    for (const person of peopleResult.data.people ?? []) {
      if (!requestedIds.has(person.id)) continue;
      const side = person.batSide?.code;
      if (side === "L") left++;
      else if (side === "R") right++;
      else if (side === "S") switchHitters++;
    }

    if (left === 0 && right === 0 && switchHitters === 0) {
      return {
        lineupHandedness: "unknown",
        lineupSummary: "Batside data is not available for enough hitters to rate the lineup tendency.",
      };
    }

    const adjustedLeft = left + switchHitters * 0.5;
    const adjustedRight = right + switchHitters * 0.5;
    const lineupHandedness =
      Math.abs(adjustedLeft - adjustedRight) <= 1
        ? "balanced"
        : adjustedRight > adjustedLeft
        ? "right"
        : "left";

    return {
      lineupHandedness,
      lineupSummary: `${hitterIds.length} active hitters checked: ${left} left-handed, ${right} right-handed, ${switchHitters} switch-hitters.`,
    };
  } catch {
    return {
      lineupHandedness: "unknown",
      lineupSummary: "The lineup-handedness estimate is unavailable right now.",
    };
  }
}

function summarizeHandednessMatchup(
  pitcherName: string,
  pitcherHand: string | undefined,
  lineupTeamKey: string,
  lineupHandedness: "left" | "right" | "balanced" | "unknown",
  lineupSummary: string,
): {
  edge: "pitcher" | "hitter" | "neutral" | "unknown";
  summary: string;
  reasoning: string;
} {
  const handLabel = pitcherHand === "L" ? "left-handed" : pitcherHand === "R" ? "right-handed" : "unknown-handed";
  if (!pitcherHand || lineupHandedness === "unknown") {
    return {
      edge: "unknown",
      summary: `${pitcherName}'s handedness is known, but ${lineupTeamKey}'s lineup tendency could not be pinned down reliably.`,
      reasoning: lineupSummary,
    };
  }

  if (lineupHandedness === "balanced") {
    return {
      edge: "neutral",
      summary: `${pitcherName} is ${handLabel}, and ${lineupTeamKey}'s active lineup looks fairly balanced. No clear handedness edge.`,
      reasoning: lineupSummary,
    };
  }

  const sameSide =
    (pitcherHand === "R" && lineupHandedness === "right") ||
    (pitcherHand === "L" && lineupHandedness === "left");

  return {
    edge: sameSide ? "pitcher" : "hitter",
    summary: `${pitcherName} is ${pitcherHand}HP. ${lineupTeamKey}'s lineup trends ${lineupHandedness}-handed. Slight ${
      sameSide ? "pitcher" : "hitter"
    } advantage.`,
    reasoning: lineupSummary,
  };
}

async function fetchBoxscore(
  gamePk: number,
  dataMode: "live" | "fixture",
  cacheBust?: string,
): Promise<MlbBoxscoreResponse | undefined> {
  try {
    const result = await fetchMlbJson<MlbBoxscoreResponse>({
      endpoint: `/game/${gamePk}/boxscore`,
      fixtureFile: "game_boxscore.json",
      ttlSeconds: 300,
      dataMode,
      cacheBust,
    });
    return result.data;
  } catch {
    return undefined;
  }
}

function extractStarterFromBoxscore(
  team: MlbBoxscoreTeam | undefined,
): {
  playerId: number;
  fullName: string;
  outing?: NonNullable<MlbBoxscoreTeamPlayer["stats"]>["pitching"];
  season?: NonNullable<MlbBoxscoreTeamPlayer["seasonStats"]>["pitching"];
} | null {
  const starterId = team?.pitchers?.[0];
  if (!starterId) return null;
  const player = team?.players?.[`ID${starterId}`];
  return {
    playerId: starterId,
    fullName: player?.person?.fullName ?? "Unknown",
    outing: player?.stats?.pitching,
    season: player?.seasonStats?.pitching,
  };
}

function durationFromBoxscore(boxscore?: MlbBoxscoreResponse): string | undefined {
  const duration = boxscore?.info?.find((entry) => entry.label === "T")?.value;
  return duration || undefined;
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
        params: { sportId: 1, teamId, startDate, endDate, hydrate: "probablePitcher" },
        fixtureFile: "team_next_7.json",
        ttlSeconds: 300,
        dataMode: dm,
        cacheBust,
      });

      const games = flattenSchedule(result.data).filter(
        (game) => new Date(game.gameDate).getTime() >= new Date(`${startDate}T00:00:00Z`).getTime(),
      );
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
              gameType: game.gameType,
              gameTypeLabel: gameTypeLabel(game.gameType),
              venue: game.venue?.name,
              seriesDescription: game.seriesDescription,
              probableStarter: isHome
                ? game.teams.home.probablePitcher
                  ? {
                      playerId: String(game.teams.home.probablePitcher.id),
                      fullName: game.teams.home.probablePitcher.fullName,
                      throwsHand: game.teams.home.probablePitcher.pitchHand?.code,
                    }
                  : null
                : game.teams.away.probablePitcher
                ? {
                    playerId: String(game.teams.away.probablePitcher.id),
                    fullName: game.teams.away.probablePitcher.fullName,
                    throwsHand: game.teams.away.probablePitcher.pitchHand?.code,
                  }
                : null,
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
      const seasonsToTry = [MLB_SEASON, MLB_SEASON - 1];
      let selectedSeason = MLB_SEASON;
      let selectedPitches: PitcherArsenal["pitches"] = [];
      let selectedMeta: Meta | null = null;

      for (const season of seasonsToTry) {
        const arsenalResult = await fetchMlbJson<MlbPitchArsenalResponse>({
          endpoint: `/people/${encodeURIComponent(playerId)}/stats`,
          params: { stats: "pitchArsenal", season },
          fixtureFile:
            season === MLB_SEASON ? "pitcher_arsenal_2026.json" : "pitcher_arsenal_2025.json",
          ttlSeconds: 3_600,
          dataMode: dm,
          cacheBust,
        });
        selectedMeta = asMeta(arsenalResult.meta);
        selectedPitches = extractPitchArsenal(arsenalResult.data);
        if (selectedPitches.length > 0) {
          selectedSeason = season;
          break;
        }
      }

      const seasonStats = await fetchPitcherSeasonSummary(
        Number.parseInt(playerId, 10),
        dm,
        cacheBust,
        [selectedSeason],
      );
      const status: PitcherArsenal["status"] =
        selectedPitches.length === 0
          ? "unavailable"
          : selectedSeason === MLB_SEASON
          ? "current"
          : "fallback";

      return {
        data: {
          playerId,
          season: selectedSeason,
          seasonLabel:
            status === "fallback"
              ? `${selectedSeason} arsenal (${MLB_SEASON} data pending)`
              : `${selectedSeason} arsenal`,
          fallbackSeason: status === "fallback" ? selectedSeason : undefined,
          status,
          message:
            status === "fallback"
              ? `${selectedSeason} arsenal shown because ${MLB_SEASON} pitch data is not yet available.`
              : status === "unavailable"
              ? "Arsenal data not yet available for this pitcher."
              : undefined,
          pitches: selectedPitches,
          seasonStats,
        },
        meta:
          selectedMeta ?? {
            sourceUsed: "demo",
            updatedAt: nowISO(),
            requestId: randomUUID(),
            dataMode: dm,
          },
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getPitcherArsenal", error, dm) };
    }
  },

  async getSeriesTracker(teamKey, dataMode, cacheBust, gameTypeFilter = "R", seriesId) {
    const dm = resolveDataMode(dataMode);
    const teamId = MLB_TEAM_IDS[teamKey];
    if (!teamId) return { data: null, meta: unknownTeamMeta(teamKey, dm) };

    const filter = gameTypeFilter === "S" ? "S" : "R";
    const today = todayISO();
    const startDate = addDays(today, -21);
    const endDate = addDays(today, 10);

    try {
      const result = await fetchMlbJson<MlbScheduleResponse>({
        endpoint: "/schedule",
        params: { sportId: 1, teamId, startDate, endDate, gameType: filter },
        fixtureFile: "team_next_7.json",
        ttlSeconds: 300,
        dataMode: dm,
        cacheBust,
      });

      const allGames = flattenSchedule(result.data).filter((game) => (game.gameType ?? filter) === filter);
      const firstGame = allGames[0];
      const teamName = firstGame
        ? firstGame.teams.home.team.id === teamId
          ? firstGame.teams.home.team.name
          : firstGame.teams.away.team.name
        : teamKey;

      type SeriesGroup = {
        seriesId: string;
        opponentId: number;
        opponentName: string;
        opponentKey: string;
        homeAway: "home" | "away";
        games: MlbGameEntry[];
      };

      const seriesGroups: SeriesGroup[] = [];
      for (const game of allGames) {
        const isHome = game.teams.home.team.id === teamId;
        const opponent = isHome ? game.teams.away.team : game.teams.home.team;
        const opponentKey = MLB_TEAM_ABBREVS[opponent.id] ?? abbrevFromName(opponent.name);
        const homeAway = (isHome ? "home" : "away") as "home" | "away";
        const lastGroup = seriesGroups[seriesGroups.length - 1];
        if (
          lastGroup &&
          lastGroup.opponentId === opponent.id &&
          lastGroup.homeAway === homeAway
        ) {
          lastGroup.games.push(game);
        } else {
          seriesGroups.push({
            seriesId: `${filter}-${opponentKey}-${game.officialDate}`,
            opponentId: opponent.id,
            opponentName: opponent.name,
            opponentKey,
            homeAway,
            games: [game],
          });
        }
      }

      const mapSeries = async (group: SeriesGroup, enrichCompletedGames: boolean): Promise<MlbSeriesInfo> => {
        let teamWins = 0;
        let teamLosses = 0;
        const boxscores = enrichCompletedGames
          ? await Promise.all(
              group.games.map((game) =>
                game.status.abstractGameState === "Final" ? fetchBoxscore(game.gamePk, dm, cacheBust) : Promise.resolve(undefined),
              ),
            )
          : [];

        const games = group.games.map((game, index) => {
          if (
            game.status.abstractGameState === "Final" &&
            game.teams.home.score !== undefined &&
            game.teams.away.score !== undefined
          ) {
            const isHome = group.homeAway === "home";
            const teamScore = isHome ? game.teams.home.score : game.teams.away.score;
            const oppScore = isHome ? game.teams.away.score : game.teams.home.score;
            if (teamScore > oppScore) teamWins += 1;
            else teamLosses += 1;
          }

          const boxscore = enrichCompletedGames ? boxscores[index] : undefined;
          const teamBox = group.homeAway === "home" ? boxscore?.teams?.home : boxscore?.teams?.away;
          const starter = extractStarterFromBoxscore(teamBox);

          return {
            gamePk: game.gamePk,
            date: game.officialDate,
            gameTime: game.gameDate,
            status: game.status.detailedState,
            opponent: group.opponentName,
            opponentKey: group.opponentKey,
            homeAway: group.homeAway,
            gameType: game.gameType,
            gameTypeLabel: gameTypeLabel(game.gameType),
            homeScore: game.teams.home.score,
            awayScore: game.teams.away.score,
            venue: game.venue?.name,
            duration: durationFromBoxscore(boxscore),
            startingPitcher: starter?.fullName ?? null,
          } satisfies MlbSeriesGame;
        });

        return {
          seriesId: group.seriesId,
          opponent: group.opponentName,
          opponentKey: group.opponentKey,
          homeAway: group.homeAway,
          games,
          teamWins,
          teamLosses,
          seriesDescription: group.games[0]?.seriesDescription ?? gameTypeLabel(filter),
          gameTypeFilter: filter,
          gameTypeLabel: gameTypeLabel(filter),
        };
      };

      const availableSeries = await Promise.all(seriesGroups.map((group) => mapSeries(group, false)));
      const defaultSeries =
        seriesGroups.find((group) => group.games.some((game) => game.officialDate >= today)) ??
        seriesGroups[seriesGroups.length - 1] ??
        null;
      const selectedBaseSeries =
        seriesGroups.find((group) => group.seriesId === seriesId) ?? defaultSeries;
      const selectedSeries = selectedBaseSeries ? await mapSeries(selectedBaseSeries, true) : null;

      return {
        data: {
          teamKey,
          teamName,
          gameTypeFilter: filter,
          availableSeries,
          selectedSeries,
        },
        meta: asMeta(result.meta),
      };
    } catch (error) {
      return { data: null, meta: errorMeta("getSeriesTracker", error, dm) };
    }
  },
  async getStartingPitcherMatchup(gamePk, dataMode, cacheBust, teamKey) {
    const dm = resolveDataMode(dataMode);
    const normalizedTeamKey = typeof teamKey === "string" ? teamKey.toUpperCase() : undefined;
    const teamId = normalizedTeamKey ? MLB_TEAM_IDS[normalizedTeamKey] : undefined;
    const today = todayISO();

    try {
      let scheduleResult: { data: MlbScheduleResponse; meta: Meta };
      if (teamId) {
        const result = await fetchMlbJson<MlbScheduleResponse>({
          endpoint: "/schedule",
          params: {
            sportId: 1,
            teamId,
            startDate: addDays(today, -14),
            endDate: addDays(today, 7),
            hydrate: "probablePitcher",
            gameType: "R,S",
          },
          fixtureFile: "team_next_7.json",
          ttlSeconds: 300,
          dataMode: dm,
          cacheBust,
        });
        scheduleResult = { data: result.data, meta: asMeta(result.meta) };
      } else {
        const result = await fetchMlbJson<MlbScheduleResponse>({
          endpoint: "/schedule",
          params: { sportId: 1, gamePk, hydrate: "probablePitcher" },
          fixtureFile: "game_with_pitchers.json",
          ttlSeconds: 300,
          dataMode: dm,
          cacheBust,
        });
        scheduleResult = { data: result.data, meta: asMeta(result.meta) };
      }

      const games = flattenSchedule(scheduleResult.data).filter((game) => {
        if (teamId) {
          return game.teams.home.team.id === teamId || game.teams.away.team.id === teamId;
        }
        return true;
      });
      const upcomingGame = games.find((game) => game.status.abstractGameState !== "Final");
      const pastGames = [...games]
        .filter((game) => game.status.abstractGameState === "Final")
        .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
        .slice(0, 5);
      const optionGames = [upcomingGame, ...pastGames].filter(
        (game): game is MlbGameEntry => Boolean(game),
      );
      const selectedGamePk = gamePk ? Number.parseInt(String(gamePk), 10) : optionGames[0]?.gamePk;
      const selectedGame =
        optionGames.find((game) => game.gamePk === selectedGamePk) ??
        games.find((game) => game.gamePk === selectedGamePk) ??
        null;

      if (!selectedGame) {
        return {
          data: null,
          meta: { ...scheduleResult.meta, warning: "No matching game found for this team." },
        };
      }

      const awayRef = selectedGame.teams.away;
      const homeRef = selectedGame.teams.home;
      const awayKey = MLB_TEAM_ABBREVS[awayRef.team.id] ?? abbrevFromName(awayRef.team.name);
      const homeKey = MLB_TEAM_ABBREVS[homeRef.team.id] ?? abbrevFromName(homeRef.team.name);
      const boxscore =
        selectedGame.status.abstractGameState === "Final"
          ? await fetchBoxscore(selectedGame.gamePk, dm, cacheBust)
          : undefined;
      const awayStarter = boxscore ? extractStarterFromBoxscore(boxscore.teams?.away) : null;
      const homeStarter = boxscore ? extractStarterFromBoxscore(boxscore.teams?.home) : null;

      const buildPitcherInfo = async (
        teamRef: typeof awayRef,
        teamAbbrev: string,
        probablePitcher: MlbProbablePitcherEntry | undefined,
        starterFromBoxscore: ReturnType<typeof extractStarterFromBoxscore>,
      ): Promise<MlbPitcherInfo | null> => {
        const pitcherId = probablePitcher?.id ?? starterFromBoxscore?.playerId;
        if (!pitcherId) return null;
        const fullName = probablePitcher?.fullName ?? starterFromBoxscore?.fullName ?? "TBD";
        const [seasonSummary, throwingHand, gameLog] = await Promise.all([
          fetchPitcherSeasonSummary(pitcherId, dm, cacheBust),
          fetchPitcherThrowingHand(pitcherId, dm, cacheBust),
          fetchPitcherGameLog(pitcherId, dm, cacheBust),
        ]);
        const boxscoreSeason = starterFromBoxscore?.season;
        const inningsPitched = seasonSummary?.inningsPitched ?? boxscoreSeason?.inningsPitched;
        const strikeOuts = seasonSummary?.strikeOuts ?? boxscoreSeason?.strikeOuts;
        const baseOnBalls = seasonSummary?.baseOnBalls ?? boxscoreSeason?.baseOnBalls;
        const info: MlbPitcherInfo = {
          playerId: String(pitcherId),
          fullName,
          teamKey: teamAbbrev,
          teamName: teamRef.team.name,
          throwsHand: probablePitcher?.pitchHand?.code ?? throwingHand,
          era: seasonSummary?.era ?? boxscoreSeason?.era,
          whip: seasonSummary?.whip ?? boxscoreSeason?.whip,
          inningsPitched,
          strikeOuts,
          wins: seasonSummary?.wins ?? boxscoreSeason?.wins,
          losses: seasonSummary?.losses ?? boxscoreSeason?.losses,
          baseOnBalls,
          kPer9: seasonSummary?.kPer9 ?? boxscoreSeason?.strikeoutsPer9Inn ?? formatPerNine(strikeOuts, inningsPitched),
          bbPer9: seasonSummary?.bbPer9 ?? boxscoreSeason?.walksPer9Inn ?? formatPerNine(baseOnBalls, inningsPitched),
          seasonUsed: seasonSummary?.seasonUsed ?? gameLog.seasonUsed,
          last5Starts: buildLast5StartsSummary(fullName, gameLog.splits ?? []),
        };
        info.scoutingNote = summarizePitcherScouting(info);
        return info;
      };

      const [awayPitcher, homePitcher] = await Promise.all([
        buildPitcherInfo(awayRef, awayKey, awayRef.probablePitcher, awayStarter),
        buildPitcherInfo(homeRef, homeKey, homeRef.probablePitcher, homeStarter),
      ]);

      const options = optionGames.map((game) => {
        const isHome = teamId ? game.teams.home.team.id === teamId : false;
        const opponent = teamId ? (isHome ? game.teams.away.team : game.teams.home.team) : game.teams.away.team;
        const opponentKey = MLB_TEAM_ABBREVS[opponent.id] ?? abbrevFromName(opponent.name);
        const loc = teamId ? (isHome ? `vs ${opponentKey}` : `@ ${opponentKey}`) : `${game.teams.away.team.name} @ ${game.teams.home.team.name}`;
        const isUpcoming = game.status.abstractGameState !== "Final";
        return {
          gamePk: game.gamePk,
          label: `${isUpcoming ? "Next Game" : "Past Game"}: ${loc} · ${game.officialDate} (${gameTypeLabel(game.gameType)})`,
          gameDate: game.officialDate,
          gameType: game.gameType,
          gameTypeLabel: gameTypeLabel(game.gameType),
          status: game.status.detailedState,
          isUpcoming,
        };
      });

      const scoutingSummary =
        selectedGame.status.abstractGameState === "Final"
          ? `This view shows the actual starters from the selected ${gameTypeLabel(selectedGame.gameType).toLowerCase()} game.`
          : `This view shows the probable starters for the next scheduled game.`;
      const advancedSummary = `${awayPitcher?.fullName ?? "TBD"}: ${awayPitcher?.scoutingNote ?? "No season line posted yet."} ${homePitcher?.fullName ?? "TBD"}: ${homePitcher?.scoutingNote ?? "No season line posted yet."}`;

      return {
        data: {
          options,
          selectedGamePk: selectedGame.gamePk,
          game: {
            gameId: String(selectedGame.gamePk),
            gamePk: selectedGame.gamePk,
            gameTime: selectedGame.gameDate,
            officialDate: selectedGame.officialDate,
            status: selectedGame.status.detailedState,
            gameType: selectedGame.gameType,
            gameTypeLabel: gameTypeLabel(selectedGame.gameType),
            homeTeam: { key: homeKey, name: homeRef.team.name, id: homeRef.team.id },
            awayTeam: { key: awayKey, name: awayRef.team.name, id: awayRef.team.id },
            venue: selectedGame.venue?.name,
            seriesDescription: selectedGame.seriesDescription,
          },
          pitchers: {
            away: awayPitcher,
            home: homePitcher,
          },
          scoutingSummary,
          advancedSummary,
        },
        meta: scheduleResult.meta,
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
          gameType: game.gameType,
          gameTypeLabel: gameTypeLabel(game.gameType),
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

      const games = flattenSchedule(schedResult.data).filter(
        (game) => game.status.abstractGameState !== "Final",
      );
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

      async function fetchSplits(pitcherId: number): Promise<MlbPitcherSplits> {
        try {
          const res = await fetchMlbJson<MlbPitcherSplitsResponse>({
            endpoint: `/people/${pitcherId}/stats`,
            params: { stats: "statSplits", group: "pitching", season: MLB_SEASON, sitCodes: "vl,vr" },
            fixtureFile: "pitcher_splits.json",
            ttlSeconds: 3600,
            dataMode: dm,
            cacheBust,
          });
          const group = res.data.stats?.find(
            (s) => s.group?.displayName?.toLowerCase() === "pitching",
          );
          const splits = group?.splits ?? [];
          const vl = splits.find((s) => s.split?.code === "vl");
          const vr = splits.find((s) => s.split?.code === "vr");
          return {
            vsLeft: vl
              ? {
                  era: vl.stat?.era,
                  whip: vl.stat?.whip,
                  avg: vl.stat?.avg,
                  ops: vl.stat?.ops,
                  sample: vl.stat?.battersFaced,
                }
              : null,
            vsRight: vr
              ? {
                  era: vr.stat?.era,
                  whip: vr.stat?.whip,
                  avg: vr.stat?.avg,
                  ops: vr.stat?.ops,
                  sample: vr.stat?.battersFaced,
                }
              : null,
          };
        } catch {
          return { vsLeft: null, vsRight: null };
        }
      }

      const [homeSplits, awaySplits, homeThrowingHand, awayThrowingHand, awayLineup, homeLineup] =
        await Promise.all([
          homeRef.probablePitcher ? fetchSplits(homeRef.probablePitcher.id) : Promise.resolve({ vsLeft: null, vsRight: null }),
          awayRef.probablePitcher ? fetchSplits(awayRef.probablePitcher.id) : Promise.resolve({ vsLeft: null, vsRight: null }),
          homeRef.probablePitcher
            ? fetchPitcherThrowingHand(homeRef.probablePitcher.id, dm, cacheBust)
            : Promise.resolve(undefined),
          awayRef.probablePitcher
            ? fetchPitcherThrowingHand(awayRef.probablePitcher.id, dm, cacheBust)
            : Promise.resolve(undefined),
          fetchTeamLineupHandedness(awayRef.team.id, dm, cacheBust),
          fetchTeamLineupHandedness(homeRef.team.id, dm, cacheBust),
        ]);

      const homeAnalysis = homeRef.probablePitcher
        ? summarizeHandednessMatchup(
            homeRef.probablePitcher.fullName,
            homeRef.probablePitcher.pitchHand?.code ?? homeThrowingHand,
            awayKey,
            awayLineup.lineupHandedness,
            awayLineup.lineupSummary,
          )
        : null;
      const awayAnalysis = awayRef.probablePitcher
        ? summarizeHandednessMatchup(
            awayRef.probablePitcher.fullName,
            awayRef.probablePitcher.pitchHand?.code ?? awayThrowingHand,
            homeKey,
            homeLineup.lineupHandedness,
            homeLineup.lineupSummary,
          )
        : null;

      const homeEraVsL = Number.parseFloat(homeSplits.vsLeft?.era ?? "NaN");
      const homeEraVsR = Number.parseFloat(homeSplits.vsRight?.era ?? "NaN");
      const awayEraVsL = Number.parseFloat(awaySplits.vsLeft?.era ?? "NaN");
      const awayEraVsR = Number.parseFloat(awaySplits.vsRight?.era ?? "NaN");
      const homeHasSplits = !Number.isNaN(homeEraVsL) && !Number.isNaN(homeEraVsR);
      const awayHasSplits = !Number.isNaN(awayEraVsL) && !Number.isNaN(awayEraVsR);

      let analysisMode: MlbPlatoonAdvantage["analysisMode"] = "handedness";
      let advantageScore = 0;
      let explanation =
        (homeKey === teamKey ? homeAnalysis?.summary : awayAnalysis?.summary) ??
        "Split data is unavailable, so this is using handedness context instead.";

      if (homeHasSplits || awayHasSplits) {
        analysisMode = "splits";
        const homeGap = homeHasSplits ? homeEraVsR - homeEraVsL : 0;
        const awayGap = awayHasSplits ? awayEraVsR - awayEraVsL : 0;
        advantageScore = Math.round((homeGap - awayGap) * 10) / 10;
        if (Math.abs(advantageScore) < 0.3) {
          explanation = `${homeRef.team.name} and ${awayRef.team.name} have similar starter split profiles for this matchup.`;
        } else if (advantageScore > 0) {
          explanation = `${homeRef.probablePitcher?.fullName ?? homeRef.team.name} shows the stronger split edge, so this leans slightly toward the home side.`;
        } else {
          explanation = `${awayRef.probablePitcher?.fullName ?? awayRef.team.name} shows the stronger split edge, so this leans slightly toward the away side.`;
        }
      } else {
        const edgeToScore = (side: "home" | "away", edge: "pitcher" | "hitter" | "neutral" | "unknown" | undefined): number => {
          if (!edge || edge === "neutral" || edge === "unknown") return 0;
          if (side === "home") return edge === "pitcher" ? 0.5 : -0.5;
          return edge === "pitcher" ? -0.5 : 0.5;
        };
        advantageScore = edgeToScore("home", homeAnalysis?.edge) + edgeToScore("away", awayAnalysis?.edge);
      }

      const advantage: "home" | "away" | "neutral" =
        advantageScore > 0.3 ? "home" : advantageScore < -0.3 ? "away" : "neutral";

      const homePitcherData = homeRef.probablePitcher
        ? {
            playerId: String(homeRef.probablePitcher.id),
            fullName: homeRef.probablePitcher.fullName,
            throwsHand: homeRef.probablePitcher.pitchHand?.code ?? homeThrowingHand ?? "?",
            splits: homeSplits,
          }
        : null;
      const awayPitcherData = awayRef.probablePitcher
        ? {
            playerId: String(awayRef.probablePitcher.id),
            fullName: awayRef.probablePitcher.fullName,
            throwsHand: awayRef.probablePitcher.pitchHand?.code ?? awayThrowingHand ?? "?",
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
          analysisMode,
          handednessAnalyses: [
            homeAnalysis
              ? {
                  pitcherTeamKey: homeKey,
                  lineupTeamKey: awayKey,
                  pitcherName: homeRef.probablePitcher?.fullName ?? homeRef.team.name,
                  pitcherHand: homeRef.probablePitcher?.pitchHand?.code ?? homeThrowingHand ?? "?",
                  lineupHandedness: awayLineup.lineupHandedness,
                  lineupSummary: awayLineup.lineupSummary,
                  edge: homeAnalysis.edge,
                  summary: homeAnalysis.summary,
                  reasoning: homeAnalysis.reasoning,
                }
              : null,
            awayAnalysis
              ? {
                  pitcherTeamKey: awayKey,
                  lineupTeamKey: homeKey,
                  pitcherName: awayRef.probablePitcher?.fullName ?? awayRef.team.name,
                  pitcherHand: awayRef.probablePitcher?.pitchHand?.code ?? awayThrowingHand ?? "?",
                  lineupHandedness: homeLineup.lineupHandedness,
                  lineupSummary: homeLineup.lineupSummary,
                  edge: awayAnalysis.edge,
                  summary: awayAnalysis.summary,
                  reasoning: awayAnalysis.reasoning,
                }
              : null,
          ].filter((value): value is NonNullable<MlbPlatoonAdvantage["handednessAnalyses"][number]> => Boolean(value)),
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

      type LinescoreGame = MlbGameEntry & {
        linescore?: {
          teams?: {
            home?: { runs?: number };
            away?: { runs?: number };
          };
        };
      };
      const allGames: LinescoreGame[] = (result.data.dates ?? [])
        .flatMap((dateEntry) => dateEntry.games as LinescoreGame[])
        .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
      const finalGames = allGames.filter((game) => game.status.abstractGameState === "Final");

      const firstGame = allGames[0];
      const teamName = firstGame
        ? firstGame.teams.home.team.id === teamId
          ? firstGame.teams.home.team.name
          : firstGame.teams.away.team.name
        : teamKey;

      function computePeriod(days: number): MlbFormPeriod {
        const cutoff = addDays(endDate, -days);
        const games = finalGames.filter((game) => game.officialDate >= cutoff && game.officialDate <= endDate);
        let wins = 0;
        let losses = 0;
        let runsScored = 0;
        let runsAllowed = 0;

        for (const game of games) {
          const isHome = game.teams.home.team.id === teamId;
          const teamRuns = isHome
            ? (game.linescore?.teams?.home?.runs ?? game.teams.home.score ?? 0)
            : (game.linescore?.teams?.away?.runs ?? game.teams.away.score ?? 0);
          const oppRuns = isHome
            ? (game.linescore?.teams?.away?.runs ?? game.teams.away.score ?? 0)
            : (game.linescore?.teams?.home?.runs ?? game.teams.home.score ?? 0);
          runsScored += teamRuns;
          runsAllowed += oppRuns;
          if (teamRuns > oppRuns) wins += 1;
          else losses += 1;
        }

        const totalGames = wins + losses;
        const winPct = totalGames > 0 ? wins / totalGames : 0;
        const runDiff = runsScored - runsAllowed;
        return {
          days,
          wins,
          losses,
          runsScored,
          runsAllowed,
          runDiff,
          winPct: Math.round(winPct * 1000) / 1000,
          games: totalGames,
          runDiffPerGame: totalGames > 0 ? Math.round((runDiff / totalGames) * 10) / 10 : 0,
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

      const gameTypeCounts = finalGames.reduce(
        (acc, game) => {
          const key = game.gameType === "S" ? "S" : game.gameType === "R" ? "R" : "other";
          acc[key] += 1;
          return acc;
        },
        { R: 0, S: 0, other: 0 },
      );
      const primaryGameType: MlbRecentForm["primaryGameType"] =
        gameTypeCounts.S > 0 && gameTypeCounts.R === 0
          ? "S"
          : gameTypeCounts.R > 0 && gameTypeCounts.S === 0
          ? "R"
          : gameTypeCounts.R > 0 || gameTypeCounts.S > 0
          ? "mixed"
          : "unknown";
      const primaryGameTypeLabel =
        primaryGameType === "S"
          ? "Spring Training"
          : primaryGameType === "R"
          ? "Regular Season"
          : primaryGameType === "mixed"
          ? "Mixed sample"
          : "No recent sample";
      const sampleContext =
        primaryGameType === "S"
          ? `This is based on Spring Training ${MLB_SEASON} results from the last 7, 14, and 30 days.`
          : primaryGameType === "R"
          ? `This is based on Regular Season ${MLB_SEASON} results from the last 7, 14, and 30 days.`
          : primaryGameType === "mixed"
          ? `This blends Spring Training and Regular Season games from the last 7, 14, and 30 days.`
          : `No completed games were found in the last 30 days.`;

      const runDiffPhrase =
        last7.runDiffPerGame > 0
          ? `outscoring opponents by ${Math.abs(last7.runDiffPerGame).toFixed(1)} runs per game`
          : last7.runDiffPerGame < 0
          ? `being outscored by ${Math.abs(last7.runDiffPerGame).toFixed(1)} runs per game`
          : `playing even in run differential`;
      const stretchLabel =
        rating === "hot" ? "hot stretch" : rating === "warm" ? "steady stretch" : rating === "cool" ? "cool stretch" : "cold stretch";
      const explanation =
        last7.games > 0
          ? `${teamName} have gone ${last7.wins}-${last7.losses} in their last ${last7.games} game${last7.games === 1 ? "" : "s"} over the last ${last7.days} days and are ${runDiffPhrase}. They are in a ${stretchLabel}${primaryGameType === "S" ? " heading into the season" : " right now"}.`
          : `${teamName} have not played a completed game in the last 7 days, so there is not a short-term form read yet.`;

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
          sampleContext,
          primaryGameType,
          primaryGameTypeLabel,
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
      const rosterResult = await fetchMlbJson<MlbRosterResponse>({
        endpoint: `/teams/${teamId}/roster`,
        params: { rosterType: "active", season: MLB_SEASON },
        fixtureFile: "team_roster.json",
        ttlSeconds: 1800,
        dataMode: dm,
        cacheBust,
      });

      const roster = (rosterResult.data.roster ?? []).filter((player) => player.status?.code === "A");
      const pitchers = roster.filter(
        (player) => player.position?.type === "Pitcher" || player.position?.abbreviation === "P",
      );
      const today = new Date(`${todayISO()}T12:00:00Z`);

      const recentSchedule = await fetchMlbJson<MlbScheduleResponse>({
        endpoint: "/schedule",
        params: { sportId: 1, teamId, startDate: addDays(todayISO(), -10), endDate: todayISO(), gameType: "R,S" },
        fixtureFile: "recent_form_schedule.json",
        ttlSeconds: 300,
        dataMode: dm,
        cacheBust,
      });
      const recentGames = flattenSchedule(recentSchedule.data)
        .filter((game) => game.status.abstractGameState === "Final")
        .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
        .slice(0, 7);
      const recentBoxscores = await Promise.all(
        recentGames.map((game) => fetchBoxscore(game.gamePk, dm, cacheBust)),
      );

      const pitcherSnapshots = await Promise.all(
        pitchers.map(async (pitcher) => {
          const pitcherId = pitcher.person?.id ?? 0;
          const [seasonSummary, gameLog] = await Promise.all([
            fetchPitcherSeasonSummary(pitcherId, dm, cacheBust),
            fetchPitcherGameLog(pitcherId, dm, cacheBust),
          ]);
          const recentSplits = (gameLog.splits ?? [])
            .filter((split) => {
              if (!split.date) return false;
              const gameDate = new Date(`${split.date}T12:00:00Z`);
              const diffDays = (today.getTime() - gameDate.getTime()) / (1000 * 60 * 60 * 24);
              return diffDays >= 0 && diffDays <= 5;
            })
            .sort(
              (a, b) =>
                new Date(`${b.date ?? "1970-01-01"}T12:00:00Z`).getTime() -
                new Date(`${a.date ?? "1970-01-01"}T12:00:00Z`).getTime(),
            );
          const lastAppearance = recentSplits[0];
          const lastAppearanceDate = lastAppearance?.date ?? null;
          const lastAppearancePitches = pitchCountFromStat(lastAppearance?.stat) ?? null;
          const lastAppearanceStrikes = strikesFromStat(lastAppearance?.stat) ?? null;
          const daysRest = lastAppearanceDate
            ? Math.floor((today.getTime() - new Date(`${lastAppearanceDate}T12:00:00Z`).getTime()) / (1000 * 60 * 60 * 24))
            : 99;
          let fatigue: MlbPitcherAvailability["fatigue"];
          if (daysRest === 99) {
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
            playerId: String(pitcherId),
            fullName: pitcher.person?.fullName ?? "Unknown",
            seasonSummary,
            gameLogSeason: gameLog.seasonUsed,
            availability: {
              playerId: String(pitcherId),
              fullName: pitcher.person?.fullName ?? "Unknown",
              fatigue,
              daysRest,
              lastAppearance: lastAppearanceDate,
              lastAppearancePitches,
              lastAppearanceStrikes,
              inningsLastAppearance: lastAppearance?.stat?.inningsPitched ?? null,
              seasonKPer9: seasonSummary?.kPer9,
              seasonUsed: seasonSummary?.seasonUsed ?? gameLog.seasonUsed,
              recentAppearances: recentSplits.map((split) => ({
                date: split.date ?? "",
                inningsPitched: split.stat?.inningsPitched ?? "0.0",
                numberOfPitches: pitchCountFromStat(split.stat) ?? 0,
                strikes: strikesFromStat(split.stat),
              })),
            } satisfies MlbPitcherAvailability,
          };
        }),
      );

      const starterMap = new Map<string, MlbBullpenFatigue["starters"][number]>();
      for (let index = 0; index < recentGames.length; index += 1) {
        const game = recentGames[index];
        const boxscore = recentBoxscores[index];
        if (!boxscore) continue;
        const isHome = game.teams.home.team.id === teamId;
        const teamBox = isHome ? boxscore.teams?.home : boxscore.teams?.away;
        const starter = extractStarterFromBoxscore(teamBox);
        if (!starter) continue;
        const starterId = String(starter.playerId);
        if (starterMap.has(starterId)) continue;
        const seasonSummary = pitcherSnapshots.find((snapshot) => snapshot.playerId === starterId)?.seasonSummary;
        starterMap.set(starterId, {
          playerId: starterId,
          fullName: starter.fullName,
          lastStartDate: game.officialDate,
          daysRest: Math.floor((today.getTime() - new Date(`${game.officialDate}T12:00:00Z`).getTime()) / (1000 * 60 * 60 * 24)),
          inningsLastStart: starter.outing?.inningsPitched ?? null,
          pitchesLastStart: pitchCountFromStat(starter.outing) ?? null,
          strikesLastStart: strikesFromStat(starter.outing) ?? null,
          seasonKPer9: seasonSummary?.kPer9,
          seasonUsed: seasonSummary?.seasonUsed,
        });
      }

      const fallbackStarters = [...pitcherSnapshots]
        .filter((snapshot) => !starterMap.has(snapshot.playerId))
        .sort((a, b) => (b.seasonSummary?.gamesStarted ?? 0) - (a.seasonSummary?.gamesStarted ?? 0))
        .slice(0, Math.max(0, 5 - starterMap.size));
      for (const snapshot of fallbackStarters) {
        starterMap.set(snapshot.playerId, {
          playerId: snapshot.playerId,
          fullName: snapshot.fullName,
          lastStartDate: snapshot.availability.lastAppearance,
          daysRest: snapshot.availability.daysRest,
          inningsLastStart: snapshot.availability.inningsLastAppearance ?? null,
          pitchesLastStart: snapshot.availability.lastAppearancePitches,
          strikesLastStart: snapshot.availability.lastAppearanceStrikes,
          seasonKPer9: snapshot.seasonSummary?.kPer9,
          seasonUsed: snapshot.seasonSummary?.seasonUsed ?? snapshot.gameLogSeason,
        });
      }

      const fatigueOrder: Record<MlbPitcherAvailability["fatigue"], number> = {
        fatigued: 0,
        tired: 1,
        available: 2,
        fresh: 3,
        rested: 4,
      };
      const starters = [...starterMap.values()].sort((a, b) => a.daysRest - b.daysRest);
      const relievers = pitcherSnapshots
        .filter((snapshot) => !starterMap.has(snapshot.playerId))
        .map((snapshot) => snapshot.availability)
        .sort((a, b) => fatigueOrder[a.fatigue] - fatigueOrder[b.fatigue]);

      const firstGame = recentGames[0];
      const teamName = firstGame
        ? firstGame.teams.home.team.id === teamId
          ? firstGame.teams.home.team.name
          : firstGame.teams.away.team.name
        : teamKey;

      return {
        data: {
          teamKey,
          teamName,
          starters,
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
// Legacy alias â€” keeps any existing import of mlbProviderStub working
// ---------------------------------------------------------------------------
/** @deprecated Use mlbProvider instead */
export const mlbProviderStub = mlbProvider;







=======
export { getMlbTeamSeasonScheduleWithProbables, getMlbUpcomingScheduleWithProbables, mlbProvider } from "@/lib/providers/mlb/provider";
export { resolveMlbPitcherComparisonStats } from "@/lib/providers/mlb/pitcherComparison";
export type {
  MlbProvider,
  MlbNextGame,
  MlbNextGames,
  MlbScheduledGame,
  MlbScheduledProbableStarter,
  MlbScheduledTeam,
  MlbArsenalPitch,
  PitcherArsenal,
} from "@/lib/providers/mlb/provider";
export type {
  MlbPitcherComparisonCard,
  MlbPitcherLastStart,
  MlbPitcherStatBasis,
  ResolveMlbPitcherComparisonStatsArgs,
  ResolveMlbPitcherComparisonStatsResult,
} from "@/lib/providers/mlb/pitcherComparison";
>>>>>>> 5518813dbf8beb460abbc3bf1376ae9c65caee03
