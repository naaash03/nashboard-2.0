import { randomUUID } from "node:crypto";
import { fetchMlbJson, getMlbDataMode } from "@/lib/providers/mlb/client";
import { MLB_TEAM_OPTIONS, resolveMlbTeam } from "@/lib/providers/mlb/teamMap";
import { getMlbUpcomingScheduleWithProbables } from "@/lib/providers/mlb/provider";
import type { Meta } from "@/lib/providers/types";

type ModeArg = "auto" | "live" | "fixture";

// ── Exported types (shapes matched to widget expectations) ───────────────────

export type MlbRecentFormPeriod = {
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
  last7: MlbRecentFormPeriod;
  last14: MlbRecentFormPeriod;
  last30: MlbRecentFormPeriod;
  explanation: string;
  sampleContext: string;
  primaryGameType: "R" | "S" | "mixed" | "unknown";
  primaryGameTypeLabel: string;
};

export type MlbPlayerSearchResult = {
  playerId: string;
  fullName: string;
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

export type PitcherRecentAppearance = {
  date: string;
  inningsPitched: string;
  numberOfPitches: number;
  strikes?: number;
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
  recentAppearances: PitcherRecentAppearance[];
};

export type MlbStarterRow = {
  playerId: string;
  fullName: string;
  lastStartDate: string | null;
  daysRest: number;
  inningsLastStart: string | null;
  pitchesLastStart: number | null;
  strikesLastStart: number | null;
  seasonKPer9?: string;
  seasonUsed?: number;
};

export type MlbBullpenFatigue = {
  teamKey: string;
  teamName: string;
  starters: MlbStarterRow[];
  relievers: MlbPitcherAvailability[];
  fetchedAt: string;
};

export type MlbPitcherSplitsData = {
  vsLeft: { era?: string; whip?: string; avg?: string; ops?: string; sample?: number } | null;
  vsRight: { era?: string; whip?: string; avg?: string; ops?: string; sample?: number } | null;
};

export type MlbPlatoonPitcher = {
  playerId: string;
  fullName: string;
  throwsHand: string;
  splits: MlbPitcherSplitsData;
};

export type MlbHandednessAnalysis = {
  pitcherTeamKey: string;
  lineupTeamKey: string;
  pitcherName: string;
  pitcherHand: string;
  lineupHandedness: "left" | "right" | "balanced" | "unknown";
  lineupSummary: string;
  edge: "pitcher" | "hitter" | "neutral" | "unknown";
  summary: string;
  reasoning: string;
};

export type MlbPlatoonAdvantage = {
  game: {
    gameId: string;
    gamePk: number;
    officialDate: string;
    homeTeam: { key: string; name: string };
    awayTeam: { key: string; name: string };
  };
  homePitcher: MlbPlatoonPitcher | null;
  awayPitcher: MlbPlatoonPitcher | null;
  advantage: "home" | "away" | "neutral";
  advantageScore: number;
  explanation: string;
  analysisMode: "splits" | "handedness";
  handednessAnalyses: MlbHandednessAnalysis[];
};

// ── Private helpers ──────────────────────────────────────────────────────────

function fallbackMeta(mode: ModeArg, warning: string): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : "mlb",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: mode,
  };
}

function normalizeTeamKeyInput(teamKey: string): string {
  return teamKey.trim().toUpperCase();
}

function sanitizeMlbPersonIds(ids: Array<string | number | null | undefined>): string[] {
  const unique = new Set<string>();

  for (const rawId of ids) {
    const normalized = typeof rawId === "number"
      ? (Number.isFinite(rawId) ? String(Math.trunc(rawId)) : "")
      : typeof rawId === "string"
        ? rawId.trim()
        : "";
    if (!/^\d+$/.test(normalized)) {
      continue;
    }
    if (normalized === "0") {
      continue;
    }
    unique.add(normalized);
  }

  return Array.from(unique);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 999;
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function outsFromInningsPitched(ip: string | null | undefined): number {
  if (!ip) return 0;
  const parts = String(ip).split(".");
  const whole = Number.parseInt(parts[0] ?? "0", 10);
  const frac = Number.parseInt(parts[1] ?? "0", 10);
  if (Number.isNaN(whole) || Number.isNaN(frac)) return 0;
  return whole * 3 + Math.max(0, Math.min(frac, 2));
}

function fatigueLevelFromDays(days: number): MlbPitcherAvailability["fatigue"] {
  if (days <= 1) return "fatigued";
  if (days === 2) return "tired";
  if (days === 3) return "available";
  if (days === 4) return "fresh";
  return "rested";
}

function readNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const p = Number(v);
    if (Number.isFinite(p)) return p;
  }
  return undefined;
}

function formatStat(v: number | undefined, digits: number): string | undefined {
  if (typeof v !== "number" || Number.isNaN(v)) return undefined;
  return v.toFixed(digits);
}

function fallbackAbbrevFromName(name?: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) {
    return "TBD";
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 3).toUpperCase();
  }
  if (parts.length === 2) {
    return parts.map((part) => (part[0] ?? "")).join("").toUpperCase();
  }
  return parts.slice(-1)[0].slice(0, 3).toUpperCase();
}

function teamKeyFromIdOrName(teamId?: number, teamName?: string): string {
  const known = MLB_TEAM_OPTIONS.find((team) => team.id === teamId);
  return known?.key ?? fallbackAbbrevFromName(teamName);
}

function gameTypeLabel(gameType?: string): string | undefined {
  switch ((gameType ?? "").toUpperCase()) {
    case "R":
      return "Regular Season";
    case "S":
      return "Spring Training";
    case "F":
      return "Wild Card";
    case "D":
      return "Division Series";
    case "L":
      return "League Championship";
    case "W":
      return "World Series";
    default:
      return undefined;
  }
}

