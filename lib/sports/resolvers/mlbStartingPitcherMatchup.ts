import { randomUUID } from "node:crypto";
import { fetchEspnJson } from "@/lib/providers/espn/client";
import { getMlbUpcomingScheduleWithProbables } from "@/lib/providers/mlb";
import { resolveMlbPitcherComparisonStats } from "@/lib/providers/mlb";
import { resolveMlbTeam } from "@/lib/providers/mlb/teamMap";
import type { MlbScheduledGame } from "@/lib/providers/mlb";
import type { Meta } from "@/lib/providers/types";
import { resolveScheduleQueryContext } from "@/lib/providers/scheduleContext";
import { formatDateInTimeZone } from "@/lib/providers/scheduleWindow";
import { resolveCanonicalTeam } from "@/lib/sports/mappings/teamMap";

type DataModeArg = "auto" | "live" | "fixture";
type MatchupMode = "beginner" | "advanced";
type MatchupState = "success" | "partial" | "failed";
type MatchupSide = "away" | "home";

type RecordMap = Record<string, unknown>;

type StarterComparisonCategory = {
  label: string;
  winner: MatchupSide | "even";
  note?: string;
};

export type PitcherLastStart = {
  date?: string;
  opponent?: string;
  innings?: string;
  earnedRuns?: number | string;
  strikeouts?: number | string;
};

export type PitcherMatchupCard = {
  playerId?: string;
  fullName: string;
  headshotUrl?: string;
  teamKey?: string;
  handedness?: string;
  record?: string;
  era?: number | string;
  whip?: number | string;
  inningsPitched?: number | string;
  strikeouts?: number | string;
  kPer9?: number | string;
  bbPer9?: number | string;
  hrPer9?: number | string;
  opponentAvg?: number | string;
  last3Starts?: PitcherLastStart[];
  homeAwaySplits?: {
    home?: Record<string, string | number>;
    away?: Record<string, string | number>;
  };
  handednessSplits?: {
    vsLeft?: Record<string, string | number>;
    vsRight?: Record<string, string | number>;
  };
  gameLogMiniSummary?: string[];
  statsBasisLabel?: string;
  confidenceNote?: string;
};

export type MlbStartingPitcherMatchupData = {
  game: {
    gameId: string;
    awayTeam: {
      key: string;
      name: string;
      logoUrl?: string;
    };
    homeTeam: {
      key: string;
      name: string;
      logoUrl?: string;
    };
    gameTime: string;
    venue?: string;
    status: "scheduled" | "live" | "final" | "partial";
  };
  pitchers: {
    away: PitcherMatchupCard | null;
    home: PitcherMatchupCard | null;
  };
  edge: {
    overall?: string;
    beginnerSummary?: string;
    categories?: StarterComparisonCategory[];
  } | null;
  state: MatchupState;
  notes?: string[];
  selectableGames?: Array<{
    gameId: string;
    label: string;
  }>;
};

export type MlbStartingPitcherMatchupMeta = {
  sourceUsed: string;
  updatedAt: string;
  fallbackUsed: boolean;
  state: MatchupState;
  requestId: string;
  warning?: string;
  warnings?: string[];
  notes?: string[];
  dataMode?: DataModeArg;
};

export type MlbStartingPitcherMatchupResult = {
  ok: boolean;
  data: MlbStartingPitcherMatchupData | null;
  meta: MlbStartingPitcherMatchupMeta;
  error: { message: string; code: string } | null;
};

export type ResolveMlbStartingPitcherMatchupArgs = {
  teamKey: string;
  gameId?: string;
  mode: MatchupMode;
  dataMode: DataModeArg;
  cacheBust?: string | number;
};

type TeamIdentity = {
  key: string;
  name: string;
  apiSportsTeamId?: string;
  logoUrl?: string;
};

type NormalizedGame = {
  gameId: string;
  startTime: string;
  dateKey: string;
  venue?: string;
  status: "scheduled" | "live" | "final";
  statusText?: string;
  awayTeam: {
    key: string;
    name: string;
    apiSportsTeamId?: string;
    logoUrl?: string;
  };
  homeTeam: {
    key: string;
    name: string;
    apiSportsTeamId?: string;
    logoUrl?: string;
  };
  probableAway: PitcherMatchupCard | null;
  probableHome: PitcherMatchupCard | null;
};

type ResolveDeps = {
  fetchTeamIdentity: (teamKey: string, providerMode: "live" | "fixture", cacheBust?: string | number) => Promise<{ team: TeamIdentity | null; meta: Meta; warning?: string }>;
  fetchApiSportsGames: (team: TeamIdentity, providerMode: "live" | "fixture", cacheBust?: string | number) => Promise<{ games: NormalizedGame[]; meta: Meta; notes: string[]; warning?: string }>;
  fetchEspnGameFallback: (selected: NormalizedGame, providerMode: "live" | "fixture", cacheBust?: string | number) => Promise<{ game: NormalizedGame | null; meta: Meta; warning?: string }>;
  fetchPitcherStats: (
    pitcher: PitcherMatchupCard,
    providerMode: "live" | "fixture",
    cacheBust?: string | number,
    selectedGameTime?: string,
  ) => Promise<{ pitcher: PitcherMatchupCard; meta: Meta; warning?: string }>;
  now: () => Date;
};

