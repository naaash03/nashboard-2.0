import { randomUUID } from "node:crypto";
import { getMlbTeamSeasonScheduleWithProbables, type MlbScheduledGame, type MlbScheduledProbableStarter } from "@/lib/providers/mlb";
import { formatDateInTimeZone } from "@/lib/providers/scheduleWindow";
import type { Meta } from "@/lib/providers/types";
import { resolveCanonicalTeam } from "@/lib/sports/mappings/teamMap";

type DataModeArg = "auto" | "live" | "fixture";
type SeriesMode = "beginner" | "advanced";

type SeriesState = "success" | "partial" | "failed";
export type SeriesGroupingMethod = "official" | "opponent_consecutive_dates";
export type SeriesGroupingMode = "official_series" | "inferred_series" | "spring_matchup" | "single_game_event";
export type SeriesType = "spring_training" | "spring_training_matchup" | "regular_season" | "postseason" | "single_game_event";
export type SeriesSelectionState = "current" | "persisted_past" | "persisted_missing" | "auto_promoted";
type SeriesLifecycle = "active" | "upcoming" | "completed";
type GameStatus = "scheduled" | "live" | "final" | "postponed";

type PostseasonRound = "Wild Card" | "ALDS/NLDS" | "ALCS/NLCS" | "World Series";

type ResolveDeps = {
  fetchSchedule: (
    teamKey: string,
    dataMode: DataModeArg,
    cacheBust?: string | number,
    season?: number,
  ) => Promise<{ data: { teamKey: string; teamId: number; season: number; games: MlbScheduledGame[] } | null; meta: Meta }>;
  now: () => Date;
};

type SeriesPerspectiveGame = {
  gameId: string;
  gamePk?: number;
  gameDate: string;
  localDate: string;
  gameType?: string;
  status: GameStatus;
  detailedState?: string;
  venue?: string;
  isHome: boolean;
  teamScore?: number;
  opponentScore?: number;
  teamProbable?: MlbScheduledProbableStarter;
  opponentProbable?: MlbScheduledProbableStarter;
  opponent: {
    id?: number;
    identityKey: string;
    key: string;
    name: string;
  };
  seriesDescription?: string;
  seriesGameNumber?: number;
  gamesInSeries?: number;
  doubleHeader?: string;
  gameNumber?: number;
  rescheduleDate?: string;
  rescheduledFrom?: string;
};

type GroupedSeries = {
  seriesId: string;
  teamKey: string;
  season: number;
  opponent: {
    id?: number;
    identityKey: string;
    key: string;
    name: string;
  };
  games: SeriesPerspectiveGame[];
  groupingMethod: SeriesGroupingMethod;
  groupingMode: SeriesGroupingMode;
  type: SeriesType;
  postseasonRound?: PostseasonRound;
  bestOf?: number;
  lifecycle: SeriesLifecycle;
  startDate: string;
  endDate: string;
};

export type MlbSeriesTimelineGame = {
  gameId: string;
  dateTime: string;
  dateLabel: string;
  homeAway: "home" | "away";
  status: GameStatus;
  statusText?: string;
  chip: string;
  teamScore?: number;
  opponentScore?: number;
  result?: "W" | "L" | "T";
  probableStarter?: {
    fullName?: string;
    playerId?: string;
    headshotUrl?: string;
  };
  opponentProbableStarter?: {
    fullName?: string;
    playerId?: string;
    headshotUrl?: string;
  };
  splitDoubleheader?: boolean;
  postponed?: {
    isPostponed: boolean;
    rescheduledTime?: string;
  };
  recapLine?: string;
  keyHitters?: string[];
  starterSummary?: string;
};

export type MlbSeriesTrackerData = {
  state: SeriesState;
  resolution: "active" | "upcoming" | "selected" | "completed";
  selectionState: SeriesSelectionState;
  seriesId: string;
  season: number;
  team: {
    key: string;
    name: string;
  };
  opponent: {
    key: string;
    name: string;
  };
  seriesType: SeriesType;
  groupingMode: SeriesGroupingMode;
  postseasonRound?: PostseasonRound;
  bestOf?: number;
  groupingMethod: SeriesGroupingMethod;
  summary: string;
  statusLine: string;
  message?: string;
  labels: string[];
  seriesScore: {
    teamWins: number;
    opponentWins: number;
    ties: number;
    display: string;
  };
  runDifferential: number;
  teamTotals: {
    runsScored: number;
    runsAllowed: number;
    teamAVG?: number;
    teamOBP?: number;
    teamSLG?: number;
  };
  pitchingTotals: {
    startersEra?: number;
  };
  bullpenTotals: {
    bullpenEra?: number;
  };
  recentHeadToHead: Array<{
    seriesId: string;
    label: string;
    result: string;
  }>;
  gameTimeline: MlbSeriesTimelineGame[];
  selectableSeries: Array<{
    seriesId: string;
    label: string;
    lifecycle: SeriesLifecycle;
  }>;
  currentSeriesId?: string;
  canGoToCurrentSeries?: boolean;
  notes?: string[];
};

export type MlbSeriesTrackerMeta = {
  sourceUsed: string;
  updatedAt: string;
  requestId: string;
  warning?: string;
  warnings?: string[];
  notes?: string[];
  dataMode?: DataModeArg;
  state: SeriesState;
  season?: number;
  seriesType?: SeriesType;
  seriesGroupingMethod?: SeriesGroupingMethod;
  seriesGroupingMode?: SeriesGroupingMode;
  selectionState?: SeriesSelectionState;
};