// ── searchPlayers ────────────────────────────────────────────────────────────

type MlbPeopleSearchResponse = {
  people?: Array<{ id?: number; fullName?: string }>;
};

export async function mlbSearchPlayers(
  q: string,
  limit: number,
  dataMode?: ModeArg,
): Promise<{ data: MlbPlayerSearchResult[] | null; meta: Meta }> {
  const resolved = getMlbDataMode(dataMode);
  const query = q.trim();
  if (!query) {
    return { data: null, meta: fallbackMeta(resolved, "q is required") };
  }
  const cappedLimit = Math.min(20, Math.max(1, Math.trunc(limit) || 8));

  const response = await fetchMlbJson<MlbPeopleSearchResponse>({
    endpoint: "/people/search",
    params: { names: query, sportId: 1 },
    fixtureFile: "player_search.json",
    ttlSeconds: 60,
    dataMode: resolved,
  });

  const people = (response.data.people ?? []).slice(0, cappedLimit);
  const data = people
    .filter((p): p is { id: number; fullName: string } => Boolean(p.id && p.fullName))
    .map((p) => ({ playerId: String(p.id), fullName: p.fullName }));

  return { data: data.length > 0 ? data : null, meta: response.meta };
}

// ── getRecentForm ────────────────────────────────────────────────────────────

type RawScheduleDates = {
  dates?: Array<{
    games?: Array<{
      gamePk?: number;
      gameDate?: string;
      officialDate?: string;
      gameType?: string;
      status?: { abstractGameState?: string };
      teams?: {
        away?: { team?: { id?: number; name?: string }; score?: number };
        home?: { team?: { id?: number; name?: string }; score?: number };
      };
    }>;
  }>;
};

type RecentGame = {
  date: string;
  gameType: string;
  teamScore: number;
  oppScore: number;
  won: boolean;
};

function extractRecentResults(teamId: number, payload: RawScheduleDates): MlbRecentResult[] {
  const results: MlbRecentResult[] = [];

  for (const bucket of payload.dates ?? []) {
    for (const game of bucket.games ?? []) {
      if ((game.status?.abstractGameState ?? "").toLowerCase() !== "final") continue;
      if (!game.officialDate || !game.gamePk) continue;

      const homeTeam = game.teams?.home?.team;
      const awayTeam = game.teams?.away?.team;
      if (!homeTeam || !awayTeam) continue;

      const isHome = homeTeam.id === teamId;
      const isAway = awayTeam.id === teamId;
      if (!isHome && !isAway) continue;

      const opponentTeam = isHome ? awayTeam : homeTeam;
      const teamScore = isHome ? game.teams?.home?.score : game.teams?.away?.score;
      const opponentScore = isHome ? game.teams?.away?.score : game.teams?.home?.score;
      const result = typeof teamScore === "number" && typeof opponentScore === "number"
        ? (teamScore > opponentScore ? "W" : "L")
        : null;

      results.push({
        gamePk: game.gamePk,
        date: game.officialDate,
        opponent: opponentTeam.name ?? teamKeyFromIdOrName(opponentTeam.id),
        opponentKey: teamKeyFromIdOrName(opponentTeam.id, opponentTeam.name),
        homeAway: isHome ? "home" : "away",
        gameType: game.gameType,
        gameTypeLabel: gameTypeLabel(game.gameType),
        result,
        teamScore: typeof teamScore === "number" ? teamScore : null,
        opponentScore: typeof opponentScore === "number" ? opponentScore : null,
        status: game.status?.abstractGameState ?? "Final",
      });
    }
  }

  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return results;
}

function extractRecentGames(teamId: number, payload: RawScheduleDates): RecentGame[] {
  const games: RecentGame[] = [];
  for (const bucket of payload.dates ?? []) {
    for (const game of bucket.games ?? []) {
      if ((game.status?.abstractGameState ?? "").toLowerCase() !== "final") continue;
      if (!game.gameDate) continue;
      const homeId = game.teams?.home?.team?.id;
      const awayId = game.teams?.away?.team?.id;
      if (homeId !== teamId && awayId !== teamId) continue;
      const isHome = homeId === teamId;
      const teamScore = isHome ? (game.teams?.home?.score ?? 0) : (game.teams?.away?.score ?? 0);
      const oppScore = isHome ? (game.teams?.away?.score ?? 0) : (game.teams?.home?.score ?? 0);
      games.push({ date: game.gameDate, gameType: game.gameType ?? "R", teamScore, oppScore, won: teamScore > oppScore });
    }
  }
  games.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return games;
}

function computePeriod(games: RecentGame[], days: number, now: Date): MlbRecentFormPeriod {
  const cutoff = addDays(now, -days);
  const relevant = games.filter((g) => new Date(g.date) >= cutoff);
  let wins = 0, losses = 0, runsScored = 0, runsAllowed = 0;
  for (const g of relevant) {
    runsScored += g.teamScore;
    runsAllowed += g.oppScore;
    if (g.won) wins++; else losses++;
  }
  const totalGames = wins + losses;
  const winPct = totalGames > 0 ? wins / totalGames : 0;
  const runDiff = runsScored - runsAllowed;
  return { days, wins, losses, runsScored, runsAllowed, runDiff, winPct, games: totalGames, runDiffPerGame: totalGames > 0 ? runDiff / totalGames : 0 };
}