const EDGE_WEIGHTS = {
  era: 25,
  whip: 20,
  kPer9: 15,
  bbPer9: 15,
  hrPer9: 10,
  recentForm: 15,
} as const;

function asObject(value: unknown): RecordMap | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordMap) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
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

function toProviderMode(dataMode: DataModeArg): "live" | "fixture" {
  if (dataMode === "live" || dataMode === "fixture") {
    return dataMode;
  }
  return (process.env.NASHBOARD_DATA_MODE ?? "live").toLowerCase() === "fixture" ? "fixture" : "live";
}

function normalizeTeamKey(value: string): string {
  return value.trim().toUpperCase();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

const TECHNICAL_NOTE_PATTERNS = [
  "configured season",
  "inferred",
  "schedule window",
  "timezone",
  "time zone",
  "pitcher stat diagnostic",
  "identity lookup",
  "endpoint",
];

export function isTechnicalMatchupNote(note: string): boolean {
  const normalized = note.trim().toLowerCase();
  return TECHNICAL_NOTE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function toUserFacingMatchupNotes(notes: string[]): string[] {
  return unique(notes).filter((note) => !isTechnicalMatchupNote(note));
}

function statusFromText(value: string | undefined): "scheduled" | "live" | "final" {
  const key = (value ?? "").toLowerCase();
  if (
    key.includes("live")
    || key.includes("in play")
    || key.includes("progress")
    || key === "in"
    || key === "1"
    || key === "2"
    || key === "3"
  ) {
    return "live";
  }
  if (
    key.includes("final")
    || key.includes("finished")
    || key.includes("ft")
    || key.includes("post")
  ) {
    return "final";
  }
  return "scheduled";
}

function toIso(value: unknown): string | undefined {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const parsed = new Date(ms);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return undefined;
}

function parsePitcherSeed(row: RecordMap | null, teamKey?: string): PitcherMatchupCard | null {
  if (!row) {
    return null;
  }
  const direct = asObject(row.probable_pitcher)
    ?? asObject(row.probablePitcher)
    ?? asObject(row.starting_pitcher)
    ?? asObject(row.starter)
    ?? asObject(row.probable);

  const source = direct ?? row;
  const fullName = readString(source.fullName)
    ?? readString(source.name)
    ?? readString(source.player_name)
    ?? readString(source.displayName);

  if (!fullName) {
    return null;
  }

  const playerId = readString(source.id)
    ?? readString(source.player_id)
    ?? readString(source.playerId);
  const record = readString(source.record);
  const era = readNumber(source.era) ?? readString(source.era);
  const whip = readNumber(source.whip) ?? readString(source.whip);
  const handedness = readString(source.hand)
    ?? readString(source.throws)
    ?? readString(source.throwingHand);
  const headshotUrl = readString(source.photo)
    ?? readString(source.headshot)
    ?? readString(source.headshotUrl)
    ?? readString(source.image);

  return {
    playerId,
    fullName,
    teamKey,
    headshotUrl,
    handedness,
    record,
    era,
    whip,
  };
}

function parseTeamFromApiSports(
  teamRow: RecordMap | null,
  leagueFallbackName: string,
  side: MatchupSide,
): {
  key: string;
  name: string;
  apiSportsTeamId?: string;
  logoUrl?: string;
} {
  const id = readString(teamRow?.id) ?? readNumber(teamRow?.id)?.toString();
  const code = readString(teamRow?.code)
    ?? readString(teamRow?.abbreviation)
    ?? readString(teamRow?.short_name)
    ?? `${side.toUpperCase()}_TBD`;
  const name = readString(teamRow?.name)
    ?? readString(teamRow?.display_name)
    ?? leagueFallbackName;
  const logoUrl = readString(teamRow?.logo) ?? readString(teamRow?.image);
  const canonical = resolveCanonicalTeam({
    league: "MLB",
    abbreviation: code,
    name,
    apiSportsTeamId: id,
    logoUrl,
  });
  return {
    key: canonical.abbreviation,
    name: canonical.name,
    apiSportsTeamId: canonical.providerIds?.apiSports ? String(canonical.providerIds.apiSports) : id,
    logoUrl: canonical.logoUrl ?? logoUrl,
  };
}

function parseApiSportsGameRows(payload: unknown, timeZone: string): NormalizedGame[] {
  const root = asObject(payload);
  const rows = asArray(root?.response);
  const parsed: NormalizedGame[] = [];

  for (const rowValue of rows) {
    const row = asObject(rowValue);
    if (!row) {
      continue;
    }

    const teams = asObject(row.teams);
    const home = asObject(teams?.home);
    const away = asObject(teams?.away) ?? asObject(teams?.visitors);
    const homeTeam = parseTeamFromApiSports(home, "Home Team", "home");
    const awayTeam = parseTeamFromApiSports(away, "Away Team", "away");

    const gameId = readString(row.id) ?? readNumber(row.id)?.toString();
    const date = asObject(row.date);
    const startTime = toIso(date?.start)
      ?? toIso(date?.timestamp)
      ?? toIso(row.date);
    if (!gameId || !startTime) {
      continue;
    }

    const statusRow = asObject(row.status);
    const statusText = readString(statusRow?.short)
      ?? readString(statusRow?.long)
      ?? readString(statusRow?.status);
    const status = statusFromText(statusText);
    const venue = readString(asObject(row.venue)?.name)
      ?? readString(asObject(row.stadium)?.name);
    const dateKey = formatDateInTimeZone(new Date(startTime), timeZone);

    parsed.push({
      gameId,
      startTime,
      dateKey,
      venue,
      status,
      statusText,
      awayTeam,
      homeTeam,
      probableAway: parsePitcherSeed(away, awayTeam.key),
      probableHome: parsePitcherSeed(home, homeTeam.key),
    });
  }

  return parsed.sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());
}

function toStarterFromSchedule(starter: MlbScheduledGame["awayTeam"]["probableStarter"], teamKey: string): PitcherMatchupCard | null {
  if (!starter?.fullName) {
    return null;
  }
  return {
    playerId: starter.playerId,
    fullName: starter.fullName,
    teamKey,
  };
}

function mapScheduledGameToNormalized(game: MlbScheduledGame, timeZone: string): NormalizedGame {
  const startTime = toIso(game.gameDate) ?? game.gameDate;
  return {
    gameId: game.gamePk ? String(game.gamePk) : `${game.awayTeam.key}-${game.homeTeam.key}-${startTime}`,
    startTime,
    dateKey: formatDateInTimeZone(new Date(startTime), timeZone),
    venue: game.venue,
    status: game.status,
    statusText: game.detailedState,
    awayTeam: {
      key: game.awayTeam.key,
      name: game.awayTeam.name,
      apiSportsTeamId: game.awayTeam.id ? String(game.awayTeam.id) : undefined,
      logoUrl: undefined,
    },
    homeTeam: {
      key: game.homeTeam.key,
      name: game.homeTeam.name,
      apiSportsTeamId: game.homeTeam.id ? String(game.homeTeam.id) : undefined,
      logoUrl: undefined,
    },
    probableAway: toStarterFromSchedule(game.awayTeam.probableStarter, game.awayTeam.key),
    probableHome: toStarterFromSchedule(game.homeTeam.probableStarter, game.homeTeam.key),
  };
}

function parseEspnTeam(competitor: RecordMap | null, fallbackSide: MatchupSide): {
  key: string;
  name: string;
  logoUrl?: string;
} {
  const team = asObject(competitor?.team);
  const key = readString(team?.abbreviation)
    ?? readString(team?.shortDisplayName)
    ?? `${fallbackSide.toUpperCase()}_TBD`;
  const name = readString(team?.displayName)
    ?? readString(team?.name)
    ?? "Unknown Team";
  const logos = asArray(team?.logos);
  const logoUrl = readString(team?.logo)
    ?? readString(team?.logoUrl)
    ?? readString(asObject(logos[0])?.href);
  const canonical = resolveCanonicalTeam({
    league: "MLB",
    abbreviation: key,
    name,
    logoUrl,
  });
  return {
    key: canonical.abbreviation,
    name: canonical.name,
    logoUrl: canonical.logoUrl ?? logoUrl,
  };
}

function parseEspnProbable(competitor: RecordMap | null, teamKey: string): PitcherMatchupCard | null {
  const probable = asObject(asArray(competitor?.probables)[0])
    ?? asObject(competitor?.probable)
    ?? asObject(competitor?.probablePitcher);
  if (!probable) {
    return null;
  }

  const athlete = asObject(probable.athlete) ?? probable;
  const fullName = readString(athlete.displayName)
    ?? readString(athlete.fullName)
    ?? readString(athlete.name)
    ?? readString(probable.displayName);
  if (!fullName) {
    return null;
  }

  const statsRows = asArray(probable.statistics).map((row) => asObject(row)).filter((row): row is RecordMap => Boolean(row));
  const statByLabel = new Map<string, string>();
  for (const row of statsRows) {
    const key = (readString(row.displayName) ?? readString(row.abbreviation) ?? "").toLowerCase();
    const value = readString(row.displayValue) ?? readString(row.value);
    if (key && value) {
      statByLabel.set(key, value);
    }
  }

  const era = statByLabel.get("era");
  const whip = statByLabel.get("whip");
  const strikeouts = statByLabel.get("k");
  const inningsPitched = statByLabel.get("ip");
  const record = readString(probable.record) ?? statByLabel.get("record");
  const hand = readString(athlete.hand)
    ?? readString(athlete.throws)
    ?? readString(athlete.throwingHand);

  return {
    playerId: readString(athlete.id) ?? readNumber(athlete.id)?.toString(),
    fullName,
    headshotUrl: readString(asObject(athlete.headshot)?.href)
      ?? readString(athlete.headshot)
      ?? readString(athlete.image),
    teamKey,
    handedness: hand,
    record,
    era: era ?? undefined,
    whip: whip ?? undefined,
    inningsPitched: inningsPitched ?? undefined,
    strikeouts: strikeouts ?? undefined,
    confidenceNote: "Probable starter sourced from ESPN fallback.",
  };
}

function parseEspnGameRows(payload: unknown, timeZone: string): NormalizedGame[] {
  const root = asObject(payload);
  const events = asArray(root?.events);
  const parsed: NormalizedGame[] = [];

  for (const eventValue of events) {
    const event = asObject(eventValue);
    if (!event) {
      continue;
    }

    const competition = asObject(asArray(event.competitions)[0]);
    if (!competition) {
      continue;
    }
    const competitors = asArray(competition.competitors).map((row) => asObject(row)).filter((row): row is RecordMap => Boolean(row));
    const awayRow = competitors.find((row) => readString(row.homeAway) === "away") ?? competitors[0] ?? null;
    const homeRow = competitors.find((row) => readString(row.homeAway) === "home") ?? competitors[1] ?? null;
    if (!awayRow || !homeRow) {
      continue;
    }

    const awayTeam = parseEspnTeam(awayRow, "away");
    const homeTeam = parseEspnTeam(homeRow, "home");
    const gameId = readString(event.id) ?? readString(competition.id);
    const startTime = toIso(event.date) ?? toIso(competition.date);
    if (!gameId || !startTime) {
      continue;
    }

    const statusType = asObject(asObject(competition.status)?.type);
    const statusText = readString(statusType?.state)
      ?? readString(statusType?.name)
      ?? readString(statusType?.detail)
      ?? readString(statusType?.shortDetail);
    const status = statusFromText(statusText);
    const venue = readString(asObject(competition.venue)?.fullName);

    parsed.push({
      gameId,
      startTime,
      dateKey: formatDateInTimeZone(new Date(startTime), timeZone),
      venue,
      status,
      statusText,
      awayTeam,
      homeTeam,
      probableAway: parseEspnProbable(awayRow, awayTeam.key),
      probableHome: parseEspnProbable(homeRow, homeTeam.key),
    });
  }

  return parsed.sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());
}

function dateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function selectMatchupGame(args: {
  games: NormalizedGame[];
  gameId?: string;
  now: Date;
  timeZone: string;
}): { selected: NormalizedGame | null; selectableGames: Array<{ gameId: string; label: string }> } {
  const sorted = [...args.games].sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());
  if (sorted.length === 0) {
    return { selected: null, selectableGames: [] };
  }

  const selectableGames = sorted.slice(0, 8).map((game) => ({
    gameId: game.gameId,
    label: `${dateLabel(game.startTime)} - ${game.awayTeam.key} at ${game.homeTeam.key}`,
  }));

  if (args.gameId) {
    const override = sorted.find((game) => String(game.gameId) === String(args.gameId));
    if (override) {
      return { selected: override, selectableGames };
    }
  }

  const today = formatDateInTimeZone(args.now, args.timeZone);
  const todaysGames = sorted.filter((game) => game.dateKey === today);
  if (todaysGames.length > 0) {
    const live = todaysGames.find((game) => game.status === "live");
    if (live) {
      return { selected: live, selectableGames };
    }
    const scheduled = todaysGames.find((game) => game.status === "scheduled");
    if (scheduled) {
      return { selected: scheduled, selectableGames };
    }
    return { selected: todaysGames[0], selectableGames };
  }

  const nowMs = args.now.getTime();
  const nextGame = sorted.find((game) => new Date(game.startTime).getTime() >= nowMs);
  if (nextGame) {
    return { selected: nextGame, selectableGames };
  }

  return { selected: sorted[sorted.length - 1], selectableGames };
}

