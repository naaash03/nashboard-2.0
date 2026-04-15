import { randomUUID } from "node:crypto";
import type { Meta } from "@/lib/providers/types";
import {
  type PlayerRoleFormDemoData,
  type RestScheduleDemoData,
  type TeamMatchupDemoData,
  getNbaPlayerRoleFormDemo,
  getNbaRestScheduleSpotDemo,
  getNbaTeamMatchupProfileDemo,
} from "@/lib/providers/espn/nbaScaffolds";
import {
  type BallDontLieGame,
  type BallDontLiePlayer,
  type BallDontLiePlayerStat,
  type BallDontLieTeam,
  currentNbaSeason,
  findBestNbaPlayerMatch,
  findNbaTeamByKey,
  getNbaPlayerSeasonStats,
  getNbaTeamSeasonGames,
  getNbaTeams,
  isBallDontLieConfigured,
} from "@/lib/providers/balldontlie";
import { getApiSportsConfig, resolveApiSportsKey } from "@/lib/providers/apiSports/config";
import { searchPlayers as searchApiSportsPlayers } from "@/lib/providers/apiSports/playerDirectory";
import { getPlayerInsights as getApiSportsPlayerInsights } from "@/lib/providers/apiSports/playerInsights";
import { getTeamsAdvanced as getApiSportsTeamsAdvanced } from "@/lib/providers/apiSports/teamAdvanced";
import type { PlayerSearchResult as ApiSportsPlayerSearchResult } from "@/lib/types/players";
import type { PlayerInsights, TeamAdvanced } from "@/lib/types/playerInsights";

type DataMode = "auto" | "live" | "fixture";
type TrendSignal = "up" | "steady" | "down";
type ApiSportsMode = "live" | "fixture";

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isFinal(game: BallDontLieGame): boolean {
  return /final/i.test(game.status);
}

function teamSide(game: BallDontLieGame, teamId: number): "home" | "away" {
  return game.home_team.id === teamId ? "home" : "away";
}

function opponentForTeam(game: BallDontLieGame, teamId: number): BallDontLieTeam {
  return game.home_team.id === teamId ? game.visitor_team : game.home_team;
}

function matchBallDontLieTeam(teams: BallDontLieTeam[], teamKey: string): BallDontLieTeam | null {
  const normalizedKey = teamKey.trim().toUpperCase();
  const normalizedName = normalizeText(teamKey);
  return teams.find((team) => {
    if (team.abbreviation.trim().toUpperCase() === normalizedKey) {
      return true;
    }
    if (normalizeText(team.full_name) === normalizedName) {
      return true;
    }
    return normalizeText(`${team.city} ${team.name}`) === normalizedName;
  }) ?? null;
}

function teamScore(game: BallDontLieGame, teamId: number): number {
  return game.home_team.id === teamId ? game.home_team_score : game.visitor_team_score;
}

function opponentScore(game: BallDontLieGame, teamId: number): number {
  return game.home_team.id === teamId ? game.visitor_team_score : game.home_team_score;
}

function completedGames(games: BallDontLieGame[]): BallDontLieGame[] {
  return games.filter((game) => isFinal(game));
}

function upcomingGames(games: BallDontLieGame[]): BallDontLieGame[] {
  const nowMs = Date.now();
  return games.filter((game) => {
    if (isFinal(game)) {
      return false;
    }
    const gameMs = new Date(game.datetime ?? game.date).getTime();
    return Number.isFinite(gameMs) && gameMs >= nowMs - 4 * 60 * 60 * 1000;
  });
}

function buildRecord(games: BallDontLieGame[], teamId: number, limit?: number): string {
  const rows = completedGames(games)
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())
    .slice(0, limit ?? Number.MAX_SAFE_INTEGER);

  const wins = rows.filter((game) => teamScore(game, teamId) > opponentScore(game, teamId)).length;
  const losses = rows.filter((game) => teamScore(game, teamId) < opponentScore(game, teamId)).length;
  return `${wins}-${losses}`;
}

function averageOf(rows: number[]): number {
  if (rows.length === 0) {
    return 0;
  }
  return rows.reduce((sum, value) => sum + value, 0) / rows.length;
}

function averageMargin(games: BallDontLieGame[], teamId: number, limit = 10): number {
  const rows = completedGames(games)
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())
    .slice(0, limit)
    .map((game) => teamScore(game, teamId) - opponentScore(game, teamId));
  return averageOf(rows);
}

function averagePoints(games: BallDontLieGame[], teamId: number, limit = 10): number {
  const rows = completedGames(games)
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())
    .slice(0, limit)
    .map((game) => teamScore(game, teamId));
  return averageOf(rows);
}

function formatSigned(value: number, digits = 1): string {
  const fixed = value.toFixed(digits);
  return value > 0 ? `+${fixed}` : fixed;
}

