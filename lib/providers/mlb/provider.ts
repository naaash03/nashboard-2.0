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
  spinRpm?: number;
};

export type PitcherArsenal = {
  playerId: string;
  playerName?: string;
  season?: number;
  seasonLabel?: string;
  fallbackSeason?: number;
  status?: "current" | "fallback" | "unavailable";
  message?: string;
  pitches: MlbArsenalPitch[];
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

export type MlbPlayerSearchResult = {
  playerId: string;
  fullName: string;
  teamKey?: string;
  teamName?: string;
  position?: string;
  throwsHand?: string;
  batsHand?: string;
};

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

export type MlbPlayerYearStats = {
  season: number;
  gamesPlayed?: number;
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
  record: {
    wins: number;
    losses: number;
    pct: string;
    divisionRank?: number;
    gamesBack?: string;
  };
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

export type MlbPitcherSplitSide = {
  era?: string;
  whip?: string;
  avg?: string;
  ops?: string;
  sample?: number;
};

export type MlbPitcherSplits = {
  vsLeft: MlbPitcherSplitSide | null;
  vsRight: MlbPitcherSplitSide | null;
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
  officialDate?: string;
  gameType?: string;
  status: "scheduled" | "live" | "final";
  detailedState?: string;
  abstractState?: string;
  venue?: string;
  awayScore?: number;
  homeScore?: number;
  seriesDescription?: string;
  seriesGameNumber?: number;
  gamesInSeries?: number;
  doubleHeader?: string;
  gameNumber?: number;
  rescheduleDate?: string;
  rescheduledFrom?: string;
  awayTeam: MlbScheduledTeam;
  homeTeam: MlbScheduledTeam;
};

export interface MlbProvider {
  getNextSevenGames(teamKey: string, mode: Mode, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ data: MlbNextGames | null; meta: Meta }>;
  getPitcherArsenal(playerId: string, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ data: PitcherArsenal | null; meta: Meta }>;
  searchPlayers(query: string, limit?: number, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ data: MlbPlayerSearchResult[]; meta: Meta }>;
  getRecentResults(teamKey: string, limit?: number, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ data: MlbRecentResults | null; meta: Meta }>;
  getPlayerSeasonStats(playerId: string, dataMode?: ModeArg): Promise<{ data: MlbPlayerSeasonStats | null; meta: Meta }>;
  getTeamSeasonStats(teamKey: string, season: number, dataMode?: ModeArg): Promise<{ data: MlbTeamSeasonStatsData | null; meta: Meta }>;
  getPlatoonAdvantage(teamKey: string, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ data: MlbPlatoonAdvantage | null; meta: Meta }>;
  getRecentForm(teamKey: string, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ data: MlbRecentForm | null; meta: Meta }>;
  getBullpenFatigue(teamKey: string, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ data: MlbBullpenFatigue | null; meta: Meta }>;
}

type MlbScheduleGame = {
  gamePk?: number;
  gameDate?: string;
  officialDate?: string;
  gameType?: string;
  seriesDescription?: string;
  seriesGameNumber?: number;
  gamesInSeries?: number;
  doubleHeader?: string;
  gameNumber?: number;
  rescheduleDate?: string;
  rescheduledFromDate?: string;
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
      score?: number;
      probablePitcher?: { id?: number; fullName?: string; pitchHand?: { code?: string; description?: string } };
    };
    home?: {
      team?: { id?: number; name?: string };
      score?: number;
      probablePitcher?: { id?: number; fullName?: string; pitchHand?: { code?: string; description?: string } };
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

type MlbPitchArsenalStatsResponse = {
  stats?: Array<{
    type?: { displayName?: string };
    group?: { displayName?: string };
    splits?: Array<{
      stat?: {
        pitchType?: { code?: string; description?: string };
        percentage?: number;
        averageSpeed?: number;
        averageSpin?: number;
      };
    }>;
  }>;
};

type MlbPeopleResponse = {
  people?: Array<{
    id?: number;
    fullName?: string;
    currentTeam?: { id?: number; name?: string };
    primaryPosition?: { code?: string; name?: string; type?: string; abbreviation?: string };
    pitchHand?: { code?: string; description?: string };
    batSide?: { code?: string; description?: string };
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
      };
    }>;
  }>;
};

type MlbSeasonStatsResponse = {
  stats?: Array<{
    type?: { displayName?: string };
    group?: { displayName?: string };
    splits?: Array<{
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
      };
    }>;
  }>;
};