function inningsToOuts(value: string | number | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const whole = Math.trunc(value);
    const decimal = Math.round((value - whole) * 10);
    return whole * 3 + Math.max(0, Math.min(2, decimal));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.includes(".")) {
      const [wholeRaw, outsRaw] = trimmed.split(".");
      const whole = Number(wholeRaw);
      const outs = Number(outsRaw);
      if (Number.isFinite(whole) && Number.isFinite(outs)) {
        return whole * 3 + Math.max(0, Math.min(2, outs));
      }
      return null;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return inningsToOuts(parsed);
    }
  }
  return null;
}

function toNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function recentFormValue(pitcher: PitcherMatchupCard | null): number | null {
  const starts = pitcher?.last3Starts;
  if (!starts || starts.length === 0) {
    return null;
  }
  let outs = 0;
  let earnedRuns = 0;
  for (const start of starts) {
    const startOuts = inningsToOuts(start.innings);
    const startEr = toNumeric(start.earnedRuns);
    if (startOuts === null || startEr === null) {
      continue;
    }
    outs += startOuts;
    earnedRuns += startEr;
  }
  if (outs <= 0) {
    return null;
  }
  const innings = outs / 3;
  return (earnedRuns * 9) / innings;
}

function formatMatchupValue(value: number | null, digits = 2): string {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  return value.toFixed(digits);
}

