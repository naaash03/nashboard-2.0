import { randomUUID } from "node:crypto";
import { getNflTeamProfile, getNflTeamSchedule, type EspnNflTeamProfile, type EspnNflTeamSchedule } from "@/lib/providers/espn/nfl";
import { fetchApiSportsJson } from "@/lib/providers/apiSports/client";
import { getApiSportsConfig, resolveApiSportsKey } from "@/lib/providers/apiSports/config";
import { getTeamsAdvanced as getApiSportsTeamsAdvanced } from "@/lib/providers/apiSports/teamAdvanced";
import type { Meta } from "@/lib/providers/types";
import type { TeamAdvanced } from "@/lib/types/playerInsights";
import type {
  NflConference,
  NflDivision,
  NflDivisionGroup,
  NflDivisionSnapshotData,
  NflFormGame,
  NflGameRef,
  NflGameResult,
  NflGameStatus,
  NflRecentFormData,
  NflTeamContextCardData,
  NflTeamRef,
  NflTeamStandingRow,
  NflWidgetSource,
} from "@/lib/types/nfl";

type DataMode = "auto" | "live" | "fixture";
type ApiSportsMode = "live" | "fixture";

type TeamDirectoryRow = {
  teamKey: string;
  name: string;
  conference: NflConference;
  division: NflDivision;
};

type EspnNflCompetitor = NonNullable<
  NonNullable<
    NonNullable<EspnNflTeamSchedule["events"]>[number]["competitions"]
  >[number]["competitors"]
>[number];

const NFL_TEAMS: TeamDirectoryRow[] = [
  { teamKey: "BUF", name: "Buffalo Bills", conference: "AFC", division: "East" },
  { teamKey: "MIA", name: "Miami Dolphins", conference: "AFC", division: "East" },
  { teamKey: "NYJ", name: "New York Jets", conference: "AFC", division: "East" },
  { teamKey: "NE", name: "New England Patriots", conference: "AFC", division: "East" },
  { teamKey: "BAL", name: "Baltimore Ravens", conference: "AFC", division: "North" },
  { teamKey: "PIT", name: "Pittsburgh Steelers", conference: "AFC", division: "North" },
  { teamKey: "CIN", name: "Cincinnati Bengals", conference: "AFC", division: "North" },
  { teamKey: "CLE", name: "Cleveland Browns", conference: "AFC", division: "North" },
  { teamKey: "HOU", name: "Houston Texans", conference: "AFC", division: "South" },
  { teamKey: "IND", name: "Indianapolis Colts", conference: "AFC", division: "South" },
  { teamKey: "JAX", name: "Jacksonville Jaguars", conference: "AFC", division: "South" },
  { teamKey: "TEN", name: "Tennessee Titans", conference: "AFC", division: "South" },
  { teamKey: "KC", name: "Kansas City Chiefs", conference: "AFC", division: "West" },
  { teamKey: "LAC", name: "Los Angeles Chargers", conference: "AFC", division: "West" },
  { teamKey: "DEN", name: "Denver Broncos", conference: "AFC", division: "West" },
  { teamKey: "LV", name: "Las Vegas Raiders", conference: "AFC", division: "West" },
  { teamKey: "PHI", name: "Philadelphia Eagles", conference: "NFC", division: "East" },
  { teamKey: "WSH", name: "Washington Commanders", conference: "NFC", division: "East" },
  { teamKey: "DAL", name: "Dallas Cowboys", conference: "NFC", division: "East" },
  { teamKey: "NYG", name: "New York Giants", conference: "NFC", division: "East" },
  { teamKey: "DET", name: "Detroit Lions", conference: "NFC", division: "North" },
  { teamKey: "GB", name: "Green Bay Packers", conference: "NFC", division: "North" },
  { teamKey: "MIN", name: "Minnesota Vikings", conference: "NFC", division: "North" },
  { teamKey: "CHI", name: "Chicago Bears", conference: "NFC", division: "North" },
  { teamKey: "TB", name: "Tampa Bay Buccaneers", conference: "NFC", division: "South" },
  { teamKey: "ATL", name: "Atlanta Falcons", conference: "NFC", division: "South" },
  { teamKey: "NO", name: "New Orleans Saints", conference: "NFC", division: "South" },
  { teamKey: "CAR", name: "Carolina Panthers", conference: "NFC", division: "South" },
  { teamKey: "LAR", name: "Los Angeles Rams", conference: "NFC", division: "West" },
  { teamKey: "SEA", name: "Seattle Seahawks", conference: "NFC", division: "West" },
  { teamKey: "ARI", name: "Arizona Cardinals", conference: "NFC", division: "West" },
  { teamKey: "SF", name: "San Francisco 49ers", conference: "NFC", division: "West" },
];

const TEAM_BY_KEY = new Map(NFL_TEAMS.map((row) => [row.teamKey, row]));
const OFFSEASON_FINAL_STANDINGS_SEASON = 2024;
const FINAL_2024_PLAYOFF_SEEDS: Record<string, number> = {
  KC: 1,
  BUF: 2,
  BAL: 3,
  HOU: 4,
  LAC: 5,
  PIT: 6,
  DEN: 7,
  DET: 1,
  PHI: 2,
  TB: 3,
  LAR: 4,
  MIN: 5,
  WSH: 6,
  GB: 7,
};
const FINAL_2024_DIVISION_LEADERS = new Set(["BUF", "BAL", "HOU", "KC", "PHI", "DET", "TB", "LAR"]);

function nowIso(): string {
  return new Date().toISOString();
}