export async function mlbGetRecentResults(
  teamKey: string,
  limit = 5,
  dataMode?: ModeArg,
): Promise<{ data: MlbRecentResults | null; meta: Meta }> {
  const resolved = getMlbDataMode(dataMode);
  const normalizedTeamKey = normalizeTeamKeyInput(teamKey);
  const team = resolveMlbTeam(normalizedTeamKey);
  if (!team) {
    return { data: null, meta: fallbackMeta(resolved, `Unknown MLB team key: ${normalizedTeamKey}`) };
  }

  const now = new Date();
  const safeLimit = Math.max(1, Math.min(10, Math.trunc(limit) || 5));
  const response = await fetchMlbJson<RawScheduleDates>({
    endpoint: "/schedule",
    params: {
      teamId: team.id,
      sportId: 1,
      startDate: isoDate(addDays(now, -14)),
      endDate: isoDate(now),
    },
    fixtureFile: "team_recent_results.json",
    ttlSeconds: 300,
    dataMode: resolved,
  });

  const results = extractRecentResults(team.id, response.data).slice(0, safeLimit);
  return {
    data: {
      teamKey: team.key,
      teamName: team.name,
      results,
    },
    meta: {
      ...response.meta,
      warning: results.length === 0 ? response.meta.warning ?? `No recent completed games found for ${team.name}.` : response.meta.warning,
    },
  };
}

export async function mlbGetRecentForm(
  teamKey: string,
  dataMode?: ModeArg,
): Promise<{ data: MlbRecentForm | null; meta: Meta }> {
  const resolved = getMlbDataMode(dataMode);
  const normalizedTeamKey = normalizeTeamKeyInput(teamKey);
  const team = resolveMlbTeam(normalizedTeamKey);
  if (!team) {
    return { data: null, meta: fallbackMeta(resolved, `Unknown MLB team key: ${normalizedTeamKey}`) };
  }

  const now = new Date();
  const response = await fetchMlbJson<RawScheduleDates>({
    endpoint: "/schedule",
    params: { teamId: team.id, sportId: 1, startDate: isoDate(addDays(now, -32)), endDate: isoDate(now), gameTypes: "R,S,F,D,L,W" },
    fixtureFile: "recent_form_schedule.json",
    ttlSeconds: 300,
    dataMode: resolved,
  });

  const allGames = extractRecentGames(team.id, response.data);

  if (allGames.length === 0) {
    const empty = computePeriod([], 7, now);
    return {
      data: {
        teamKey: team.key, teamName: team.name, rating: "cool", ratingScore: 50, weightedWinPct: 0.5,
        last7: empty, last14: computePeriod([], 14, now), last30: computePeriod([], 30, now),
        explanation: `${team.name} has no completed games in the recent window.`,
        sampleContext: "No completed games in the last 31 days.",
        primaryGameType: "unknown", primaryGameTypeLabel: "No recent games",
      },
      meta: { ...response.meta, warning: response.meta.warning ?? "No recent games found" },
    };
  }

  const typeMap = new Map<string, number>();
  for (const g of allGames) typeMap.set(g.gameType, (typeMap.get(g.gameType) ?? 0) + 1);
  const hasR = (typeMap.get("R") ?? 0) > 0;
  const hasS = (typeMap.get("S") ?? 0) > 0;
  let primaryGameType: MlbRecentForm["primaryGameType"] = "unknown";
  let primaryGameTypeLabel = "Unknown";
  if (hasR && !hasS) { primaryGameType = "R"; primaryGameTypeLabel = "Regular Season"; }
  else if (hasS && !hasR) { primaryGameType = "S"; primaryGameTypeLabel = "Spring Training"; }
  else if (hasR && hasS) { primaryGameType = "mixed"; primaryGameTypeLabel = "Regular + Spring"; }

  const last7 = computePeriod(allGames, 7, now);
  const last14 = computePeriod(allGames, 14, now);
  const last30 = computePeriod(allGames, 30, now);

  const incrL8_14 = Math.max(0, last14.games - last7.games);
  const incrL15_30 = Math.max(0, last30.games - last14.games);
  const weightedWins = last7.wins * 2 + (last14.wins - last7.wins) * 1.5 + (last30.wins - last14.wins);
  const weightedTotal = last7.games * 2 + incrL8_14 * 1.5 + incrL15_30;
  const weightedWinPct = weightedTotal > 0 ? weightedWins / weightedTotal : 0.5;

  let rating: MlbRecentForm["rating"] = "cool";
  if (weightedWinPct >= 0.65) rating = "hot";
  else if (weightedWinPct >= 0.52) rating = "warm";
  else if (weightedWinPct >= 0.40) rating = "cool";
  else rating = "cold";

  const ratingScore = Math.round(weightedWinPct * 100);
  const sampleContext = `Based on ${last30.games} completed game${last30.games !== 1 ? "s" : ""} in the last 31 days (${primaryGameTypeLabel}).`;

  let explanation: string;
  if (last7.games === 0) {
    explanation = `${team.name} has not played in the last 7 days. Check back after their next game.`;
  } else {
    const trend = last7.winPct > last30.winPct + 0.05 ? "trending up" :
      last7.winPct < last30.winPct - 0.05 ? "trending down" : "steady";
    const rdLabel = last7.runDiff >= 0 ? `+${last7.runDiff}` : `${last7.runDiff}`;
    explanation = `${team.name} is ${rating} this week: ${last7.wins}-${last7.losses} (${(last7.winPct * 100).toFixed(0)}% win rate), run diff ${rdLabel}, ${trend} vs 30-day baseline.`;
  }

  return {
    data: { teamKey: team.key, teamName: team.name, rating, ratingScore, weightedWinPct, last7, last14, last30, explanation, sampleContext, primaryGameType, primaryGameTypeLabel },
    meta: response.meta,
  };
}

// ── getBullpenFatigue ────────────────────────────────────────────────────────