function calendarDiffDays(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function restDaysBeforeGame(previousGame: BallDontLieGame | null, nextGame: BallDontLieGame): number {
  if (!previousGame) {
    return 0;
  }
  return Math.max(0, calendarDiffDays(previousGame.date, nextGame.date) - 1);
}

function gamesInWindow(games: BallDontLieGame[], anchorDate: string, days: number): number {
  const startDate = toIsoDate(addDays(new Date(`${anchorDate}T00:00:00.000Z`), -(days - 1)));
  return games.filter((game) => game.date >= startDate && game.date <= anchorDate).length;
}

function densityLabel(countInFour: number, countInSeven: number): string {
  if (countInFour >= 3) {
    return `${countInFour} in 4 nights`;
  }
  if (countInSeven >= 4) {
    return `${countInSeven} in 7 nights`;
  }
  if (countInSeven >= 3) {
    return `${countInSeven} in 7 nights`;
  }
  return "Normal cadence";
}

function travelDescriptor(previousGame: BallDontLieGame | null, nextGame: BallDontLieGame, teamId: number): { label: string; stressScore: number } {
  if (!previousGame) {
    return { label: "No prior game in current sample", stressScore: 1 };
  }

  const wasHome = teamSide(previousGame, teamId) === "home";
  const isHome = teamSide(nextGame, teamId) === "home";

  if (wasHome && isHome) {
    return { label: "Stayed home", stressScore: 0 };
  }
  if (!wasHome && isHome) {
    return { label: "Returning home", stressScore: 1 };
  }
  if (wasHome && !isHome) {
    return { label: "Flying out after home game", stressScore: 1 };
  }
  return { label: "Road to road turnaround", stressScore: 2 };
}

function compareAdvantage(teamValue: number, opponentValue: number, lowerIsBetter = false): "team" | "opponent" | "even" {
  if (teamValue === opponentValue) {
    return "even";
  }
  if (lowerIsBetter) {
    return teamValue < opponentValue ? "team" : "opponent";
  }
  return teamValue > opponentValue ? "team" : "opponent";
}

function dedupe(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function sanitizeDemoNotes(notes: string[] | undefined): string[] {
  return (notes ?? []).filter((note) => !note.toLowerCase().includes("live enrichment is intentionally deferred"));
}

function mergeMeta(metas: Meta[], extras?: {
  warning?: string;
  warnings?: string[];
  notes?: string[];
  hydrationUsed?: boolean;
  sourceUsed?: Meta["sourceUsed"];
  dataModeEffective?: Meta["dataModeEffective"];
}): Meta {
  if (metas.length === 0) {
    return {
      sourceUsed: extras?.sourceUsed ?? "demo",
      updatedAt: new Date().toISOString(),
      requestId: randomUUID(),
      notes: dedupe(extras?.notes ?? []),
      warnings: dedupe(extras?.warnings ?? []),
      warning: extras?.warning,
      hydrationUsed: extras?.hydrationUsed,
      dataModeEffective: extras?.dataModeEffective,
      dataMode: "auto",
    };
  }

  const sorted = [...metas].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const sourceUsed = extras?.sourceUsed
    ?? (metas.some((meta) => meta.sourceUsed === "balldontlie")
      ? "balldontlie"
      : metas.every((meta) => meta.sourceUsed === "cache")
        ? "cache"
        : sorted[0].sourceUsed);
  const warning = extras?.warning ?? metas.find((meta) => meta.warning)?.warning;
  const warnings = dedupe([
    ...metas.flatMap((meta) => meta.warnings ?? []),
    ...metas.flatMap((meta) => (meta.warning ? [meta.warning] : [])),
    ...(extras?.warnings ?? []),
    ...(warning ? [warning] : []),
  ]);
  const notes = dedupe([
    ...metas.flatMap((meta) => sanitizeDemoNotes(meta.notes)),
    ...(extras?.notes ?? []),
  ]);

  return {
    ...sorted[0],
    sourceUsed,
    updatedAt: sorted[0].updatedAt,
    warning,
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: notes.length > 0 ? notes : undefined,
    hydrationUsed: extras?.hydrationUsed ?? metas.some((meta) => Boolean(meta.hydrationUsed)),
    cacheHit: metas.some((meta) => Boolean(meta.cacheHit)),
    cacheAgeSeconds: metas.reduce<number | undefined>((youngest, meta) => {
      if (typeof meta.cacheAgeSeconds !== "number") {
        return youngest;
      }
      if (typeof youngest !== "number") {
        return meta.cacheAgeSeconds;
      }
      return Math.min(youngest, meta.cacheAgeSeconds);
    }, undefined),
    dataModeEffective: extras?.dataModeEffective ?? (sourceUsed === "demo" || sourceUsed === "fixture" ? "fixture" : "live"),
  };
}

function withDemoFallback<T>(
  resolved: { data: T; meta: Meta },
  args?: { warning?: string; notes?: string[] },
): { data: T; meta: Meta } {
  return {
    data: resolved.data,
    meta: mergeMeta([resolved.meta], {
      sourceUsed: "demo",
      warning: args?.warning,
      notes: args?.notes,
      dataModeEffective: "fixture",
    }),
  };
}

function withRefreshPreservedRealState<T>(
  resolved: { data: T; meta: Meta },
  args: { widgetLabel: string; reason: string; notes?: string[] },
): { data: T; meta: Meta } {
  return {
    data: resolved.data,
    meta: mergeMeta([resolved.meta], {
      warning: `Fresh ${args.widgetLabel} refresh failed, so NashBoard kept the last-known real data instead. ${args.reason}`,
      notes: [
        `A forced refresh could not hydrate newer ${args.widgetLabel} data, so the widget preserved the best available real state.`,
        ...(args.notes ?? []),
      ],
      sourceUsed: resolved.meta.sourceUsed,
      dataModeEffective: resolved.meta.dataModeEffective,
    }),
  };
}

function ballDontLieAvailability(dataMode: DataMode): { enabled: boolean; warning?: string } {
  if (dataMode === "fixture") {
    return { enabled: false };
  }
  if (!isBallDontLieConfigured()) {
    return {
      enabled: false,
      warning: dataMode === "live"
        ? "BALL_DONT_LIE_KEY is not configured. Using the demo-backed NBA scaffold instead."
        : undefined,
    };
  }
  return { enabled: true };
}

function apiSportsAvailability(dataMode: DataMode): { enabled: boolean; warning?: string } {
  if (dataMode === "fixture") {
    return { enabled: false };
  }

  const config = getApiSportsConfig("nba");
  const apiKey = resolveApiSportsKey()?.trim() ?? "";
  const invalidApiKey = apiKey.length < 20
    || /^(YOUR|REPLACE|INSERT|PLACEHOLDER|TEST|SAMPLE|DEMO|FAKE)/i.test(apiKey);

  if (!apiKey || invalidApiKey || !config.baseUrl || !config.league || !config.season) {
    return {
      enabled: false,
      warning: dataMode === "live"
        ? "API-Sports NBA is not fully configured. Showing the demo-backed NBA scaffold instead."
        : undefined,
    };
  }

  return { enabled: true };
}

function toApiSportsMode(dataMode: DataMode): ApiSportsMode {
  return dataMode === "fixture" ? "fixture" : "live";
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]|_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function seemsTeamKey(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toUpperCase();
  if (!trimmed || !/^[A-Z]{2,4}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function formatRecordString(record?: TeamAdvanced["record"] | null): string {
  if (!record) {
    return "Record unavailable";
  }
  const base = `${record.wins}-${record.losses}`;
  return record.last10 ? `${base} (${record.last10} last 10)` : base;
}

function formatStandingsContext(team: TeamAdvanced | null | undefined): string | undefined {
  if (!team) {
    return undefined;
  }
  const parts = [
    team.standings?.rank ? `Rank ${team.standings.rank}` : undefined,
    team.standings?.division,
    team.record?.streak ? `Streak ${team.record.streak}` : undefined,
  ];
  const compact = dedupe(parts);
  return compact.length > 0 ? compact.join(" | ") : undefined;
}

function scheduleRestDays(lastWhen?: string, nextWhen?: string): number | undefined {
  if (!lastWhen || !nextWhen) {
    return undefined;
  }
  const diff = Math.round((new Date(nextWhen).getTime() - new Date(lastWhen).getTime()) / 86_400_000) - 1;
  return Number.isFinite(diff) ? Math.max(0, diff) : undefined;
}

function pickTeamByKey(teams: TeamAdvanced[] | undefined, teamKey: string): TeamAdvanced | null {
  if (!teams || teams.length === 0) {
    return null;
  }
  const normalized = teamKey.trim().toUpperCase();
  return teams.find((team) => team.teamKey.trim().toUpperCase() === normalized) ?? null;
}

function hasMeaningfulTeamContext(team: TeamAdvanced | null | undefined): boolean {
  if (!team) {
    return false;
  }
  return Boolean(team.record || team.standings || team.lastGame || team.nextGame);
}

function playerSearchScore(query: string, player: ApiSportsPlayerSearchResult, teamKey?: string): number {
  const normalizedQuery = normalizeText(query);
  const normalizedPlayer = normalizeText(player.fullName);
  let score = 0;

  if (normalizedPlayer === normalizedQuery) {
    score += 150;
  } else if (normalizedPlayer.startsWith(normalizedQuery)) {
    score += 100;
  } else if (normalizedPlayer.includes(normalizedQuery)) {
    score += 70;
  }

  if (teamKey && player.teamAbbr?.toUpperCase() === teamKey.toUpperCase()) {
    score += 35;
  }

  if (player.teamAbbr) {
    score += 10;
  }
  if (player.position) {
    score += 5;
  }

  return score;
}

async function findBestApiSportsPlayerMatch(
  query: string,
  args?: { teamKey?: string; dataMode?: DataMode; cacheBust?: string },
): Promise<{ data: ApiSportsPlayerSearchResult | null; meta: Meta }> {
  const response = await searchApiSportsPlayers("nba", query, 8, toApiSportsMode(args?.dataMode ?? "auto"), args?.cacheBust);
  const ranked = [...(response.data ?? [])].sort((left, right) => {
    return playerSearchScore(query, right, args?.teamKey) - playerSearchScore(query, left, args?.teamKey);
  });

  return {
    data: ranked[0] ?? null,
    meta: response.meta,
  };
}

function playerFullName(player: BallDontLiePlayer): string {
  return `${player.first_name} ${player.last_name}`.trim();
}

function parseMinutes(raw: string | undefined): number {
  if (!raw) {
    return 0;
  }
  if (raw.includes(":")) {
    const [minutes, seconds] = raw.split(":").map((part) => Number(part));
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return 0;
    }
    return minutes + seconds / 60;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function trendFromDelta(recent: number, baseline: number, threshold: number): TrendSignal {
  if (recent >= baseline + threshold) {
    return "up";
  }
  if (recent <= baseline - threshold) {
    return "down";
  }
  return "steady";
}

function averageStat(rows: BallDontLiePlayerStat[], pick: (row: BallDontLiePlayerStat) => number): number {
  return averageOf(rows.map(pick));
}

function roleFromLiveProfile(player: BallDontLiePlayer, stats: BallDontLiePlayerStat[]): { role: string; archetype: string } {
  const position = (player.position ?? "").toUpperCase();
  const seasonAst = averageStat(stats, (row) => row.ast);
  const seasonPts = averageStat(stats, (row) => row.pts);
  const seasonReb = averageStat(stats, (row) => row.reb);

  if ((position.includes("PG") || position === "G") && seasonAst >= 6) {
    return {
      role: "Lead guard",
      archetype: "Primary organizer who creates the first advantage and carries the passing load",
    };
  }
  if (position.includes("C") || seasonReb >= 9) {
    return {
      role: "Interior anchor",
      archetype: "Paint finisher, rebound stabilizer, and interior volume source",
    };
  }
  if (seasonPts >= 20) {
    return {
      role: "Primary scorer",
      archetype: "High-volume scoring option whose role is shaped by shot creation and usage",
    };
  }
  if (seasonAst >= 4) {
    return {
      role: "Connector creator",
      archetype: "Secondary organizer who keeps the offense flowing without owning every trip",
    };
  }
  return {
    role: "Rotation scorer",
    archetype: "Supporting piece whose minutes and scoring load move with lineup need",
  };
}

function roleFromPositionOnly(player: BallDontLiePlayer): { role: string; archetype: string } {
  const position = (player.position ?? "").toUpperCase();
  if (position.includes("PG") || position === "G") {
    return {
      role: "Guard rotation context",
      archetype: "Backcourt role read based on roster position only until live game stats are enabled",
    };
  }
  if (position.includes("C")) {
    return {
      role: "Frontcourt anchor context",
      archetype: "Interior role read based on roster position only until live game stats are enabled",
    };
  }
  return {
    role: "Wing / forward context",
    archetype: "Wing/forward role read based on roster position only until live game stats are enabled",
  };
}

function roleFromPositionValue(positionRaw?: string): { role: string; archetype: string } {
  const position = (positionRaw ?? "").toUpperCase();
  if (position.includes("PG") || position === "G") {
    return {
      role: "Guard rotation context",
      archetype: "Backcourt role read based on roster position only until live game stats are enabled",
    };
  }
  if (position.includes("C")) {
    return {
      role: "Frontcourt anchor context",
      archetype: "Interior role read based on roster position only until live game stats are enabled",
    };
  }
  return {
    role: "Wing / forward context",
    archetype: "Wing/forward role read based on roster position only until live game stats are enabled",
  };
}

async function resolveApiSportsTeamMatchupProfile(
  base: { data: TeamMatchupDemoData; meta: Meta },
  dataMode: DataMode,
  cacheBust?: string,
): Promise<{ data: TeamMatchupDemoData; meta: Meta }> {
  const response = await getApiSportsTeamsAdvanced(
    "nba",
    [
      { teamKey: base.data.away.key, teamName: base.data.away.name },
      { teamKey: base.data.home.key, teamName: base.data.home.name },
    ],
    "advanced",
    toApiSportsMode(dataMode),
    cacheBust,
  );

  const away = pickTeamByKey(response.data?.teams, base.data.away.key);
  const home = pickTeamByKey(response.data?.teams, base.data.home.key);
  if (!away || !home || !hasMeaningfulTeamContext(away) || !hasMeaningfulTeamContext(home)) {
    throw new Error("API-Sports could not resolve both matchup teams.");
  }

  const awayIdentity = dedupe([base.data.away.identity, formatStandingsContext(away)]).join(" | ");
  const homeIdentity = dedupe([base.data.home.identity, formatStandingsContext(home)]).join(" | ");
  const awayRecord = formatRecordString(away.record);
  const homeRecord = formatRecordString(home.record);
  const awayLastGame = away.lastGame?.when && away.lastGame?.vs
    ? `${formatDateLabel(away.lastGame.when)} ${away.lastGame.result ?? ""} vs ${away.lastGame.vs}`.trim()
    : undefined;
  const homeLastGame = home.lastGame?.when && home.lastGame?.vs
    ? `${formatDateLabel(home.lastGame.when)} ${home.lastGame.result ?? ""} vs ${home.lastGame.vs}`.trim()
    : undefined;
  const meetingContext = away.nextGame?.vs && seemsTeamKey(away.nextGame.vs) === home.teamKey
    ? `${away.teamKey} has the next tracked meeting on ${formatDateLabel(away.nextGame.when ?? "")}.`
    : awayLastGame && homeLastGame
      ? `Recent schedule context: ${away.teamKey} last saw ${away.lastGame?.vs ?? "-"} on ${formatDateLabel(away.lastGame?.when ?? "")}, while ${home.teamKey} last saw ${home.lastGame?.vs ?? "-"} on ${formatDateLabel(home.lastGame?.when ?? "")}.`
      : "API-Sports is providing live team context, while the matchup pillars remain scaffolded.";

  return {
    data: {
      ...base.data,
      matchup: `${away.teamName ?? base.data.away.name} at ${home.teamName ?? base.data.home.name}`,
      context: `API-Sports NBA is supplying the live team context for this matchup. The pillar board remains scaffolded until team split data is connected cleanly.`,
      beginnerSummary:
        `${away.teamName ?? base.data.away.name} enters ${awayRecord}. ${home.teamName ?? base.data.home.name} enters ${homeRecord}. `
        + "The live layer is updating record and schedule context, while the teaching pillars stay scaffolded.",
      advancedSummary:
        `${away.teamKey} context: ${formatStandingsContext(away) ?? "standings context limited"}. `
        + `${home.teamKey} context: ${formatStandingsContext(home) ?? "standings context limited"}. `
        + "The pillar board is still scaffolded because API-Sports is not giving this widget a clean shot-profile / turnover split feed.",
      away: {
        ...base.data.away,
        key: away.teamKey,
        name: away.teamName ?? base.data.away.name,
        record: awayRecord,
        identity: awayIdentity || base.data.away.identity,
      },
      home: {
        ...base.data.home,
        key: home.teamKey,
        name: home.teamName ?? base.data.home.name,
        record: homeRecord,
        identity: homeIdentity || base.data.home.identity,
      },
      swingFactor: {
        title: "Live team context, scaffolded pillars",
        summary: meetingContext,
      },
      sourceState: "hybrid",
      sourceLabel: "Hybrid live matchup board",
      sourceDetail: "Team records, standings, and last/next game context are live from API-Sports NBA. The pillar board is still scaffolded because richer team split data is not wired cleanly.",
      teachingPoints: dedupe([
        ...base.data.teachingPoints,
        "API-Sports can strengthen the live team context even when the deeper matchup pillars are still scaffolded.",
        ...(awayLastGame ? [`${away.teamKey} last game: ${awayLastGame}.`] : []),
        ...(homeLastGame ? [`${home.teamKey} last game: ${homeLastGame}.`] : []),
      ]),
    },
    meta: mergeMeta([response.meta], {
      notes: [
        "API-Sports NBA provided the live team record and schedule context for this matchup.",
        "Matchup pillar cards remain scaffolded because deeper team split data is still unavailable.",
      ],
      hydrationUsed: true,
    }),
  };
}

async function resolveApiSportsRestScheduleSpot(
  base: { data: RestScheduleDemoData; meta: Meta },
  teamKey: string,
  dataMode: DataMode,
  cacheBust?: string,
): Promise<{ data: RestScheduleDemoData; meta: Meta }> {
  const teamResponse = await getApiSportsTeamsAdvanced("nba", [teamKey], "advanced", toApiSportsMode(dataMode), cacheBust);
  const team = pickTeamByKey(teamResponse.data?.teams, teamKey);
  if (!team || !hasMeaningfulTeamContext(team)) {
    throw new Error(`API-Sports could not resolve team ${teamKey}.`);
  }

  const opponentKey = seemsTeamKey(team.nextGame?.vs);
  const opponentResponse = opponentKey
    ? await getApiSportsTeamsAdvanced("nba", [opponentKey], "advanced", toApiSportsMode(dataMode), cacheBust)
    : null;
  const opponent = opponentKey ? pickTeamByKey(opponentResponse?.data?.teams, opponentKey) : null;

  const teamRest = scheduleRestDays(team.lastGame?.when, team.nextGame?.when);
  const opponentRest = scheduleRestDays(opponent?.lastGame?.when, opponent?.nextGame?.when);
  const restEdge = typeof teamRest === "number" && typeof opponentRest === "number"
    ? compareAdvantage(teamRest, opponentRest)
    : "even";

  if (!team.nextGame?.when) {
    return {
      data: {
        ...base.data,
        team: {
          key: team.teamKey,
          name: team.teamName ?? base.data.team.name,
          record: formatRecordString(team.record),
        },
        opponent: {
          key: opponent?.teamKey ?? "-",
          name: opponent?.teamName ?? "No upcoming opponent",
          record: opponent ? formatRecordString(opponent.record) : "Schedule not posted",
        },
        spotLabel: "Sparse live schedule",
        signal: "neutral",
        context: `API-Sports NBA resolved ${team.teamName ?? team.teamKey}, but there is no posted next game in the current schedule window.`,
        beginnerSummary: `${team.teamName ?? team.teamKey} has no posted next game right now, so this card stays on last-known schedule context instead of inventing a matchup edge.`,
        advancedSummary:
          `${team.teamKey} is ${formatRecordString(team.record)}. API-Sports can confirm the team's recent schedule state, but there is no posted next game to support a real rest-vs-opponent comparison.`,
        factors: [
          {
            label: "Schedule status",
            teamValue: "No next game posted",
            opponentValue: team.lastGame?.when ? `Last game ${formatDateLabel(team.lastGame.when)}` : "Recent game unavailable",
            edge: "even",
            takeaway: "There is no trustworthy next-game rest spot to compare right now.",
            whyItMatters: "A schedule widget should stay explicit when the next opponent window is missing.",
          },
          {
            label: "Standings context",
            teamValue: formatStandingsContext(team) ?? formatRecordString(team.record),
            opponentValue: opponent ? (formatStandingsContext(opponent) ?? formatRecordString(opponent.record)) : "Opponent unavailable",
            edge: "even",
            takeaway: "The live layer can still confirm the team's current context without pretending a rest edge exists.",
            whyItMatters: "Sparse windows are a real NBA product state, especially around schedule gaps and offseason edges.",
          },
        ],
        recentWindow: [{
          dateLabel: team.lastGame?.when ? formatDateLabel(team.lastGame.when) : "Waiting",
          site: team.nextGame?.homeAway === "away" ? "@" as const : "vs" as const,
          opponent: team.lastGame?.vs ?? "-",
          result: team.lastGame?.result ? `${team.lastGame.result} ${team.lastGame.score ?? ""}`.trim() : undefined,
          note: "Last known API-Sports NBA schedule context.",
        }],
        nextWindow: [{
          dateLabel: "Waiting",
          site: "vs" as const,
          opponent: "-",
          note: "No upcoming NBA game is posted on the current API-Sports fallback path.",
        }],
        teachingPoints: [
          "API-Sports can confirm live team context even when the next-game window is still sparse.",
          "A sparse live state is more trustworthy than swapping to a confident demo matchup without telling the user.",
        ],
        sourceState: "partial",
        sourceLabel: "Partial live schedule context",
        sourceDetail: "API-Sports NBA confirmed the team's current schedule state, but there is no posted next game to support a full rest-vs-opponent comparison.",
      },
      meta: mergeMeta([teamResponse.meta], {
        notes: [
          "API-Sports NBA provided the fallback schedule context after BALLDONTLIE was unavailable.",
        ],
        hydrationUsed: true,
      }),
    };
  }

  const signal = restEdge === "team" ? "positive" : restEdge === "opponent" ? "warning" : "neutral";
  return {
    data: {
      ...base.data,
      team: {
        key: team.teamKey,
        name: team.teamName ?? base.data.team.name,
        record: formatRecordString(team.record),
      },
      opponent: {
        key: opponent?.teamKey ?? (opponentKey ?? "-"),
        name: opponent?.teamName ?? (team.nextGame?.vs ?? "Upcoming opponent"),
        record: opponent ? formatRecordString(opponent.record) : "Opponent record unavailable",
      },
      spotLabel: typeof teamRest === "number" && typeof opponentRest === "number"
        ? (restEdge === "team" ? "Rest edge" : restEdge === "opponent" ? "Stress spot" : "Neutral rest")
        : "Schedule context",
      signal,
      context: `API-Sports NBA fallback resolved the next game for ${team.teamName ?? team.teamKey} on ${formatDateLabel(team.nextGame.when)}.`,
      beginnerSummary:
        typeof teamRest === "number" && typeof opponentRest === "number"
          ? `${team.teamName ?? team.teamKey} has ${teamRest} day(s) off before ${team.nextGame.vs ?? "the next game"}, while the opponent is at ${opponentRest} day(s).`
          : `${team.teamName ?? team.teamKey} has a posted next game on ${formatDateLabel(team.nextGame.when)}, but the fallback path cannot support the full rest-density-travel read.`,
      advancedSummary:
        `${team.teamKey} next game: ${team.nextGame.homeAway === "away" ? "@" : "vs"} ${team.nextGame.vs ?? "-"}. `
        + `Last game: ${team.lastGame?.result ?? "-"} ${team.lastGame?.score ?? ""}`.trim()
        + ". This is an API-Sports fallback view, so rest is grounded where dates exist, but density and travel remain limited.",
      factors: [
        {
          label: "Rest days",
          teamValue: typeof teamRest === "number" ? `${teamRest} day${teamRest === 1 ? "" : "s"} off` : "Unavailable",
          opponentValue: typeof opponentRest === "number" ? `${opponentRest} day${opponentRest === 1 ? "" : "s"} off` : "Unavailable",
          edge: restEdge,
          takeaway:
            restEdge === "team"
              ? `${team.teamKey} has the cleaner layoff on the API-Sports fallback path.`
              : restEdge === "opponent"
                ? `${opponent?.teamKey ?? "Opponent"} has the cleaner layoff on the fallback path.`
                : "The fallback path does not show a strong rest edge.",
          whyItMatters: "Rest can still be grounded from last-game and next-game dates even when deeper schedule modeling is unavailable.",
        },
        {
          label: "Last game",
          teamValue: team.lastGame?.when ? `${formatDateLabel(team.lastGame.when)} ${team.lastGame.result ?? ""}`.trim() : "Unavailable",
          opponentValue: opponent?.lastGame?.when ? `${formatDateLabel(opponent.lastGame.when)} ${opponent.lastGame.result ?? ""}`.trim() : "Unavailable",
          edge: "even",
          takeaway: "Last-game timing helps explain how much true recovery time each side had.",
          whyItMatters: "Fallback schedule reads are stronger when they stay anchored to posted game dates instead of guessing travel or fatigue.",
        },
        {
          label: "Standings context",
          teamValue: formatStandingsContext(team) ?? formatRecordString(team.record),
          opponentValue: opponent ? (formatStandingsContext(opponent) ?? formatRecordString(opponent.record)) : "Opponent unavailable",
          edge: "even",
          takeaway: "The fallback layer can still ground team context even when the full BALLDONTLIE schedule model is unavailable.",
          whyItMatters: "Schedule spots are easier to interpret when you also know the baseline team context.",
        },
      ],
      recentWindow: [{
        dateLabel: team.lastGame?.when ? formatDateLabel(team.lastGame.when) : "Waiting",
        site: team.nextGame?.homeAway === "away" ? "@" as const : "vs" as const,
        opponent: team.lastGame?.vs ?? "-",
        result: team.lastGame?.result ? `${team.lastGame.result} ${team.lastGame.score ?? ""}`.trim() : undefined,
        note: "Last known API-Sports NBA schedule context.",
      }],
      nextWindow: [{
        dateLabel: formatDateLabel(team.nextGame.when),
        site: team.nextGame.homeAway === "away" ? "@" as const : "vs" as const,
        opponent: team.nextGame.vs ?? "-",
        note: "Upcoming game from the API-Sports NBA fallback path.",
      }],
      teachingPoints: [
        "API-Sports fallback can still anchor next-game timing and basic rest without pretending to know more than the dates support.",
        "When BALLDONTLIE is unavailable, the right fallback is partial live schedule context, not a silent jump to demo.",
      ],
      sourceState: "partial",
      sourceLabel: "Partial live schedule context",
      sourceDetail: "API-Sports NBA is supplying the fallback next-game and team-context read. Rest can be grounded from posted dates, but density and travel remain limited on this path.",
    },
    meta: mergeMeta([teamResponse.meta, ...(opponentResponse ? [opponentResponse.meta] : [])], {
      notes: [
        "API-Sports NBA provided the fallback schedule context after BALLDONTLIE was unavailable.",
      ],
      hydrationUsed: true,
    }),
  };
}

async function resolveApiSportsPlayerRoleForm(
  base: { data: PlayerRoleFormDemoData; meta: Meta },
  args: { playerName: string; playerTeamKey?: string; dataMode: DataMode; cacheBust?: string },
): Promise<{ data: PlayerRoleFormDemoData; meta: Meta }> {
  const playerMatch = await findBestApiSportsPlayerMatch(args.playerName, {
    teamKey: args.playerTeamKey,
    dataMode: args.dataMode,
    cacheBust: args.cacheBust,
  });

  if (!playerMatch.data) {
    throw new Error(`API-Sports NBA did not return a player match for '${args.playerName}'.`);
  }

  const livePlayer = playerMatch.data;
  const insightsResponse = await getApiSportsPlayerInsights(
    "nba",
    livePlayer.playerId,
    "advanced",
    toApiSportsMode(args.dataMode),
    args.cacheBust,
  );
  const insights: PlayerInsights | null = insightsResponse.data;
  const position = livePlayer.position ?? base.data.player.position;
  const fallbackRole = roleFromPositionValue(position);
  const seasonMetrics = insights?.season?.metrics ?? [];
  const recentGames = (insights?.recent?.games ?? []).slice(0, 3);

  return {
    data: {
      ...base.data,
      player: {
        fullName: insights?.fullName ?? livePlayer.fullName,
        teamKey: insights?.teamAbbrev ?? livePlayer.teamAbbr ?? args.playerTeamKey ?? base.data.player.teamKey,
        teamName: insights?.teamName ?? livePlayer.teamName ?? base.data.player.teamName,
        position,
        role: fallbackRole.role,
        archetype: fallbackRole.archetype,
      },
      form: recentGames.length > 0 ? "steady" : "steady",
      context: `API-Sports NBA confirmed ${insights?.fullName ?? livePlayer.fullName} and provided season-level player context for this fallback live read.`,
      beginnerSummary:
        `${insights?.fullName ?? livePlayer.fullName} is being shown through an API-Sports fallback live profile. `
        + "Identity and season context are grounded, but this path does not claim a full recent-form model unless recent game data is actually present.",
      advancedSummary:
        `${insights?.fullName ?? livePlayer.fullName} is on ${insights?.teamName ?? livePlayer.teamName ?? "an NBA roster"}. `
        + `${insights?.season?.headline ?? "Season metric detail is limited on the current fallback path."} `
        + (recentGames.length > 0
          ? "Recent game context is present, but this still is not a deeper role-modeling layer."
          : "Recent game context is not available on this fallback path, so the widget stays partial instead of implying live form certainty."),
      metrics: seasonMetrics.slice(0, 3).map((metric) => ({
        label: metric.label,
        seasonValue: metric.value,
        recentValue: insights?.recent?.headline ?? "Recent split unavailable",
        trend: "steady" as const,
        takeaway: "API-Sports is supplying season context here, not a full recent-role model.",
      })).concat(seasonMetrics.length >= 3 ? [] : [{
        label: "Live data status",
        seasonValue: insights?.season?.headline ?? "Season context limited",
        recentValue: recentGames.length > 0 ? "Recent games available" : "Recent games unavailable",
        trend: "steady" as const,
        takeaway: "This fallback path keeps the player card live-backed without overstating recent-form precision.",
      }]).slice(0, 3),
      roleSignals: [
        {
          label: "Roster context",
          value: fallbackRole.role,
          explanation: "The fallback role tag stays grounded in position and live identity rather than pretending deeper role modeling exists.",
        },
        {
          label: "Team",
          value: insights?.teamAbbrev ?? livePlayer.teamAbbr ?? args.playerTeamKey ?? "-",
          explanation: "API-Sports still confirms the current team context for this player.",
        },
        {
          label: "Data shape",
          value: recentGames.length > 0 ? "Season + recent context" : "Season context only",
          explanation: "This widget only claims the recent-form layer when upstream recent-game data is actually present.",
        },
      ],
      recentGames: recentGames.map((game) => ({
        dateLabel: game.date ? formatDateLabel(game.date) : "Recent",
        opponent: game.opponent ?? "-",
        line: game.line,
        roleNote: "Recent game context from the API-Sports NBA fallback path.",
      })),
      teachingPoints: [
        "A live player card can still be useful when it stays honest about whether it has season context, recent context, or both.",
        "Fallback live data should downgrade confidence before it downgrades truthfulness.",
      ],
      sourceState: recentGames.length > 0 ? "hybrid" : "partial",
      sourceLabel: recentGames.length > 0 ? "Hybrid live player context" : "Partial live player context",
      sourceDetail: recentGames.length > 0
        ? "API-Sports NBA confirmed the player, team, season context, and a limited recent-game layer. This is still not a full box-score trend model."
        : "API-Sports NBA confirmed the player identity and season context, but recent game data remains limited. This stays a partial live read instead of implying a full recent-form model.",
    },
    meta: mergeMeta([playerMatch.meta, insightsResponse.meta], {
      notes: [
        "API-Sports NBA provided the fallback player identity and season-context layer after BALLDONTLIE was unavailable or incomplete.",
      ],
      hydrationUsed: true,
    }),
  };
}

async function resolveLiveTeamMatchupProfile(
  base: { data: TeamMatchupDemoData; meta: Meta },
  dataMode: DataMode,
  cacheBust?: string,
): Promise<{ data: TeamMatchupDemoData; meta: Meta }> {
  const teamsResponse = await getNbaTeams(dataMode, cacheBust);
  const awayTeam = matchBallDontLieTeam(teamsResponse.data, base.data.away.key);
  const homeTeam = matchBallDontLieTeam(teamsResponse.data, base.data.home.key);

  if (!awayTeam || !homeTeam) {
    return withDemoFallback(base, {
      warning: "Live matchup enrichment could not map both NBA teams, so the widget stayed on the demo matchup board.",
      notes: ["BALLDONTLIE team lookup failed for one or both matchup teams."],
    });
  }

  const season = currentNbaSeason();
  let awaySeason: { data: BallDontLieGame[]; meta: Meta };
  let homeSeason: { data: BallDontLieGame[]; meta: Meta };
  try {
    [awaySeason, homeSeason] = await Promise.all([
      getNbaTeamSeasonGames(awayTeam.id, season, dataMode, cacheBust),
      getNbaTeamSeasonGames(homeTeam.id, season, dataMode, cacheBust),
    ]);
  } catch {
    return {
      data: {
        ...base.data,
        away: { ...base.data.away, key: awayTeam.abbreviation, name: awayTeam.full_name, record: "Record unavailable" },
        home: { ...base.data.home, key: homeTeam.abbreviation, name: homeTeam.full_name, record: "Record unavailable" },
        context: `${awayTeam.full_name} and ${homeTeam.full_name} were confirmed via BALLDONTLIE, but game record data was temporarily unavailable.`,
        beginnerSummary: `Both teams were confirmed as valid NBA teams, but season record data could not be loaded right now. Try refreshing in a moment.`,
        advancedSummary: `${awayTeam.abbreviation} and ${homeTeam.abbreviation} confirmed via BALLDONTLIE. Record and form data unavailable — game schedule endpoint was unreachable at this time.`,
        sourceState: "partial",
        sourceLabel: "Live team identity, records unavailable",
        sourceDetail: "Team identities confirmed via BALLDONTLIE. Season record and form data could not be loaded at this time.",
      },
      meta: mergeMeta([teamsResponse.meta], {
        warning: `${awayTeam.abbreviation} and ${homeTeam.abbreviation} confirmed but game record data was unavailable from BALLDONTLIE.`,
      }),
    };
  }

  const awayRecord = buildRecord(awaySeason.data, awayTeam.id);
  const homeRecord = buildRecord(homeSeason.data, homeTeam.id);
  const awayLast10 = buildRecord(awaySeason.data, awayTeam.id, 10);
  const homeLast10 = buildRecord(homeSeason.data, homeTeam.id, 10);
  const awayMargin = averageMargin(awaySeason.data, awayTeam.id, 10);
  const homeMargin = averageMargin(homeSeason.data, homeTeam.id, 10);
  const awayPoints = averagePoints(awaySeason.data, awayTeam.id, 10);
  const homePoints = averagePoints(homeSeason.data, homeTeam.id, 10);
  const headToHead = awaySeason.data.find((game) => {
    const opponent = opponentForTeam(game, awayTeam.id);
    return opponent.id === homeTeam.id && !isFinal(game);
  }) ?? awaySeason.data
    .filter((game) => {
      const opponent = opponentForTeam(game, awayTeam.id);
      return opponent.id === homeTeam.id && isFinal(game);
    })
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())[0];

  const context = headToHead
    ? `Live records and recent form are pulled from BALLDONTLIE. ${awayTeam.abbreviation} and ${homeTeam.abbreviation} also have a scheduled or recent head-to-head marker on ${formatDateLabel(headToHead.date)}.`
    : "Live records and recent form are pulled from BALLDONTLIE. The matchup pillars below remain a teachable scaffold until richer team split data is wired in.";

  return {
    data: {
      ...base.data,
      context,
      beginnerSummary:
        `${awayTeam.full_name} enters ${awayRecord} overall and ${awayLast10} over the last 10 games. `
        + `${homeTeam.full_name} is ${homeRecord} overall and ${homeLast10} over the same window. `
        + "The live layer updates team form context; the pillar cards stay focused on the teaching angle.",
      advancedSummary:
        `${awayTeam.abbreviation} carries a ${formatSigned(awayMargin)} average margin and ${awayPoints.toFixed(1)} points per game over its last 10. `
        + `${homeTeam.abbreviation} sits at ${formatSigned(homeMargin)} and ${homePoints.toFixed(1)}. `
        + "The possession-pillar board remains scaffolded because the current BALLDONTLIE path does not expose team shot-profile splits cleanly.",
      away: {
        ...base.data.away,
        key: awayTeam.abbreviation,
        name: awayTeam.full_name,
        record: awayRecord,
        identity: `${base.data.away.identity} · ${awayLast10} last 10`,
      },
      home: {
        ...base.data.home,
        key: homeTeam.abbreviation,
        name: homeTeam.full_name,
        record: homeRecord,
        identity: `${base.data.home.identity} · ${homeLast10} last 10`,
      },
      swingFactor: headToHead
        ? {
            title: `Recent meeting marker: ${formatDateLabel(headToHead.date)}`,
            summary: isFinal(headToHead)
              ? `The latest tracked meeting ended ${teamScore(headToHead, awayTeam.id)}-${opponentScore(headToHead, awayTeam.id)} for ${awayTeam.abbreviation}. Use it as context, not a full predictive answer.`
              : `The next tracked meeting lands on ${formatDateLabel(headToHead.date)}. Current records and last-10 form help frame the spot before richer team split data is connected.`,
          }
        : {
            ...base.data.swingFactor,
            summary: `${base.data.swingFactor.summary} Live form context: ${awayTeam.abbreviation} ${awayLast10} last 10, ${homeTeam.abbreviation} ${homeLast10} last 10.`,
          },
      sourceState: "hybrid",
      sourceLabel: "Hybrid live matchup board",
      sourceDetail: "Team records, recent form, and meeting context are live from BALLDONTLIE. The pillar board is still scaffolded because deeper team split data is not connected yet.",
      teachingPoints: dedupe([
        ...base.data.teachingPoints,
        "This live pass updates team records and recent form, but the matchup pillars remain scaffolded until team-level shot and turnover splits are connected.",
      ]),
    },
    meta: mergeMeta([teamsResponse.meta, awaySeason.meta, homeSeason.meta], {
      notes: [
        "Live team records and recent-form context are sourced from BALLDONTLIE.",
        "Matchup pillar cards remain scaffolded because deeper team split data is not wired yet.",
      ],
      hydrationUsed: true,
    }),
  };
}

async function resolveLiveRestScheduleSpot(
  base: { data: RestScheduleDemoData; meta: Meta },
  teamKey: string,
  dataMode: DataMode,
  cacheBust?: string,
): Promise<{ data: RestScheduleDemoData; meta: Meta }> {
  const teamLookup = await findNbaTeamByKey(teamKey, dataMode, cacheBust);
  if (!teamLookup.data) {
    return withDemoFallback(base, {
      warning: `Unknown NBA team key '${teamKey.toUpperCase()}'. Showing the demo schedule spot instead.`,
      notes: ["BALLDONTLIE team lookup failed for the requested rest/schedule widget team."],
    });
  }

  const teamInfo = teamLookup.data;
  const season = currentNbaSeason();
  let teamSeason: { data: BallDontLieGame[]; meta: Meta };
  try {
    teamSeason = await getNbaTeamSeasonGames(teamInfo.id, season, dataMode, cacheBust);
  } catch {
    teamSeason = { data: [], meta: teamLookup.meta };
  }
  const nextGame = upcomingGames(teamSeason.data)[0] ?? null;
  if (!nextGame) {
    const recentCompleted = completedGames(teamSeason.data)
      .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())
      .slice(0, 3);
    const teamRecord = buildRecord(teamSeason.data, teamInfo.id);

    return {
      data: {
        ...base.data,
        team: {
          key: teamInfo.abbreviation,
          name: teamInfo.full_name,
          record: recentCompleted.length > 0 ? teamRecord : "No completed games found",
        },
        opponent: {
          key: "-",
          name: "No upcoming opponent",
          record: recentCompleted.length > 0 ? "Schedule not posted" : "No live sample",
        },
        spotLabel: recentCompleted.length > 0 ? "No upcoming game" : "Sparse live schedule",
        signal: "neutral",
        context: `Live schedule lookup found ${teamInfo.full_name}, but no upcoming NBA game is posted in the current BALLDONTLIE season window.`,
        beginnerSummary: recentCompleted.length > 0
          ? `${teamInfo.full_name} has no upcoming game posted right now, so this card shifts from matchup prep to last-known schedule context.`
          : `${teamInfo.full_name} has no upcoming game and no recent live sample in the current season window, so there is no trustworthy rest edge to show.`,
        advancedSummary: recentCompleted.length > 0
          ? `${teamInfo.abbreviation} is ${teamRecord} in the current live season sample, but BALLDONTLIE does not show a next scheduled game right now. Use the recent cadence below instead of reading this as a matchup edge.`
          : `BALLDONTLIE resolved ${teamInfo.abbreviation}, but the current season window does not include a recent or upcoming game sample. The widget stays honest by showing a sparse live state instead of a fake opponent board.`,
        factors: [
          {
            label: "Schedule status",
            teamValue: recentCompleted.length > 0 ? "No next game posted" : "No live game sample",
            opponentValue: recentCompleted.length > 0 ? "Recent team context only" : "Not enough live context",
            edge: "even",
            takeaway: "There is no live next-game spot to compare right now.",
            whyItMatters: "A schedule widget should not pretend to have a rest edge when the next opponent or next game window is missing.",
          },
          {
            label: "Current sample",
            teamValue: recentCompleted.length > 0 ? `${recentCompleted.length} recent finals` : "0 recent finals",
            opponentValue: recentCompleted.length > 0 ? teamRecord : "No current record",
            edge: "even",
            takeaway: recentCompleted.length > 0
              ? "The most recent finished games still provide cadence context."
              : "The live sample is too thin to support a matchup-style schedule read.",
            whyItMatters: "Sparse windows happen in offseason and schedule gaps, so the fallback state needs to be explicit.",
          },
        ],
        recentWindow: recentCompleted.length > 0
          ? recentCompleted
            .slice()
            .reverse()
            .map((game) => ({
              dateLabel: formatDateLabel(game.date),
              site: teamSide(game, teamInfo.id) === "home" ? "vs" as const : "@" as const,
              opponent: opponentForTeam(game, teamInfo.id).abbreviation,
              result: `${teamScore(game, teamInfo.id) > opponentScore(game, teamInfo.id) ? "W" : "L"} ${teamScore(game, teamInfo.id)}-${opponentScore(game, teamInfo.id)}`,
              note: "Last known live game in the current season window.",
            }))
          : [{
              dateLabel: "No games",
              site: "vs" as const,
              opponent: "-",
              note: "No completed games were returned in the current live season window.",
            }],
        nextWindow: [{
          dateLabel: "Waiting",
          site: "vs" as const,
          opponent: "-",
          note: "No upcoming NBA game is posted for this team on the current live path.",
        }],
        teachingPoints: [
          "A missing next game is a real product state, not a signal to fake a rest edge.",
          "When the live schedule is sparse, the safest read is to show the last known cadence and explain the gap clearly.",
        ],
        sourceState: "partial",
        sourceLabel: "Live sparse schedule state",
        sourceDetail: "This card is using live BALLDONTLIE team schedule data, but there is no upcoming game posted right now. It shows last-known cadence instead of a fake matchup edge.",
      },
      meta: mergeMeta([teamLookup.meta, teamSeason.meta], {
        warning: `No upcoming NBA game was found for ${teamInfo.abbreviation}. Showing an explicit sparse-schedule state instead of a demo matchup board.`,
        notes: [
          "BALLDONTLIE resolved the team successfully, but no upcoming game was returned in the current season window.",
          "The widget is intentionally rendering a sparse live state rather than switching to a fake opponent scenario.",
        ],
      }),
    };
  }

  const opponent = opponentForTeam(nextGame, teamInfo.id);
  let opponentSeason: { data: BallDontLieGame[]; meta: Meta };
  try {
    opponentSeason = await getNbaTeamSeasonGames(opponent.id, season, dataMode, cacheBust);
  } catch {
    opponentSeason = { data: [], meta: teamLookup.meta };
  }
  const previousTeamGame = completedGames(teamSeason.data)
    .filter((game) => new Date(game.datetime ?? game.date).getTime() < new Date(nextGame.datetime ?? nextGame.date).getTime())
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())[0] ?? null;
  const previousOpponentGame = completedGames(opponentSeason.data)
    .filter((game) => new Date(game.datetime ?? game.date).getTime() < new Date(nextGame.datetime ?? nextGame.date).getTime())
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())[0] ?? null;

  const teamRestDays = restDaysBeforeGame(previousTeamGame, nextGame);
  const opponentRestDays = restDaysBeforeGame(previousOpponentGame, nextGame);
  const teamCountInFour = gamesInWindow(teamSeason.data, nextGame.date, 4);
  const opponentCountInFour = gamesInWindow(opponentSeason.data, nextGame.date, 4);
  const teamCountInSeven = gamesInWindow(teamSeason.data, nextGame.date, 7);
  const opponentCountInSeven = gamesInWindow(opponentSeason.data, nextGame.date, 7);
  const teamTravel = travelDescriptor(previousTeamGame, nextGame, teamInfo.id);
  const opponentTravel = travelDescriptor(previousOpponentGame, nextGame, opponent.id);

  const restEdge = compareAdvantage(teamRestDays, opponentRestDays);
  const densityEdge = compareAdvantage(teamCountInFour, opponentCountInFour, true);
  const travelEdge = compareAdvantage(teamTravel.stressScore, opponentTravel.stressScore, true);
  const score = [restEdge, densityEdge, travelEdge].reduce((total, edge) => {
    if (edge === "team") return total + 1;
    if (edge === "opponent") return total - 1;
    return total;
  }, 0);

  const signal = score >= 2 ? "positive" : score <= -2 ? "warning" : "neutral";
  const spotLabel = signal === "positive"
    ? "Rest edge"
    : signal === "warning"
      ? teamCountInFour >= 3
        ? "Dense stretch"
        : "Stress spot"
      : "Neutral rest";
  const sitePrefix = teamSide(nextGame, teamInfo.id) === "home" ? "vs" : "@";
  const teamRecord = buildRecord(teamSeason.data, teamInfo.id);
  const opponentRecord = buildRecord(opponentSeason.data, opponent.id);

  const recentCompleted = completedGames(teamSeason.data)
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())
    .slice(0, 2)
    .reverse();
  const upcomingTeamGames = upcomingGames(teamSeason.data);

  return {
    data: {
      ...base.data,
      team: {
        key: teamInfo.abbreviation,
        name: teamInfo.full_name,
        record: teamRecord,
      },
      opponent: {
        key: opponent.abbreviation,
        name: opponent.full_name,
        record: opponentRecord,
      },
      spotLabel,
      signal,
      context: `Live schedule read for ${teamInfo.full_name}. The featured spot is ${sitePrefix} ${opponent.full_name} on ${formatDateLabel(nextGame.date)}.`,
      beginnerSummary:
        signal === "positive"
          ? `${teamInfo.full_name} has the cleaner rest setup than ${opponent.full_name}, with ${teamRestDays} day(s) off versus ${opponentRestDays}.`
          : signal === "warning"
            ? `${teamInfo.full_name} is in the tougher schedule spot than ${opponent.full_name}, so fatigue risk matters more than usual.`
            : `This looks like a more balanced schedule spot. Neither side owns a strong rest or travel edge going into ${formatDateLabel(nextGame.date)}.`,
      advancedSummary:
        `${teamInfo.abbreviation} enters on ${teamRestDays} rest day(s), ${densityLabel(teamCountInFour, teamCountInSeven).toLowerCase()}, and a '${teamTravel.label.toLowerCase()}' travel path. `
        + `${opponent.abbreviation} is at ${opponentRestDays} rest day(s), ${densityLabel(opponentCountInFour, opponentCountInSeven).toLowerCase()}, and '${opponentTravel.label.toLowerCase()}'.`,
      factors: [
        {
          label: "Rest days",
          teamValue: `${teamRestDays} day${teamRestDays === 1 ? "" : "s"} off`,
          opponentValue: `${opponentRestDays} day${opponentRestDays === 1 ? "" : "s"} off`,
          edge: restEdge,
          takeaway:
            restEdge === "team"
              ? `${teamInfo.abbreviation} has the fresher lead-in.`
              : restEdge === "opponent"
                ? `${opponent.abbreviation} gets the cleaner recovery window.`
                : "Both teams enter on similar rest.",
          whyItMatters: "Rest edges tend to show up first in defensive legs, late-clock creation, and lineup trust.",
        },
        {
          label: "Game density",
          teamValue: densityLabel(teamCountInFour, teamCountInSeven),
          opponentValue: densityLabel(opponentCountInFour, opponentCountInSeven),
          edge: densityEdge,
          takeaway:
            densityEdge === "team"
              ? `${teamInfo.abbreviation} has the lighter game-density load.`
              : densityEdge === "opponent"
                ? `${teamInfo.abbreviation} is carrying the denser recent stretch.`
                : "Both teams are on a similar recent cadence.",
          whyItMatters: "Compressed schedules reduce treatment and practice time, which can flatten shooting legs and bench stability.",
        },
        {
          label: "Travel path",
          teamValue: teamTravel.label,
          opponentValue: opponentTravel.label,
          edge: travelEdge,
          takeaway:
            travelEdge === "team"
              ? `${teamInfo.abbreviation} has the cleaner travel setup.`
              : travelEdge === "opponent"
                ? `${opponent.abbreviation} gets the easier venue path into this game.`
                : "Travel stress looks mostly even.",
          whyItMatters: "Venue changes matter because recovery time is about routine disruption as much as miles traveled.",
        },
      ],
      recentWindow: [
        ...recentCompleted.map((game) => ({
          dateLabel: formatDateLabel(game.date),
          site: teamSide(game, teamInfo.id) === "home" ? "vs" as const : "@" as const,
          opponent: opponentForTeam(game, teamInfo.id).abbreviation,
          result: `${teamScore(game, teamInfo.id) > opponentScore(game, teamInfo.id) ? "W" : "L"} ${teamScore(game, teamInfo.id)}-${opponentScore(game, teamInfo.id)}`,
          note: `Live schedule context from BALLDONTLIE on ${game.status}.`,
        })),
        {
          dateLabel: formatDateLabel(nextGame.date),
          site: sitePrefix,
          opponent: opponent.abbreviation,
          note: "Featured live schedule spot.",
        },
      ],
      nextWindow: upcomingTeamGames.slice(1, 3).map((game) => ({
        dateLabel: formatDateLabel(game.date),
        site: teamSide(game, teamInfo.id) === "home" ? "vs" as const : "@" as const,
        opponent: opponentForTeam(game, teamInfo.id).abbreviation,
        note: "Upcoming live schedule context from BALLDONTLIE.",
      })),
      teachingPoints: [
        "The cleanest schedule reads compare rest, game density, and travel together instead of treating every back-to-back the same.",
        "This live path teaches where the hidden schedule stress sits, even before deeper rotation data is connected.",
      ],
      sourceState: "live",
      sourceLabel: "Live schedule context",
      sourceDetail: "Next game, rest days, game density, and recent travel path are all coming from live BALLDONTLIE team schedule data.",
    },
    meta: mergeMeta([teamLookup.meta, teamSeason.meta, opponentSeason.meta], {
      notes: [
        "Rest and schedule context are sourced live from BALLDONTLIE games and team data.",
      ],
    }),
  };
}