function dedupe(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function toWidgetSource(meta: Meta): NflWidgetSource {
  if (meta.sourceUsed === "cache") return "cached";
  if (meta.sourceUsed === "demo" || meta.sourceUsed === "fixture") return "demo";
  return "live";
}

function buildDemoMeta(dataMode: DataMode, warning?: string, notes: string[] = []): Meta {
  return {
    sourceUsed: "demo",
    updatedAt: nowIso(),
    requestId: randomUUID(),
    warning,
    warnings: warning ? [warning] : undefined,
    notes: notes.length > 0 ? notes : undefined,
    dataMode,
    dataModeEffective: "fixture",
  };
}

function mergeMeta(sourceUsed: Meta["sourceUsed"], dataMode: DataMode, metas: Meta[], warning?: string, notes: string[] = []): Meta {
  const latest = [...metas].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
  const warnings = dedupe([...metas.map((meta) => meta.warning), warning]);
  const mergedNotes = dedupe([...metas.flatMap((meta) => meta.notes ?? []), ...notes]);

  return {
    sourceUsed,
    updatedAt: latest?.updatedAt ?? nowIso(),
    requestId: latest?.requestId ?? randomUUID(),
    endpointUrl: latest?.endpointUrl,
    upstreamStatus: latest?.upstreamStatus,
    upstreamMessage: latest?.upstreamMessage,
    cacheHit: metas.some((meta) => Boolean(meta.cacheHit)),
    cacheAgeSeconds: metas.reduce<number | undefined>((youngest, meta) => {
      if (typeof meta.cacheAgeSeconds !== "number") return youngest;
      if (typeof youngest !== "number") return meta.cacheAgeSeconds;
      return Math.min(youngest, meta.cacheAgeSeconds);
    }, undefined),
    warning: warnings[0],
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: mergedNotes.length > 0 ? mergedNotes : undefined,
    dataMode,
    dataModeEffective: sourceUsed === "demo" ? "fixture" : "live",
  };
}

function appendMeta(meta: Meta, warning?: string, notes: string[] = [], attemptedSources?: Meta["attemptedSources"]): Meta {
  const warnings = dedupe([...(meta.warnings ?? []), meta.warning, warning]);
  const mergedNotes = dedupe([...(meta.notes ?? []), ...notes]);
  return {
    ...meta,
    warning: warnings[0],
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: mergedNotes.length > 0 ? mergedNotes : undefined,
    attemptedSources: attemptedSources ?? meta.attemptedSources,
  };
}

function toApiSportsMode(dataMode: DataMode): ApiSportsMode {
  return dataMode === "fixture" ? "fixture" : "live";
}

function apiSportsAvailability(dataMode: DataMode): { enabled: boolean; warning?: string } {
  if (dataMode === "fixture") {
    return { enabled: false };
  }

  const config = getApiSportsConfig("nfl");
  const apiKey = resolveApiSportsKey()?.trim() ?? "";
  const invalidApiKey = apiKey.length < 20
    || /^(YOUR|REPLACE|INSERT|PLACEHOLDER|TEST|SAMPLE|DEMO|FAKE)/i.test(apiKey);

  if (!apiKey || invalidApiKey || !config.baseUrl || !config.league || !config.season) {
    return {
      enabled: false,
      warning: dataMode === "live"
        ? "API-Sports NFL is not fully configured, so NFL widgets can only use ESPN before falling back to demo."
        : undefined,
    };
  }

  return { enabled: true };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseRecordSummary(summary: string | undefined): { wins: number; losses: number; ties: number } | null {
  if (!summary) return null;
  const parts = summary.split("-").map((value) => Number(value.trim()));
  if (parts.length < 2 || parts.some((value) => !Number.isFinite(value))) return null;
  return { wins: parts[0] ?? 0, losses: parts[1] ?? 0, ties: parts[2] ?? 0 };
}

function parseDivisionRank(standingSummary: string | undefined): number | null {
  const match = standingSummary?.match(/^(\d+)(st|nd|rd|th)\s+in\s+/i);
  return match ? Number(match[1]) : null;
}

function recordItem(profile: EspnNflTeamProfile): NonNullable<NonNullable<NonNullable<EspnNflTeamProfile["team"]>["record"]>["items"]>[number] | null {
  return profile.team?.record?.items?.find((item) => item.type === "total") ?? profile.team?.record?.items?.[0] ?? null;
}

function readStat(stats: Array<{ name?: string; value?: number; displayValue?: string }> | undefined, name: string): number | null {
  return readNumber((stats ?? []).find((row) => row.name === name)?.value);
}

function streakFromNumeric(value: number | null): string {
  if (value === null || value === 0) return "EVEN";
  return value > 0 ? `W${value}` : `L${Math.abs(value)}`;
}

function isOffseasonProfile(profile: EspnNflTeamProfile): boolean {
  return profile.season?.type === 4;
}

function profileHasNoUpcomingEvent(profile: EspnNflTeamProfile): boolean {
  return (profile.team?.nextEvent?.length ?? 0) === 0;
}

function profileLooksLikeCompletedSeasonStandings(profile: EspnNflTeamProfile): boolean {
  return profileHasNoUpcomingEvent(profile)
    && profileRecord(profile) !== null
    && Boolean(profile.team?.standingSummary);
}

function aggregatedMeta(meta: Meta, notes: string[] = []): Meta {
  return appendMeta(
    {
      ...meta,
      endpointUrl: undefined,
    },
    undefined,
    notes,
    meta.attemptedSources,
  );
}

const DEMO_DIVISION_ROWS: Record<string, Array<Omit<NflTeamStandingRow, "teamId" | "name" | "abbreviation"> & { teamKey: string }>> = {
  "AFC-East": [
    { teamKey: "BUF", wins: 13, losses: 4, ties: 0, pct: 0.765, pointsFor: 525, pointsAgainst: 368, streak: "L1", clinched: true, divisionLeader: true, playoffSeed: 2 },
    { teamKey: "MIA", wins: 8, losses: 9, ties: 0, pct: 0.471, pointsFor: 345, pointsAgainst: 364, streak: "L1", clinched: false, divisionLeader: false, playoffSeed: null },
    { teamKey: "NYJ", wins: 5, losses: 12, ties: 0, pct: 0.294, pointsFor: 338, pointsAgainst: 404, streak: "W1", clinched: false, divisionLeader: false, playoffSeed: null },
    { teamKey: "NE", wins: 4, losses: 13, ties: 0, pct: 0.235, pointsFor: 289, pointsAgainst: 417, streak: "W1", clinched: false, divisionLeader: false, playoffSeed: null },
  ],
  "AFC-North": [
    { teamKey: "BAL", wins: 12, losses: 5, ties: 0, pct: 0.706, pointsFor: 518, pointsAgainst: 361, streak: "W4", clinched: true, divisionLeader: true, playoffSeed: 3 },
    { teamKey: "PIT", wins: 10, losses: 7, ties: 0, pct: 0.588, pointsFor: 380, pointsAgainst: 347, streak: "L4", clinched: true, divisionLeader: false, playoffSeed: 6 },
    { teamKey: "CIN", wins: 9, losses: 8, ties: 0, pct: 0.529, pointsFor: 472, pointsAgainst: 434, streak: "W5", clinched: false, divisionLeader: false, playoffSeed: null },
    { teamKey: "CLE", wins: 3, losses: 14, ties: 0, pct: 0.176, pointsFor: 258, pointsAgainst: 435, streak: "L6", clinched: false, divisionLeader: false, playoffSeed: null },
  ],
  "AFC-South": [
    { teamKey: "HOU", wins: 10, losses: 7, ties: 0, pct: 0.588, pointsFor: 372, pointsAgainst: 372, streak: "W1", clinched: true, divisionLeader: true, playoffSeed: 4 },
    { teamKey: "IND", wins: 8, losses: 9, ties: 0, pct: 0.471, pointsFor: 377, pointsAgainst: 427, streak: "W1", clinched: false, divisionLeader: false, playoffSeed: null },
    { teamKey: "JAX", wins: 4, losses: 13, ties: 0, pct: 0.235, pointsFor: 320, pointsAgainst: 435, streak: "L1", clinched: false, divisionLeader: false, playoffSeed: null },
    { teamKey: "TEN", wins: 3, losses: 14, ties: 0, pct: 0.176, pointsFor: 311, pointsAgainst: 460, streak: "L6", clinched: false, divisionLeader: false, playoffSeed: null },
  ],
  "AFC-West": [
    { teamKey: "KC", wins: 15, losses: 2, ties: 0, pct: 0.882, pointsFor: 385, pointsAgainst: 326, streak: "L1", clinched: true, divisionLeader: true, playoffSeed: 1 },
    { teamKey: "DEN", wins: 10, losses: 7, ties: 0, pct: 0.588, pointsFor: 425, pointsAgainst: 311, streak: "W1", clinched: true, divisionLeader: false, playoffSeed: 7 },
    { teamKey: "LAC", wins: 11, losses: 6, ties: 0, pct: 0.647, pointsFor: 402, pointsAgainst: 301, streak: "W3", clinched: true, divisionLeader: false, playoffSeed: 5 },
    { teamKey: "LV", wins: 4, losses: 13, ties: 0, pct: 0.235, pointsFor: 309, pointsAgainst: 434, streak: "L1", clinched: false, divisionLeader: false, playoffSeed: null },
  ],
  "NFC-East": [
    { teamKey: "PHI", wins: 14, losses: 3, ties: 0, pct: 0.824, pointsFor: 463, pointsAgainst: 303, streak: "W2", clinched: true, divisionLeader: true, playoffSeed: 2 },
    { teamKey: "WSH", wins: 12, losses: 5, ties: 0, pct: 0.706, pointsFor: 485, pointsAgainst: 391, streak: "W5", clinched: true, divisionLeader: false, playoffSeed: 6 },
    { teamKey: "DAL", wins: 7, losses: 10, ties: 0, pct: 0.412, pointsFor: 350, pointsAgainst: 468, streak: "L2", clinched: false, divisionLeader: false, playoffSeed: null },
    { teamKey: "NYG", wins: 3, losses: 14, ties: 0, pct: 0.176, pointsFor: 273, pointsAgainst: 415, streak: "L1", clinched: false, divisionLeader: false, playoffSeed: null },
  ],
  "NFC-North": [
    { teamKey: "DET", wins: 15, losses: 2, ties: 0, pct: 0.882, pointsFor: 564, pointsAgainst: 342, streak: "W3", clinched: true, divisionLeader: true, playoffSeed: 1 },
    { teamKey: "MIN", wins: 14, losses: 3, ties: 0, pct: 0.824, pointsFor: 432, pointsAgainst: 332, streak: "L1", clinched: true, divisionLeader: false, playoffSeed: 5 },
    { teamKey: "GB", wins: 11, losses: 6, ties: 0, pct: 0.647, pointsFor: 460, pointsAgainst: 338, streak: "L2", clinched: true, divisionLeader: false, playoffSeed: 7 },
    { teamKey: "CHI", wins: 5, losses: 12, ties: 0, pct: 0.294, pointsFor: 310, pointsAgainst: 370, streak: "W1", clinched: false, divisionLeader: false, playoffSeed: null },
  ],
  "NFC-South": [
    { teamKey: "TB", wins: 10, losses: 7, ties: 0, pct: 0.588, pointsFor: 502, pointsAgainst: 385, streak: "W2", clinched: true, divisionLeader: true, playoffSeed: 3 },
    { teamKey: "ATL", wins: 8, losses: 9, ties: 0, pct: 0.471, pointsFor: 389, pointsAgainst: 423, streak: "L2", clinched: false, divisionLeader: false, playoffSeed: null },
    { teamKey: "NO", wins: 5, losses: 12, ties: 0, pct: 0.294, pointsFor: 338, pointsAgainst: 398, streak: "L4", clinched: false, divisionLeader: false, playoffSeed: null },
    { teamKey: "CAR", wins: 5, losses: 12, ties: 0, pct: 0.294, pointsFor: 341, pointsAgainst: 534, streak: "W1", clinched: false, divisionLeader: false, playoffSeed: null },
  ],
  "NFC-West": [
    { teamKey: "SEA", wins: 10, losses: 7, ties: 0, pct: 0.588, pointsFor: 375, pointsAgainst: 368, streak: "W2", clinched: false, divisionLeader: false, playoffSeed: null },
    { teamKey: "LAR", wins: 10, losses: 7, ties: 0, pct: 0.588, pointsFor: 367, pointsAgainst: 386, streak: "L1", clinched: true, divisionLeader: true, playoffSeed: 4 },
    { teamKey: "ARI", wins: 8, losses: 9, ties: 0, pct: 0.471, pointsFor: 400, pointsAgainst: 379, streak: "W1", clinched: false, divisionLeader: false, playoffSeed: null },
    { teamKey: "SF", wins: 6, losses: 11, ties: 0, pct: 0.353, pointsFor: 389, pointsAgainst: 436, streak: "L4", clinched: false, divisionLeader: false, playoffSeed: null },
  ],
};

function statusFromState(state: string | undefined, detail: string | undefined): NflGameStatus {
  const normalizedState = (state ?? "").toLowerCase();
  const normalizedDetail = (detail ?? "").toLowerCase();
  if (normalizedDetail.includes("postpon")) return "postponed";
  if (normalizedState === "in" || normalizedState.includes("in")) return "in_progress";
  if (normalizedState === "post" || normalizedState.includes("post")) return "final";
  return "scheduled";
}

function teamRefFromCompetitor(competitor: EspnNflCompetitor | undefined): NflTeamRef {
  return {
    teamId: competitor?.team?.id ?? competitor?.id ?? "",
    teamKey: competitor?.team?.abbreviation ?? "",
    name: competitor?.team?.displayName ?? competitor?.team?.shortDisplayName ?? competitor?.team?.abbreviation ?? "Team",
    abbreviation: competitor?.team?.abbreviation ?? "",
    logo: competitor?.team?.logos?.[0]?.href ?? null,
  };
}

function parseGameRef(event: NonNullable<EspnNflTeamSchedule["events"]>[number]): NflGameRef | null {
  const competition = event.competitions?.[0];
  const home = competition?.competitors?.find((row) => row.homeAway === "home");
  const away = competition?.competitors?.find((row) => row.homeAway === "away");
  const week = readNumber(event.week?.number) ?? 0;

  if (!competition || !home || !away || !event.id) return null;

  return {
    gameId: event.id,
    status: statusFromState(competition.status?.type?.state, competition.status?.type?.detail),
    date: competition.date ?? event.date ?? nowIso(),
    homeTeam: teamRefFromCompetitor(home),
    awayTeam: teamRefFromCompetitor(away),
    homeScore: readNumber(home.score?.value),
    awayScore: readNumber(away.score?.value),
    venue: competition.venue?.fullName ?? null,
    week,
    isPlayoff: event.seasonType?.type === 3,
  };
}

function chooseNextGame(games: NflGameRef[]): NflGameRef | null {
  const nowMs = Date.now();
  return games
    .filter((game) => {
      const gameMs = new Date(game.date).getTime();
      return game.status !== "final" && Number.isFinite(gameMs) && gameMs >= nowMs - 4 * 60 * 60 * 1000;
    })
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())[0] ?? null;
}

function chooseMostRecentGame(games: NflGameRef[]): NflGameRef | null {
  return games
    .filter((game) => game.status === "final")
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0] ?? null;
}