export type MlbSeriesTrackerResult = {
  ok: boolean;
  data: MlbSeriesTrackerData | null;
  meta: MlbSeriesTrackerMeta;
  error: { message: string; code: string } | null;
};

export type ResolveMlbSeriesTrackerArgs = {
  teamKey: string;
  mode: SeriesMode;
  dataMode: DataModeArg;
  seriesId?: string;
  selectionPinned?: boolean;
  cacheBust?: string | number;
};

function normalizeTeamKey(value: string): string {
  return value.trim().toUpperCase();
}

function toProviderMode(dataMode: DataModeArg): "live" | "fixture" {
  if (dataMode === "live" || dataMode === "fixture") {
    return dataMode;
  }
  return (process.env.NASHBOARD_DATA_MODE ?? "live").toLowerCase() === "fixture" ? "fixture" : "live";
}

function parseIsoDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayDiff(leftIsoDate: string, rightIsoDate: string): number {
  const left = `${leftIsoDate}T00:00:00Z`;
  const right = `${rightIsoDate}T00:00:00Z`;
  const leftDate = parseIsoDate(left);
  const rightDate = parseIsoDate(right);
  if (!leftDate || !rightDate) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Math.round((rightDate.getTime() - leftDate.getTime()) / 86_400_000);
}