async function resolveLivePlayerRoleForm(
  base: { data: PlayerRoleFormDemoData; meta: Meta },
  args: { playerName: string; playerTeamKey?: string; dataMode: DataMode; cacheBust?: string },
): Promise<{ data: PlayerRoleFormDemoData; meta: Meta }> {
  const playerMatch = await findBestNbaPlayerMatch(args.playerName, {
    teamKey: args.playerTeamKey,
    dataMode: args.dataMode,
    cacheBust: args.cacheBust,
  });

  if (!playerMatch.data) {
    return withDemoFallback(base, {
      warning: `No live NBA player match was found for '${args.playerName}'. Showing the demo player profile instead.`,
      notes: ["BALLDONTLIE player search returned no match for the requested name."],
    });
  }

  const livePlayer = playerMatch.data;
  const team = livePlayer.team;

  try {
    const [statsResponse, teamsResponse] = await Promise.all([
      getNbaPlayerSeasonStats(livePlayer.id, {
        season: currentNbaSeason(),
        dataMode: args.dataMode,
        cacheBust: args.cacheBust,
      }),
      getNbaTeams(args.dataMode, args.cacheBust),
    ]);

    if (statsResponse.data.length === 0) {
      throw new Error("BALLDONTLIE returned no player stat rows for the selected player.");
    }

    const recent = statsResponse.data.slice(0, 5);
    const seasonPts = averageStat(statsResponse.data, (row) => row.pts);
    const recentPts = averageStat(recent, (row) => row.pts);
    const seasonAst = averageStat(statsResponse.data, (row) => row.ast);
    const recentAst = averageStat(recent, (row) => row.ast);
    const seasonReb = averageStat(statsResponse.data, (row) => row.reb);
    const recentReb = averageStat(recent, (row) => row.reb);
    const seasonMin = averageStat(statsResponse.data, (row) => parseMinutes(row.min));
    const recentMin = averageStat(recent, (row) => parseMinutes(row.min));
    const form = recentPts >= seasonPts + 2.5 ? "hot" : recentPts <= seasonPts - 2.5 ? "cool" : "steady";
    const role = roleFromLiveProfile(livePlayer, statsResponse.data);
    const teamById = new Map(teamsResponse.data.map((row) => [row.id, row]));
    const livePosition = livePlayer.position || base.data.player.position;
    const positionForRole = livePosition.toUpperCase();

    return {
      data: {
        ...base.data,
        player: {
          fullName: playerFullName(livePlayer),
          teamKey: team?.abbreviation ?? args.playerTeamKey ?? base.data.player.teamKey,
          teamName: team?.full_name ?? base.data.player.teamName,
          position: livePosition,
          role: role.role,
          archetype: role.archetype,
        },
        form,
        context: `Live player lookup and current-season game stats are sourced from BALLDONTLIE for ${playerFullName(livePlayer)}.`,
        beginnerSummary:
          `${playerFullName(livePlayer)} is now running through a live box-score trend read. `
          + `Recent scoring sits at ${recentPts.toFixed(1)} points versus a ${seasonPts.toFixed(1)} season baseline, which frames the current form signal.`,
        advancedSummary:
          `${playerFullName(livePlayer)} carries ${seasonPts.toFixed(1)} PTS, ${seasonAst.toFixed(1)} AST, `
          + `and ${seasonMin.toFixed(1)} MIN on the season, versus ${recentPts.toFixed(1)}, ${recentAst.toFixed(1)}, and ${recentMin.toFixed(1)} over the latest five-game window. `
          + "This is a live box-score trend read, not a full play-type or on/off role model.",
        metrics: [
          {
            label: "Scoring load",
            seasonValue: `${seasonPts.toFixed(1)} PTS`,
            recentValue: `${recentPts.toFixed(1)} PTS`,
            trend: trendFromDelta(recentPts, seasonPts, 2),
            takeaway: "Scoring volume helps separate a true usage lift from a short hot-shooting stretch.",
          },
          {
            label: positionForRole.includes("C") ? "Rebounding load" : "Playmaking load",
            seasonValue: positionForRole.includes("C")
              ? `${seasonReb.toFixed(1)} REB`
              : `${seasonAst.toFixed(1)} AST`,
            recentValue: positionForRole.includes("C")
              ? `${recentReb.toFixed(1)} REB`
              : `${recentAst.toFixed(1)} AST`,
            trend: positionForRole.includes("C")
              ? trendFromDelta(recentReb, seasonReb, 1)
              : trendFromDelta(recentAst, seasonAst, 1),
            takeaway: "Supporting metrics show whether the role shift is just scoring or a broader change in responsibility.",
          },
          {
            label: "Minutes",
            seasonValue: `${seasonMin.toFixed(1)} MIN`,
            recentValue: `${recentMin.toFixed(1)} MIN`,
            trend: trendFromDelta(recentMin, seasonMin, 2),
            takeaway: "Minutes are the cleanest proxy for lineup trust when a player is healthy and active.",
          },
        ],
        roleSignals: [
          {
            label: "Role tag",
            value: role.role,
            explanation: "This label is inferred from current-season scoring, passing, rebounding, and position context.",
          },
          {
            label: "Team context",
            value: team?.abbreviation ?? args.playerTeamKey ?? "-",
            explanation: "Team context helps anchor the role read when similar player names exist across seasons.",
          },
          {
            label: "Recent form",
            value: form === "hot" ? "Above baseline" : form === "cool" ? "Below baseline" : "Near baseline",
            explanation: "Form is measured against the season baseline rather than a single-game spike.",
          },
        ],
        recentGames: recent.slice(0, 3).map((row) => {
          const playerTeamId = row.team?.id ?? livePlayer.team?.id ?? livePlayer.team_id ?? 0;
          const opponentId = row.game.home_team_id === playerTeamId ? row.game.visitor_team_id : row.game.home_team_id;
          const opponentTeam = teamById.get(opponentId);
          return {
            dateLabel: formatDateLabel(row.game.date),
            opponent: opponentTeam?.abbreviation ?? `Team ${opponentId}`,
            line: `${row.pts} PTS, ${row.ast} AST, ${row.reb} REB`,
            roleNote: `${parseMinutes(row.min).toFixed(1)} minutes from the live BALLDONTLIE game log.`,
          };
        }),
        teachingPoints: [
          "Live role reads get more trustworthy when recent production is compared to the season baseline instead of raw game highs.",
          "Minutes and secondary stats help explain whether a scoring spike came from a real role change or just shot variance.",
        ],
        sourceState: "live",
        sourceLabel: "Live player form",
        sourceDetail: "Player identity plus season and recent box-score trends are live from BALLDONTLIE. This is a trustworthy box-score role/form read, not a deeper play-type model.",
      },
      meta: mergeMeta([playerMatch.meta, statsResponse.meta, teamsResponse.meta], {
        notes: [
          "Player lookup and current-season game stats are sourced live from BALLDONTLIE.",
          "Recent form is based on season and last-five box-score averages rather than a full possession-level role model.",
        ],
      }),
    };
  } catch (error) {
    const fallbackRole = roleFromPositionOnly(livePlayer);
    return {
      data: {
        ...base.data,
        player: {
          fullName: playerFullName(livePlayer),
          teamKey: team?.abbreviation ?? args.playerTeamKey ?? base.data.player.teamKey,
          teamName: team?.full_name ?? base.data.player.teamName,
          position: livePlayer.position || base.data.player.position,
          role: fallbackRole.role,
          archetype: fallbackRole.archetype,
        },
        form: "steady",
        context: `Live BALLDONTLIE player lookup found ${playerFullName(livePlayer)}, but the current key did not expose game stats for a full recent-form read.`,
        beginnerSummary:
          `${playerFullName(livePlayer)} was found live on ${team?.full_name ?? "an NBA roster"}, but recent-form numbers are unavailable on the current BALLDONTLIE plan.`,
        advancedSummary:
          `The live path resolved ${playerFullName(livePlayer)} through BALLDONTLIE's player directory, but the stats endpoint was unavailable for this key. `
          + "The widget stays honest by showing roster context without inventing recent production trends.",
        metrics: [
          {
            label: "Live data status",
            seasonValue: "Player profile found",
            recentValue: "Game stats unavailable",
            trend: "steady",
            takeaway: "The current key can verify roster identity, but not recent box-score form.",
          },
          {
            label: "Position",
            seasonValue: livePlayer.position || "-",
            recentValue: team?.abbreviation ?? args.playerTeamKey ?? "-",
            trend: "steady",
            takeaway: "Position and team context help frame the role, but not the current form signal.",
          },
          {
            label: "Minutes",
            seasonValue: "Not available at this tier",
            recentValue: "Not available at this tier",
            trend: "steady",
            takeaway: "Playing time and box-score trends are available with an upgraded BALLDONTLIE plan.",
          },
        ],
        roleSignals: [
          {
            label: "Roster context",
            value: fallbackRole.role,
            explanation: "This is a roster-level role read based on position only.",
          },
          {
            label: "Team",
            value: team?.abbreviation ?? args.playerTeamKey ?? "-",
            explanation: "The live player directory still confirms current team context.",
          },
          {
            label: "Data gap",
            value: "Stats tier unavailable",
            explanation: "The current BALLDONTLIE key does not expose the player game-log data needed for form trends.",
          },
        ],
        recentGames: [],
        teachingPoints: [
          "Roster context and form are different things. A player can be identified live without the stats access needed to measure recent trend.",
          "This honest fallback keeps the widget usable while showing exactly what the current data tier cannot support yet.",
        ],
        sourceState: "partial",
        sourceLabel: "Partial live player context",
        sourceDetail: `BALLDONTLIE confirmed ${playerFullName(livePlayer)} on ${team?.full_name ?? "an NBA roster"}. Game log and stat access is gated at this plan tier — showing role identity and position context only.`,
      },
      meta: mergeMeta([playerMatch.meta], {
        warning: String(error),
        notes: [
          "BALLDONTLIE player lookup succeeded, but the game-stats endpoint was unavailable for the current key.",
        ],
      }),
    };
  }
}