function scheduleWindowDays(lastGame: NflGameRef | null, nextGame: NflGameRef | null): number | null {
  if (!lastGame || !nextGame) return null;
  const delta = new Date(nextGame.date).getTime() - new Date(lastGame.date).getTime();
  if (!Number.isFinite(delta)) return null;
  return Math.round(delta / 86_400_000);
}

function profileRecord(profile: EspnNflTeamProfile): { wins: number; losses: number; ties: number } | null {
  return parseRecordSummary(profile.team?.recordSummary ?? recordItem(profile)?.summary);
}

function buildStandingRow(profile: EspnNflTeamProfile, directory: TeamDirectoryRow): NflTeamStandingRow | null {
  const record = profileRecord(profile);
  const stats = recordItem(profile)?.stats ?? [];
  if (!record) return null;

  const winPct = readStat(stats, "winPercent");
  const playoffSeed = readStat(stats, "playoffSeed");
  const clincher = readStat(stats, "clincher");
  const divisionRank = parseDivisionRank(profile.team?.standingSummary);

  return {
    teamId: profile.team?.id ?? directory.teamKey,
    teamKey: directory.teamKey,
    name: profile.team?.displayName ?? directory.name,
    abbreviation: profile.team?.abbreviation ?? directory.teamKey,
    wins: record.wins,
    losses: record.losses,
    ties: record.ties,
    pct: winPct ?? (record.wins + record.losses + record.ties > 0 ? record.wins / (record.wins + record.losses + record.ties) : 0),
    pointsFor: readStat(stats, "pointsFor") ?? 0,
    pointsAgainst: readStat(stats, "pointsAgainst") ?? 0,
    streak: streakFromNumeric(readStat(stats, "streak")),
    clinched: Boolean(clincher && clincher > 0),
    divisionLeader: divisionRank === 1,
    playoffSeed: typeof playoffSeed === "number" && playoffSeed > 0 ? playoffSeed : null,
  };
}