type MlbTeamStatsResponse = {
  stats?: Array<{
    type?: { displayName?: string };
    group?: { displayName?: string };
    splits?: Array<{
      team?: { id?: number; name?: string };
      stat?: {
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
    teamRecords?: Array<{
      team?: { id?: number; name?: string };
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
      split?: { code?: string };
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
    person?: { id?: number; fullName?: string };
    position?: { code?: string; name?: string; type?: string; abbreviation?: string };
    status?: { code?: string; description?: string };
  }>;
};

type MlbGameLogResponse = {
  stats?: Array<{
    splits?: Array<{
      date?: string;
      stat?: {
        inningsPitched?: string;
        numberOfPitches?: number;
        pitchesThrown?: number;
        strikes?: number;
        strikeOuts?: number;
        baseOnBalls?: number;
        earnedRuns?: number;
      };
    }>;
  }>;
};

type MlbBoxscoreTeamPlayer = {
  person?: { id?: number; fullName?: string };
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
};

type MlbBoxscoreTeam = {
  pitchers?: number[];
  players?: Record<string, MlbBoxscoreTeamPlayer>;
};

type MlbBoxscoreResponse = {
  teams?: {
    home?: MlbBoxscoreTeam;
    away?: MlbBoxscoreTeam;
  };
  info?: Array<{ label?: string; value?: string }>;
};

type PitchingSeasonSummary = NonNullable<PitcherArsenal["seasonStats"]> & {
  baseOnBalls?: number;
  kPer9?: string;
  bbPer9?: string;
  seasonUsed?: number;
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
  return normalizeScheduleGames(teamId, payload, { upcomingOnly: true });
}

function normalizeScheduleGames(
  teamId: number,
  payload: MlbScheduleResponse,
  options?: { upcomingOnly?: boolean },
): MlbScheduledGame[] {
  const rows: Array<{ gameDate: string; game: MlbScheduleGame }> = [];

  for (const dateBucket of payload.dates ?? []) {
    for (const game of dateBucket.games ?? []) {
      if (options?.upcomingOnly && !isUpcoming(game.gameDate, game.status?.abstractGameState)) {
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
    officialDate: game.officialDate,
    gameType: game.gameType,
    status: statusFromScheduleState(game.status?.abstractGameState),
    abstractState: game.status?.abstractGameState,
    detailedState: game.status?.detailedState,
    venue: game.venue?.name,
    awayScore: game.teams?.away?.score,
    homeScore: game.teams?.home?.score,
    seriesDescription: game.seriesDescription,
    seriesGameNumber: game.seriesGameNumber,
    gamesInSeries: game.gamesInSeries,
    doubleHeader: game.doubleHeader,
    gameNumber: game.gameNumber,
    rescheduleDate: game.rescheduleDate,
    rescheduledFrom: game.rescheduledFromDate,
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

function unknownTeamMeta(teamKey: string, sourceDataMode: ModeArg): Meta {
  return fallbackMeta(sourceDataMode, `Unknown MLB team key: ${teamKey.toUpperCase()}`);
}

function addDaysToIso(dateIso: string, days: number): string {
  return isoDate(addDays(new Date(`${dateIso}T12:00:00Z`), days));
}

function flattenSchedule(payload: MlbScheduleResponse): MlbScheduleGame[] {
  return (payload.dates ?? [])
    .flatMap((bucket) => bucket.games ?? [])
    .filter((game): game is MlbScheduleGame => Boolean(game.gameDate))
    .sort((a, b) => new Date(a.gameDate ?? "").getTime() - new Date(b.gameDate ?? "").getTime());
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

function pitchCountFromStat(stat?: { numberOfPitches?: number; pitchesThrown?: number }): number | undefined {
  return stat?.pitchesThrown ?? stat?.numberOfPitches;
}

function strikesFromStat(stat?: { strikes?: number }): number | undefined {
  return stat?.strikes;
}

function extractPitchArsenal(data: MlbPitchArsenalStatsResponse): PitcherArsenal["pitches"] {
  const arsenalGroup = data.stats?.find((item) => item.type?.displayName?.toLowerCase().includes("pitcharsenal"));
  return (arsenalGroup?.splits ?? [])
    .filter((split) => split.stat?.pitchType?.code)
    .map((split) => ({
      type: split.stat?.pitchType?.description ?? split.stat?.pitchType?.code ?? "Unknown",
      usagePct: toUsagePct(split.stat?.percentage),
      velocityMph: toVelocity(split.stat?.averageSpeed),
      spinRpm: typeof split.stat?.averageSpin === "number" ? Math.round(split.stat.averageSpin) : undefined,
    }))
    .sort((a, b) => (b.usagePct ?? 0) - (a.usagePct ?? 0));
}

function extractSeasonStats(data: MlbSeasonStatsResponse, seasonUsed?: number): PitchingSeasonSummary | undefined {
  const group = data.stats?.find((item) => item.group?.displayName?.toLowerCase() === "pitching");
  const split = group?.splits?.[0];
  if (!split?.stat) return undefined;

  return {
    era: split.stat.era,
    whip: split.stat.whip,
    inningsPitched: split.stat.inningsPitched,
    strikeOuts: split.stat.strikeOuts,
    wins: split.stat.wins,
    losses: split.stat.losses,
    gamesStarted: split.stat.gamesStarted,
    baseOnBalls: split.stat.baseOnBalls,
    kPer9: formatPerNine(split.stat.strikeOuts, split.stat.inningsPitched),
    bbPer9: formatPerNine(split.stat.baseOnBalls, split.stat.inningsPitched),
    seasonUsed,
  };
}

async function fetchPitcherSeasonSummary(
  pitcherId: number,
  dataMode: "live" | "fixture",
  cacheBust?: CacheBustArg,
  seasons: number[] = [new Date().getUTCFullYear(), new Date().getUTCFullYear() - 1],
): Promise<PitchingSeasonSummary | undefined> {
  for (const season of seasons) {
    try {
      const result = await fetchMlbJson<MlbSeasonStatsResponse>({
        endpoint: `/people/${pitcherId}/stats`,
        params: { stats: "season", group: "pitching", season },
        fixtureFile: "pitcher_season_stats.json",
        ttlSeconds: 3600,
        dataMode,
        cacheBust,
      });
      const summary = extractSeasonStats(result.data, season);
      if (summary) {
        return summary;
      }
    } catch {
      // Try the next season.
    }
  }

  return undefined;
}

async function fetchPitcherGameLog(
  pitcherId: number,
  dataMode: "live" | "fixture",
  cacheBust?: CacheBustArg,
  seasons: number[] = [new Date().getUTCFullYear(), new Date().getUTCFullYear() - 1],
): Promise<{ seasonUsed?: number; splits: NonNullable<MlbGameLogResponse["stats"]>[number]["splits"] }> {
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
      // Try the next season.
    }
  }

  return { seasonUsed: undefined, splits: [] };
}

async function fetchPitcherThrowingHand(
  pitcherId: number,
  dataMode: "live" | "fixture",
  cacheBust?: CacheBustArg,
): Promise<string | undefined> {
  try {
    const result = await fetchMlbJson<MlbPeopleResponse>({
      endpoint: `/people/${pitcherId}`,
      fixtureFile: "player_search.json",
      ttlSeconds: 3600,
      dataMode,
      cacheBust,
    });
    return result.data.people?.find((person) => person.id === pitcherId)?.pitchHand?.code ?? result.data.people?.[0]?.pitchHand?.code;
  } catch {
    return undefined;
  }
}

async function fetchTeamLineupHandedness(
  teamId: number,
  dataMode: "live" | "fixture",
  cacheBust?: CacheBustArg,
): Promise<{ lineupHandedness: "left" | "right" | "balanced" | "unknown"; lineupSummary: string }> {
  try {
    const rosterResult = await fetchMlbJson<MlbRosterResponse>({
      endpoint: `/teams/${teamId}/roster`,
      params: { rosterType: "active", season: new Date().getUTCFullYear() },
      fixtureFile: "team_roster.json",
      ttlSeconds: 1800,
      dataMode,
      cacheBust,
    });

    const hitterIds = (rosterResult.data.roster ?? [])
      .filter((player) => player.position?.type !== "Pitcher" && player.person?.id)
      .slice(0, 13)
      .map((player) => player.person!.id!);

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
      ttlSeconds: 1800,
      dataMode,
      cacheBust,
    });

    let left = 0;
    let right = 0;
    let switchHitters = 0;
    const requestedIds = new Set(hitterIds);

    for (const person of peopleResult.data.people ?? []) {
      if (!person.id || !requestedIds.has(person.id)) continue;
      if (person.batSide?.code === "L") left += 1;
      else if (person.batSide?.code === "R") right += 1;
      else if (person.batSide?.code === "S") switchHitters += 1;
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
      Math.abs(adjustedLeft - adjustedRight) <= 1 ? "balanced" : adjustedRight > adjustedLeft ? "right" : "left";

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
): { edge: "pitcher" | "hitter" | "neutral" | "unknown"; summary: string; reasoning: string } {
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
    (pitcherHand === "R" && lineupHandedness === "right")
    || (pitcherHand === "L" && lineupHandedness === "left");

  return {
    edge: sameSide ? "pitcher" : "hitter",
    summary: `${pitcherName} is ${pitcherHand}HP. ${lineupTeamKey}'s lineup trends ${lineupHandedness}-handed. Slight ${sameSide ? "pitcher" : "hitter"} advantage.`,
    reasoning: lineupSummary,
  };
}

async function fetchBoxscore(
  gamePk: number,
  dataMode: "live" | "fixture",
  cacheBust?: CacheBustArg,
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
): { playerId: number; fullName: string; outing?: NonNullable<MlbBoxscoreTeamPlayer["stats"]>["pitching"] } | null {
  const starterId = team?.pitchers?.[0];
  if (!starterId) return null;
  const player = team.players?.[`ID${starterId}`];
  return {
    playerId: starterId,
    fullName: player?.person?.fullName ?? "Unknown",
    outing: player?.stats?.pitching,
  };
}

function durationFromBoxscore(boxscore?: MlbBoxscoreResponse): string | undefined {
  return boxscore?.info?.find((entry) => entry.label === "T")?.value;
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

export async function getMlbTeamSeasonScheduleWithProbables(
  teamKey: string,
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
  options?: {
    season?: number;
    startDate?: string;
    endDate?: string;
    gameTypes?: string;
  },
): Promise<{ data: { teamKey: string; teamId: number; season: number; games: MlbScheduledGame[] } | null; meta: Meta }> {
  const resolved = getMlbDataMode(dataMode);
  const team = resolveMlbTeam(teamKey);

  if (!team) {
    return {
      data: null,
      meta: fallbackMeta(resolved, `Unknown MLB team key: ${teamKey.toUpperCase()}`),
    };
  }

  const season = options?.season ?? new Date().getUTCFullYear();
  const response = await fetchMlbJson<MlbScheduleResponse>({
    endpoint: "/schedule",
    params: {
      teamId: team.id,
      sportId: 1,
      season,
      gameTypes: options?.gameTypes ?? "S,R,F,D,L,W",
      startDate: options?.startDate,
      endDate: options?.endDate,
      hydrate: "probablePitcher",
    },
    fixtureFile: "series_tracker_nym.json",
    ttlSeconds: 300,
    dataMode: resolved,
    cacheBust,
  });

  const games = normalizeScheduleGames(team.id, response.data);
  const warning = games.length === 0 ? `No season schedule found in the selected ${resolved} data window.` : response.meta.warning;
  return {
    data: {
      teamKey: team.key,
      teamId: team.id,
      season,
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
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) {
      return {
        data: null,
        meta: fallbackMeta(resolved, "playerId is required"),
      };
    }

    const currentYear = new Date().getUTCFullYear();
    const seasonsToTry = [currentYear, currentYear - 1];
    let playerName: string | undefined;

    try {
      const playerResult = await fetchMlbJson<MlbPeopleResponse>({
        endpoint: `/people/${encodeURIComponent(normalizedPlayerId)}`,
        fixtureFile: "player_search.json",
        ttlSeconds: 3600,
        dataMode: resolved,
        cacheBust,
      });
      playerName = playerResult.data.people?.find((person) => String(person.id) === normalizedPlayerId)?.fullName
        ?? playerResult.data.people?.[0]?.fullName;
    } catch {
      playerName = undefined;
    }

    let selectedSeason: number | undefined;
    let selectedMeta: Meta | undefined;
    let pitches: PitcherArsenal["pitches"] = [];

    for (const season of seasonsToTry) {
      try {
        const result = await fetchMlbJson<MlbPitchArsenalStatsResponse>({
          endpoint: `/people/${encodeURIComponent(normalizedPlayerId)}/stats`,
          params: { stats: "pitchArsenal", season },
          fixtureFile:
            season === 2026
              ? "pitcher_arsenal_2026.json"
              : season === 2025
              ? "pitcher_arsenal_2025.json"
              : "pitcher_arsenal_sample.json",
          ttlSeconds: 3600,
          dataMode: resolved,
          cacheBust,
        });

        const extracted = extractPitchArsenal(result.data);
        if (extracted.length > 0) {
          selectedSeason = season;
          selectedMeta = result.meta;
          pitches = extracted;
          break;
        }
      } catch {
        // Fall back to the previous season when current pitch-level data is unavailable.
      }
    }

    if (!selectedSeason || pitches.length === 0) {
      return {
        data: null,
        meta: fallbackMeta(resolved, "Pitch arsenal not available from upstream for this pitcher yet."),
      };
    }

    const seasonSummary = await fetchPitcherSeasonSummary(
      Number(normalizedPlayerId),
      resolved,
      cacheBust,
      selectedSeason === currentYear ? seasonsToTry : [selectedSeason],
    );
    const usedFallbackSeason = selectedSeason !== currentYear;
    const message = usedFallbackSeason
      ? `Using ${selectedSeason} arsenal data because ${currentYear} pitch-level data is not posted yet.`
      : undefined;

    return {
      data: {
        playerId: normalizedPlayerId,
        playerName,
        season: selectedSeason,
        seasonLabel: String(selectedSeason),
        fallbackSeason: usedFallbackSeason ? selectedSeason : undefined,
        status: usedFallbackSeason ? "fallback" : "current",
        message,
        pitches,
        seasonStats: seasonSummary
          ? {
              era: seasonSummary.era,
              whip: seasonSummary.whip,
              inningsPitched: seasonSummary.inningsPitched,
              strikeOuts: seasonSummary.strikeOuts,
              wins: seasonSummary.wins,
              losses: seasonSummary.losses,
              gamesStarted: seasonSummary.gamesStarted,
            }
          : undefined,
      },
      meta: {
        ...(selectedMeta ?? fallbackMeta(resolved, message ?? "Pitch arsenal loaded.")),
        warning: selectedMeta?.warning ?? message,
      },
    };
  },

  async searchPlayers(query: string, limit = 8, dataMode?: ModeArg, cacheBust?: CacheBustArg) {
    const resolved = getMlbDataMode(dataMode);
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return {
        data: [],
        meta: fallbackMeta(resolved, "Type at least 2 characters to search."),
      };
    }

    try {
      const response = await fetchMlbJson<MlbPeopleResponse>({
        endpoint: "/people/search",
        params: { names: trimmed, sportId: 1 },
        fixtureFile: "player_search.json",
        ttlSeconds: 300,
        dataMode: resolved,
        cacheBust,
      });

      const rows = (response.data.people ?? [])
        .slice(0, Math.max(1, Math.min(20, limit)))
        .map((person): MlbPlayerSearchResult => ({
          playerId: String(person.id ?? ""),
          fullName: person.fullName ?? "Unknown player",
          teamKey: person.currentTeam?.id ? (MLB_TEAM_OPTIONS.find((team) => team.id === person.currentTeam?.id)?.key ?? undefined) : undefined,
          teamName: person.currentTeam?.name,
          position: person.primaryPosition?.abbreviation ?? person.primaryPosition?.name,
          throwsHand: person.pitchHand?.code,
          batsHand: person.batSide?.code,
        }))
        .filter((person) => person.playerId.length > 0);

      return {
        data: rows,
        meta: {
          ...response.meta,
          warning: rows.length === 0 ? "No MLB players found matching that query." : response.meta.warning,
        },
      };
    } catch (error) {
      return {
        data: [],
        meta: fallbackMeta(resolved, `searchPlayers failed: ${String(error)}`),
      };
    }
  },

  async getRecentResults(teamKey: string, limit = 5, dataMode?: ModeArg, cacheBust?: CacheBustArg) {
    const resolved = getMlbDataMode(dataMode);
    const team = resolveMlbTeam(teamKey);
    if (!team) {
      return {
        data: null,
        meta: fallbackMeta(resolved, `Unknown MLB team key: ${teamKey.toUpperCase()}`),
      };
    }

    const endDate = isoDate(new Date());
    const startDate = addDaysToIso(endDate, -21);

    try {
      const response = await fetchMlbJson<MlbScheduleResponse>({
        endpoint: "/schedule",
        params: { sportId: 1, teamId: team.id, startDate, endDate },
        fixtureFile: "team_recent_results.json",
        ttlSeconds: 300,
        dataMode: resolved,
        cacheBust,
      });

      const results = flattenSchedule(response.data)
        .filter((game) => game.status?.abstractGameState === "Final")
        .sort((a, b) => new Date(b.gameDate ?? "").getTime() - new Date(a.gameDate ?? "").getTime())
        .slice(0, Math.max(1, Math.min(10, limit)))
        .map((game): MlbRecentResult => {
          const isHome = game.teams?.home?.team?.id === team.id;
          const opponent = isHome ? game.teams?.away?.team : game.teams?.home?.team;
          const teamScore = isHome ? game.teams?.home?.score : game.teams?.away?.score;
          const opponentScore = isHome ? game.teams?.away?.score : game.teams?.home?.score;
          const result =
            typeof teamScore === "number" && typeof opponentScore === "number"
              ? teamScore > opponentScore
                ? "W"
                : "L"
              : null;

          return {
            gamePk: game.gamePk ?? 0,
            date: game.officialDate ?? game.gameDate?.slice(0, 10) ?? endDate,
            opponent: opponent?.name ?? "Unknown opponent",
            opponentKey: opponent?.id ? (MLB_TEAM_OPTIONS.find((option) => option.id === opponent.id)?.key ?? "TBD") : "TBD",
            homeAway: isHome ? "home" : "away",
            gameType: game.gameType,
            gameTypeLabel: gameTypeLabel(game.gameType),
            result,
            teamScore: typeof teamScore === "number" ? teamScore : null,
            opponentScore: typeof opponentScore === "number" ? opponentScore : null,
            status: game.status?.detailedState ?? "Final",
          };
        });

      return {
        data: {
          teamKey: team.key,
          teamName: team.name,
          results,
        },
        meta: {
          ...response.meta,
          warning: results.length === 0 ? "No recent final games were found for that team." : response.meta.warning,
        },
      };
    } catch (error) {
      return {
        data: null,
        meta: fallbackMeta(resolved, `getRecentResults failed: ${String(error)}`),
      };
    }
  },

  async getPlayerSeasonStats(playerId: string, dataMode?: ModeArg) {
    const resolved = getMlbDataMode(dataMode);
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) {
      return {
        data: null,
        meta: fallbackMeta(resolved, "playerId is required"),
      };
    }

    try {
      const [playerResult, hittingResult, pitchingResult] = await Promise.all([
        fetchMlbJson<MlbPeopleResponse>({
          endpoint: `/people/${encodeURIComponent(normalizedPlayerId)}`,
          fixtureFile: "player_search.json",
          ttlSeconds: 3600,
          dataMode: resolved,
        }),
        fetchMlbJson<MlbYearByYearStatsResponse>({
          endpoint: `/people/${encodeURIComponent(normalizedPlayerId)}/stats`,
          params: { stats: "yearByYear", group: "hitting", sportId: 1 },
          fixtureFile: "season_stats_player.json",
          ttlSeconds: 3600,
          dataMode: resolved,
        }),
        fetchMlbJson<MlbYearByYearStatsResponse>({
          endpoint: `/people/${encodeURIComponent(normalizedPlayerId)}/stats`,
          params: { stats: "yearByYear", group: "pitching", sportId: 1 },
          fixtureFile: "season_stats_player.json",
          ttlSeconds: 3600,
          dataMode: resolved,
        }),
      ]);

      const player = playerResult.data.people?.find((person) => String(person.id) === normalizedPlayerId) ?? playerResult.data.people?.[0];

      const mapHittingSplits = (data: MlbYearByYearStatsResponse): MlbPlayerYearStats[] =>
        ((data.stats ?? []).find((entry) => entry.group?.displayName?.toLowerCase() === "hitting")?.splits ?? [])
          .map((split) => ({
            season: Number.parseInt(split.season ?? "0", 10),
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
          }))
          .filter((row) => row.season > 0)
          .sort((a, b) => b.season - a.season);

      const mapPitchingSplits = (data: MlbYearByYearStatsResponse): MlbPlayerYearStats[] =>
        ((data.stats ?? []).find((entry) => entry.group?.displayName?.toLowerCase() === "pitching")?.splits ?? [])
          .map((split) => ({
            season: Number.parseInt(split.season ?? "0", 10),
            gamesPlayed: split.stat?.gamesPlayed,
            gamesStarted: split.stat?.gamesStarted,
            wins: split.stat?.wins,
            losses: split.stat?.losses,
            era: split.stat?.era,
            whip: split.stat?.whip,
            inningsPitched: split.stat?.inningsPitched,
            strikeOuts: split.stat?.strikeOuts,
          }))
          .filter((row) => row.season > 0)
          .sort((a, b) => b.season - a.season);

      return {
        data: {
          playerId: normalizedPlayerId,
          playerName: player?.fullName,
          position: player?.primaryPosition?.abbreviation ?? player?.primaryPosition?.name,
          hitting: mapHittingSplits(hittingResult.data),
          pitching: mapPitchingSplits(pitchingResult.data),
        },
        meta: hittingResult.meta,
      };
    } catch (error) {
      return {
        data: null,
        meta: fallbackMeta(resolved, `getPlayerSeasonStats failed: ${String(error)}`),
      };
    }
  },

  async getTeamSeasonStats(teamKey: string, season: number, dataMode?: ModeArg) {
    const resolved = getMlbDataMode(dataMode);
    const team = resolveMlbTeam(teamKey);
    if (!team) {
      return {
        data: null,
        meta: fallbackMeta(resolved, `Unknown MLB team key: ${teamKey.toUpperCase()}`),
      };
    }

    try {
      const [hittingResult, pitchingResult, standingsResult] = await Promise.all([
        fetchMlbJson<MlbTeamStatsResponse>({
          endpoint: "/teams/stats",
          params: { stats: "season", group: "hitting", season, sportId: 1 },
          fixtureFile: "season_stats_team.json",
          ttlSeconds: 3600,
          dataMode: resolved,
        }),
        fetchMlbJson<MlbTeamStatsResponse>({
          endpoint: "/teams/stats",
          params: { stats: "season", group: "pitching", season, sportId: 1 },
          fixtureFile: "season_stats_team.json",
          ttlSeconds: 3600,
          dataMode: resolved,
        }),
        fetchMlbJson<MlbStandingsResponse & { standings?: MlbStandingsResponse }>({
          endpoint: "/standings",
          params: { leagueId: "103,104", season, sportId: 1 },
          fixtureFile: "season_stats_team.json",
          ttlSeconds: 3600,
          dataMode: resolved,
        }),
      ]);

      const hittingSplit = ((hittingResult.data.stats ?? []).find((entry) => entry.group?.displayName?.toLowerCase() === "hitting")?.splits ?? [])
        .find((split) => split.team?.id === team.id);
      const pitchingSplit = ((pitchingResult.data.stats ?? []).find((entry) => entry.group?.displayName?.toLowerCase() === "pitching")?.splits ?? [])
        .find((split) => split.team?.id === team.id);

      const records = standingsResult.data.records ?? standingsResult.data.standings?.records ?? [];
      const standing = records
        .flatMap((record) => record.teamRecords ?? [])
        .find((record) => record.team?.id === team.id);

      return {
        data: {
          teamKey: team.key,
          teamName: hittingSplit?.team?.name ?? pitchingSplit?.team?.name ?? team.name,
          season,
          record: {
            wins: standing?.wins ?? 0,
            losses: standing?.losses ?? 0,
            pct: standing?.pct ?? ".000",
            divisionRank: standing?.divisionRank ? Number.parseInt(standing.divisionRank, 10) : undefined,
            gamesBack: standing?.gamesBack,
          },
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
        meta: hittingResult.meta,
      };
    } catch (error) {
      return {
        data: null,
        meta: fallbackMeta(resolved, `getTeamSeasonStats failed: ${String(error)}`),
      };
    }
  },

  async getPlatoonAdvantage(teamKey: string, dataMode?: ModeArg, cacheBust?: CacheBustArg) {
    const resolved = getMlbDataMode(dataMode);
    const team = resolveMlbTeam(teamKey);
    if (!team) {
      return {
        data: null,
        meta: fallbackMeta(resolved, `Unknown MLB team key: ${teamKey.toUpperCase()}`),
      };
    }

    const today = isoDate(new Date());
    const endDate = addDaysToIso(today, 7);
    const currentYear = new Date().getUTCFullYear();

    const fetchSplits = async (pitcherId: number): Promise<MlbPitcherSplits> => {
      for (const season of [currentYear, currentYear - 1]) {
        try {
          const response = await fetchMlbJson<MlbPitcherSplitsResponse>({
            endpoint: `/people/${pitcherId}/stats`,
            params: { stats: "statSplits", group: "pitching", season, sitCodes: "vl,vr" },
            fixtureFile: "pitcher_splits.json",
            ttlSeconds: 3600,
            dataMode: resolved,
            cacheBust,
          });

          const splits = response.data.stats?.[0]?.splits ?? [];
          const mapSide = (code: "vl" | "vr"): MlbPitcherSplitSide | null => {
            const split = splits.find((entry) => entry.split?.code === code);
            if (!split?.stat) return null;
            return {
              era: split.stat.era,
              whip: split.stat.whip,
              avg: split.stat.avg,
              ops: split.stat.ops,
              sample: split.stat.battersFaced,
            };
          };

          const mapped = {
            vsLeft: mapSide("vl"),
            vsRight: mapSide("vr"),
          };

          if (mapped.vsLeft || mapped.vsRight) {
            return mapped;
          }
        } catch {
          // Try previous season if current splits are unavailable.
        }
      }

      return { vsLeft: null, vsRight: null };
    };

    try {
      const scheduleResult = await fetchMlbJson<MlbScheduleResponse>({
        endpoint: "/schedule",
        params: { sportId: 1, teamId: team.id, startDate: today, endDate, hydrate: "probablePitcher" },
        fixtureFile: "game_with_pitchers.json",
        ttlSeconds: 300,
        dataMode: resolved,
        cacheBust,
      });

      const scheduledGames = flattenSchedule(scheduleResult.data);
      const nextGame = scheduledGames.find((game) => isUpcoming(game.gameDate, game.status?.abstractGameState)) ?? scheduledGames[0];

      if (!nextGame || !nextGame.teams?.home?.team?.id || !nextGame.teams?.away?.team?.id) {
        return {
          data: null,
          meta: {
            ...scheduleResult.meta,
            warning: "No upcoming games found.",
          },
        };
      }

      const homeRef = nextGame.teams.home;
      const awayRef = nextGame.teams.away;
      const homeTeam = MLB_TEAM_OPTIONS.find((option) => option.id === homeRef.team?.id);
      const awayTeam = MLB_TEAM_OPTIONS.find((option) => option.id === awayRef.team?.id);
      const homeKey = homeTeam?.key ?? "TBD";
      const awayKey = awayTeam?.key ?? "TBD";
      const unknownLineup: Awaited<ReturnType<typeof fetchTeamLineupHandedness>> = {
        lineupHandedness: "unknown",
        lineupSummary: "Unavailable.",
      };

      const [homeSplits, awaySplits, homeThrowingHand, awayThrowingHand, homeLineup, awayLineup] = await Promise.all([
        homeRef.probablePitcher?.id ? fetchSplits(homeRef.probablePitcher.id) : Promise.resolve({ vsLeft: null, vsRight: null }),
        awayRef.probablePitcher?.id ? fetchSplits(awayRef.probablePitcher.id) : Promise.resolve({ vsLeft: null, vsRight: null }),
        homeRef.probablePitcher?.id ? fetchPitcherThrowingHand(homeRef.probablePitcher.id, resolved, cacheBust) : Promise.resolve(undefined),
        awayRef.probablePitcher?.id ? fetchPitcherThrowingHand(awayRef.probablePitcher.id, resolved, cacheBust) : Promise.resolve(undefined),
        homeRef.team?.id ? fetchTeamLineupHandedness(homeRef.team.id, resolved, cacheBust) : Promise.resolve(unknownLineup),
        awayRef.team?.id ? fetchTeamLineupHandedness(awayRef.team.id, resolved, cacheBust) : Promise.resolve(unknownLineup),
      ]);

      const homeAnalysis = homeRef.probablePitcher
        ? summarizeHandednessMatchup(
            homeRef.probablePitcher.fullName ?? homeRef.team?.name ?? homeKey,
            homeRef.probablePitcher.pitchHand?.code ?? homeThrowingHand,
            awayKey,
            awayLineup.lineupHandedness,
            awayLineup.lineupSummary,
          )
        : null;
      const awayAnalysis = awayRef.probablePitcher
        ? summarizeHandednessMatchup(
            awayRef.probablePitcher.fullName ?? awayRef.team?.name ?? awayKey,
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
        (homeKey === team.key ? homeAnalysis?.summary : awayAnalysis?.summary)
        ?? "Split data is unavailable, so this is using handedness context instead.";

      if (homeHasSplits || awayHasSplits) {
        analysisMode = "splits";
        const homeGap = homeHasSplits ? homeEraVsR - homeEraVsL : 0;
        const awayGap = awayHasSplits ? awayEraVsR - awayEraVsL : 0;
        advantageScore = Math.round((homeGap - awayGap) * 10) / 10;

        if (Math.abs(advantageScore) < 0.3) {
          explanation = `${homeRef.team?.name ?? homeKey} and ${awayRef.team?.name ?? awayKey} have similar starter split profiles for this matchup.`;
        } else if (advantageScore > 0) {
          explanation = `${homeRef.probablePitcher?.fullName ?? homeRef.team?.name ?? homeKey} shows the stronger split edge, so this leans slightly toward the home side.`;
        } else {
          explanation = `${awayRef.probablePitcher?.fullName ?? awayRef.team?.name ?? awayKey} shows the stronger split edge, so this leans slightly toward the away side.`;
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

      return {
        data: {
          game: {
            gameId: String(nextGame.gamePk ?? ""),
            gamePk: nextGame.gamePk ?? 0,
            officialDate: nextGame.officialDate ?? today,
            homeTeam: { key: homeKey, name: homeRef.team?.name ?? homeKey },
            awayTeam: { key: awayKey, name: awayRef.team?.name ?? awayKey },
          },
          homePitcher: homeRef.probablePitcher?.id
            ? {
                playerId: String(homeRef.probablePitcher.id),
                fullName: homeRef.probablePitcher.fullName ?? "TBD",
                throwsHand: homeRef.probablePitcher.pitchHand?.code ?? homeThrowingHand ?? "?",
                splits: homeSplits,
              }
            : null,
          awayPitcher: awayRef.probablePitcher?.id
            ? {
                playerId: String(awayRef.probablePitcher.id),
                fullName: awayRef.probablePitcher.fullName ?? "TBD",
                throwsHand: awayRef.probablePitcher.pitchHand?.code ?? awayThrowingHand ?? "?",
                splits: awaySplits,
              }
            : null,
          advantage,
          advantageScore,
          explanation,
          analysisMode,
          handednessAnalyses: [
            homeAnalysis
              ? {
                  pitcherTeamKey: homeKey,
                  lineupTeamKey: awayKey,
                  pitcherName: homeRef.probablePitcher?.fullName ?? homeRef.team?.name ?? homeKey,
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
                  pitcherName: awayRef.probablePitcher?.fullName ?? awayRef.team?.name ?? awayKey,
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
        meta: scheduleResult.meta,
      };
    } catch (error) {
      return {
        data: null,
        meta: fallbackMeta(resolved, `getPlatoonAdvantage failed: ${String(error)}`),
      };
    }
  },

  async getRecentForm(teamKey: string, dataMode?: ModeArg, cacheBust?: CacheBustArg) {
    const resolved = getMlbDataMode(dataMode);
    const team = resolveMlbTeam(teamKey);
    if (!team) {
      return {
        data: null,
        meta: fallbackMeta(resolved, `Unknown MLB team key: ${teamKey.toUpperCase()}`),
      };
    }

    const endDate = isoDate(new Date());
    const startDate = addDaysToIso(endDate, -30);

    try {
      const response = await fetchMlbJson<MlbScheduleResponse>({
        endpoint: "/schedule",
        params: { sportId: 1, teamId: team.id, startDate, endDate, hydrate: "linescore" },
        fixtureFile: "recent_form_schedule.json",
        ttlSeconds: 300,
        dataMode: resolved,
        cacheBust,
      });

      type LinescoreGame = MlbScheduleGame & {
        linescore?: {
          teams?: {
            home?: { runs?: number };
            away?: { runs?: number };
          };
        };
      };

      const allGames = (response.data.dates ?? [])
        .flatMap((bucket) => bucket.games ?? [])
        .sort((a, b) => new Date(a.gameDate ?? "").getTime() - new Date(b.gameDate ?? "").getTime()) as LinescoreGame[];
      const finalGames = allGames.filter((game) => game.status?.abstractGameState === "Final");

      const computePeriod = (days: number): MlbFormPeriod => {
        const cutoff = addDaysToIso(endDate, -days);
        const games = finalGames.filter((game) => {
          const officialDate = game.officialDate ?? game.gameDate?.slice(0, 10);
          return Boolean(officialDate && officialDate >= cutoff && officialDate <= endDate);
        });

        let wins = 0;
        let losses = 0;
        let runsScored = 0;
        let runsAllowed = 0;

        for (const game of games) {
          const isHome = game.teams?.home?.team?.id === team.id;
          const teamRuns = isHome
            ? (game.linescore?.teams?.home?.runs ?? game.teams?.home?.score ?? 0)
            : (game.linescore?.teams?.away?.runs ?? game.teams?.away?.score ?? 0);
          const opponentRuns = isHome
            ? (game.linescore?.teams?.away?.runs ?? game.teams?.away?.score ?? 0)
            : (game.linescore?.teams?.home?.runs ?? game.teams?.home?.score ?? 0);
          runsScored += teamRuns;
          runsAllowed += opponentRuns;
          if (teamRuns > opponentRuns) wins += 1;
          else losses += 1;
        }

        const totalGames = wins + losses;
        const runDiff = runsScored - runsAllowed;
        const winPct = totalGames > 0 ? wins / totalGames : 0;

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
      };

      const last7 = computePeriod(7);
      const last14 = computePeriod(14);
      const last30 = computePeriod(30);
      const weightedWinPct = Math.round((0.5 * last7.winPct + 0.3 * last14.winPct + 0.2 * last30.winPct) * 1000) / 1000;
      const rating: MlbRecentForm["rating"] =
        weightedWinPct >= 0.6
          ? "hot"
          : weightedWinPct >= 0.5
          ? "warm"
          : weightedWinPct >= 0.4
          ? "cool"
          : "cold";

      const gameTypeCounts = finalGames.reduce(
        (totals, game) => {
          if (game.gameType === "S") totals.S += 1;
          else if (game.gameType === "R") totals.R += 1;
          else totals.other += 1;
          return totals;
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
          ? `This is based on Spring Training ${new Date().getUTCFullYear()} results from the last 7, 14, and 30 days.`
          : primaryGameType === "R"
          ? `This is based on Regular Season ${new Date().getUTCFullYear()} results from the last 7, 14, and 30 days.`
          : primaryGameType === "mixed"
          ? "This blends Spring Training and Regular Season games from the last 7, 14, and 30 days."
          : "No completed games were found in the last 30 days.";

      const runDiffPhrase =
        last7.runDiffPerGame > 0
          ? `outscoring opponents by ${Math.abs(last7.runDiffPerGame).toFixed(1)} runs per game`
          : last7.runDiffPerGame < 0
          ? `being outscored by ${Math.abs(last7.runDiffPerGame).toFixed(1)} runs per game`
          : "playing even in run differential";
      const stretchLabel =
        rating === "hot" ? "hot stretch" : rating === "warm" ? "steady stretch" : rating === "cool" ? "cool stretch" : "cold stretch";
      const explanation =
        last7.games > 0
          ? `${team.name} have gone ${last7.wins}-${last7.losses} in their last ${last7.games} game${last7.games === 1 ? "" : "s"} over the last ${last7.days} days and are ${runDiffPhrase}. They are in a ${stretchLabel}${primaryGameType === "S" ? " heading into the season" : " right now"}.`
          : `${team.name} have not played a completed game in the last 7 days, so there is not a short-term form read yet.`;

      return {
        data: {
          teamKey: team.key,
          teamName: team.name,
          rating,
          ratingScore: Math.round(weightedWinPct * 100),
          weightedWinPct,
          last7,
          last14,
          last30,
          explanation,
          sampleContext,
          primaryGameType,
          primaryGameTypeLabel,
        },
        meta: response.meta,
      };
    } catch (error) {
      return {
        data: null,
        meta: fallbackMeta(resolved, `getRecentForm failed: ${String(error)}`),
      };
    }
  },

  async getBullpenFatigue(teamKey: string, dataMode?: ModeArg, cacheBust?: CacheBustArg) {
    const resolved = getMlbDataMode(dataMode);
    const team = resolveMlbTeam(teamKey);
    if (!team) {
      return {
        data: null,
        meta: fallbackMeta(resolved, `Unknown MLB team key: ${teamKey.toUpperCase()}`),
      };
    }

    const today = new Date(`${isoDate(new Date())}T12:00:00Z`);

    try {
      const rosterResult = await fetchMlbJson<MlbRosterResponse>({
        endpoint: `/teams/${team.id}/roster`,
        params: { rosterType: "active", season: new Date().getUTCFullYear() },
        fixtureFile: "team_roster.json",
        ttlSeconds: 1800,
        dataMode: resolved,
        cacheBust,
      });

      const pitchers = (rosterResult.data.roster ?? []).filter(
        (player) =>
          (player.status?.code === "A" || !player.status?.code)
          && (player.position?.type === "Pitcher" || player.position?.abbreviation === "P")
          && player.person?.id,
      );

      const recentSchedule = await fetchMlbJson<MlbScheduleResponse>({
        endpoint: "/schedule",
        params: {
          sportId: 1,
          teamId: team.id,
          startDate: addDaysToIso(isoDate(new Date()), -10),
          endDate: isoDate(new Date()),
          gameType: "R,S",
        },
        fixtureFile: "recent_form_schedule.json",
        ttlSeconds: 300,
        dataMode: resolved,
        cacheBust,
      });

      const recentGames = flattenSchedule(recentSchedule.data)
        .filter((game) => game.status?.abstractGameState === "Final")
        .sort((a, b) => new Date(b.gameDate ?? "").getTime() - new Date(a.gameDate ?? "").getTime())
        .slice(0, 7);
      const recentBoxscores = await Promise.all(
        recentGames.map((game) => (game.gamePk ? fetchBoxscore(game.gamePk, resolved, cacheBust) : Promise.resolve(undefined))),
      );

      const pitcherSnapshots = await Promise.all(
        pitchers.map(async (pitcher) => {
          const pitcherId = pitcher.person?.id ?? 0;
          const [seasonSummary, gameLog] = await Promise.all([
            fetchPitcherSeasonSummary(pitcherId, resolved, cacheBust),
            fetchPitcherGameLog(pitcherId, resolved, cacheBust),
          ]);

          const recentSplits = (gameLog.splits ?? [])
            .filter((split) => {
              if (!split.date) return false;
              const appearanceDate = new Date(`${split.date}T12:00:00Z`);
              const diffDays = (today.getTime() - appearanceDate.getTime()) / (1000 * 60 * 60 * 24);
              return diffDays >= 0 && diffDays <= 5;
            })
            .sort(
              (a, b) =>
                new Date(`${b.date ?? "1970-01-01"}T12:00:00Z`).getTime()
                - new Date(`${a.date ?? "1970-01-01"}T12:00:00Z`).getTime(),
            );

          const lastAppearance = recentSplits[0];
          const lastAppearanceDate = lastAppearance?.date ?? null;
          const lastAppearancePitches = pitchCountFromStat(lastAppearance?.stat) ?? null;
          const lastAppearanceStrikes = strikesFromStat(lastAppearance?.stat) ?? null;
          const daysRest = lastAppearanceDate
            ? Math.floor((today.getTime() - new Date(`${lastAppearanceDate}T12:00:00Z`).getTime()) / (1000 * 60 * 60 * 24))
            : 99;

          let fatigue: MlbPitcherAvailability["fatigue"];
          if (daysRest === 99) fatigue = "rested";
          else if (daysRest <= 1 && (lastAppearancePitches ?? 0) >= 30) fatigue = "fatigued";
          else if (daysRest <= 1) fatigue = "tired";
          else if (daysRest === 2) fatigue = "available";
          else if (daysRest <= 4) fatigue = "fresh";
          else fatigue = "rested";

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
        if (!game || !boxscore) continue;
        const isHome = game.teams?.home?.team?.id === team.id;
        const teamBox = isHome ? boxscore.teams?.home : boxscore.teams?.away;
        const starter = extractStarterFromBoxscore(teamBox);
        if (!starter) continue;
        const starterId = String(starter.playerId);
        if (starterMap.has(starterId)) continue;

        const seasonSummary = pitcherSnapshots.find((snapshot) => snapshot.playerId === starterId)?.seasonSummary;
        starterMap.set(starterId, {
          playerId: starterId,
          fullName: starter.fullName,
          lastStartDate: game.officialDate ?? game.gameDate?.slice(0, 10) ?? null,
          daysRest: game.officialDate
            ? Math.floor((today.getTime() - new Date(`${game.officialDate}T12:00:00Z`).getTime()) / (1000 * 60 * 60 * 24))
            : 99,
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

      return {
        data: {
          teamKey: team.key,
          teamName: team.name,
          starters: [...starterMap.values()].sort((a, b) => a.daysRest - b.daysRest),
          relievers: pitcherSnapshots
            .filter((snapshot) => !starterMap.has(snapshot.playerId))
            .map((snapshot) => snapshot.availability)
            .sort((a, b) => fatigueOrder[a.fatigue] - fatigueOrder[b.fatigue]),
          fetchedAt: new Date().toISOString(),
        },
        meta: rosterResult.meta,
      };
    } catch (error) {
      return {
        data: null,
        meta: fallbackMeta(resolved, `getBullpenFatigue failed: ${String(error)}`),
      };
    }
  },
};