function compareMetric(args: {
  label: string;
  away: number | null;
  home: number | null;
  lowerIsBetter: boolean;
  weight: number;
}): { category: StarterComparisonCategory; awayPoints: number; homePoints: number } | null {
  const { label, away, home, lowerIsBetter, weight } = args;
  if (away === null || home === null) {
    return null;
  }

  const difference = lowerIsBetter ? home - away : away - home;
  const magnitude = Math.max(Math.abs(away), Math.abs(home), 1);
  const normalized = Math.min(1, Math.abs(difference) / magnitude);
  const weighted = normalized * weight;
  const even = Math.abs(difference) < 0.0001;
  const winner: MatchupSide | "even" = even ? "even" : (difference > 0 ? "away" : "home");

  if (winner === "even") {
    return {
      category: {
        label,
        winner: "even",
        note: `${formatMatchupValue(away)} vs ${formatMatchupValue(home)}`,
      },
      awayPoints: 0,
      homePoints: 0,
    };
  }

  return {
    category: {
      label,
      winner,
      note: `${formatMatchupValue(away)} vs ${formatMatchupValue(home)}`,
    },
    awayPoints: winner === "away" ? weighted : 0,
    homePoints: winner === "home" ? weighted : 0,
  };
}

export function computePitcherEdge(args: {
  away: PitcherMatchupCard | null;
  home: PitcherMatchupCard | null;
  awayTeamLabel: string;
  homeTeamLabel: string;
}): {
  overall?: string;
  beginnerSummary?: string;
  categories?: StarterComparisonCategory[];
} | null {
  const away = args.away;
  const home = args.home;
  if (!away || !home) {
    return null;
  }

  const categories: StarterComparisonCategory[] = [];
  let awayPoints = 0;
  let homePoints = 0;
  let consideredWeight = 0;

  const comparisons = [
    compareMetric({
      label: "ERA",
      away: toNumeric(away.era),
      home: toNumeric(home.era),
      lowerIsBetter: true,
      weight: EDGE_WEIGHTS.era,
    }),
    compareMetric({
      label: "WHIP",
      away: toNumeric(away.whip),
      home: toNumeric(home.whip),
      lowerIsBetter: true,
      weight: EDGE_WEIGHTS.whip,
    }),
    compareMetric({
      label: "K/9",
      away: toNumeric(away.kPer9),
      home: toNumeric(home.kPer9),
      lowerIsBetter: false,
      weight: EDGE_WEIGHTS.kPer9,
    }),
    compareMetric({
      label: "BB/9",
      away: toNumeric(away.bbPer9),
      home: toNumeric(home.bbPer9),
      lowerIsBetter: true,
      weight: EDGE_WEIGHTS.bbPer9,
    }),
    compareMetric({
      label: "HR/9",
      away: toNumeric(away.hrPer9),
      home: toNumeric(home.hrPer9),
      lowerIsBetter: true,
      weight: EDGE_WEIGHTS.hrPer9,
    }),
    compareMetric({
      label: "Recent Form (3-start ERA)",
      away: recentFormValue(away),
      home: recentFormValue(home),
      lowerIsBetter: true,
      weight: EDGE_WEIGHTS.recentForm,
    }),
  ];

  for (const item of comparisons) {
    if (!item) {
      continue;
    }
    categories.push(item.category);
    awayPoints += item.awayPoints;
    homePoints += item.homePoints;
    if (item.category.winner !== "even") {
      const weight = ((): number => {
        if (item.category.label === "ERA") return EDGE_WEIGHTS.era;
        if (item.category.label === "WHIP") return EDGE_WEIGHTS.whip;
        if (item.category.label === "K/9") return EDGE_WEIGHTS.kPer9;
        if (item.category.label === "BB/9") return EDGE_WEIGHTS.bbPer9;
        if (item.category.label === "HR/9") return EDGE_WEIGHTS.hrPer9;
        return EDGE_WEIGHTS.recentForm;
      })();
      consideredWeight += weight;
    }
  }

  if (categories.length === 0 || consideredWeight < 20) {
    return {
      overall: "Balanced matchup on the mound",
      beginnerSummary: "Balanced matchup on the mound",
      categories,
    };
  }

  const differential = awayPoints - homePoints;
  if (Math.abs(differential) < 0.25) {
    return {
      overall: "Balanced matchup on the mound",
      beginnerSummary: "Balanced matchup on the mound",
      categories,
    };
  }

  const winner = differential > 0 ? "away" : "home";
  const winnerLabel = winner === "away" ? args.awayTeamLabel : args.homeTeamLabel;
  return {
    overall: `Edge: ${winnerLabel} starter`,
    beginnerSummary: `Edge: ${winnerLabel} starter`,
    categories,
  };
}