type MlbYearByYearStatsResponse = {
  stats?: Array<{
    group?: { displayName?: string };
    splits?: Array<{
      season?: string;
      stat?: {
        gamesPlayed?: number;
        homeRuns?: number;
        rbi?: number;
        avg?: string;
        obp?: string;
        slg?: string;
        ops?: string;
        strikeOuts?: number;
        baseOnBalls?: number;
        stolenBases?: number;
        babip?: string;
        gamesStarted?: number;
        wins?: number;
        losses?: number;
        era?: string;
        whip?: string;
        inningsPitched?: string;
      };
    }>;
  }>;
};

type MlbTeamStatsResponse = {
  stats?: Array<{
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
      team?: { id?: number };
      wins?: number;
      losses?: number;
      pct?: string;
      divisionRank?: string;
      gamesBack?: string;
    }>;
  }>;
  standings?: {
    records?: Array<{
      teamRecords?: Array<{
        team?: { id?: number };
        wins?: number;
        losses?: number;
        pct?: string;
        divisionRank?: string;
        gamesBack?: string;
      }>;
    }>;
  };
};

function mapPlayerHittingSplits(payload: MlbYearByYearStatsResponse): MlbPlayerYearStats[] {
  const group = payload.stats?.find((entry) => entry.group?.displayName?.toLowerCase() === "hitting");
  return (group?.splits ?? [])
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
    .filter((row) => Number.isFinite(row.season) && row.season > 0)
    .sort((a, b) => b.season - a.season);
}

function mapPlayerPitchingSplits(payload: MlbYearByYearStatsResponse): MlbPlayerYearStats[] {
  const group = payload.stats?.find((entry) => entry.group?.displayName?.toLowerCase() === "pitching");
  return (group?.splits ?? [])
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
    .filter((row) => Number.isFinite(row.season) && row.season > 0)
    .sort((a, b) => b.season - a.season);
}