export async function resolveNbaTeamMatchupProfile(args: {
  scenarioId?: string;
  awayKey?: string;
  homeKey?: string;
  dataMode: DataMode;
  cacheBust?: string;
}) {
  const base = getNbaTeamMatchupProfileDemo(args.scenarioId, args.dataMode);
  const overrideAwayKey = args.awayKey?.trim().toUpperCase();
  const overrideHomeKey = args.homeKey?.trim().toUpperCase();
  const refreshRequested = Boolean(args.cacheBust?.trim());
  if (overrideAwayKey && overrideHomeKey) {
    base.data.away.key = overrideAwayKey;
    base.data.home.key = overrideHomeKey;
  }
  const ball = ballDontLieAvailability(args.dataMode);
  const apiSports = apiSportsAvailability(args.dataMode);
  let ballError: string | undefined;

  // Track whether BALLDONTLIE attempted enrichment but could not match the team abbreviations.
  // This lets the final fallback explain why demo is shown even when BALLDONTLIE is configured.
  let ballTeamMismatch = false;

  if (ball.enabled) {
    try {
      const resolved = await resolveLiveTeamMatchupProfile(base, args.dataMode, args.cacheBust);
      if (resolved.meta.sourceUsed !== "demo") {
        return resolved;
      }
      ballTeamMismatch = true;
    } catch (error) {
      ballError = String(error);
      if (!apiSports.enabled && !refreshRequested) {
        return withDemoFallback(base, {
          warning: `Live matchup enrichment failed, so the widget fell back to the demo board. ${String(error)}`,
          notes: ["BALLDONTLIE live matchup enrichment failed during resolver execution."],
        });
      }
    }
  }

  if (refreshRequested && ball.enabled) {
    try {
      const cachedResolved = await resolveLiveTeamMatchupProfile(base, args.dataMode);
      if (cachedResolved.meta.sourceUsed !== "demo") {
        return withRefreshPreservedRealState(cachedResolved, {
          widgetLabel: "NBA matchup",
          reason: "The forced refresh path did not complete cleanly.",
          notes: ["BALLDONTLIE fallback retry preserved the previous hybrid matchup context."],
        });
      }
    } catch {
      // Preserve the existing provider fallback chain below.
    }
  }

  if (!apiSports.enabled && ballError) {
    return withDemoFallback(base, {
      warning: `Live matchup enrichment failed, so the widget fell back to the demo board. ${ballError}`,
      notes: ["BALLDONTLIE live matchup enrichment failed during resolver execution."],
    });
  }

  if (apiSports.enabled) {
    try {
      return await resolveApiSportsTeamMatchupProfile(base, args.dataMode, args.cacheBust);
    } catch (error) {
      if (refreshRequested) {
        try {
          const cachedResolved = await resolveApiSportsTeamMatchupProfile(base, args.dataMode);
          if (cachedResolved.meta.sourceUsed !== "demo") {
            return withRefreshPreservedRealState(cachedResolved, {
              widgetLabel: "NBA matchup",
              reason: String(error),
              notes: ["API-Sports fallback retry preserved the previous live matchup context."],
            });
          }
        } catch {
          // Fall through to the existing demo fallback below.
        }
      }
      return withDemoFallback(base, {
        warning: `Live matchup enrichment failed on both NBA providers, so the widget fell back to the demo board. ${String(error)}`,
        notes: [
          ...(ball.enabled ? ["BALLDONTLIE live matchup enrichment failed during resolver execution."] : []),
          "API-Sports NBA matchup fallback also failed during resolver execution.",
        ],
      });
    }
  }

  const demoWarning = ball.warning
    ?? apiSports.warning
    ?? (ballTeamMismatch
      ? `BALLDONTLIE could not match the team abbreviations for this matchup. Try selecting teams via the Away/Home dropdowns using standard NBA keys (e.g. LAL, GSW, NYK). Showing the demo board.`
      : `No live NBA provider is configured. Showing the demo matchup board.`);

  return withDemoFallback(base, {
    warning: demoWarning,
    notes: ["The NBA matchup profile stayed on the scaffold because no live NBA provider was available."],
  });
}