function apiSportsRows(payload: unknown): Record<string, unknown>[] {
  const typed = asObject(payload);
  const rows = Array.isArray(typed?.response) ? typed.response : [];
  return rows
    .map((row) => asObject(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

function apiSportsTeamId(team: Record<string, unknown> | null): string | null {
  return readString(team?.id) ?? readNumber(team?.id)?.toString() ?? readString(team?.team_id) ?? readNumber(team?.team_id)?.toString() ?? null;
}

function apiSportsTeamCode(team: Record<string, unknown> | null): string | null {
  return readString(team?.code)?.toUpperCase()
    ?? readString(team?.abbreviation)?.toUpperCase()
    ?? readString(team?.short_name)?.toUpperCase()
    ?? null;
}

function apiSportsTeamName(team: Record<string, unknown> | null): string | null {
  const direct = readString(team?.name) ?? readString(team?.display_name);
  if (direct) return direct;
  const city = readString(team?.city);
  const nickname = readString(team?.nickname) ?? readString(team?.mascot);
  return [city, nickname].filter(Boolean).join(" ").trim() || null;
}

function apiSportsStatus(rawState: string | null, rawDetail: string | null): NflGameStatus {
  const normalizedState = (rawState ?? "").toLowerCase();
  const normalizedDetail = (rawDetail ?? "").toLowerCase();
  if (normalizedDetail.includes("postpon")) return "postponed";
  if (normalizedState.includes("post") || normalizedState.includes("final") || normalizedState.includes("finish") || normalizedState === "ft") return "final";
  if (normalizedState.includes("in") || normalizedState.includes("progress") || normalizedState.includes("live")) return "in_progress";
  return "scheduled";
}

function apiSportsScore(value: unknown): number | null {
  const direct = readNumber(value);
  if (typeof direct === "number") return direct;
  const typed = asObject(value);
  return readNumber(typed?.total ?? typed?.points ?? typed?.value);
}

function inferWeekFromGameDate(dateValue: string): number {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 0;
  const kickoff = Date.UTC(date.getUTCFullYear(), 8, 1);
  const diff = Math.max(0, Math.floor((date.getTime() - kickoff) / 86_400_000));
  return Math.max(1, Math.floor(diff / 7) + 1);
}

function parseApiSportsGameRef(row: Record<string, unknown>, teamKey: string): NflGameRef | null {
  const teams = asObject(row.teams);
  const homeTeam = asObject(teams?.home);
  const awayTeam = asObject(teams?.away) ?? asObject(teams?.visitors);
  const homeKey = apiSportsTeamCode(homeTeam);
  const awayKey = apiSportsTeamCode(awayTeam);
  if (!homeKey || !awayKey) return null;

  const dateNode = asObject(row.date);
  const dateValue = readString(dateNode?.date)
    ?? readString(dateNode?.start)
    ?? readString(dateNode?.iso)
    ?? readString(row.date);
  if (!dateValue) return null;

  const statusNode = asObject(row.status);
  const longStatus = readString(statusNode?.long) ?? readString(statusNode?.status);
  const shortStatus = readString(statusNode?.short);
  const weekNode = asObject(row.week) ?? asObject(asObject(row.game)?.week);
  const seasonNode = asObject(row.season);
  const leagueNode = asObject(row.league);
  const venueNode = asObject(row.venue);
  const scoresNode = asObject(row.scores);
  const homeScore = apiSportsScore(scoresNode?.home);
  const awayScore = apiSportsScore(scoresNode?.away) ?? apiSportsScore(scoresNode?.visitors);

  const homeRef = {
    teamId: apiSportsTeamId(homeTeam) ?? homeKey,
    teamKey: homeKey,
    name: apiSportsTeamName(homeTeam) ?? TEAM_BY_KEY.get(homeKey)?.name ?? homeKey,
    abbreviation: homeKey,
    logo: readString(homeTeam?.logo),
  };
  const awayRef = {
    teamId: apiSportsTeamId(awayTeam) ?? awayKey,
    teamKey: awayKey,
    name: apiSportsTeamName(awayTeam) ?? TEAM_BY_KEY.get(awayKey)?.name ?? awayKey,
    abbreviation: awayKey,
    logo: readString(awayTeam?.logo),
  };

  if (homeRef.teamKey !== teamKey && awayRef.teamKey !== teamKey) {
    return null;
  }

  return {
    gameId: readString(row.id) ?? readNumber(row.id)?.toString() ?? `${teamKey}-${dateValue}`,
    status: apiSportsStatus(shortStatus, longStatus),
    date: new Date(dateValue).toISOString(),
    homeTeam: homeRef,
    awayTeam: awayRef,
    homeScore,
    awayScore,
    venue: readString(venueNode?.name) ?? readString(venueNode?.city) ?? null,
    week: readNumber(weekNode?.number) ?? readNumber(weekNode?.week) ?? readNumber(leagueNode?.week) ?? inferWeekFromGameDate(dateValue),
    isPlayoff: (readString(seasonNode?.type) ?? readString(leagueNode?.round) ?? "").toLowerCase().includes("playoff"),
  };
}

function parseApiSportsPct(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value > 1 ? value / 100 : value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed > 1 ? parsed / 100 : parsed;
}

function pickApiSportsTeam(teams: TeamAdvanced[] | undefined, teamKey: string): TeamAdvanced | null {
  return teams?.find((team) => team.teamKey.trim().toUpperCase() === teamKey.trim().toUpperCase()) ?? null;
}

function apiSportsRecordString(record?: TeamAdvanced["record"] | null): string | null {
  if (!record) return null;
  return `${record.wins}-${record.losses}`;
}

function pctFromAdvancedRecord(record?: TeamAdvanced["record"] | null): number | null {
  if (!record) return null;
  if (record.pct) {
    return parseApiSportsPct(record.pct);
  }
  const total = record.wins + record.losses;
  return total > 0 ? record.wins / total : null;
}

async function loadApiSportsTeamAdvanced(
  teamRefs: Array<{ teamKey: string; teamName?: string }>,
  dataMode: DataMode,
  cacheBust?: string,
): Promise<{ teams: TeamAdvanced[]; meta: Meta }> {
  const envelope = await getApiSportsTeamsAdvanced("nfl", teamRefs, "advanced", toApiSportsMode(dataMode), cacheBust);
  const teams = envelope.data?.teams ?? [];
  if (teams.length === 0) {
    throw new Error("API-Sports NFL returned no team context.");
  }
  return { teams, meta: envelope.meta };
}

async function loadApiSportsGamesForTeam(
  teamKey: string,
  apiSportsTeamId: string,
  dataMode: DataMode,
  cacheBust?: string,
  season?: number,
): Promise<{ games: NflGameRef[]; meta: Meta }> {
  const config = getApiSportsConfig("nfl");
  const resolvedSeason = season ?? readNumber(config.season) ?? currentSeasonYear();
  const response = await fetchApiSportsJson<unknown>({
    sport: "nfl",
    endpoint: "games",
    params: {
      league: config.league,
      season: resolvedSeason,
      team: apiSportsTeamId,
    },
    dataMode: toApiSportsMode(dataMode),
    ttlSeconds: 180,
    cacheBust,
  });

  const games = apiSportsRows(response.data)
    .map((row) => parseApiSportsGameRef(row, teamKey))
    .filter((game): game is NflGameRef => game !== null)
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

  if (games.length === 0) {
    throw new Error(`API-Sports NFL returned no season games for ${teamKey}.`);
  }

  return { games, meta: response.meta };
}

function demoDivisionSnapshot(
  conference?: NflConference,
  division?: NflDivision,
  warning?: string,
  dataMode: DataMode = "fixture",
): { data: NflDivisionSnapshotData; meta: Meta } {
  const divisions: NflDivisionGroup[] = ["AFC", "NFC"].flatMap((conf) =>
    ["East", "North", "South", "West"].map((div) => {
      const teams = (DEMO_DIVISION_ROWS[`${conf}-${div}`] ?? []).map((row) => {
        const directory = TEAM_BY_KEY.get(row.teamKey);
        return {
          teamId: row.teamKey,
          teamKey: row.teamKey,
          name: directory?.name ?? row.teamKey,
          abbreviation: row.teamKey,
          wins: row.wins,
          losses: row.losses,
          ties: row.ties,
          pct: row.pct,
          pointsFor: row.pointsFor,
          pointsAgainst: row.pointsAgainst,
          streak: row.streak,
          clinched: row.clinched,
          divisionLeader: row.divisionLeader,
          playoffSeed: row.playoffSeed,
        };
      });
      return { conference: conf as NflConference, division: div as NflDivision, teams: sortDivisionStandingRows(teams) };
    }),
  ).filter((group) => (!conference || group.conference === conference) && (!division || group.division === division));

  return {
    data: {
      source: "demo",
      season: OFFSEASON_FINAL_STANDINGS_SEASON,
      week: null,
      isOffseason: true,
      divisions,
      updatedAt: nowIso(),
    },
    meta: buildDemoMeta(dataMode, warning, ["Showing demo NFL standings because live ESPN division data was unavailable or not requested."]),
  };
}

function demoTeamContext(teamKey?: string, warning?: string, dataMode: DataMode = "fixture", season = 2025): { data: NflTeamContextCardData; meta: Meta } {
  const activeTeamKey = teamKey && TEAM_BY_KEY.has(teamKey) ? teamKey : "PHI";
  const teamName = TEAM_BY_KEY.get(activeTeamKey)?.name ?? "Philadelphia Eagles";

  return {
    data: {
      source: "demo",
      teamKey: activeTeamKey,
      teamName,
      season,
      isHistoricalSeason: true,
      currentRecord: { wins: 11, losses: 6, ties: 0 },
      currentRank: 3,
      divisionRank: 1,
      nextGame: null,
      mostRecentGame: {
        gameId: "demo-phi-wsh",
        status: "final",
        date: "2026-01-04T21:25:00.000Z",
        homeTeam: { teamId: "PHI", teamKey: "PHI", name: "Philadelphia Eagles", abbreviation: "PHI", logo: null },
        awayTeam: { teamId: "WSH", teamKey: "WSH", name: "Washington Commanders", abbreviation: "WSH", logo: null },
        homeScore: 17,
        awayScore: 24,
        venue: "Lincoln Financial Field",
        week: 18,
        isPlayoff: false,
      },
      isOffseason: true,
      isByeWeek: false,
      updatedAt: nowIso(),
    },
    meta: buildDemoMeta(dataMode, warning, ["Showing demo NFL team context because no live team key was selected or ESPN data was unavailable."]),
  };
}

function demoRecentForm(teamKey?: string, warning?: string, dataMode: DataMode = "fixture"): { data: NflRecentFormData; meta: Meta } {
  const activeTeamKey = teamKey && TEAM_BY_KEY.has(teamKey) ? teamKey : "PHI";
  const teamName = TEAM_BY_KEY.get(activeTeamKey)?.name ?? "Philadelphia Eagles";

  return {
    data: {
      source: "demo",
      teamKey: activeTeamKey,
      teamName,
      season: 2025,
      recentGames: [
        { gameId: "demo-1", week: 14, result: "W", opponentKey: "DAL", opponentName: "Dallas Cowboys", score: "27-20", isHome: true, opponentRecord: "8-9", opponentWinPct: 0.471 },
        { gameId: "demo-2", week: 15, result: "W", opponentKey: "NYG", opponentName: "New York Giants", score: "24-17", isHome: false, opponentRecord: "5-12", opponentWinPct: 0.294 },
        { gameId: "demo-3", week: 16, result: "W", opponentKey: "BUF", opponentName: "Buffalo Bills", score: "30-27", isHome: true, opponentRecord: "12-5", opponentWinPct: 0.706 },
        { gameId: "demo-4", week: 17, result: "L", opponentKey: "SEA", opponentName: "Seattle Seahawks", score: "17-23", isHome: false, opponentRecord: "9-8", opponentWinPct: 0.529 },
        { gameId: "demo-5", week: 18, result: "L", opponentKey: "WSH", opponentName: "Washington Commanders", score: "17-24", isHome: true, opponentRecord: "10-7", opponentWinPct: 0.588 },
      ],
      currentStreak: "L2",
      scheduleLabel: "Mixed",
      scheduleDifficulty: 0.518,
      isOffseason: true,
      updatedAt: nowIso(),
    },
    meta: buildDemoMeta(dataMode, warning, ["Showing demo NFL recent-form context because no live team key was selected or ESPN data was unavailable."]),
  };
}

function filterTeams(conference?: NflConference, division?: NflDivision): TeamDirectoryRow[] {
  return NFL_TEAMS.filter((row) => (!conference || row.conference === conference) && (!division || row.division === division));
}

function summarySeedFromProfile(profile: EspnNflTeamProfile): number | null {
  const seed = readStat(recordItem(profile)?.stats ?? [], "playoffSeed");
  return typeof seed === "number" && seed > 0 ? seed : null;
}

function scoreLabel(game: NflGameRef, teamKey: string): string | null {
  if (game.homeScore === null || game.awayScore === null) return null;
  const teamScore = game.homeTeam.teamKey === teamKey ? game.homeScore : game.awayScore;
  const opponentScore = game.homeTeam.teamKey === teamKey ? game.awayScore : game.homeScore;
  return `${teamScore}-${opponentScore}`;
}

function resultFromGame(game: NflGameRef, teamKey: string): NflGameResult {
  if (game.status !== "final" || game.homeScore === null || game.awayScore === null) return "UPCOMING";
  const teamScore = game.homeTeam.teamKey === teamKey ? game.homeScore : game.awayScore;
  const opponentScore = game.homeTeam.teamKey === teamKey ? game.awayScore : game.homeScore;
  if (teamScore > opponentScore) return "W";
  if (teamScore < opponentScore) return "L";
  return "T";
}

function computeStreak(games: NflGameRef[], teamKey: string): string {
  const finals = games
    .filter((game) => game.status === "final")
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  const first = finals[0];
  if (!first) return "EVEN";
  const firstResult = resultFromGame(first, teamKey);
  let count = 0;
  for (const game of finals) {
    if (resultFromGame(game, teamKey) !== firstResult) break;
    count += 1;
  }
  return `${firstResult}${count}`;
}

function currentSeasonYear(): number {
  return new Date().getUTCFullYear();
}

function lastCompletedSeasonYear(profile: EspnNflTeamProfile): number {
  return profile.season?.year ?? currentSeasonYear() - 1;
}

function regularSeasonGames(games: NflGameRef[]): NflGameRef[] {
  return games.filter((game) => !game.isPlayoff);
}

function recordFromGames(games: NflGameRef[], teamKey: string): { wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number } {
  return games.reduce(
    (acc, game) => {
      if (game.status !== "final" || game.homeScore === null || game.awayScore === null) {
        return acc;
      }

      const teamScore = game.homeTeam.teamKey === teamKey ? game.homeScore : game.awayScore;
      const opponentScore = game.homeTeam.teamKey === teamKey ? game.awayScore : game.homeScore;

      acc.pointsFor += teamScore;
      acc.pointsAgainst += opponentScore;

      if (teamScore > opponentScore) acc.wins += 1;
      else if (teamScore < opponentScore) acc.losses += 1;
      else acc.ties += 1;

      return acc;
    },
    { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 },
  );
}

function winPctFromRecord(record: { wins: number; losses: number; ties: number }): number {
  const total = record.wins + record.losses + record.ties;
  if (total <= 0) return 0;
  return (record.wins + 0.5 * record.ties) / total;
}

function historicalSeed(teamKey: string): number | null {
  return FINAL_2024_PLAYOFF_SEEDS[teamKey] ?? null;
}

function isHistoricalDivisionLeader(teamKey: string): boolean {
  return FINAL_2024_DIVISION_LEADERS.has(teamKey);
}

function sortDivisionStandingRows(rows: NflTeamStandingRow[]): NflTeamStandingRow[] {
  return [...rows].sort((left, right) => {
    // Offseason sort: 2024 final W-L record, PD tiebreak
    if (right.wins !== left.wins) return right.wins - left.wins;

    const pointDiffDelta = divisionPointDiff(right) - divisionPointDiff(left);
    if (pointDiffDelta !== 0) return pointDiffDelta;

    if (right.ties !== left.ties) return right.ties - left.ties;
    return left.name.localeCompare(right.name);
  });
}

async function loadHistoricalOffseasonDivisionRows(
  conference?: NflConference,
  division?: NflDivision,
  dataMode: DataMode = "live",
  cacheBust?: string,
): Promise<{ divisions: NflDivisionGroup[]; meta: Meta }> {
  const teams = filterTeams(conference, division);
  const settled = await Promise.all(teams.map(async (directory) => ({
    directory,
    response: await getNflTeamSchedule(directory.teamKey, dataMode, cacheBust, OFFSEASON_FINAL_STANDINGS_SEASON),
  })));

  const groupsByKey = new Map<string, NflDivisionGroup>();

  for (const row of settled) {
    const games = regularSeasonGames(
      (row.response.data.events ?? [])
        .map((event) => parseGameRef(event))
        .filter((game): game is NflGameRef => game !== null),
    );
    const record = recordFromGames(games, row.directory.teamKey);
    const groupKey = `${row.directory.conference}-${row.directory.division}`;
    const existing = groupsByKey.get(groupKey) ?? {
      conference: row.directory.conference,
      division: row.directory.division,
      teams: [],
    };

    existing.teams.push({
      teamId: row.response.data.team?.id ?? row.directory.teamKey,
      teamKey: row.directory.teamKey,
      name: row.response.data.team?.displayName ?? row.directory.name,
      abbreviation: row.response.data.team?.abbreviation ?? row.directory.teamKey,
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      pct: winPctFromRecord(record),
      pointsFor: record.pointsFor,
      pointsAgainst: record.pointsAgainst,
      streak: computeStreak(games, row.directory.teamKey),
      clinched: historicalSeed(row.directory.teamKey) !== null,
      divisionLeader: isHistoricalDivisionLeader(row.directory.teamKey),
      playoffSeed: historicalSeed(row.directory.teamKey),
    });
    groupsByKey.set(groupKey, existing);
  }

  const divisions = Array.from(groupsByKey.values())
    .sort((left, right) => `${left.conference}-${left.division}`.localeCompare(`${right.conference}-${right.division}`))
    .map((group) => ({
      ...group,
      teams: sortDivisionStandingRows(group.teams),
    }));

  const meta = mergeMeta(
    settled.some((row) => row.response.meta.sourceUsed === "cache") ? "cache" : "espn",
    dataMode,
    settled.map((row) => row.response.meta),
    undefined,
    [
      "Offseason NFL standings are built from ESPN 2024 historical team schedules because ESPN's live standings payload is sparse after the season ends.",
      "Playoff seed and division-leader badges reflect the finished 2024 season, even when wins and point differential create a different sort order in tied divisions.",
    ],
  );

  return { divisions, meta };
}

function pctFromRecord(summary: string | null): number | null {
  const record = parseRecordSummary(summary ?? undefined);
  if (!record) return null;
  const total = record.wins + record.losses + record.ties;
  return total > 0 ? record.wins / total : null;
}

function difficultyLabel(value: number): string {
  if (value >= 0.6) return "Tough stretch";
  if (value <= 0.45) return "Easier run";
  return "Mixed";
}

async function resolveApiSportsDivisionSnapshot(
  conference: NflConference | undefined,
  division: NflDivision | undefined,
  dataMode: DataMode,
  cacheBust?: string,
): Promise<{ data: NflDivisionSnapshotData; meta: Meta }> {
  const teams = filterTeams(conference, division);
  const advanced = await loadApiSportsTeamAdvanced(
    teams.map((team) => ({ teamKey: team.teamKey, teamName: team.name })),
    dataMode,
    cacheBust,
  );

  const season = readNumber(getApiSportsConfig("nfl").season) ?? OFFSEASON_FINAL_STANDINGS_SEASON;
  const enriched = await Promise.all(teams.map(async (directory) => {
    const team = pickApiSportsTeam(advanced.teams, directory.teamKey);
    if (!team?.apiSportsTeamId) {
      throw new Error(`API-Sports team id missing for ${directory.teamKey}.`);
    }

    const gamesResponse = await loadApiSportsGamesForTeam(directory.teamKey, team.apiSportsTeamId, dataMode, cacheBust, season);
    const regularGames = regularSeasonGames(gamesResponse.games);
    const record = recordFromGames(regularGames, directory.teamKey);
    const divisionRank = readNumber(team.standings?.rank);
    const standingsRow = {
      teamId: team.apiSportsTeamId,
      teamKey: directory.teamKey,
      name: team.teamName ?? directory.name,
      abbreviation: directory.teamKey,
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      pct: winPctFromRecord(record),
      pointsFor: record.pointsFor,
      pointsAgainst: record.pointsAgainst,
      streak: computeStreak(regularGames, directory.teamKey),
      clinched: false,
      divisionLeader: divisionRank === 1,
      playoffSeed: null,
    } satisfies NflTeamStandingRow;

    return {
      directory,
      row: standingsRow,
      isOffseason: chooseNextGame(gamesResponse.games) === null && chooseMostRecentGame(regularGames) !== null,
      meta: gamesResponse.meta,
    };
  }));

  const groupsByKey = new Map<string, NflDivisionGroup>();
  for (const item of enriched) {
    const key = `${item.directory.conference}-${item.directory.division}`;
    const existing = groupsByKey.get(key) ?? {
      conference: item.directory.conference,
      division: item.directory.division,
      teams: [],
    };
    existing.teams.push(item.row);
    groupsByKey.set(key, existing);
  }

  const divisions = Array.from(groupsByKey.values())
    .sort((left, right) => `${left.conference}-${left.division}`.localeCompare(`${right.conference}-${right.division}`))
    .map((group) => {
      const sorted = sortDivisionStandingRows(group.teams).map((row, index) => ({
        ...row,
        divisionLeader: row.divisionLeader || index === 0,
      }));
      return { ...group, teams: sorted };
    });

  const metas = [advanced.meta, ...enriched.map((item) => item.meta)];
  const meta = mergeMeta(
    metas.some((item) => item.sourceUsed === "cache") ? "cache" : "apiSports",
    dataMode,
    metas,
    "ESPN NFL standings were unavailable or sparse, so this division snapshot is using API-Sports NFL as the fallback source.",
    [
      "API-Sports NFL supplied the fallback season schedule data used to rebuild division records and point differential.",
      "Division leader badges come from fallback standings context when available, then from sorted record order.",
      "Playoff seed and clinch badges stay conservative on the API-Sports fallback path unless those fields are explicitly available.",
    ],
  );

  return {
    data: {
      source: toWidgetSource(meta),
      season,
      week: null,
      isOffseason: enriched.every((item) => item.isOffseason),
      divisions,
      updatedAt: meta.updatedAt,
    },
    meta,
  };
}

async function resolveApiSportsTeamContextCard(
  teamKey: string,
  dataMode: DataMode,
  cacheBust?: string,
  season?: number,
): Promise<{ data: NflTeamContextCardData; meta: Meta }> {
  const directory = TEAM_BY_KEY.get(teamKey);
  if (!directory) {
    throw new Error(`Unknown NFL team key ${teamKey}.`);
  }

  const advanced = await loadApiSportsTeamAdvanced([{ teamKey, teamName: directory.name }], dataMode, cacheBust);
  const team = pickApiSportsTeam(advanced.teams, teamKey);
  if (!team?.apiSportsTeamId) {
    throw new Error(`API-Sports team context missing id for ${teamKey}.`);
  }

  const resolvedSeason = season ?? readNumber(getApiSportsConfig("nfl").season) ?? currentSeasonYear();
  const gamesResponse = await loadApiSportsGamesForTeam(teamKey, team.apiSportsTeamId, dataMode, cacheBust, resolvedSeason);
  const allGames = gamesResponse.games;
  const seasonGames = season ? regularSeasonGames(allGames) : allGames;
  const nextGame = season ? null : chooseNextGame(allGames);
  const mostRecentGame = chooseMostRecentGame(seasonGames) ?? chooseMostRecentGame(allGames);
  const record = recordFromGames(seasonGames, teamKey);
  const isHistoricalSeason = Boolean(season);
  const isOffseason = isHistoricalSeason || (!nextGame && Boolean(mostRecentGame));
  const windowDays = scheduleWindowDays(mostRecentGame, nextGame);
  const isByeWeek = !isHistoricalSeason && !isOffseason && Boolean(nextGame) && typeof windowDays === "number" && windowDays >= 10;
  const meta = mergeMeta(
    [advanced.meta, gamesResponse.meta].some((item) => item.sourceUsed === "cache") ? "cache" : "apiSports",
    dataMode,
    [advanced.meta, gamesResponse.meta],
    "ESPN NFL team context was unavailable, so this card is using API-Sports NFL fallback context.",
    [
      isHistoricalSeason
        ? `API-Sports NFL rebuilt the ${resolvedSeason} season context from team schedule results because ESPN historical context was unavailable.`
        : "API-Sports NFL supplied the fallback record and next/last game context for this team.",
      "Conference seed remains conservative on the fallback path when only division-rank context is available.",
    ],
  );

  return {
    data: {
      source: toWidgetSource(meta),
      teamKey,
      teamName: team.teamName ?? directory.name,
      season: resolvedSeason,
      isHistoricalSeason,
      currentRecord: { wins: record.wins, losses: record.losses, ties: record.ties },
      currentRank: null,
      divisionRank: readNumber(team.standings?.rank),
      nextGame,
      mostRecentGame,
      isOffseason,
      isByeWeek,
      updatedAt: meta.updatedAt,
    },
    meta,
  };
}

async function resolveApiSportsRecentForm(
  teamKey: string,
  dataMode: DataMode,
  cacheBust?: string,
): Promise<{ data: NflRecentFormData; meta: Meta }> {
  const directory = TEAM_BY_KEY.get(teamKey);
  if (!directory) {
    throw new Error(`Unknown NFL team key ${teamKey}.`);
  }

  const advanced = await loadApiSportsTeamAdvanced([{ teamKey, teamName: directory.name }], dataMode, cacheBust);
  const team = pickApiSportsTeam(advanced.teams, teamKey);
  if (!team?.apiSportsTeamId) {
    throw new Error(`API-Sports team context missing id for ${teamKey}.`);
  }

  const resolvedSeason = readNumber(getApiSportsConfig("nfl").season) ?? currentSeasonYear();
  const gamesResponse = await loadApiSportsGamesForTeam(teamKey, team.apiSportsTeamId, dataMode, cacheBust, resolvedSeason);
  const allGames = gamesResponse.games;
  const recentFinals = allGames.filter((game) => game.status === "final").slice(-5);
  if (recentFinals.length === 0) {
    throw new Error(`API-Sports NFL returned no recent completed games for ${teamKey}.`);
  }

  const opponentKeys = Array.from(new Set(recentFinals.map((game) => (
    game.homeTeam.teamKey === teamKey ? game.awayTeam.teamKey : game.homeTeam.teamKey
  )))).filter((key) => TEAM_BY_KEY.has(key));
  const opponentAdvanced = opponentKeys.length > 0
    ? await loadApiSportsTeamAdvanced(
        opponentKeys.map((key) => ({ teamKey: key, teamName: TEAM_BY_KEY.get(key)?.name })),
        dataMode,
        cacheBust,
      )
    : null;
  const opponentMap = new Map((opponentAdvanced?.teams ?? []).map((item) => [item.teamKey, item]));

  const recentGames: NflFormGame[] = recentFinals.map((game) => {
    const opponent = game.homeTeam.teamKey === teamKey ? game.awayTeam : game.homeTeam;
    const opponentTeam = opponentMap.get(opponent.teamKey);
    return {
      gameId: game.gameId,
      week: game.week,
      result: resultFromGame(game, teamKey),
      opponentKey: opponent.teamKey,
      opponentName: opponent.name,
      score: scoreLabel(game, teamKey),
      isHome: game.homeTeam.teamKey === teamKey,
      opponentRecord: apiSportsRecordString(opponentTeam?.record),
      opponentWinPct: pctFromAdvancedRecord(opponentTeam?.record),
    };
  });

  const difficultyValues = recentGames
    .map((game) => game.opponentWinPct)
    .filter((value): value is number => typeof value === "number");
  const scheduleDifficulty = difficultyValues.length > 0
    ? clamp(difficultyValues.reduce((sum, value) => sum + value, 0) / difficultyValues.length, 0, 1)
    : 0.5;
  const isOffseason = chooseNextGame(allGames) === null && recentFinals.length > 0;
  const metas = [advanced.meta, gamesResponse.meta, ...(opponentAdvanced ? [opponentAdvanced.meta] : [])];
  const meta = mergeMeta(
    metas.some((item) => item.sourceUsed === "cache") ? "cache" : "apiSports",
    dataMode,
    metas,
    "ESPN NFL recent-form data was unavailable, so this card is using API-Sports NFL fallback context.",
    [
      "API-Sports NFL supplied the fallback last-five game sample and opponent record context for this recent-form card.",
      "Difficulty stays conservative when opponent standings context is limited on the fallback path.",
    ],
  );

  return {
    data: {
      source: toWidgetSource(meta),
      teamKey,
      teamName: team.teamName ?? directory.name,
      season: resolvedSeason,
      recentGames,
      currentStreak: computeStreak(allGames, teamKey),
      scheduleLabel: difficultyLabel(scheduleDifficulty),
      scheduleDifficulty,
      isOffseason,
      updatedAt: meta.updatedAt,
    },
    meta,
  };
}

async function loadProfilesForDivisionSnapshot(
  conference?: NflConference,
  division?: NflDivision,
  dataMode: DataMode = "live",
  cacheBust?: string,
): Promise<{ rows: Array<{ directory: TeamDirectoryRow; profile: EspnNflTeamProfile; meta: Meta }>; meta: Meta }> {
  const teams = filterTeams(conference, division);
  const settled = await Promise.all(teams.map(async (directory) => ({
    directory,
    response: await getNflTeamProfile(directory.teamKey, dataMode, cacheBust),
  })));

  const rows = settled.map((row) => ({
    directory: row.directory,
    profile: row.response.data,
    meta: row.response.meta,
  }));
  const meta = mergeMeta(
    rows.some((row) => row.meta.sourceUsed === "cache") ? "cache" : "espn",
    dataMode,
    rows.map((row) => row.meta),
  );
  return { rows, meta };
}

export async function resolveNflDivisionSnapshot(args: {
  conference?: NflConference;
  division?: NflDivision;
  dataMode: DataMode;
  cacheBust?: string;
}): Promise<{ data: NflDivisionSnapshotData; meta: Meta }> {
  if (args.dataMode === "fixture") {
    return demoDivisionSnapshot(args.conference, args.division, undefined, args.dataMode);
  }

  const apiSports = apiSportsAvailability(args.dataMode);

  try {
    const loaded = await loadProfilesForDivisionSnapshot(args.conference, args.division, args.dataMode, args.cacheBust);
    const explicitOffseason = loaded.rows.every((row) => isOffseasonProfile(row.profile));
    const completedSeasonStandings = loaded.rows.every((row) => profileLooksLikeCompletedSeasonStandings(row.profile));
    const priorSeason = Math.max(
      2000,
      (loaded.rows[0]?.profile.season?.year ?? currentSeasonYear()) - 1,
    );

    if (explicitOffseason) {
      if (apiSports.enabled) {
        try {
          const fallback = await resolveApiSportsDivisionSnapshot(args.conference, args.division, args.dataMode, args.cacheBust);
          return { data: fallback.data, meta: aggregatedMeta(fallback.meta) };
        } catch (fallbackError) {
          const historical = await loadHistoricalOffseasonDivisionRows(args.conference, args.division, args.dataMode, args.cacheBust);
          return {
            data: {
              source: toWidgetSource(historical.meta),
              season: OFFSEASON_FINAL_STANDINGS_SEASON,
              week: null,
              isOffseason: true,
              divisions: historical.divisions,
              updatedAt: historical.meta.updatedAt,
            },
            meta: aggregatedMeta(appendMeta(
              historical.meta,
              `ESPN offseason standings were sparse and API-Sports NFL fallback did not complete, so the widget is using the historical ${OFFSEASON_FINAL_STANDINGS_SEASON} fallback. ${String(fallbackError)}`,
              ["API-Sports NFL was attempted before falling back to the historical ESPN-derived offseason snapshot."],
              ["espn", "apiSports", "fixture"],
            )),
          };
        }
      }

      const historical = await loadHistoricalOffseasonDivisionRows(args.conference, args.division, args.dataMode, args.cacheBust);
      return {
        data: {
          source: toWidgetSource(historical.meta),
          season: OFFSEASON_FINAL_STANDINGS_SEASON,
          week: null,
          isOffseason: true,
          divisions: historical.divisions,
          updatedAt: historical.meta.updatedAt,
        },
        meta: aggregatedMeta(appendMeta(
          historical.meta,
          apiSports.warning,
          apiSports.warning ? ["API-Sports NFL was not available, so the resolver stayed on the historical ESPN offseason fallback."] : [],
          apiSports.warning ? ["espn", "fixture"] : historical.meta.attemptedSources,
        )),
      };
    }

    const groupsByKey = new Map<string, NflDivisionGroup>();

    for (const row of loaded.rows) {
      const standingRow = buildStandingRow(row.profile, row.directory);
      if (!standingRow) {
        throw new Error(`Standings row missing for ${row.directory.teamKey}.`);
      }

      const key = `${row.directory.conference}-${row.directory.division}`;
      const existing = groupsByKey.get(key) ?? {
        conference: row.directory.conference,
        division: row.directory.division,
        teams: [],
      };
      existing.teams.push(standingRow);
      groupsByKey.set(key, existing);
    }

    const divisions = Array.from(groupsByKey.values())
      .sort((left, right) => `${left.conference}-${left.division}`.localeCompare(`${right.conference}-${right.division}`))
      .map((group) => ({
        ...group,
        teams: [...group.teams].sort((left, right) => {
          const leftRank = left.divisionLeader ? 1 : 99;
          const rightRank = right.divisionLeader ? 1 : 99;
          if (leftRank !== rightRank) return leftRank - rightRank;
          if (right.pct !== left.pct) return right.pct - left.pct;
          return right.wins - left.wins;
        }),
      }));

    const season = completedSeasonStandings ? priorSeason : (loaded.rows[0]?.profile.season?.year ?? currentSeasonYear());
    const meta = aggregatedMeta(mergeMeta(
      loaded.rows.some((row) => row.meta.sourceUsed === "cache") ? "cache" : "espn",
      args.dataMode,
      loaded.rows.map((row) => row.meta),
      undefined,
      [
        completedSeasonStandings
          ? `These standings represent the completed ${priorSeason} season. ESPN team profiles were available, but no upcoming games were posted, so the snapshot is being labeled as final standings rather than current-season live rows.`
          : "Live NFL division rows were assembled from ESPN team profile data.",
      ],
    ));

    return {
      data: {
        source: toWidgetSource(meta),
        season,
        week: null,
        isOffseason: completedSeasonStandings,
        divisions,
        updatedAt: meta.updatedAt,
      },
      meta,
    };
  } catch (error) {
    if (apiSports.enabled) {
      try {
        return await resolveApiSportsDivisionSnapshot(args.conference, args.division, args.dataMode, args.cacheBust);
      } catch (fallbackError) {
        return demoDivisionSnapshot(
          args.conference,
          args.division,
          `Live NFL division data was unavailable on both ESPN and API-Sports NFL, so the widget fell back to demo standings. ${String(fallbackError)}`,
          args.dataMode,
        );
      }
    }

    return demoDivisionSnapshot(
      args.conference,
      args.division,
      `${apiSports.warning ?? "Live NFL division data was unavailable, so the widget fell back to demo standings."} ${String(error)}`,
      args.dataMode,
    );
  }
}

export async function resolveNflTeamContextCard(args: {
  teamKey?: string;
  season?: number;
  dataMode: DataMode;
  cacheBust?: string;
}): Promise<{ data: NflTeamContextCardData; meta: Meta }> {
  const requestedTeamKey = args.teamKey?.trim().toUpperCase();
  if (!requestedTeamKey) {
    return demoTeamContext(undefined, undefined, args.dataMode, args.season ?? 2025);
  }
  if (!TEAM_BY_KEY.has(requestedTeamKey)) {
    return demoTeamContext(requestedTeamKey, `Unknown NFL team key '${requestedTeamKey}'. Showing a demo team context card instead.`, args.dataMode, args.season ?? 2025);
  }
  if (args.dataMode === "fixture") {
    return demoTeamContext(requestedTeamKey, undefined, args.dataMode, args.season ?? 2025);
  }

  const apiSports = apiSportsAvailability(args.dataMode);

  try {
    const profileResponse = await getNflTeamProfile(requestedTeamKey, args.dataMode, args.cacheBust);
    const resolvedHistoricalSeason = args.season ?? (isOffseasonProfile(profileResponse.data) ? lastCompletedSeasonYear(profileResponse.data) : undefined);
    const scheduleResponse = await getNflTeamSchedule(requestedTeamKey, args.dataMode, args.cacheBust, resolvedHistoricalSeason);

    const allGames = (scheduleResponse.data.events ?? [])
      .map((event) => parseGameRef(event))
      .filter((game): game is NflGameRef => game !== null);
    const historicalGames = resolvedHistoricalSeason ? regularSeasonGames(allGames) : allGames;
    const nextGame = resolvedHistoricalSeason ? null : chooseNextGame(allGames);
    const mostRecentGame = chooseMostRecentGame(historicalGames);
    const windowDays = scheduleWindowDays(mostRecentGame, nextGame);
    const isHistoricalSeason = Boolean(resolvedHistoricalSeason);
    const isOffseason = isHistoricalSeason || isOffseasonProfile(profileResponse.data) || (!nextGame && Boolean(mostRecentGame));
    const isByeWeek = !isHistoricalSeason && !isOffseason && Boolean(nextGame) && typeof windowDays === "number" && windowDays >= 10;
    const historicalRecord = isHistoricalSeason ? recordFromGames(historicalGames, requestedTeamKey) : null;
    const meta = mergeMeta(
      profileResponse.meta.sourceUsed === "cache" || scheduleResponse.meta.sourceUsed === "cache" ? "cache" : "espn",
      args.dataMode,
      [profileResponse.meta, scheduleResponse.meta],
      undefined,
      [
        isHistoricalSeason
          ? `Historical NFL team context is built from ESPN's ${resolvedHistoricalSeason} team schedule because ESPN's offseason team profile does not expose reliable historical standings fields.`
          : isOffseason
            ? "No upcoming game is scheduled right now, so the widget shows the most recent final game and the latest known record."
            : "Upcoming team context is sourced from ESPN's team schedule and team profile endpoints.",
      ],
    );

    return {
      data: {
        source: toWidgetSource(meta),
        teamKey: requestedTeamKey,
        teamName: profileResponse.data.team?.displayName ?? TEAM_BY_KEY.get(requestedTeamKey)?.name ?? requestedTeamKey,
        season: resolvedHistoricalSeason ?? scheduleResponse.data.season?.year ?? profileResponse.data.season?.year ?? currentSeasonYear(),
        isHistoricalSeason,
        currentRecord: historicalRecord
          ? { wins: historicalRecord.wins, losses: historicalRecord.losses, ties: historicalRecord.ties }
          : profileRecord(profileResponse.data),
        currentRank: isHistoricalSeason ? null : summarySeedFromProfile(profileResponse.data),
        divisionRank: isHistoricalSeason ? null : parseDivisionRank(profileResponse.data.team?.standingSummary),
        nextGame,
        mostRecentGame,
        isOffseason,
        isByeWeek,
        updatedAt: meta.updatedAt,
      },
      meta,
    };
  } catch (error) {
    if (apiSports.enabled) {
      try {
        return await resolveApiSportsTeamContextCard(requestedTeamKey, args.dataMode, args.cacheBust, args.season);
      } catch (fallbackError) {
        return demoTeamContext(
          requestedTeamKey,
          `Live NFL team context was unavailable on both ESPN and API-Sports NFL for ${requestedTeamKey}, so the widget fell back to a demo card. ${String(fallbackError)}`,
          args.dataMode,
          args.season ?? 2025,
        );
      }
    }

    return demoTeamContext(
      requestedTeamKey,
      `${apiSports.warning ?? `Live NFL team context was unavailable for ${requestedTeamKey}, so the widget fell back to a demo card.`} ${String(error)}`,
      args.dataMode,
      args.season ?? 2025,
    );
  }
}

export async function resolveNflRecentForm(args: {
  teamKey?: string;
  dataMode: DataMode;
  cacheBust?: string;
}): Promise<{ data: NflRecentFormData; meta: Meta }> {
  const requestedTeamKey = args.teamKey?.trim().toUpperCase();
  if (!requestedTeamKey) {
    return demoRecentForm(undefined, undefined, args.dataMode);
  }
  if (!TEAM_BY_KEY.has(requestedTeamKey)) {
    return demoRecentForm(requestedTeamKey, `Unknown NFL team key '${requestedTeamKey}'. Showing a demo recent-form card instead.`, args.dataMode);
  }
  if (args.dataMode === "fixture") {
    return demoRecentForm(requestedTeamKey, undefined, args.dataMode);
  }

  const apiSports = apiSportsAvailability(args.dataMode);

  try {
    const [profileResponse, scheduleResponse] = await Promise.all([
      getNflTeamProfile(requestedTeamKey, args.dataMode, args.cacheBust),
      getNflTeamSchedule(requestedTeamKey, args.dataMode, args.cacheBust),
    ]);

    const allGames = (scheduleResponse.data.events ?? [])
      .map((event) => parseGameRef(event))
      .filter((game): game is NflGameRef => game !== null)
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
    const recentFinals = allGames.filter((game) => game.status === "final").slice(-5);
    const opponentKeys = Array.from(new Set(recentFinals.map((game) => (
      game.homeTeam.teamKey === requestedTeamKey ? game.awayTeam.teamKey : game.homeTeam.teamKey
    )))).filter((key) => TEAM_BY_KEY.has(key));
    const opponentProfiles = await Promise.all(opponentKeys.map(async (teamKey) => ({
      teamKey,
      response: await getNflTeamProfile(teamKey, args.dataMode, args.cacheBust),
    })));
    const opponentProfileMap = new Map(opponentProfiles.map((row) => [row.teamKey, row.response.data]));

    const recentGames: NflFormGame[] = recentFinals.map((game) => {
      const opponent = game.homeTeam.teamKey === requestedTeamKey ? game.awayTeam : game.homeTeam;
      const opponentProfile = opponentProfileMap.get(opponent.teamKey);
      return {
        gameId: game.gameId,
        week: game.week,
        result: resultFromGame(game, requestedTeamKey),
        opponentKey: opponent.teamKey,
        opponentName: opponent.name,
        score: scoreLabel(game, requestedTeamKey),
        isHome: game.homeTeam.teamKey === requestedTeamKey,
        opponentRecord: opponentProfile?.team?.recordSummary ?? null,
        opponentWinPct: pctFromRecord(opponentProfile?.team?.recordSummary ?? null),
      };
    });

    const difficultyValues = recentGames
      .map((game) => game.opponentWinPct)
      .filter((value): value is number => typeof value === "number");
    const scheduleDifficulty = difficultyValues.length > 0
      ? clamp(difficultyValues.reduce((sum, value) => sum + value, 0) / difficultyValues.length, 0, 1)
      : 0.5;
    const isOffseason = isOffseasonProfile(profileResponse.data) || allGames.every((game) => game.status === "final");
    const metas = [profileResponse.meta, scheduleResponse.meta, ...opponentProfiles.map((row) => row.response.meta)];
    const meta = mergeMeta(
      metas.some((item) => item.sourceUsed === "cache") ? "cache" : "espn",
      args.dataMode,
      metas,
      undefined,
      [
        isOffseason
          ? "No future games are posted right now, so the widget shows the last five completed games from the finished season."
          : "Recent-form context is sourced from the last five completed games on ESPN's team schedule.",
      ],
    );

    return {
      data: {
        source: toWidgetSource(meta),
        teamKey: requestedTeamKey,
        teamName: profileResponse.data.team?.displayName ?? TEAM_BY_KEY.get(requestedTeamKey)?.name ?? requestedTeamKey,
        season: scheduleResponse.data.season?.year ?? profileResponse.data.season?.year ?? new Date().getUTCFullYear(),
        recentGames,
        currentStreak: computeStreak(allGames, requestedTeamKey),
        scheduleLabel: difficultyLabel(scheduleDifficulty),
        scheduleDifficulty,
        isOffseason,
        updatedAt: meta.updatedAt,
      },
      meta,
    };
  } catch (error) {
    if (apiSports.enabled) {
      try {
        return await resolveApiSportsRecentForm(requestedTeamKey, args.dataMode, args.cacheBust);
      } catch (fallbackError) {
        return demoRecentForm(
          requestedTeamKey,
          `Live NFL recent-form data was unavailable on both ESPN and API-Sports NFL for ${requestedTeamKey}, so the widget fell back to a demo card. ${String(fallbackError)}`,
          args.dataMode,
        );
      }
    }

    return demoRecentForm(
      requestedTeamKey,
      `${apiSports.warning ?? `Live NFL recent-form data was unavailable for ${requestedTeamKey}, so the widget fell back to a demo card.`} ${String(error)}`,
      args.dataMode,
    );
  }
}

export function formatDivisionFilterLabel(conference?: NflConference, division?: NflDivision): string {
  if (conference && division) return `${conference} ${division}`;
  if (conference) return conference;
  return "All divisions";
}

export function formatTeamStatusTone(data: NflTeamContextCardData): "offseason" | "bye" | "upcoming" | "recent" {
  if (data.isOffseason) return "offseason";
  if (data.isByeWeek) return "bye";
  if (data.nextGame) return "upcoming";
  return "recent";
}

export function formatRecentFormSentence(streak: string): string {
  const result = streak.charAt(0);
  const count = Number(streak.slice(1));
  if (!Number.isFinite(count) || count <= 0) {
    return "Recent trend is mixed.";
  }
  if (result === "W") return count === 1 ? "Won the last game." : `Won ${count} straight.`;
  if (result === "L") return count === 1 ? "Lost the last game." : `Lost ${count} straight.`;
  if (result === "T") return count === 1 ? "Tied the last game." : `Tied ${count} straight.`;
  return "Recent trend is mixed.";
}

export function divisionPointDiff(row: NflTeamStandingRow): number {
  return row.pointsFor - row.pointsAgainst;
}

export function recentFormRecord(games: NflFormGame[]): string {
  const results = games.map((game) => game.result);
  const wins = results.filter((result) => result === "W").length;
  const losses = results.filter((result) => result === "L").length;
  const ties = results.filter((result) => result === "T").length;
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}