function mergePitcher(base: PitcherMatchupCard | null, fallback: PitcherMatchupCard | null): PitcherMatchupCard | null {
  if (!base && !fallback) {
    return null;
  }
  if (!base) {
    return fallback;
  }
  if (!fallback) {
    return base;
  }
  return {
    ...fallback,
    ...base,
    playerId: base.playerId ?? fallback.playerId,
    fullName: base.fullName || fallback.fullName,
    headshotUrl: base.headshotUrl ?? fallback.headshotUrl,
    teamKey: base.teamKey ?? fallback.teamKey,
    handedness: base.handedness ?? fallback.handedness,
    record: base.record ?? fallback.record,
    era: base.era ?? fallback.era,
    whip: base.whip ?? fallback.whip,
    inningsPitched: base.inningsPitched ?? fallback.inningsPitched,
    strikeouts: base.strikeouts ?? fallback.strikeouts,
    kPer9: base.kPer9 ?? fallback.kPer9,
    bbPer9: base.bbPer9 ?? fallback.bbPer9,
    hrPer9: base.hrPer9 ?? fallback.hrPer9,
    opponentAvg: base.opponentAvg ?? fallback.opponentAvg,
    last3Starts: base.last3Starts ?? fallback.last3Starts,
    homeAwaySplits: base.homeAwaySplits ?? fallback.homeAwaySplits,
    handednessSplits: base.handednessSplits ?? fallback.handednessSplits,
    gameLogMiniSummary: base.gameLogMiniSummary ?? fallback.gameLogMiniSummary,
    statsBasisLabel: base.statsBasisLabel ?? fallback.statsBasisLabel,
    confidenceNote: base.confidenceNote ?? fallback.confidenceNote,
  };
}

function createFailedResult(args: {
  message: string;
  code: string;
  sourceUsed: string;
  fallbackUsed: boolean;
  dataMode: DataModeArg;
  notes?: string[];
  warnings?: string[];
}): MlbStartingPitcherMatchupResult {
  const warnings = unique(args.warnings ?? []);
  return {
    ok: false,
    data: null,
    meta: {
      sourceUsed: args.sourceUsed,
      updatedAt: new Date().toISOString(),
      fallbackUsed: args.fallbackUsed,
      state: "failed",
      requestId: randomUUID(),
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      notes: args.notes,
      dataMode: args.dataMode,
    },
    error: {
      message: args.message,
      code: args.code,
    },
  };
}

function prunePitcherForMode(pitcher: PitcherMatchupCard | null, mode: MatchupMode): PitcherMatchupCard | null {
  if (!pitcher) {
    return null;
  }
  if (mode === "advanced") {
    return pitcher;
  }
  return {
    playerId: pitcher.playerId,
    fullName: pitcher.fullName,
    headshotUrl: pitcher.headshotUrl,
    teamKey: pitcher.teamKey,
    handedness: pitcher.handedness,
    record: pitcher.record,
    era: pitcher.era,
    statsBasisLabel: pitcher.statsBasisLabel,
    confidenceNote: pitcher.confidenceNote,
  };
}

function buildSelectableGames(mode: MatchupMode, rows: Array<{ gameId: string; label: string }>): Array<{ gameId: string; label: string }> | undefined {
  if (mode !== "advanced") {
    return undefined;
  }
  return rows.length > 0 ? rows : undefined;
}

function buildUiState(args: {
  selectedGame: NormalizedGame;
  awayPitcher: PitcherMatchupCard | null;
  homePitcher: PitcherMatchupCard | null;
  edge: { overall?: string; beginnerSummary?: string; categories?: StarterComparisonCategory[] } | null;
  mode: MatchupMode;
  selectableGames: Array<{ gameId: string; label: string }>;
  notes: string[];
}): MlbStartingPitcherMatchupData {
  const hasBothPitchers = Boolean(args.awayPitcher?.fullName && args.homePitcher?.fullName);
  const state: MatchupState = hasBothPitchers ? "success" : "partial";
  const userNotes = toUserFacingMatchupNotes(args.notes);

  return {
    game: {
      gameId: args.selectedGame.gameId,
      awayTeam: args.selectedGame.awayTeam,
      homeTeam: args.selectedGame.homeTeam,
      gameTime: args.selectedGame.startTime,
      venue: args.selectedGame.venue,
      status: state === "partial" ? "partial" : args.selectedGame.status,
    },
    pitchers: {
      away: prunePitcherForMode(args.awayPitcher, args.mode),
      home: prunePitcherForMode(args.homePitcher, args.mode),
    },
    edge: args.mode === "advanced"
      ? args.edge
      : (args.edge ? { overall: args.edge.beginnerSummary, beginnerSummary: args.edge.beginnerSummary } : null),
    state,
    notes: userNotes.length > 0 ? userNotes : undefined,
    selectableGames: buildSelectableGames(args.mode, args.selectableGames),
  };
}