export async function resolveNbaRestScheduleSpot(args: {
  scenarioId?: string;
  teamKey?: string;
  dataMode: DataMode;
  cacheBust?: string;
}) {
  const base = getNbaRestScheduleSpotDemo(args.scenarioId, args.dataMode);
  const ball = ballDontLieAvailability(args.dataMode);
  const apiSports = apiSportsAvailability(args.dataMode);
  const requestedTeamKey = args.teamKey?.trim().toUpperCase();
  const refreshRequested = Boolean(args.cacheBust?.trim());
  let ballError: string | undefined;

  if (!requestedTeamKey) {
    return base;
  }

  if (ball.enabled) {
    try {
      const resolved = await resolveLiveRestScheduleSpot(base, requestedTeamKey, args.dataMode, args.cacheBust);
      if (resolved.meta.sourceUsed !== "demo") {
        return resolved;
      }
    } catch (error) {
      ballError = String(error);
      if (!apiSports.enabled && !refreshRequested) {
        return withDemoFallback(base, {
          warning: `Live schedule enrichment failed for ${requestedTeamKey}, so the widget fell back to the demo spot. ${String(error)}`,
          notes: ["BALLDONTLIE live rest/schedule enrichment failed during resolver execution."],
        });
      }
    }
  }

  if (refreshRequested && ball.enabled) {
    try {
      const cachedResolved = await resolveLiveRestScheduleSpot(base, requestedTeamKey, args.dataMode);
      if (cachedResolved.meta.sourceUsed !== "demo") {
        return withRefreshPreservedRealState(cachedResolved, {
          widgetLabel: "NBA schedule",
          reason: "The forced refresh path did not complete cleanly.",
          notes: ["BALLDONTLIE fallback retry preserved the previous live or sparse-live schedule context."],
        });
      }
    } catch {
      // Preserve the existing provider fallback chain below.
    }
  }

  if (!apiSports.enabled && ballError) {
    return withDemoFallback(base, {
      warning: `Live schedule enrichment failed for ${requestedTeamKey}, so the widget fell back to the demo spot. ${ballError}`,
      notes: ["BALLDONTLIE live rest/schedule enrichment failed during resolver execution."],
    });
  }

  if (apiSports.enabled) {
    try {
      return await resolveApiSportsRestScheduleSpot(base, requestedTeamKey, args.dataMode, args.cacheBust);
    } catch (error) {
      if (refreshRequested) {
        try {
          const cachedResolved = await resolveApiSportsRestScheduleSpot(base, requestedTeamKey, args.dataMode);
          if (cachedResolved.meta.sourceUsed !== "demo") {
            return withRefreshPreservedRealState(cachedResolved, {
              widgetLabel: "NBA schedule",
              reason: String(error),
              notes: ["API-Sports fallback retry preserved the previous schedule context."],
            });
          }
        } catch {
          // Fall through to the existing demo fallback below.
        }
      }
      return withDemoFallback(base, {
        warning: `Live schedule enrichment failed for ${requestedTeamKey} on both NBA providers, so the widget fell back to the demo spot. ${String(error)}`,
        notes: [
          ...(ball.enabled ? ["BALLDONTLIE live rest/schedule enrichment failed during resolver execution."] : []),
          "API-Sports NBA rest/schedule fallback also failed during resolver execution.",
        ],
      });
    }
  }

  return withDemoFallback(base, {
    warning: ball.warning ?? apiSports.warning ?? `No live NBA provider is configured for ${requestedTeamKey}. Showing the demo schedule spot instead.`,
    notes: ["The NBA rest/schedule widget stayed on the scaffold because no live NBA provider was available."],
  });
}