export async function mlbGetPlayerSeasonStats(
  playerId: string,
  dataMode?: ModeArg,
): Promise<{ data: MlbPlayerSeasonStats | null; meta: Meta }> {
  const resolved = getMlbDataMode(dataMode);
  const normalizedPlayerId = playerId.trim();

  if (!normalizedPlayerId) {
    return { data: null, meta: fallbackMeta(resolved, "playerId is required") };
  }

  const [hittingResult, pitchingResult] = await Promise.all([
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

  const warnings = [hittingResult.meta.warning, pitchingResult.meta.warning]
    .filter((value): value is string => Boolean(value));

  return {
    data: {
      playerId: normalizedPlayerId,
      hitting: mapPlayerHittingSplits(hittingResult.data),
      pitching: mapPlayerPitchingSplits(pitchingResult.data),
    },
    meta: {
      ...hittingResult.meta,
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
    },
  };
}

export async function mlbGetTeamSeasonStats(
  teamKey: string,
  season: number,
  dataMode?: ModeArg,
): Promise<{ data: MlbTeamSeasonStatsData | null; meta: Meta }> {
  const resolved = getMlbDataMode(dataMode);
  const normalizedTeamKey = normalizeTeamKeyInput(teamKey);
  const team = resolveMlbTeam(normalizedTeamKey);
  if (!team) {
    return { data: null, meta: fallbackMeta(resolved, `Unknown MLB team key: ${normalizedTeamKey}`) };
  }

  const normalizedSeason = Number.isFinite(season) ? Math.trunc(season) : new Date().getUTCFullYear();
  const [hittingResult, pitchingResult, standingsResult] = await Promise.all([
    fetchMlbJson<MlbTeamStatsResponse>({
      endpoint: "/teams/stats",
      params: { stats: "season", group: "hitting", season: normalizedSeason, sportId: 1 },
      fixtureFile: "season_stats_team.json",
      ttlSeconds: 3600,
      dataMode: resolved,
    }),
    fetchMlbJson<MlbTeamStatsResponse>({
      endpoint: "/teams/stats",
      params: { stats: "season", group: "pitching", season: normalizedSeason, sportId: 1 },
      fixtureFile: "season_stats_team.json",
      ttlSeconds: 3600,
      dataMode: resolved,
    }),
    fetchMlbJson<MlbStandingsResponse>({
      endpoint: "/standings",
      params: { leagueId: "103,104", season: normalizedSeason, sportId: 1 },
      fixtureFile: "season_stats_team.json",
      ttlSeconds: 3600,
      dataMode: resolved,
    }),
  ]);

  const hittingGroup = hittingResult.data.stats?.find((entry) => entry.group?.displayName?.toLowerCase() === "hitting");
  const hittingSplit = hittingGroup?.splits?.find((entry) => entry.team?.id === team.id);
  const pitchingGroup = pitchingResult.data.stats?.find((entry) => entry.group?.displayName?.toLowerCase() === "pitching");
  const pitchingSplit = pitchingGroup?.splits?.find((entry) => entry.team?.id === team.id);
  const standingsRecords = standingsResult.data.records ?? standingsResult.data.standings?.records ?? [];
  const teamRecord = standingsRecords
    .flatMap((record) => record.teamRecords ?? [])
    .find((record) => record.team?.id === team.id);

  const warnings = [hittingResult.meta.warning, pitchingResult.meta.warning, standingsResult.meta.warning]
    .filter((value): value is string => Boolean(value));

  return {
    data: {
      teamKey: team.key,
      teamName: hittingSplit?.team?.name ?? pitchingSplit?.team?.name ?? team.name,
      season: normalizedSeason,
      record: {
        wins: teamRecord?.wins ?? 0,
        losses: teamRecord?.losses ?? 0,
        pct: teamRecord?.pct ?? ".000",
        divisionRank: teamRecord?.divisionRank ? Number.parseInt(teamRecord.divisionRank, 10) : undefined,
        gamesBack: teamRecord?.gamesBack,
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
    meta: {
      ...hittingResult.meta,
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
    },
  };
}

type MlbRosterResponse = {
  roster?: Array<{
    person?: { id?: number; fullName?: string };
    position?: { code?: string; type?: string; abbreviation?: string };
  }>;
  team?: { id?: number; name?: string };
};

type MlbBulkPeopleResponse = {
  people?: Array<{
    id?: number;
    fullName?: string;
    stats?: Array<{
      type?: { displayName?: string; code?: string };
      splits?: Array<{
        date?: string;
        game?: { gameType?: string };
        gameType?: string;
        stat?: {
          inningsPitched?: string | number;
          numberOfPitches?: number;
          strikes?: number;
          strikeOuts?: number;
          strikeouts?: number;
          strikeoutsPer9Inn?: number;
          gamesPlayed?: number;
        };
      }>;
    }>;
  }>;
};

type PersonSplitRow = { date?: string; ip: string; pitches?: number; strikes?: number; k?: number };

function isPitcher(abbr?: string, type?: string): boolean {
  if (!abbr && !type) return false;
  const a = (abbr ?? "").toUpperCase();
  const t = (type ?? "").toLowerCase();
  return a === "SP" || a === "RP" || a === "CL" || a === "P" || t === "pitcher";
}

function isStarter(abbr?: string): boolean {
  return (abbr ?? "").toUpperCase() === "SP";
}

function inferStarterFromRecentWorkload(splits: PersonSplitRow[]): boolean {
  const recentSplits = splits.slice(0, 3);
  if (recentSplits.length === 0) return false;

  let maxOuts = 0;
  let maxPitches = 0;
  for (const split of recentSplits) {
    maxOuts = Math.max(maxOuts, outsFromInningsPitched(split.ip));
    maxPitches = Math.max(maxPitches, split.pitches ?? 0);
  }

  return maxOuts >= 12 || (maxOuts >= 9 && maxPitches >= 50);
}

function classifyPitcherRole(abbr: string | undefined, splits: PersonSplitRow[]): {
  isStarter: boolean;
  inferred: boolean;
} {
  const normalizedAbbr = (abbr ?? "").toUpperCase();
  if (normalizedAbbr === "SP") {
    return { isStarter: true, inferred: false };
  }
  if (normalizedAbbr === "RP" || normalizedAbbr === "CL") {
    return { isStarter: false, inferred: false };
  }

  const inferredStarter = inferStarterFromRecentWorkload(splits);
  return { isStarter: inferredStarter, inferred: inferredStarter };
}

export async function mlbGetBullpenFatigue(
  teamKey: string,
  dataMode?: ModeArg,
): Promise<{ data: MlbBullpenFatigue | null; meta: Meta }> {
  const resolved = getMlbDataMode(dataMode);
  const normalizedTeamKey = normalizeTeamKeyInput(teamKey);
  const team = resolveMlbTeam(normalizedTeamKey);
  if (!team) {
    return { data: null, meta: fallbackMeta(resolved, `Unknown MLB team key: ${normalizedTeamKey}`) };
  }

  const year = new Date().getUTCFullYear();

  const rosterResp = await fetchMlbJson<MlbRosterResponse>({
    endpoint: `/teams/${team.id}/roster`,
    params: { rosterType: "40Man", hydrate: "person" },
    fixtureFile: "bullpen_fatigue_nym.json",
    ttlSeconds: 300,
    dataMode: resolved,
  });

  const rosterEntries = rosterResp.data.roster ?? [];
  const teamName = rosterResp.data.team?.name ?? team.name;

  const pitcherEntries = rosterEntries.filter((e) =>
    isPitcher(e.position?.abbreviation, e.position?.type)
  );

  const pitcherIds = sanitizeMlbPersonIds(pitcherEntries.map((entry) => entry.person?.id));
  const filteredPitcherCount = Math.max(0, pitcherEntries.length - pitcherIds.length);

  if (pitcherIds.length === 0) {
    return {
      data: { teamKey: team.key, teamName, starters: [], relievers: [], fetchedAt: new Date().toISOString() },
      meta: {
        ...rosterResp.meta,
        warning: filteredPitcherCount > 0
          ? `No valid MLB pitcher ids remained after sanitizing ${filteredPitcherCount} roster entries.`
          : "No pitchers found in roster response.",
      },
    };
  }

  const bulkResp = await fetchMlbJson<MlbBulkPeopleResponse>({
    endpoint: "/people",
    params: {
      personIds: pitcherIds.join(","),
      hydrate: `stats(group=[pitching],type=[gameLog],season=${year},gameType=[R,S])`,
    },
    fixtureFile: "bullpen_fatigue_logs_nym.json",
    ttlSeconds: 300,
    dataMode: resolved,
  });

  const personMap = new Map<string, PersonSplitRow[]>();

  for (const person of bulkResp.data.people ?? []) {
    const normalizedPersonId = sanitizeMlbPersonIds([person.id])[0];
    if (!normalizedPersonId) continue;
    const gameLogGroup = person.stats?.find((s) => {
      const label = (s.type?.displayName ?? s.type?.code ?? "").toLowerCase();
      return label.includes("gamelog") || label.includes("game log");
    });
    const splits: PersonSplitRow[] = (gameLogGroup?.splits ?? [])
      .filter((s) => s.date)
      .map((s) => ({
        date: s.date,
        ip: String(s.stat?.inningsPitched ?? ""),
        pitches: s.stat?.numberOfPitches,
        strikes: s.stat?.strikes,
        k: s.stat?.strikeOuts ?? s.stat?.strikeouts,
      }))
      .sort((a, b) => new Date(b.date ?? "").getTime() - new Date(a.date ?? "").getTime());
    personMap.set(normalizedPersonId, splits);
  }

  const now = new Date();
  const starters: MlbStarterRow[] = [];
  const relievers: MlbPitcherAvailability[] = [];
  const seenPitcherIds = new Set<string>();
  let inferredStarterCount = 0;

  for (const entry of pitcherEntries) {
    const id = sanitizeMlbPersonIds([entry.person?.id])[0];
    if (!id || seenPitcherIds.has(id)) continue;
    seenPitcherIds.add(id);
    const name = entry.person?.fullName ?? `Player ${id}`;
    const abbr = entry.position?.abbreviation;
    const splits = personMap.get(id) ?? [];

    // Season K/9
    let totalOuts = 0, totalK = 0;
    for (const s of splits) {
      totalOuts += outsFromInningsPitched(s.ip);
      totalK += s.k ?? 0;
    }
    const seasonKPer9 = totalOuts > 0 ? ((totalK * 27) / totalOuts).toFixed(1) : undefined;
    const seasonUsed = splits.length;
    const role = classifyPitcherRole(abbr, splits);

    if (role.isStarter) {
      if (role.inferred) inferredStarterCount += 1;
      const last = splits[0];
      const lastDate = last?.date ?? null;
      starters.push({
        playerId: String(id), fullName: name,
        lastStartDate: lastDate,
        daysRest: lastDate ? daysBetween(lastDate, now) : 99,
        inningsLastStart: last?.ip ?? null,
        pitchesLastStart: last?.pitches ?? null,
        strikesLastStart: last?.strikes ?? null,
        seasonKPer9, seasonUsed,
      });
    } else {
      const last = splits[0];
      const lastDate = last?.date ?? null;
      const daysRest = lastDate ? daysBetween(lastDate, now) : 99;
      const recentAppearances: PitcherRecentAppearance[] = splits.slice(0, 7).map((s) => ({
        date: s.date!,
        inningsPitched: s.ip || "0.0",
        numberOfPitches: s.pitches ?? 0,
        strikes: s.strikes,
      }));
      relievers.push({
        playerId: String(id), fullName: name,
        fatigue: fatigueLevelFromDays(daysRest), daysRest,
        lastAppearance: lastDate,
        lastAppearancePitches: last?.pitches ?? null,
        lastAppearanceStrikes: last?.strikes ?? null,
        inningsLastAppearance: last?.ip ?? null,
        seasonKPer9, seasonUsed,
        recentAppearances,
      });
    }
  }

  const fatigueOrder = { fatigued: 0, tired: 1, available: 2, fresh: 3, rested: 4 } as const;
  starters.sort((a, b) => a.daysRest - b.daysRest);
  relievers.sort((a, b) => fatigueOrder[a.fatigue] - fatigueOrder[b.fatigue]);

  const warningParts = [
    rosterResp.meta.warning,
    bulkResp.meta.warning,
    filteredPitcherCount > 0 ? `Filtered ${filteredPitcherCount} invalid or duplicate pitcher ids before requesting player logs.` : undefined,
    (bulkResp.data.people ?? []).length === 0 ? "No pitcher game logs were returned from MLB Stats API." : undefined,
    inferredStarterCount > 0 ? `Inferred ${inferredStarterCount} starter${inferredStarterCount === 1 ? "" : "s"} from recent workload because MLB roster roles were generic.` : undefined,
    starters.length === 0 ? "No starter-length outings were identified, so the starters view may be incomplete." : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    data: { teamKey: team.key, teamName, starters, relievers, fetchedAt: now.toISOString() },
    meta: {
      ...bulkResp.meta,
      warning: warningParts.length > 0 ? warningParts.join(" ") : undefined,
    },
  };
}

// ── getPlatoonAdvantage ──────────────────────────────────────────────────────

type MlbPersonSplitsResponse = {
  people?: Array<{
    id?: number;
    fullName?: string;
    pitchHand?: { code?: string };
    stats?: Array<{
      type?: { displayName?: string; code?: string };
      splits?: Array<{
        split?: { code?: string; description?: string };
        stat?: { era?: number | string; whip?: number | string; avg?: number | string; ops?: number | string; battersFaced?: number };
      }>;
    }>;
  }>;
};

async function fetchPitcherSplits(
  playerId: string,
  dataMode: "live" | "fixture",
): Promise<{ fullName: string; pitchHand: string; splits: MlbPitcherSplitsData } | null> {
  const year = new Date().getUTCFullYear();
  try {
    const resp = await fetchMlbJson<MlbPersonSplitsResponse>({
      endpoint: `/people/${encodeURIComponent(playerId)}`,
      params: {
        hydrate: `stats(group=[pitching],type=[statSplits],sitCodes=[vl,vr],season=${year},gameType=[R,S])`,
        fields: "people,id,fullName,pitchHand,stats,splits,split,stat,era,whip,avg,ops,battersFaced",
      },
      fixtureFile: "pitcher_splits_sample.json",
      ttlSeconds: 300,
      dataMode,
    });
    const person = (resp.data.people ?? [])[0];
    if (!person?.id) return null;

    const fullName = person.fullName ?? `Player ${playerId}`;
    const pitchHand = person.pitchHand?.code ?? "R";

    const splitGroup = person.stats?.find((s) => {
      const label = (s.type?.displayName ?? s.type?.code ?? "").toLowerCase();
      return label.includes("statsplit") || label.includes("stat split") || label.includes("site");
    });

    let vsLeft: MlbPitcherSplitsData["vsLeft"] = null;
    let vsRight: MlbPitcherSplitsData["vsRight"] = null;

    for (const row of splitGroup?.splits ?? []) {
      const code = (row.split?.code ?? "").toLowerCase();
      const desc = (row.split?.description ?? "").toLowerCase();
      const isLeft = code === "vl" || desc.includes("left");
      const isRight = code === "vr" || desc.includes("right");
      if (!isLeft && !isRight) continue;
      const st = row.stat;
      const entry = {
        era: formatStat(readNumber(st?.era), 2),
        whip: formatStat(readNumber(st?.whip), 2),
        avg: formatStat(readNumber(st?.avg), 3),
        ops: formatStat(readNumber(st?.ops), 3),
        sample: readNumber(st?.battersFaced),
      };
      if (isLeft) vsLeft = entry;
      else vsRight = entry;
    }

    return { fullName, pitchHand, splits: { vsLeft, vsRight } };
  } catch {
    return null;
  }
}

function hasAnyPitcherSplits(pitcher: MlbPlatoonPitcher | null): boolean {
  return Boolean(pitcher?.splits.vsLeft || pitcher?.splits.vsRight);
}

function computeEdge(home: MlbPlatoonPitcher | null, away: MlbPlatoonPitcher | null): {
  advantage: MlbPlatoonAdvantage["advantage"];
  advantageScore: number;
  explanation: string;
} {
  function avgEra(splits: MlbPitcherSplitsData): number {
    const l = parseFloat(splits.vsLeft?.era ?? "");
    const r = parseFloat(splits.vsRight?.era ?? "");
    if (Number.isNaN(l) && Number.isNaN(r)) return 4.50;
    if (Number.isNaN(l)) return r;
    if (Number.isNaN(r)) return l;
    return (l + r) / 2;
  }

  const homeEra = home ? avgEra(home.splits) : 4.50;
  const awayEra = away ? avgEra(away.splits) : 4.50;
  const diff = awayEra - homeEra;

  if (Math.abs(diff) < 0.50) {
    return { advantage: "neutral", advantageScore: 0, explanation: "Both pitchers show similar platoon splits — even matchup on the mound." };
  }
  if (diff > 0) {
    return {
      advantage: "home", advantageScore: Math.min(5, Math.round(diff)),
      explanation: `Home starter shows tighter platoon splits (ERA ${homeEra.toFixed(2)}) vs away (ERA ${awayEra.toFixed(2)}).`,
    };
  }
  return {
    advantage: "away", advantageScore: Math.min(5, Math.round(-diff)),
    explanation: `Away starter shows tighter platoon splits (ERA ${awayEra.toFixed(2)}) vs home (ERA ${homeEra.toFixed(2)}).`,
  };
}

function buildHandednessAnalysis(pitcher: MlbPlatoonPitcher, pitcherTeamKey: string, lineupTeamKey: string): MlbHandednessAnalysis {
  const hand = pitcher.throwsHand;
  return {
    pitcherTeamKey, lineupTeamKey,
    pitcherName: pitcher.fullName, pitcherHand: hand,
    lineupHandedness: "balanced",
    lineupSummary: "Lineup handedness data not available.",
    edge: "neutral",
    summary: `${pitcher.fullName} (${hand}HP) vs ${lineupTeamKey} lineup`,
    reasoning: `A ${hand === "L" ? "left" : "right"}-handed pitcher. Without exact lineup data, platoon advantage is estimated from handedness matchup norms.`,
  };
}

export async function mlbGetPlatoonAdvantage(
  teamKey: string,
  dataMode?: ModeArg,
): Promise<{ data: MlbPlatoonAdvantage | null; meta: Meta }> {
  const resolved = getMlbDataMode(dataMode);
  const normalizedTeamKey = normalizeTeamKeyInput(teamKey);
  const team = resolveMlbTeam(normalizedTeamKey);
  if (!team) {
    return { data: null, meta: fallbackMeta(resolved, `Unknown MLB team key: ${normalizedTeamKey}`) };
  }

  const schedResult = await getMlbUpcomingScheduleWithProbables(normalizedTeamKey, resolved);
  if (!schedResult.data || schedResult.data.games.length === 0) {
    return { data: null, meta: { ...schedResult.meta, warning: `No upcoming games found for ${team.name}.` } };
  }

  const nextGame = schedResult.data.games[0];
  const awayProb = nextGame.awayTeam.probableStarter;
  const homeProb = nextGame.homeTeam.probableStarter;

  const [awayData, homeData] = await Promise.all([
    awayProb?.playerId ? fetchPitcherSplits(awayProb.playerId, resolved) : Promise.resolve(null),
    homeProb?.playerId ? fetchPitcherSplits(homeProb.playerId, resolved) : Promise.resolve(null),
  ]);

  function toPlatoonPitcher(
    prob: { playerId?: string; fullName?: string } | undefined,
    fetched: { fullName: string; pitchHand: string; splits: MlbPitcherSplitsData } | null,
  ): MlbPlatoonPitcher | null {
    if (!prob?.fullName) return null;
    if (fetched && prob.playerId) {
      return {
        playerId: prob.playerId,
        fullName: prob.fullName,
        throwsHand: fetched.pitchHand,
        splits: fetched.splits,
      };
    }
    return { playerId: prob.playerId ?? "", fullName: prob.fullName, throwsHand: "R", splits: { vsLeft: null, vsRight: null } };
  }

  const awayPitcher = toPlatoonPitcher(awayProb, awayData);
  const homePitcher = toPlatoonPitcher(homeProb, homeData);

  const homeHasSplitData = hasAnyPitcherSplits(homePitcher);
  const awayHasSplitData = hasAnyPitcherSplits(awayPitcher);
  const hasComparableSplits = homeHasSplitData && awayHasSplitData;
  const analysisMode: MlbPlatoonAdvantage["analysisMode"] = hasComparableSplits ? "splits" : "handedness";

  let advantage: MlbPlatoonAdvantage["advantage"] = "neutral";
  let advantageScore = 0;
  let explanation = "";

  if (analysisMode === "splits") {
    const edge = computeEdge(homePitcher, awayPitcher);
    advantage = edge.advantage;
    advantageScore = edge.advantageScore;
    explanation = edge.explanation;
  } else {
    explanation = homeHasSplitData || awayHasSplitData
      ? "Only one probable starter has usable split data right now, so this is a handedness-based estimate instead of a full split comparison."
      : (homePitcher || awayPitcher)
        ? "Pitcher splits are not posted yet. This is a handedness-based estimate."
        : "Probable starters are not posted yet. Check back closer to first pitch.";
  }

  const handednessAnalyses: MlbHandednessAnalysis[] = [];
  if (awayPitcher) handednessAnalyses.push(buildHandednessAnalysis(awayPitcher, nextGame.awayTeam.key, nextGame.homeTeam.key));
  if (homePitcher) handednessAnalyses.push(buildHandednessAnalysis(homePitcher, nextGame.homeTeam.key, nextGame.awayTeam.key));

  const gamePk = nextGame.gamePk ?? 0;
  const warningParts = [
    schedResult.meta.warning,
    !hasComparableSplits && (homeHasSplitData || awayHasSplitData)
      ? "Only one probable starter currently has split data; matchup edge is estimated from handedness."
      : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    data: {
      game: {
        gameId: String(gamePk), gamePk,
        officialDate: nextGame.officialDate ?? nextGame.gameDate.slice(0, 10),
        homeTeam: { key: nextGame.homeTeam.key, name: nextGame.homeTeam.name },
        awayTeam: { key: nextGame.awayTeam.key, name: nextGame.awayTeam.name },
      },
      homePitcher, awayPitcher, advantage, advantageScore, explanation, analysisMode, handednessAnalyses,
    },
    meta: {
      ...schedResult.meta,
      warning: warningParts.length > 0 ? warningParts.join(" ") : undefined,
    },
  };
}

// ── mlbGetRecentGameLog ───────────────────────────────────────────────────────

export type TeamGameLogEntry = {
  gamePk: number;
  gameNumber: number;
  date: string;
  dateISO: string;
  opponent: string;
  opponentKey: string;
  homeAway: "home" | "away";
  runsScored: number;
  runsAllowed: number;
  result: "W" | "L";
};

export type TeamGameLog = {
  teamKey: string;
  teamName: string;
  games: TeamGameLogEntry[];
  isPartial: boolean;
};

export async function mlbGetRecentGameLog(
  teamKey: string,
  limit = 15,
  dataMode?: ModeArg,
): Promise<{ data: TeamGameLog | null; meta: Meta }> {
  const resolved = getMlbDataMode(dataMode);
  const normalizedTeamKey = normalizeTeamKeyInput(teamKey);
  const team = resolveMlbTeam(normalizedTeamKey);
  if (!team) {
    return { data: null, meta: fallbackMeta(resolved, `Unknown MLB team key: ${normalizedTeamKey}`) };
  }

  const now = new Date();
  const response = await fetchMlbJson<RawScheduleDates>({
    endpoint: "/schedule",
    params: {
      teamId: team.id,
      sportId: 1,
      startDate: isoDate(addDays(now, -42)),
      endDate: isoDate(now),
      gameTypes: "R",
    },
    fixtureFile: "team-game-log.json",
    ttlSeconds: 300,
    dataMode: resolved,
  });

  const games = extractGameLog(team.id, response.data, limit);

  return {
    data: {
      teamKey: team.key,
      teamName: team.name,
      games,
      isPartial: games.length < limit,
    },
    meta: response.meta,
  };
}

function extractGameLog(teamId: number, payload: RawScheduleDates, limit: number): TeamGameLogEntry[] {
  const entries: TeamGameLogEntry[] = [];

  for (const bucket of payload.dates ?? []) {
    for (const game of bucket.games ?? []) {
      if ((game.status?.abstractGameState ?? "").toLowerCase() !== "final") continue;
      if (!game.officialDate || !game.gamePk) continue;
      if ((game.gameType ?? "") !== "R") continue;

      const homeTeam = game.teams?.home?.team;
      const awayTeam = game.teams?.away?.team;
      if (!homeTeam || !awayTeam) continue;

      const isHome = homeTeam.id === teamId;
      const isAway = awayTeam.id === teamId;
      if (!isHome && !isAway) continue;

      const runsScored = isHome ? game.teams?.home?.score : game.teams?.away?.score;
      const runsAllowed = isHome ? game.teams?.away?.score : game.teams?.home?.score;

      if (typeof runsScored !== "number" || typeof runsAllowed !== "number") continue;

      const opponentTeam = isHome ? awayTeam : homeTeam;

      entries.push({
        gamePk: game.gamePk,
        gameNumber: 0,
        date: formatGameDate(game.officialDate),
        dateISO: game.officialDate,
        opponent: opponentTeam.name ?? teamKeyFromIdOrName(opponentTeam.id),
        opponentKey: teamKeyFromIdOrName(opponentTeam.id, opponentTeam.name),
        homeAway: isHome ? "home" : "away",
        runsScored,
        runsAllowed,
        result: runsScored > runsAllowed ? "W" : "L",
      });
    }
  }

  entries.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const trimmed = entries.slice(-limit);
  trimmed.forEach((e, i) => { e.gameNumber = i + 1; });
  return trimmed;
}

function formatGameDate(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