function defaultDeps(): ResolveDeps {
  return {
    fetchTeamIdentity: async (teamKey, providerMode, cacheBust) => {
      const resolved = resolveMlbTeam(teamKey);
      if (resolved) {
        return {
          team: {
            key: resolved.key,
            name: resolved.name,
            apiSportsTeamId: String(resolved.id),
          },
          meta: {
            sourceUsed: providerMode === "fixture" ? "fixture" : "mlb",
            updatedAt: new Date().toISOString(),
            requestId: randomUUID(),
            dataMode: providerMode,
            dataModeEffective: providerMode,
          },
        };
      }

      const canonical = resolveCanonicalTeam({ league: "MLB", abbreviation: teamKey, name: teamKey });
      if (!canonical.abbreviation) {
        return {
          team: null,
          meta: {
            sourceUsed: providerMode === "fixture" ? "fixture" : "mlb",
            updatedAt: new Date().toISOString(),
            requestId: randomUUID(),
            dataMode: providerMode,
            dataModeEffective: providerMode,
          },
          warning: `No MLB team identity found for ${normalizeTeamKey(teamKey)}.`,
        };
      }
      return {
        team: {
          key: canonical.abbreviation,
          name: canonical.name,
          apiSportsTeamId: canonical.providerIds?.apiSports ? String(canonical.providerIds.apiSports) : undefined,
          logoUrl: canonical.logoUrl,
        },
        meta: {
          sourceUsed: providerMode === "fixture" ? "fixture" : "mlb",
          updatedAt: new Date().toISOString(),
          requestId: randomUUID(),
          dataMode: providerMode,
          dataModeEffective: providerMode,
        },
      };
    },
    fetchApiSportsGames: async (team, providerMode, cacheBust) => {
      const scheduleContext = resolveScheduleQueryContext({
        sport: "mlb",
        timeZone: "America/New_York",
      });
      const schedule = await getMlbUpcomingScheduleWithProbables(team.key, providerMode, cacheBust);
      const rows = (schedule.data?.games ?? []).map((game) => mapScheduledGameToNormalized(game, scheduleContext.window.timeZone));
      const notes = [
        `Schedule window ${scheduleContext.window.startDate}..${scheduleContext.window.endDate} (${scheduleContext.window.timeZone}) from MLB schedule provider.`,
        ...scheduleContext.seasonResolution.notes,
      ];
      return {
        games: rows,
        meta: schedule.meta,
        notes,
        warning: schedule.meta.warning,
      };
    },
    fetchEspnGameFallback: async (selected, providerMode, cacheBust) => {
      const date = new Date(selected.startTime);
      const ymd = Number.isNaN(date.getTime())
        ? undefined
        : `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
      const response = await fetchEspnJson<unknown>({
        endpoint: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
        params: {
          dates: ymd,
        },
        dataMode: providerMode,
        cacheBust,
        fixtureSubdir: "scoreboard",
        fixtureFile: "mlb_starting_pitcher_matchup_scoreboard_sample.json",
        ttlSeconds: 60,
      });
      const rows = parseEspnGameRows(response.data, "America/New_York");
      const match = rows.find((row) => {
        const away = row.awayTeam.key;
        const home = row.homeTeam.key;
        return away === selected.awayTeam.key && home === selected.homeTeam.key;
      }) ?? rows.find((row) => row.gameId === selected.gameId) ?? null;

      return {
        game: match,
        meta: response.meta,
        warning: match ? undefined : "ESPN fallback did not return a matching game for probable starters.",
      };
    },
    fetchPitcherStats: async (pitcher, providerMode, cacheBust, selectedGameTime) => {
      const resolved = await resolveMlbPitcherComparisonStats({
        playerId: pitcher.playerId,
        fallbackName: pitcher.fullName,
        selectedGameTime,
        dataMode: providerMode,
        cacheBust,
      });

      const card = resolved.card
        ? ({ ...resolved.card } as PitcherMatchupCard)
        : {
          ...pitcher,
          statsBasisLabel: "Limited posted data",
        };

      return {
        pitcher: mergePitcher(pitcher, card) ?? card,
        meta: resolved.meta,
        warning: resolved.warning,
      };
    },
    now: () => new Date(),
  };
}

export async function resolveMlbStartingPitcherMatchup(
  args: ResolveMlbStartingPitcherMatchupArgs,
  depsInput?: Partial<ResolveDeps>,
): Promise<MlbStartingPitcherMatchupResult> {
  const deps = { ...defaultDeps(), ...depsInput };
  const warnings: string[] = [];
  const notes: string[] = [];
  const providerMode = toProviderMode(args.dataMode);
  const normalizedTeamKey = normalizeTeamKey(args.teamKey);

  if (!normalizedTeamKey) {
    return createFailedResult({
      message: "teamKey is required",
      code: "MISSING_TEAM_KEY",
      sourceUsed: providerMode === "fixture" ? "fixture" : "apiSports",
      fallbackUsed: false,
      dataMode: args.dataMode,
      warnings: ["teamKey is required"],
    });
  }

  let fallbackUsed = false;
  let sourceUsed = providerMode === "fixture" ? "fixture" : "apiSports";
  const metaStack: Meta[] = [];

  const teamResult = await deps.fetchTeamIdentity(normalizedTeamKey, providerMode, args.cacheBust);
  metaStack.push(teamResult.meta);
  if (teamResult.warning) {
    warnings.push(teamResult.warning);
  }
  if (!teamResult.team) {
    return createFailedResult({
      message: "Failed to load team identity",
      code: "TEAM_IDENTITY_NOT_FOUND",
      sourceUsed,
      fallbackUsed,
      dataMode: args.dataMode,
      notes,
      warnings,
    });
  }

  const gamesResult = await deps.fetchApiSportsGames(teamResult.team, providerMode, args.cacheBust);
  metaStack.push(gamesResult.meta);
  warnings.push(...(gamesResult.warning ? [gamesResult.warning] : []));
  notes.push(...gamesResult.notes);

  const scheduleContext = resolveScheduleQueryContext({
    sport: "mlb",
  });
  const selected = selectMatchupGame({
    games: gamesResult.games,
    gameId: args.gameId,
    now: deps.now(),
    timeZone: scheduleContext.window.timeZone,
  });

  if (!selected.selected) {
    return createFailedResult({
      message: "Failed to load game context",
      code: "GAME_NOT_FOUND",
      sourceUsed,
      fallbackUsed,
      dataMode: args.dataMode,
      notes: [
        ...notes,
        "No upcoming MLB game found for the selected team in the current schedule window.",
      ],
      warnings,
    });
  }

  let game = selected.selected;
  let awayPitcher = selected.selected.probableAway;
  let homePitcher = selected.selected.probableHome;

  if (!awayPitcher || !homePitcher) {
    const espnFallback = await deps.fetchEspnGameFallback(selected.selected, providerMode, args.cacheBust);
    metaStack.push(espnFallback.meta);
    if (espnFallback.warning) {
      warnings.push(espnFallback.warning);
    }
    if (espnFallback.game) {
      fallbackUsed = true;
      sourceUsed = providerMode === "fixture" ? "fixture" : sourceUsed;
      game = {
        ...selected.selected,
        venue: selected.selected.venue ?? espnFallback.game.venue,
        probableAway: mergePitcher(selected.selected.probableAway, espnFallback.game.probableAway),
        probableHome: mergePitcher(selected.selected.probableHome, espnFallback.game.probableHome),
      };
      awayPitcher = game.probableAway;
      homePitcher = game.probableHome;
      notes.push("ESPN fallback was used to enrich probable starter context.");
    }
  }

  const pitcherStatsCache = new Map<string, PitcherMatchupCard>();
  const maybeHydratePitcher = async (pitcher: PitcherMatchupCard | null): Promise<PitcherMatchupCard | null> => {
    if (!pitcher) {
      return null;
    }
    if (args.mode !== "advanced") {
      return pitcher;
    }
    const cacheKey = pitcher.playerId ? `id:${pitcher.playerId}` : `name:${pitcher.fullName.toLowerCase()}`;
    if (pitcherStatsCache.has(cacheKey)) {
      return pitcherStatsCache.get(cacheKey) ?? pitcher;
    }
    const enriched = await deps.fetchPitcherStats(pitcher, providerMode, args.cacheBust, game.startTime);
    metaStack.push(enriched.meta);
    if (enriched.warning) {
      warnings.push(enriched.warning);
    }
    if (Array.isArray(enriched.meta.notes) && enriched.meta.notes.length > 0) {
      notes.push(...enriched.meta.notes);
    }
    pitcherStatsCache.set(cacheKey, enriched.pitcher);
    return enriched.pitcher;
  };

  awayPitcher = await maybeHydratePitcher(awayPitcher);
  homePitcher = await maybeHydratePitcher(homePitcher);

  const hasBothProbables = Boolean(awayPitcher?.fullName && homePitcher?.fullName);
  if (!hasBothProbables) {
    notes.push("Game found, probable starters not posted yet.");
  }

  const edge = computePitcherEdge({
    away: awayPitcher,
    home: homePitcher,
    awayTeamLabel: game.awayTeam.key,
    homeTeamLabel: game.homeTeam.key,
  });

  if (edge?.beginnerSummary === "Balanced matchup on the mound" && hasBothProbables) {
    notes.push("Limited matchup data available.");
  }

  const data = buildUiState({
    selectedGame: game,
    awayPitcher,
    homePitcher,
    edge,
    mode: args.mode,
    selectableGames: selected.selectableGames,
    notes: unique(notes),
  });
  const state = data.state;

  const warningsUnique = unique(warnings);
  const latestMeta = metaStack[metaStack.length - 1];
  const warningText = warningsUnique.length > 0 ? warningsUnique.join(" ") : undefined;

  return {
    ok: state !== "failed",
    data,
    meta: {
      sourceUsed: latestMeta?.sourceUsed ?? sourceUsed,
      updatedAt: latestMeta?.updatedAt ?? new Date().toISOString(),
      fallbackUsed,
      state,
      requestId: latestMeta?.requestId ?? randomUUID(),
      warning: warningText,
      warnings: warningsUnique.length > 0 ? warningsUnique : undefined,
      notes: unique(notes),
      dataMode: args.dataMode,
    },
    error: null,
  };
}