export async function resolveNbaPlayerRoleForm(args: {
  scenarioId?: string;
  playerName?: string;
  playerTeamKey?: string;
  dataMode: DataMode;
  cacheBust?: string;
}) {
  const base = getNbaPlayerRoleFormDemo(args.scenarioId, args.dataMode);
  const ball = ballDontLieAvailability(args.dataMode);
  const apiSports = apiSportsAvailability(args.dataMode);
  const requestedPlayerName = args.playerName?.trim();
  const refreshRequested = Boolean(args.cacheBust?.trim());
  let ballError: string | undefined;

  if (!requestedPlayerName) {
    return base;
  }

  // Save a partial result from BALLDONTLIE (player found, stats unavailable) so it can be
  // returned as a fallback when API-Sports is also unavailable. Partial is better than demo
  // because it carries real player identity, team, and position.
  let ballPartialResult: { data: PlayerRoleFormDemoData; meta: Meta } | null = null;

  if (ball.enabled) {
    try {
      const resolved = await resolveLivePlayerRoleForm(base, {
        playerName: requestedPlayerName,
        playerTeamKey: args.playerTeamKey?.trim().toUpperCase() || undefined,
        dataMode: args.dataMode,
        cacheBust: args.cacheBust,
      });
      if (resolved.data.sourceState === "live") {
        return resolved;
      }
      if (resolved.data.sourceState === "partial") {
        ballPartialResult = resolved;
      }
    } catch (error) {
      ballError = String(error);
      if (!apiSports.enabled && !refreshRequested) {
        return withDemoFallback(base, {
          warning: `Live player enrichment failed for ${requestedPlayerName}, so the widget fell back to the demo profile. ${String(error)}`,
          notes: ["BALLDONTLIE live player-role enrichment failed during resolver execution."],
        });
      }
    }
  }

  if (refreshRequested && ball.enabled) {
    try {
      const cachedResolved = await resolveLivePlayerRoleForm(base, {
        playerName: requestedPlayerName,
        playerTeamKey: args.playerTeamKey?.trim().toUpperCase() || undefined,
        dataMode: args.dataMode,
      });
      if (cachedResolved.data.sourceState === "live" || cachedResolved.data.sourceState === "partial") {
        return withRefreshPreservedRealState(cachedResolved, {
          widgetLabel: "NBA player card",
          reason: "The forced refresh path did not complete cleanly.",
          notes: ["BALLDONTLIE fallback retry preserved the previous live or partial-live player context."],
        });
      }
    } catch {
      // Preserve the existing provider fallback chain below.
    }
  }

  if (!apiSports.enabled && ballError) {
    return withDemoFallback(base, {
      warning: `Live player enrichment failed for ${requestedPlayerName}, so the widget fell back to the demo profile. ${ballError}`,
      notes: ["BALLDONTLIE live player-role enrichment failed during resolver execution."],
    });
  }

  if (apiSports.enabled) {
    try {
      return await resolveApiSportsPlayerRoleForm(base, {
        playerName: requestedPlayerName,
        playerTeamKey: args.playerTeamKey?.trim().toUpperCase() || undefined,
        dataMode: args.dataMode,
        cacheBust: args.cacheBust,
      });
    } catch (error) {
      if (refreshRequested) {
        try {
          const cachedResolved = await resolveApiSportsPlayerRoleForm(base, {
            playerName: requestedPlayerName,
            playerTeamKey: args.playerTeamKey?.trim().toUpperCase() || undefined,
            dataMode: args.dataMode,
          });
          if (cachedResolved.data.sourceState !== "demo") {
            return withRefreshPreservedRealState(cachedResolved, {
              widgetLabel: "NBA player card",
              reason: String(error),
              notes: ["API-Sports fallback retry preserved the previous player identity and form context."],
            });
          }
        } catch {
          // Fall through to the existing partial/demo fallback below.
        }
      }
      if (ballPartialResult) {
        return refreshRequested
          ? withRefreshPreservedRealState(ballPartialResult, {
              widgetLabel: "NBA player card",
              reason: String(error),
              notes: ["BALLDONTLIE partial-live identity context was preserved after the fresh provider chain degraded."],
            })
          : ballPartialResult;
      }
      return withDemoFallback(base, {
        warning: `Live player enrichment failed for ${requestedPlayerName} on both NBA providers, so the widget fell back to the demo profile. ${String(error)}`,
        notes: [
          ...(ball.enabled ? ["BALLDONTLIE live player-role enrichment failed during resolver execution."] : []),
          "API-Sports NBA player fallback also failed during resolver execution.",
        ],
      });
    }
  }

  // Prefer the partial live result (real player identity + team context) over a pure demo fallback.
  if (ballPartialResult) {
    return ballPartialResult;
  }

  return withDemoFallback(base, {
    warning: ball.warning ?? apiSports.warning ?? `No live NBA provider is configured for ${requestedPlayerName}. Showing the demo player card instead.`,
    notes: ["The NBA player-role widget stayed on the scaffold because no live NBA provider was available."],
  });
}