function toHeadshotUrl(playerId?: string): string | undefined {
  if (!playerId || !/^\d+$/.test(playerId)) {
    return undefined;
  }
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_80,q_auto:best/v1/people/${playerId}/headshot/67/current`;
}

function toGameStatus(game: MlbScheduledGame): GameStatus {
  const abstractState = (game.abstractState ?? "").toLowerCase();
  const detailedState = (game.detailedState ?? "").toLowerCase();

  if (abstractState.includes("postponed") || detailedState.includes("postponed") || detailedState.includes("suspended")) {
    return "postponed";
  }
  if (game.status === "final" || abstractState.includes("final") || detailedState.includes("final")) {
    return "final";
  }
  if (game.status === "live" || abstractState.includes("live") || detailedState.includes("in progress")) {
    return "live";
  }
  return "scheduled";
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeWords(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function looksLikeAbbreviation(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return /^[A-Z0-9]{2,4}$/.test(value.trim().toUpperCase());
}

function deriveAbbreviationFromName(name: string | undefined): string {
  const words = normalizeWords(name);
  if (words.length === 0) {
    return "TBD";
  }
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  const last = words[words.length - 1];
  if (last.length >= 3) {
    return last.slice(0, 3).toUpperCase();
  }
  return `${words[0][0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "TBD";
}

function isSpringGame(game: SeriesPerspectiveGame): boolean {
  const gameType = (game.gameType ?? "").toUpperCase();
  if (gameType === "S") {
    return true;
  }
  const text = (game.seriesDescription ?? "").toLowerCase();
  return text.includes("spring");
}

function isConfidentSpringSeries(games: SeriesPerspectiveGame[], officialUsed: boolean): boolean {
  if (!officialUsed || games.length < 2) {
    return false;
  }
  const withNumbers = games.filter((game) => typeof game.seriesGameNumber === "number" && typeof game.gamesInSeries === "number");
  if (withNumbers.length >= 2) {
    const ordered = [...withNumbers].sort((left, right) => (left.seriesGameNumber ?? 0) - (right.seriesGameNumber ?? 0));
    const monotonic = ordered.every((game, index) => index === 0 || (game.seriesGameNumber ?? 0) >= (ordered[index - 1].seriesGameNumber ?? 0));
    const maxGames = Math.max(...ordered.map((game) => game.gamesInSeries ?? 0));
    if (monotonic && maxGames >= 2) {
      return true;
    }
  }
  const descriptions = games
    .map((game) => (game.seriesDescription ?? "").trim().toLowerCase())
    .filter(Boolean);
  const uniqueDescriptions = Array.from(new Set(descriptions));
  return uniqueDescriptions.length === 1 && uniqueDescriptions[0].includes("spring");
}

function toDateMs(value: string): number {
  return parseIsoDate(`${value}T00:00:00Z`)?.getTime() ?? 0;
}

function isAnalyticsSeriesMode(mode: SeriesGroupingMode): boolean {
  return mode === "official_series" || mode === "inferred_series";
}

function toResolutionFromLifecycle(lifecycle: SeriesLifecycle): "active" | "upcoming" | "completed" {
  if (lifecycle === "active") {
    return "active";
  }
  if (lifecycle === "upcoming") {
    return "upcoming";
  }
  return "completed";
}

function pickRelevantGame(games: SeriesPerspectiveGame[], now: Date): SeriesPerspectiveGame | null {
  if (games.length === 0) {
    return null;
  }
  const sorted = [...games].sort((left, right) => new Date(left.gameDate).getTime() - new Date(right.gameDate).getTime());
  const today = formatDateInTimeZone(now, "America/New_York");
  const nowMs = now.getTime();

  const todaysGames = sorted.filter((game) => game.localDate === today);
  if (todaysGames.length > 0) {
    return todaysGames.find((game) => game.status === "live")
      ?? todaysGames.find((game) => game.status === "scheduled" || game.status === "postponed")
      ?? todaysGames[0];
  }

  const nextGame = sorted.find((game) => {
    const parsed = parseIsoDate(game.gameDate);
    return parsed ? parsed.getTime() >= nowMs : false;
  });
  if (nextGame) {
    return nextGame;
  }

  return sorted[sorted.length - 1];
}

function resolveCurrentRelevantSeries(series: GroupedSeries[], now: Date): GroupedSeries | null {
  if (series.length === 0) {
    return null;
  }

  const activeAnalytics = series.find((entry) => entry.lifecycle === "active" && isAnalyticsSeriesMode(entry.groupingMode));
  if (activeAnalytics) {
    return activeAnalytics;
  }

  const allGames = series.flatMap((entry) => entry.games);
  const relevantGame = pickRelevantGame(allGames, now);
  if (relevantGame) {
    const owner = series.find((entry) => entry.games.some((game) => game.gameId === relevantGame.gameId));
    if (owner && (owner.lifecycle === "active" || owner.lifecycle === "upcoming")) {
      return owner;
    }
  }

  const upcoming = series.find((entry) => entry.lifecycle === "upcoming");
  if (upcoming) {
    return upcoming;
  }

  return [...series].reverse().find((entry) => entry.lifecycle === "completed") ?? null;
}

function isOlderThanCurrent(selected: GroupedSeries, current: GroupedSeries): boolean {
  return toDateMs(selected.endDate) < toDateMs(current.startDate);
}

function toSeriesType(games: SeriesPerspectiveGame[]): { type: SeriesType; postseasonRound?: PostseasonRound; bestOf?: number } {
  const gameTypes = games.map((game) => (game.gameType ?? "").toUpperCase());

  if (gameTypes.some((code) => ["F", "D", "L", "W"].includes(code))) {
    if (gameTypes.includes("W")) {
      return { type: "postseason", postseasonRound: "World Series", bestOf: 7 };
    }
    if (gameTypes.includes("L")) {
      return { type: "postseason", postseasonRound: "ALCS/NLCS", bestOf: 7 };
    }
    if (gameTypes.includes("D")) {
      return { type: "postseason", postseasonRound: "ALDS/NLDS", bestOf: 5 };
    }
    return { type: "postseason", postseasonRound: "Wild Card", bestOf: 3 };
  }

  if (gameTypes.includes("S")) {
    return { type: "spring_training" };
  }

  if (games.length === 1) {
    return { type: "single_game_event" };
  }

  return { type: "regular_season" };
}

function toPerspectiveGame(teamId: number, teamKey: string, game: MlbScheduledGame): SeriesPerspectiveGame | null {
  const isHome = game.homeTeam.id === teamId;
  const isAway = game.awayTeam.id === teamId;
  if (!isHome && !isAway) {
    return null;
  }

  const teamSide = isHome ? game.homeTeam : game.awayTeam;
  const opponentSide = isHome ? game.awayTeam : game.homeTeam;
  const canonicalOpponent = resolveCanonicalTeam({
    league: "MLB",
    abbreviation: opponentSide.key,
    name: opponentSide.name,
  });
  const canonicalLooksSafe = canonicalOpponent.abbreviation.length >= 2 && canonicalOpponent.name.trim().length > 0;
  const preferredName = opponentSide.name?.trim() || (canonicalLooksSafe ? canonicalOpponent.name : "Unknown Opponent");
  const preferredKey = looksLikeAbbreviation(opponentSide.key)
    ? opponentSide.key.trim().toUpperCase()
    : (canonicalLooksSafe && looksLikeAbbreviation(canonicalOpponent.abbreviation)
      ? canonicalOpponent.abbreviation
      : deriveAbbreviationFromName(preferredName));
  const opponentIdentityKey = opponentSide.id
    ? `id:${opponentSide.id}`
    : `name:${normalizeToken(preferredName) || normalizeToken(preferredKey) || "unknown"}`;

  const parsed = parseIsoDate(game.gameDate);
  const localDate = parsed ? formatDateInTimeZone(parsed, "America/New_York") : game.gameDate.slice(0, 10);

  return {
    gameId: game.gamePk ? String(game.gamePk) : `${teamKey}-${opponentIdentityKey}-${game.gameDate}`,
    gamePk: game.gamePk,
    gameDate: game.gameDate,
    localDate,
    gameType: game.gameType,
    status: toGameStatus(game),
    detailedState: game.detailedState,
    venue: game.venue,
    isHome,
    teamScore: isHome ? game.homeScore : game.awayScore,
    opponentScore: isHome ? game.awayScore : game.homeScore,
    teamProbable: teamSide.probableStarter,
    opponentProbable: opponentSide.probableStarter,
    opponent: {
      id: opponentSide.id,
      identityKey: opponentIdentityKey,
      key: preferredKey,
      name: preferredName,
    },
    seriesDescription: game.seriesDescription,
    seriesGameNumber: game.seriesGameNumber,
    gamesInSeries: game.gamesInSeries,
    doubleHeader: game.doubleHeader,
    gameNumber: game.gameNumber,
    rescheduleDate: game.rescheduleDate,
    rescheduledFrom: game.rescheduledFrom,
  };
}

function hasOfficialSignal(game: SeriesPerspectiveGame): boolean {
  return Boolean(game.seriesDescription || game.seriesGameNumber || game.gamesInSeries);
}

function canJoinOfficial(previous: SeriesPerspectiveGame, current: SeriesPerspectiveGame): boolean {
  if (previous.opponent.identityKey !== current.opponent.identityKey) {
    return false;
  }

  const dateGap = dayDiff(previous.localDate, current.localDate);
  if (dateGap < 0 || dateGap > 2) {
    return false;
  }

  const previousDescription = (previous.seriesDescription ?? "").trim().toLowerCase();
  const currentDescription = (current.seriesDescription ?? "").trim().toLowerCase();
  if (previousDescription && currentDescription && previousDescription === currentDescription) {
    return true;
  }

  if (
    typeof previous.seriesGameNumber === "number"
    && typeof current.seriesGameNumber === "number"
    && typeof previous.gamesInSeries === "number"
    && typeof current.gamesInSeries === "number"
    && previous.gamesInSeries === current.gamesInSeries
    && current.seriesGameNumber >= previous.seriesGameNumber
    && current.seriesGameNumber <= previous.seriesGameNumber + 2
  ) {
    return true;
  }

  return false;
}

function canJoinFallback(previous: SeriesPerspectiveGame, current: SeriesPerspectiveGame): boolean {
  if (previous.opponent.identityKey !== current.opponent.identityKey) {
    return false;
  }
  const dateGap = dayDiff(previous.localDate, current.localDate);
  return dateGap >= 0 && dateGap <= 1;
}

export function groupMlbSeriesGames(args: {
  teamKey: string;
  season: number;
  teamId: number;
  games: MlbScheduledGame[];
  now: Date;
}): GroupedSeries[] {
  const perspectiveGames = args.games
    .map((game) => toPerspectiveGame(args.teamId, args.teamKey, game))
    .filter((game): game is SeriesPerspectiveGame => Boolean(game))
    .sort((left, right) => new Date(left.gameDate).getTime() - new Date(right.gameDate).getTime());

  const groups: Array<{ games: SeriesPerspectiveGame[]; officialUsed: boolean }> = [];

  for (const game of perspectiveGames) {
    if (groups.length === 0) {
      groups.push({ games: [game], officialUsed: hasOfficialSignal(game) });
      continue;
    }

    const current = groups[groups.length - 1];
    const previous = current.games[current.games.length - 1];
    const joinOfficial = canJoinOfficial(previous, game);
    const joinFallback = canJoinFallback(previous, game);

    if (joinOfficial || joinFallback) {
      current.games.push(game);
      if (joinOfficial || hasOfficialSignal(game)) {
        current.officialUsed = true;
      }
      continue;
    }

    groups.push({ games: [game], officialUsed: hasOfficialSignal(game) });
  }

  const nowMs = args.now.getTime();
  const today = formatDateInTimeZone(args.now, "America/New_York");

  return groups.map((group, index) => {
    const games = group.games;
    const first = games[0];
    const last = games[games.length - 1];

    const hasLive = games.some((game) => game.status === "live");
    const hasScheduledFuture = games.some((game) => {
      const parsed = parseIsoDate(game.gameDate);
      return parsed ? parsed.getTime() >= nowMs && (game.status === "scheduled" || game.status === "postponed") : false;
    });
    const hasStarted = games.some((game) => {
      const parsed = parseIsoDate(game.gameDate);
      return game.status === "final" || game.status === "live" || (parsed ? parsed.getTime() <= nowMs : false);
    });
    const hasToday = games.some((game) => game.localDate === today);

    let lifecycle: SeriesLifecycle;
    if (hasLive || (hasStarted && (hasScheduledFuture || hasToday))) {
      lifecycle = "active";
    } else if (!hasStarted && hasScheduledFuture) {
      lifecycle = "upcoming";
    } else {
      lifecycle = "completed";
    }

    const typeMeta = toSeriesType(games);
    const allSpring = games.every((game) => isSpringGame(game));
    const springSeriesConfident = allSpring ? isConfidentSpringSeries(games, group.officialUsed) : false;
    const groupingMode: SeriesGroupingMode = (() => {
      if (typeMeta.type === "single_game_event") {
        return "single_game_event";
      }
      if (allSpring && !springSeriesConfident) {
        return "spring_matchup";
      }
      return group.officialUsed ? "official_series" : "inferred_series";
    })();
    const seriesType: SeriesType = groupingMode === "spring_matchup"
      ? "spring_training_matchup"
      : typeMeta.type;
    const opponentToken = first.opponent.id
      ? `id${first.opponent.id}`
      : (normalizeToken(first.opponent.name) || normalizeToken(first.opponent.key) || "opp");

    return {
      seriesId: `${args.teamKey}-${opponentToken}-${first.localDate}-${index + 1}`,
      teamKey: args.teamKey,
      season: args.season,
      opponent: first.opponent,
      games,
      groupingMethod: group.officialUsed ? "official" : "opponent_consecutive_dates",
      groupingMode,
      type: seriesType,
      postseasonRound: typeMeta.postseasonRound,
      bestOf: typeMeta.bestOf,
      lifecycle,
      startDate: first.localDate,
      endDate: last.localDate,
    };
  });
}

export function calculateSeriesScore(series: GroupedSeries): {
  teamWins: number;
  opponentWins: number;
  ties: number;
  runDifferential: number;
  runsScored: number;
  runsAllowed: number;
  completedGames: number;
} {
  let teamWins = 0;
  let opponentWins = 0;
  let ties = 0;
  let runDifferential = 0;
  let runsScored = 0;
  let runsAllowed = 0;
  let completedGames = 0;

  for (const game of series.games) {
    if (game.status !== "final") {
      continue;
    }

    const teamScore = asNumber(game.teamScore);
    const opponentScore = asNumber(game.opponentScore);
    if (typeof teamScore !== "number" || typeof opponentScore !== "number") {
      continue;
    }

    completedGames += 1;
    runsScored += teamScore;
    runsAllowed += opponentScore;
    runDifferential += teamScore - opponentScore;

    if (teamScore > opponentScore) {
      teamWins += 1;
    } else if (teamScore < opponentScore) {
      opponentWins += 1;
    } else {
      ties += 1;
    }
  }

  return {
    teamWins,
    opponentWins,
    ties,
    runDifferential,
    runsScored,
    runsAllowed,
    completedGames,
  };
}

function toSeriesSummary(teamKey: string, series: GroupedSeries, score: ReturnType<typeof calculateSeriesScore>): string {
  if (series.groupingMode === "spring_matchup") {
    const opponentLabel = series.opponent.name || series.opponent.key;
    if (series.lifecycle === "upcoming") {
      return `${teamKey} spring training matchup vs ${opponentLabel}`;
    }
    if (series.lifecycle === "active") {
      return `Spring training matchup: ${teamKey} vs ${opponentLabel}`;
    }
    return `Spring training matchup completed: ${teamKey} vs ${opponentLabel}`;
  }

  if (series.type === "single_game_event") {
    return `${teamKey} single game matchup event vs ${series.opponent.name || series.opponent.key}`;
  }
  if (score.completedGames === 0) {
    const count = series.games.length;
    if (series.type === "spring_training") {
      return `${teamKey} open a spring set vs ${series.opponent.name || series.opponent.key}`;
    }
    return `${teamKey} open a ${count}-game set vs ${series.opponent.name || series.opponent.key}`;
  }
  if (score.teamWins > score.opponentWins) {
    return `${teamKey} lead series ${score.teamWins}-${score.opponentWins} vs ${series.opponent.name || series.opponent.key}`;
  }
  if (score.teamWins < score.opponentWins) {
    return `${teamKey} trail series ${score.teamWins}-${score.opponentWins} vs ${series.opponent.name || series.opponent.key}`;
  }
  return `Series tied ${score.teamWins}-${score.opponentWins} vs ${series.opponent.name || series.opponent.key}`;
}

function toStatusLine(series: GroupedSeries, score: ReturnType<typeof calculateSeriesScore>): string {
  if (series.groupingMode === "spring_matchup") {
    if (series.lifecycle === "upcoming") {
      return "Next spring training game";
    }
    if (series.lifecycle === "active") {
      return "Spring training matchup";
    }
    return "No active spring training series detected";
  }

  const upcoming = series.games.find((game) => game.status === "scheduled" || game.status === "postponed");
  if (series.lifecycle === "upcoming") {
    if (series.type === "spring_training") {
      return "Next spring training game";
    }
    return `Next game ${upcoming ? new Date(upcoming.gameDate).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "TBD"}`;
  }
  if (series.lifecycle === "completed") {
    return "Completed series";
  }
  if (score.teamWins === score.opponentWins && score.completedGames > 0 && score.completedGames < series.games.length) {
    return "Series tied";
  }
  if (score.teamWins > score.opponentWins && score.completedGames < series.games.length) {
    return `${series.teamKey} series lead`;
  }
  if (score.teamWins < score.opponentWins && score.completedGames < series.games.length) {
    return `${series.teamKey} playing from behind`;
  }
  return "Series in progress";
}

function toLabels(series: GroupedSeries, score: ReturnType<typeof calculateSeriesScore>): string[] {
  if (series.groupingMode === "spring_matchup") {
    const labels = ["Spring training matchup"];
    if (series.games.some((game) => (game.doubleHeader ?? "").toUpperCase() === "Y")) {
      labels.push("Split doubleheader");
    }
    return Array.from(new Set(labels));
  }

  const labels: string[] = [];
  if (series.type === "single_game_event") {
    labels.push("Single game matchup event");
  }
  if (series.type === "spring_training" && series.lifecycle !== "completed") {
    labels.push("Current spring training set");
  }
  if (series.games.some((game) => (game.doubleHeader ?? "").toUpperCase() === "Y")) {
    labels.push("Split doubleheader");
  }
  if (series.lifecycle !== "completed" && score.completedGames === 0) {
    labels.push("Series opener");
  }

  const remaining = series.games.length - score.completedGames;
  if (remaining === 1 && score.teamWins === score.opponentWins && series.games.length > 1) {
    labels.push("Rubber game");
  }

  const clinchTarget = series.bestOf
    ? Math.floor(series.bestOf / 2) + 1
    : Math.floor(series.games.length / 2) + 1;

  if (remaining > 0 && score.teamWins === clinchTarget - 1) {
    labels.push("Clinch opportunity");
  }
  if (remaining === 1 && score.opponentWins === clinchTarget - 1 && score.teamWins < score.opponentWins) {
    labels.push("Avoid sweep");
  }
  if (score.teamWins === score.opponentWins && score.completedGames > 0 && remaining > 0) {
    labels.push("Series tied");
  }
  if (score.teamWins > score.opponentWins && remaining > 0) {
    labels.push("Series lead");
  }

  return Array.from(new Set(labels));
}

function toGameChip(game: SeriesPerspectiveGame): { chip: string; result?: "W" | "L" | "T" } {
  if (game.status === "postponed") {
    return { chip: "PPD" };
  }
  if (game.status === "final") {
    const teamScore = asNumber(game.teamScore);
    const opponentScore = asNumber(game.opponentScore);
    if (typeof teamScore === "number" && typeof opponentScore === "number") {
      if (teamScore > opponentScore) {
        return { chip: `W ${teamScore}-${opponentScore}`, result: "W" };
      }
      if (teamScore < opponentScore) {
        return { chip: `L ${teamScore}-${opponentScore}`, result: "L" };
      }
      return { chip: `T ${teamScore}-${opponentScore}`, result: "T" };
    }
    return { chip: "Final" };
  }

  const parsed = parseIsoDate(game.gameDate);
  if (!parsed) {
    return { chip: "Scheduled" };
  }
  return {
    chip: parsed.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

function toTimeline(series: GroupedSeries): MlbSeriesTimelineGame[] {
  return [...series.games]
    .sort((left, right) => new Date(left.gameDate).getTime() - new Date(right.gameDate).getTime())
    .map((game) => {
      const parsed = parseIsoDate(game.gameDate);
      const chipMeta = toGameChip(game);
      const probableStarter = game.teamProbable?.fullName || game.teamProbable?.playerId
        ? {
          fullName: game.teamProbable?.fullName,
          playerId: game.teamProbable?.playerId,
          headshotUrl: toHeadshotUrl(game.teamProbable?.playerId),
        }
        : undefined;
      const opponentStarter = game.opponentProbable?.fullName || game.opponentProbable?.playerId
        ? {
          fullName: game.opponentProbable?.fullName,
          playerId: game.opponentProbable?.playerId,
          headshotUrl: toHeadshotUrl(game.opponentProbable?.playerId),
        }
        : undefined;
      const postponed = game.status === "postponed"
        ? {
          isPostponed: true,
          rescheduledTime: game.rescheduleDate,
        }
        : undefined;

      const scoreLine = (() => {
        const teamScore = asNumber(game.teamScore);
        const opponentScore = asNumber(game.opponentScore);
        if (typeof teamScore === "number" && typeof opponentScore === "number") {
          return `${game.isHome ? "Home" : "Away"} ${teamScore}-${opponentScore}`;
        }
        return undefined;
      })();

      return {
        gameId: game.gameId,
        dateTime: game.gameDate,
        dateLabel: parsed
          ? parsed.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
          : game.gameDate,
        homeAway: game.isHome ? "home" : "away",
        status: game.status,
        statusText: game.detailedState,
        chip: chipMeta.chip,
        teamScore: asNumber(game.teamScore),
        opponentScore: asNumber(game.opponentScore),
        result: chipMeta.result,
        probableStarter,
        opponentProbableStarter: opponentStarter,
        splitDoubleheader: (game.doubleHeader ?? "").toUpperCase() === "Y",
        postponed,
        recapLine: game.status === "final" ? scoreLine : undefined,
        starterSummary: probableStarter?.fullName ? `${probableStarter.fullName} probable` : undefined,
      };
    });
}

function selectSpringMatchupFocusGames(series: GroupedSeries, now: Date): GroupedSeries {
  if (series.groupingMode !== "spring_matchup") {
    return series;
  }

  const ordered = [...series.games].sort((left, right) => new Date(left.gameDate).getTime() - new Date(right.gameDate).getTime());
  const nowMs = now.getTime();
  const live = ordered.find((game) => game.status === "live");
  if (live) {
    return { ...series, games: [live] };
  }
  const nextScheduled = ordered.find((game) => {
    const parsed = parseIsoDate(game.gameDate);
    return parsed ? parsed.getTime() >= nowMs && (game.status === "scheduled" || game.status === "postponed") : false;
  });
  if (nextScheduled) {
    return { ...series, games: [nextScheduled] };
  }
  return { ...series, games: [ordered[ordered.length - 1]] };
}

function toSelectableSeries(series: GroupedSeries[]): Array<{ seriesId: string; label: string; lifecycle: SeriesLifecycle }> {
  return [...series]
    .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
    .map((entry) => {
      const prefix = entry.groupingMode === "spring_matchup"
        ? "Spring matchup"
        : (entry.lifecycle === "active"
          ? "Current"
          : entry.lifecycle === "upcoming"
            ? "Upcoming"
            : "Completed");
      const dateLabel = new Date(`${entry.startDate}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return {
        seriesId: entry.seriesId,
        label: `${prefix} | ${dateLabel} | ${entry.teamKey} vs ${entry.opponent.name || entry.opponent.key}`,
        lifecycle: entry.lifecycle,
      };
    });
}

function toRecentHeadToHead(series: GroupedSeries[], selected: GroupedSeries): Array<{ seriesId: string; label: string; result: string }> {
  if (selected.groupingMode === "spring_matchup") {
    return [];
  }
  const selectedStart = parseIsoDate(`${selected.startDate}T00:00:00Z`)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const candidates = series
    .filter((entry) => entry.opponent.identityKey === selected.opponent.identityKey)
    .filter((entry) => entry.seriesId !== selected.seriesId)
    .filter((entry) => entry.lifecycle === "completed")
    .filter((entry) => entry.groupingMode !== "spring_matchup")
    .filter((entry) => (parseIsoDate(`${entry.startDate}T00:00:00Z`)?.getTime() ?? 0) < selectedStart)
    .sort((left, right) => (parseIsoDate(`${right.startDate}T00:00:00Z`)?.getTime() ?? 0) - (parseIsoDate(`${left.startDate}T00:00:00Z`)?.getTime() ?? 0))
    .slice(0, 5);

  return candidates.map((entry) => {
    const score = calculateSeriesScore(entry);
    const label = `${new Date(`${entry.startDate}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${entry.teamKey} vs ${entry.opponent.name || entry.opponent.key}`;
    const result = score.teamWins === score.opponentWins
      ? `${score.teamWins}-${score.opponentWins}`
      : (score.teamWins > score.opponentWins ? `Won ${score.teamWins}-${score.opponentWins}` : `Lost ${score.teamWins}-${score.opponentWins}`);
    return {
      seriesId: entry.seriesId,
      label,
      result,
    };
  });
}

export function resolveSeriesSelection(args: {
  series: GroupedSeries[];
  now: Date;
  selectedSeriesId?: string;
  selectionPinned?: boolean;
}): {
  selected: GroupedSeries | null;
  currentSeries: GroupedSeries | null;
  resolution: "active" | "upcoming" | "selected" | "completed";
  selectionState: SeriesSelectionState;
  message?: string;
} {
  const ordered = [...args.series].sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime());
  const current = resolveCurrentRelevantSeries(ordered, args.now);
  const completed = [...ordered].reverse().find((entry) => entry.lifecycle === "completed") ?? null;
  const selectionPinned = Boolean(args.selectionPinned);

  if (args.selectedSeriesId) {
    const selected = ordered.find((entry) => entry.seriesId === args.selectedSeriesId) ?? null;
    if (selected) {
      if (current && selected.seriesId !== current.seriesId && isOlderThanCurrent(selected, current)) {
        if (selectionPinned) {
          return {
            selected,
            currentSeries: current,
            resolution: "selected",
            selectionState: "persisted_past",
            message: "Viewing past matchup selection.",
          };
        }
        return {
          selected: current,
          currentSeries: current,
          resolution: toResolutionFromLifecycle(current.lifecycle),
          selectionState: "auto_promoted",
          message: "Saved matchup selection is in the past. Showing current matchup.",
        };
      }
      const resolution = selected.lifecycle === "completed" ? "selected" : (selected.lifecycle as "active" | "upcoming");
      return {
        selected,
        currentSeries: current,
        resolution,
        selectionState: "current",
      };
    }
    if (current) {
      return {
        selected: current,
        currentSeries: current,
        resolution: toResolutionFromLifecycle(current.lifecycle),
        selectionState: "persisted_missing",
        message: "Saved matchup selection was not found. Showing current matchup.",
      };
    }
  }

  if (current) {
    return {
      selected: current,
      currentSeries: current,
      resolution: toResolutionFromLifecycle(current.lifecycle),
      selectionState: "current",
      message: current.lifecycle === "upcoming" ? "No active series. Showing next upcoming series." : undefined,
    };
  }

  if (completed) {
    return {
      selected: completed,
      currentSeries: null,
      resolution: "completed",
      selectionState: args.selectedSeriesId ? "persisted_missing" : "current",
      message: "No active series. Showing most recent completed series.",
    };
  }

  return {
    selected: null,
    currentSeries: null,
    resolution: "upcoming",
    selectionState: args.selectedSeriesId ? "persisted_missing" : "current",
    message: "No active series. Showing next upcoming series.",
  };
}

function buildFailure(args: {
  message: string;
  code: string;
  sourceUsed: string;
  dataMode: DataModeArg;
  notes?: string[];
  warnings?: string[];
}): MlbSeriesTrackerResult {
  const warnings = Array.from(new Set(args.warnings ?? []));
  return {
    ok: false,
    data: null,
    meta: {
      sourceUsed: args.sourceUsed,
      updatedAt: new Date().toISOString(),
      requestId: randomUUID(),
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      notes: args.notes,
      dataMode: args.dataMode,
      state: "failed",
    },
    error: {
      message: args.message,
      code: args.code,
    },
  };
}

function pruneForMode(data: MlbSeriesTrackerData, mode: SeriesMode): MlbSeriesTrackerData {
  if (mode === "advanced") {
    return data;
  }

  return {
    ...data,
    teamTotals: {
      runsScored: data.teamTotals.runsScored,
      runsAllowed: data.teamTotals.runsAllowed,
    },
    pitchingTotals: {},
    bullpenTotals: {},
    recentHeadToHead: data.recentHeadToHead.slice(0, 2),
    gameTimeline: data.gameTimeline.map((game) => ({
      gameId: game.gameId,
      dateTime: game.dateTime,
      dateLabel: game.dateLabel,
      homeAway: game.homeAway,
      status: game.status,
      statusText: game.statusText,
      chip: game.chip,
      teamScore: game.teamScore,
      opponentScore: game.opponentScore,
      result: game.result,
      probableStarter: game.probableStarter,
      opponentProbableStarter: game.opponentProbableStarter,
      splitDoubleheader: game.splitDoubleheader,
      postponed: game.postponed,
      recapLine: game.recapLine,
    })),
  };
}

function defaultDeps(): ResolveDeps {
  return {
    fetchSchedule: async (teamKey, dataMode, cacheBust, season) => {
      return getMlbTeamSeasonScheduleWithProbables(teamKey, dataMode, cacheBust, { season });
    },
    now: () => new Date(),
  };
}

export async function resolveMlbSeriesTracker(
  args: ResolveMlbSeriesTrackerArgs,
  depsInput?: Partial<ResolveDeps>,
): Promise<MlbSeriesTrackerResult> {
  const deps = { ...defaultDeps(), ...depsInput };
  const normalizedTeamKey = normalizeTeamKey(args.teamKey);
  const now = deps.now();
  const season = now.getUTCFullYear();

  if (!normalizedTeamKey) {
    return buildFailure({
      message: "teamKey is required",
      code: "MISSING_TEAM_KEY",
      sourceUsed: toProviderMode(args.dataMode) === "fixture" ? "fixture" : "mlb",
      dataMode: args.dataMode,
      warnings: ["teamKey is required"],
    });
  }

  const schedule = await deps.fetchSchedule(normalizedTeamKey, args.dataMode, args.cacheBust, season);
  if (!schedule.data) {
    return buildFailure({
      message: "Failed to load series schedule",
      code: "SCHEDULE_NOT_FOUND",
      sourceUsed: schedule.meta.sourceUsed,
      dataMode: args.dataMode,
      warnings: [schedule.meta.warning ?? "No schedule data available."],
    });
  }

  const grouped = groupMlbSeriesGames({
    teamKey: schedule.data.teamKey,
    season: schedule.data.season,
    teamId: schedule.data.teamId,
    games: schedule.data.games,
    now,
  });

  if (grouped.length === 0) {
    return {
      ok: true,
      data: null,
      meta: {
        sourceUsed: schedule.meta.sourceUsed,
        updatedAt: schedule.meta.updatedAt,
        requestId: schedule.meta.requestId,
        warning: "No series data returned in the selected season window.",
        notes: schedule.meta.notes,
        dataMode: args.dataMode,
        state: "partial",
        season: schedule.data.season,
      },
      error: null,
    };
  }

  const selection = resolveSeriesSelection({
    series: grouped,
    now,
    selectedSeriesId: args.seriesId,
    selectionPinned: args.selectionPinned,
  });

  if (!selection.selected) {
    return {
      ok: true,
      data: null,
      meta: {
        sourceUsed: schedule.meta.sourceUsed,
        updatedAt: schedule.meta.updatedAt,
        requestId: schedule.meta.requestId,
        warning: selection.message ?? "No active series. Showing next upcoming series.",
        notes: schedule.meta.notes,
        dataMode: args.dataMode,
        state: "partial",
        season: schedule.data.season,
      },
      error: null,
    };
  }

  const selectedForDisplay = selectSpringMatchupFocusGames(selection.selected, now);
  const score = calculateSeriesScore(selectedForDisplay);
  const summary = toSeriesSummary(schedule.data.teamKey, selectedForDisplay, score);
  const statusLine = toStatusLine(selectedForDisplay, score);
  const labels = toLabels(selectedForDisplay, score);
  const gameTimeline = toTimeline(selectedForDisplay);
  const message = selection.selectionState === "persisted_past"
    ? selection.message
    : (selectedForDisplay.groupingMode === "spring_matchup" && selectedForDisplay.lifecycle !== "active"
      ? "No active spring training series detected"
      : selection.message);

  const seriesData: MlbSeriesTrackerData = {
    state: selectedForDisplay.lifecycle === "completed" ? "partial" : "success",
    resolution: selection.resolution,
    selectionState: selection.selectionState,
    seriesId: selectedForDisplay.seriesId,
    season: selectedForDisplay.season,
    team: {
      key: schedule.data.teamKey,
      name: resolveCanonicalTeam({ league: "MLB", abbreviation: schedule.data.teamKey, name: schedule.data.teamKey }).name,
    },
    opponent: {
      key: selectedForDisplay.opponent.key,
      name: selectedForDisplay.opponent.name,
    },
    seriesType: selectedForDisplay.type,
    groupingMode: selectedForDisplay.groupingMode,
    postseasonRound: selectedForDisplay.postseasonRound,
    bestOf: selectedForDisplay.bestOf,
    groupingMethod: selectedForDisplay.groupingMethod,
    summary,
    statusLine,
    message,
    labels,
    seriesScore: {
      teamWins: score.teamWins,
      opponentWins: score.opponentWins,
      ties: score.ties,
      display: `${score.teamWins}-${score.opponentWins}`,
    },
    runDifferential: score.runDifferential,
    teamTotals: {
      runsScored: score.runsScored,
      runsAllowed: score.runsAllowed,
    },
    pitchingTotals: {},
    bullpenTotals: {},
    recentHeadToHead: toRecentHeadToHead(grouped, selectedForDisplay),
    gameTimeline,
    selectableSeries: toSelectableSeries(grouped),
    currentSeriesId: selection.currentSeries?.seriesId,
    canGoToCurrentSeries: Boolean(
      selection.currentSeries
      && selection.currentSeries.seriesId !== selectedForDisplay.seriesId
      && selection.selectionState === "persisted_past",
    ),
    notes: message ? [message] : undefined,
  };

  const state = seriesData.state;

  return {
    ok: true,
    data: pruneForMode(seriesData, args.mode),
    meta: {
      sourceUsed: schedule.meta.sourceUsed,
      updatedAt: schedule.meta.updatedAt,
      requestId: schedule.meta.requestId,
      warning: schedule.meta.warning,
      warnings: schedule.meta.warnings,
      notes: schedule.meta.notes,
      dataMode: args.dataMode,
      state,
      season: selectedForDisplay.season,
      seriesType: selectedForDisplay.type,
      seriesGroupingMethod: selectedForDisplay.groupingMethod,
      seriesGroupingMode: selectedForDisplay.groupingMode,
      selectionState: selection.selectionState,
    },
    error: null,
  };
}
