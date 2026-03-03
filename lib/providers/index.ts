import { randomUUID } from "node:crypto";
import type { DataMode } from "@/lib/dataMode";
import * as apiSportsPlayers from "@/lib/providers/apiSports/playerDirectory";
import * as apiSportsInsights from "@/lib/providers/apiSports/playerInsights";
import * as apiSportsTeams from "@/lib/providers/apiSports/teamDirectory";
import * as apiSportsAdvanced from "@/lib/providers/apiSports/teamAdvanced";
import * as espnPlayers from "@/lib/providers/espn/playerDirectory";
import * as espnInsights from "@/lib/providers/espn/playerInsights";
import * as espnTeams from "@/lib/providers/espn/teamDirectory";
import * as espnAdvanced from "@/lib/providers/espn/teamAdvanced";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, PlayerProfile, PlayerSearchResult, SportKey, TeamProviderRef, TeamSearchResult } from "@/lib/types/players";
import type { PlayerInsights, TeamAdvanced } from "@/lib/types/playerInsights";

export type ProviderAttemptSource = "apiSports" | "espn" | "fixture";
export type ProviderDataModeEffective = "live" | "fixture";

export type ProviderContext = {
  dataMode: DataMode;
  cacheBust?: string | number | undefined;
  mode?: "beginner" | "advanced";
  teamRefs?: TeamProviderRef[];
};

type TeamsAdvancedResult = { sport: SportKey; teams: TeamAdvanced[] };

export interface HybridProviderContract {
  searchPlayers: (sport: SportKey, q: string, limit: number, ctx: ProviderContext) => Promise<Envelope<PlayerSearchResult[]>>;
  getPlayerProfile: (sport: SportKey, playerId: string, ctx: ProviderContext) => Promise<Envelope<PlayerProfile>>;
  getPlayerInsights: (
    sport: SportKey,
    playerId: string,
    mode: "beginner" | "advanced",
    ctx: ProviderContext,
  ) => Promise<Envelope<PlayerInsights>>;
  searchTeams: (sport: SportKey, q: string, limit: number, ctx: ProviderContext) => Promise<Envelope<TeamSearchResult[]>>;
  getTeamAdvanced: (
    sport: SportKey,
    teamKeys: string[],
    mode: "beginner" | "advanced",
    ctx: ProviderContext,
  ) => Promise<Envelope<TeamsAdvancedResult>>;
}

function buildHybridMeta(args: {
  baseMeta: Meta | null;
  sourceUsed: "apiSports" | "espn" | "fixture" | "cache";
  attemptedSources: ProviderAttemptSource[];
  warnings: string[];
  hydrationUsed: boolean;
  dataModeEffective: ProviderDataModeEffective;
}): Meta {
  const { baseMeta, sourceUsed, attemptedSources, warnings, hydrationUsed, dataModeEffective } = args;
  const combinedWarnings = [
    ...(baseMeta?.warning ? [baseMeta.warning] : []),
    ...warnings,
  ];
  return {
    sourceUsed,
    updatedAt: baseMeta?.updatedAt ?? new Date().toISOString(),
    requestId: baseMeta?.requestId ?? randomUUID(),
    endpointUrl: baseMeta?.endpointUrl,
    upstreamStatus: baseMeta?.upstreamStatus,
    upstreamMessage: baseMeta?.upstreamMessage,
    cacheHit: baseMeta?.cacheHit,
    cacheAgeSeconds: baseMeta?.cacheAgeSeconds,
    warning: combinedWarnings.length > 0 ? combinedWarnings.join(" ") : undefined,
    warnings: combinedWarnings.length > 0 ? combinedWarnings : undefined,
    attemptedSources,
    hydrationUsed,
    dataMode: dataModeEffective,
    dataModeEffective,
    notes: baseMeta?.notes,
  };
}

function resolveSourceWithCache(
  preferred: "apiSports" | "espn" | "fixture",
  meta: Meta | null | undefined,
): "apiSports" | "espn" | "fixture" | "cache" {
  if (meta?.sourceUsed === "cache") {
    return "cache";
  }
  return preferred;
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeKey(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function normalizeName(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\w\s]|_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeamRefs(teamKeys: string[], provided?: TeamProviderRef[]): TeamProviderRef[] {
  const byKey = new Map<string, TeamProviderRef>();

  for (const key of teamKeys) {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) {
      continue;
    }
    byKey.set(normalizedKey, { teamKey: normalizedKey });
  }

  for (const row of provided ?? []) {
    const normalizedKey = normalizeKey(row.teamKey);
    if (!normalizedKey) {
      continue;
    }
    const existing = byKey.get(normalizedKey) ?? { teamKey: normalizedKey };
    byKey.set(normalizedKey, {
      teamKey: normalizedKey,
      teamName: row.teamName ?? existing.teamName,
      apiSportsTeamId: row.apiSportsTeamId ?? existing.apiSportsTeamId,
      espnTeamId: row.espnTeamId ?? existing.espnTeamId,
    });
  }

  return Array.from(byKey.values());
}

function mergeTeamSearchRows(primary: TeamSearchResult[], secondary: TeamSearchResult[]): TeamSearchResult[] {
  const secondaryByKey = new Map<string, TeamSearchResult>();
  const secondaryByName = new Map<string, TeamSearchResult>();

  for (const row of secondary) {
    const key = normalizeKey(row.teamKey);
    if (key) {
      secondaryByKey.set(key, row);
    }
    const name = normalizeName(row.displayName);
    if (name) {
      secondaryByName.set(name, row);
    }
  }

  return primary.map((row) => {
    const byKey = secondaryByKey.get(normalizeKey(row.teamKey));
    const byName = secondaryByName.get(normalizeName(row.displayName));
    const secondaryRow = byKey ?? byName;
    if (!secondaryRow) {
      return row;
    }
    return {
      ...secondaryRow,
      ...row,
      teamKey: row.teamKey || secondaryRow.teamKey,
      displayName: row.displayName || secondaryRow.displayName,
      league: row.league || secondaryRow.league,
      abbreviation: row.abbreviation ?? secondaryRow.abbreviation,
      logo: row.logo ?? secondaryRow.logo,
      apiSportsTeamId: row.apiSportsTeamId ?? secondaryRow.apiSportsTeamId,
      espnTeamId: row.espnTeamId ?? secondaryRow.espnTeamId,
    };
  });
}

function profileMissingSections(profile: PlayerProfile | null): string[] {
  if (!profile) {
    return ["payload"];
  }

  const missing: string[] = [];
  if (!profile.fullName) {
    missing.push("identity");
  }
  if (!profile.teamName && !profile.teamAbbrev && !profile.position) {
    missing.push("team_or_position");
  }
  const hasBio =
    typeof profile.age === "number"
    || Boolean(profile.height)
    || Boolean(profile.weight)
    || Boolean(profile.jersey)
    || Boolean(profile.bats)
    || Boolean(profile.throws);
  const hasHeadshot = Boolean(profile.headshot);
  if (!hasHeadshot && !hasBio) {
    missing.push("presentation");
  }
  return missing;
}

function seasonMetricCount(insights: PlayerInsights | null | undefined): number {
  return insights?.season?.metrics?.length ?? 0;
}

function recentGameCount(insights: PlayerInsights | null | undefined): number {
  return insights?.recent?.games?.length ?? 0;
}

function hasUsefulLiveContext(insights: PlayerInsights | null | undefined): boolean {
  if (!insights?.live) {
    return false;
  }
  if (insights.live.hasGameToday) {
    return true;
  }
  return Boolean(insights.live.state || insights.live.displayClock || insights.live.opponent || insights.live.eventId);
}

function requiredSeasonMetricCount(sport: SportKey): number {
  if (sport === "nba") {
    return 3;
  }
  if (sport === "mlb") {
    return 3;
  }
  return 2;
}

function insightsMissingSections(
  insights: PlayerInsights | null,
  sport: SportKey,
  mode: "beginner" | "advanced",
): string[] {
  if (!insights) {
    return ["payload"];
  }

  const missing: string[] = [];
  if (!insights.fullName) {
    missing.push("identity");
  }
  if (!insights.teamName && !insights.teamAbbrev) {
    missing.push("team");
  }

  if (mode !== "advanced") {
    return missing;
  }

  if (seasonMetricCount(insights) < requiredSeasonMetricCount(sport)) {
    missing.push("season");
  }
  if (recentGameCount(insights) < 3) {
    missing.push("recent");
  }
  if (!hasUsefulLiveContext(insights)) {
    missing.push("live");
  }
  return missing;
}

function teamMissingSections(
  team: TeamAdvanced | null | undefined,
  mode: "beginner" | "advanced",
): string[] {
  if (!team) {
    return ["payload"];
  }

  const missing: string[] = [];
  if (!team.teamKey && !team.teamName) {
    missing.push("identity");
  }

  const hasGameContext = Boolean(
    team.status?.hasGameToday
    || team.status?.state
    || team.status?.displayClock
    || team.status?.opponent
    || team.nextGame
    || team.lastGame,
  );
  if (!hasGameContext) {
    missing.push("game_context");
  }

  if (mode === "advanced") {
    if (!team.record) {
      missing.push("record");
    }
    if (!team.standings) {
      missing.push("standings");
    }
    if (!team.nextGame && !team.status?.hasGameToday) {
      missing.push("next_game");
    }
  }

  return missing;
}

function seasonScore(season: PlayerInsights["season"] | null | undefined): number {
  if (!season) {
    return 0;
  }
  let score = season.metrics.length * 2;
  if (season.headline) {
    score += 1;
  }
  if (season.source === "upstream") {
    score += 1;
  }
  return score;
}

function recentScore(recent: PlayerInsights["recent"] | null | undefined): number {
  if (!recent) {
    return 0;
  }
  let score = recent.games.length * 2;
  if (recent.headline) {
    score += 1;
  }
  if (recent.source === "upstream") {
    score += 1;
  }
  return score;
}

function selectRicherSeason(
  primary: PlayerInsights["season"] | null | undefined,
  secondary: PlayerInsights["season"] | null | undefined,
): PlayerInsights["season"] | null | undefined {
  if (!primary) {
    return secondary;
  }
  if (!secondary) {
    return primary;
  }

  if (seasonScore(secondary) > seasonScore(primary)) {
    return secondary;
  }

  return {
    ...primary,
    headline: primary.headline || secondary.headline,
    sampleSize: primary.sampleSize ?? secondary.sampleSize,
    metrics: primary.metrics.length >= secondary.metrics.length
      ? primary.metrics
      : secondary.metrics,
  };
}

function selectRicherRecent(
  primary: PlayerInsights["recent"] | null | undefined,
  secondary: PlayerInsights["recent"] | null | undefined,
): PlayerInsights["recent"] | null | undefined {
  if (!primary) {
    return secondary;
  }
  if (!secondary) {
    return primary;
  }

  if (recentScore(secondary) > recentScore(primary)) {
    return secondary;
  }

  return {
    ...primary,
    headline: primary.headline || secondary.headline,
    games: primary.games.length >= secondary.games.length
      ? primary.games
      : secondary.games,
  };
}

function mergeProfile(primary: PlayerProfile | null, secondary: PlayerProfile | null): PlayerProfile | null {
  if (!primary && !secondary) {
    return null;
  }
  if (!primary) {
    return secondary;
  }
  if (!secondary) {
    return primary;
  }
  return {
    playerId: primary.playerId || secondary.playerId,
    fullName: primary.fullName || secondary.fullName,
    teamAbbrev: primary.teamAbbrev ?? secondary.teamAbbrev,
    teamName: primary.teamName ?? secondary.teamName,
    position: primary.position ?? secondary.position,
    headshot: primary.headshot ?? secondary.headshot,
    jersey: primary.jersey ?? secondary.jersey,
    age: primary.age ?? secondary.age,
    height: primary.height ?? secondary.height,
    weight: primary.weight ?? secondary.weight,
    bats: primary.bats ?? secondary.bats,
    throws: primary.throws ?? secondary.throws,
    injury: primary.injury ?? secondary.injury,
    whyItMatters: primary.whyItMatters ?? secondary.whyItMatters,
    tooltip: primary.tooltip ?? secondary.tooltip,
    stats: primary.stats ?? secondary.stats,
    learnMore: primary.learnMore ?? secondary.learnMore,
  };
}

function mergeInsights(primary: PlayerInsights | null, secondary: PlayerInsights | null): PlayerInsights | null {
  if (!primary && !secondary) {
    return null;
  }
  if (!primary) {
    return secondary;
  }
  if (!secondary) {
    return primary;
  }
  const mergedMetaNotes = [...(primary.metaNotes ?? []), ...(secondary.metaNotes ?? [])];
  const primaryLive = primary.live;
  const secondaryLive = secondary.live;
  const selectedLive = (() => {
    if (!primaryLive) {
      return secondaryLive ?? null;
    }
    if (!secondaryLive) {
      return primaryLive;
    }
    const primaryHasSignal = primaryLive.hasGameToday || Boolean(primaryLive.state || primaryLive.displayClock || primaryLive.opponent);
    const secondaryHasSignal = secondaryLive.hasGameToday || Boolean(secondaryLive.state || secondaryLive.displayClock || secondaryLive.opponent);
    if (!primaryHasSignal && secondaryHasSignal) {
      return secondaryLive;
    }
    return primaryLive;
  })();

  const selectedInjury = (() => {
    const primaryHas = Boolean(primary.injury && (primary.injury.status || primary.injury.detail));
    const secondaryHas = Boolean(secondary.injury && (secondary.injury.status || secondary.injury.detail));
    if (!primaryHas && secondaryHas) {
      return secondary.injury;
    }
    return primary.injury ?? secondary.injury ?? null;
  })();

  return {
    ...secondary,
    ...primary,
    fullName: primary.fullName ?? secondary.fullName,
    teamAbbrev: primary.teamAbbrev ?? secondary.teamAbbrev,
    teamName: primary.teamName ?? secondary.teamName,
    injury: selectedInjury,
    live: selectedLive,
    season: selectRicherSeason(primary.season, secondary.season),
    recent: selectRicherRecent(primary.recent, secondary.recent),
    metaNotes: mergedMetaNotes.length > 0 ? uniqueStrings(mergedMetaNotes) : undefined,
  };
}

function mergeTeamAdvancedRow(primary: TeamAdvanced | undefined, secondary: TeamAdvanced | undefined): TeamAdvanced | null {
  if (!primary && !secondary) {
    return null;
  }
  if (!primary) {
    return secondary ?? null;
  }
  if (!secondary) {
    return primary;
  }
  const primaryStatusHasSignal = Boolean(
    primary.status?.hasGameToday
    || primary.status?.state
    || primary.status?.displayClock
    || primary.status?.opponent,
  );
  const secondaryStatusHasSignal = Boolean(
    secondary.status?.hasGameToday
    || secondary.status?.state
    || secondary.status?.displayClock
    || secondary.status?.opponent,
  );
  return {
    teamKey: primary.teamKey || secondary.teamKey,
    teamName: primary.teamName ?? secondary.teamName,
    apiSportsTeamId: primary.apiSportsTeamId ?? secondary.apiSportsTeamId,
    espnTeamId: primary.espnTeamId ?? secondary.espnTeamId,
    status: primaryStatusHasSignal || !secondaryStatusHasSignal ? (primary.status ?? secondary.status) : secondary.status,
    nextGame: primary.nextGame ?? secondary.nextGame ?? null,
    record: primary.record ?? secondary.record ?? null,
    standings: primary.standings ?? secondary.standings ?? null,
    lastGame: primary.lastGame ?? secondary.lastGame ?? null,
    metaNotes: uniqueStrings([...(primary.metaNotes ?? []), ...(secondary.metaNotes ?? [])]),
  };
}

function applyTeamRefs(teams: TeamAdvanced[] | undefined, refs: TeamProviderRef[]): TeamAdvanced[] {
  if (!teams || teams.length === 0) {
    return [];
  }
  const refMap = new Map(refs.map((row) => [normalizeKey(row.teamKey), row]));
  return teams.map((team) => {
    const ref = refMap.get(normalizeKey(team.teamKey));
    if (!ref) {
      return team;
    }
    return {
      ...team,
      teamName: team.teamName ?? ref.teamName,
      apiSportsTeamId: team.apiSportsTeamId ?? ref.apiSportsTeamId,
      espnTeamId: team.espnTeamId ?? ref.espnTeamId,
    };
  });
}

export function isPlayerProfileComplete(profile: PlayerProfile | null): boolean {
  return profileMissingSections(profile).length === 0;
}

export function isPlayerInsightsComplete(
  insights: PlayerInsights | null,
  sport: SportKey,
  mode: "beginner" | "advanced",
): boolean {
  return insightsMissingSections(insights, sport, mode).length === 0;
}

export function isTeamAdvancedComplete(team: TeamAdvanced | null | undefined): boolean {
  return teamMissingSections(team, "beginner").length === 0;
}

function isTeamsAdvancedComplete(
  result: TeamsAdvancedResult | null | undefined,
  mode: "beginner" | "advanced",
): boolean {
  if (!result || result.teams.length === 0) {
    return false;
  }
  return result.teams.every((team) => teamMissingSections(team, mode).length === 0);
}

async function fetchFixturePlayersSearch(
  sport: SportKey,
  q: string,
  limit: number,
  cacheBust?: string | number,
): Promise<Envelope<PlayerSearchResult[]>> {
  return espnPlayers.searchPlayers(sport, q, "fixture", limit, cacheBust);
}

async function fetchFixturePlayerProfile(
  sport: SportKey,
  playerId: string,
  cacheBust?: string | number,
): Promise<Envelope<PlayerProfile>> {
  return espnPlayers.getPlayerProfile(sport, playerId, "fixture", cacheBust);
}

async function fetchFixturePlayerInsights(
  sport: SportKey,
  playerId: string,
  mode: "beginner" | "advanced",
  cacheBust?: string | number,
): Promise<Envelope<PlayerInsights>> {
  return espnInsights.getPlayerInsights(sport, playerId, mode, "fixture", cacheBust);
}

async function fetchFixtureTeamsSearch(
  sport: SportKey,
  q: string,
  limit: number,
  cacheBust?: string | number,
): Promise<Envelope<TeamSearchResult[]>> {
  return espnTeams.searchTeams(sport, q, "fixture", limit, cacheBust);
}

async function fetchFixtureTeamsAdvanced(
  sport: SportKey,
  teamKeys: string[],
  mode: "beginner" | "advanced",
  cacheBust?: string | number,
): Promise<Envelope<TeamsAdvancedResult>> {
  return espnAdvanced.getTeamsAdvanced(sport, teamKeys, mode, "fixture", cacheBust);
}

function normalizeContextMode(mode: DataMode): "live" | "fixture" | "auto" {
  if (mode === "live" || mode === "fixture") {
    return mode;
  }
  return "auto";
}

async function resolveSearchPlayers(
  sport: SportKey,
  q: string,
  limit: number,
  ctx: ProviderContext,
): Promise<Envelope<PlayerSearchResult[]>> {
  const mode = normalizeContextMode(ctx.dataMode);
  if (mode === "fixture") {
    const fixtureEnvelope = await fetchFixturePlayersSearch(sport, q, limit, ctx.cacheBust);
    return {
      ...fixtureEnvelope,
      meta: buildHybridMeta({
        baseMeta: fixtureEnvelope.meta,
        sourceUsed: "fixture",
        attemptedSources: ["fixture"],
        warnings: [],
        hydrationUsed: false,
        dataModeEffective: "fixture",
      }),
    };
  }

  const attempted: ProviderAttemptSource[] = ["apiSports"];
  const warnings: string[] = [];

  const apiEnvelope = await apiSportsPlayers.searchPlayers(sport, q, limit, "live", ctx.cacheBust);
  const apiResults = safeArray(apiEnvelope.data);
  if (!apiEnvelope.error && apiResults.length > 0) {
    return {
      ...apiEnvelope,
      meta: buildHybridMeta({
        baseMeta: apiEnvelope.meta,
        sourceUsed: resolveSourceWithCache("apiSports", apiEnvelope.meta),
        attemptedSources: attempted,
        warnings,
        hydrationUsed: false,
        dataModeEffective: "live",
      }),
    };
  }
  if (apiEnvelope.meta.warning) {
    warnings.push(apiEnvelope.meta.warning);
  }

  attempted.push("espn");
  const espnEnvelope = await espnPlayers.searchPlayers(sport, q, "live", limit, ctx.cacheBust);
  const espnResults = safeArray(espnEnvelope.data);
  if (!espnEnvelope.error && espnResults.length > 0) {
    return {
      ...espnEnvelope,
      meta: buildHybridMeta({
        baseMeta: espnEnvelope.meta,
        sourceUsed: resolveSourceWithCache("espn", espnEnvelope.meta),
        attemptedSources: attempted,
        warnings,
        hydrationUsed: false,
        dataModeEffective: "live",
      }),
    };
  }
  if (espnEnvelope.meta.warning) {
    warnings.push(espnEnvelope.meta.warning);
  }

  if (mode === "auto") {
    attempted.push("fixture");
    const fixtureEnvelope = await fetchFixturePlayersSearch(sport, q, limit, ctx.cacheBust);
    if (!fixtureEnvelope.error && safeArray(fixtureEnvelope.data).length > 0) {
      return {
        ...fixtureEnvelope,
        meta: buildHybridMeta({
          baseMeta: fixtureEnvelope.meta,
          sourceUsed: "fixture",
          attemptedSources: attempted,
          warnings,
          hydrationUsed: false,
          dataModeEffective: "fixture",
        }),
      };
    }
    if (fixtureEnvelope.meta.warning) {
      warnings.push(fixtureEnvelope.meta.warning);
    }
    return {
      data: safeArray(fixtureEnvelope.data),
      meta: buildHybridMeta({
        baseMeta: fixtureEnvelope.meta,
        sourceUsed: "fixture",
        attemptedSources: attempted,
        warnings,
        hydrationUsed: false,
        dataModeEffective: "fixture",
      }),
      error: fixtureEnvelope.error ?? espnEnvelope.error ?? apiEnvelope.error,
    };
  }

  return {
    data: safeArray(espnEnvelope.data),
    meta: buildHybridMeta({
      baseMeta: espnEnvelope.meta,
      sourceUsed: resolveSourceWithCache("espn", espnEnvelope.meta),
      attemptedSources: attempted,
      warnings,
      hydrationUsed: false,
      dataModeEffective: "live",
    }),
    error: espnEnvelope.error ?? apiEnvelope.error,
  };
}

async function resolvePlayerProfileAuto(
  sport: SportKey,
  playerId: string,
  ctx: ProviderContext,
): Promise<Envelope<PlayerProfile>> {
  const mode = normalizeContextMode(ctx.dataMode);
  if (mode === "fixture") {
    const fixtureEnvelope = await fetchFixturePlayerProfile(sport, playerId, ctx.cacheBust);
    return {
      ...fixtureEnvelope,
      meta: buildHybridMeta({
        baseMeta: fixtureEnvelope.meta,
        sourceUsed: "fixture",
        attemptedSources: ["fixture"],
        warnings: [],
        hydrationUsed: false,
        dataModeEffective: "fixture",
      }),
    };
  }

  const attempted: ProviderAttemptSource[] = ["apiSports"];
  const warnings: string[] = [];
  const apiEnvelope = await apiSportsPlayers.getPlayerProfile(sport, playerId, "live", ctx.cacheBust);
  const apiData = apiEnvelope.data;
  const apiMissing = profileMissingSections(apiData);
  if (!apiEnvelope.error && apiMissing.length === 0) {
    return {
      ...apiEnvelope,
      meta: buildHybridMeta({
        baseMeta: apiEnvelope.meta,
        sourceUsed: resolveSourceWithCache("apiSports", apiEnvelope.meta),
        attemptedSources: attempted,
        warnings,
        hydrationUsed: false,
        dataModeEffective: "live",
      }),
    };
  }
  if (apiEnvelope.meta.warning) {
    warnings.push(apiEnvelope.meta.warning);
  }
  if (apiMissing.length > 0) {
    warnings.push(`API-Sports profile missing sections: ${apiMissing.join(", ")}.`);
  }

  attempted.push("espn");
  const espnEnvelope = await espnPlayers.getPlayerProfile(sport, playerId, "live", ctx.cacheBust);
  const mergedLive = mergeProfile(apiData, espnEnvelope.data);
  const mergedMissing = profileMissingSections(mergedLive);
  const sourceUsed = apiData
    ? resolveSourceWithCache("apiSports", apiEnvelope.meta)
    : resolveSourceWithCache("espn", espnEnvelope.meta);

  if (mergedMissing.length === 0 && mergedLive) {
    return {
      data: mergedLive,
      meta: buildHybridMeta({
        baseMeta: sourceUsed === "apiSports" || sourceUsed === "cache" ? apiEnvelope.meta : espnEnvelope.meta,
        sourceUsed,
        attemptedSources: attempted,
        warnings,
        hydrationUsed: Boolean(apiData && espnEnvelope.data),
        dataModeEffective: "live",
      }),
    };
  }
  if (espnEnvelope.meta.warning) {
    warnings.push(espnEnvelope.meta.warning);
  }
  if (mergedMissing.length > 0) {
    warnings.push(`Live profile still missing sections after ESPN enrichment: ${mergedMissing.join(", ")}.`);
  }

  if (mode === "auto") {
    attempted.push("fixture");
    const fixtureEnvelope = await fetchFixturePlayerProfile(sport, playerId, ctx.cacheBust);
    const mergedFixture = mergeProfile(mergedLive, fixtureEnvelope.data);
    const mergedFixtureMissing = profileMissingSections(mergedFixture);
    const hydrationImproved = mergedFixtureMissing.length < mergedMissing.length;
    if (mergedFixture) {
      const hydrationNote = hydrationImproved
        ? "Live profile remained incomplete after ESPN; using fixture fallback for missing sections."
        : "Live profile remained incomplete after ESPN; returning fixture fallback.";
      return {
        data: mergedFixture,
        meta: buildHybridMeta({
          baseMeta: fixtureEnvelope.meta,
          sourceUsed: "fixture",
          attemptedSources: attempted,
          warnings: [...warnings, hydrationNote],
          hydrationUsed: Boolean(fixtureEnvelope.data && (apiData || espnEnvelope.data)),
          dataModeEffective: "fixture",
        }),
      };
    }
    return {
      data: null,
      meta: buildHybridMeta({
        baseMeta: fixtureEnvelope.meta,
        sourceUsed: "fixture",
        attemptedSources: attempted,
        warnings,
        hydrationUsed: false,
        dataModeEffective: "fixture",
      }),
      error: fixtureEnvelope.error ?? espnEnvelope.error ?? apiEnvelope.error,
    };
  }

  return {
    data: mergedLive,
    meta: buildHybridMeta({
      baseMeta: sourceUsed === "apiSports" || sourceUsed === "cache" ? apiEnvelope.meta : espnEnvelope.meta,
      sourceUsed,
      attemptedSources: attempted,
      warnings,
      hydrationUsed: Boolean(apiData && espnEnvelope.data),
      dataModeEffective: "live",
    }),
    error: espnEnvelope.error ?? apiEnvelope.error,
  };
}

async function resolvePlayerInsightsAuto(
  sport: SportKey,
  playerId: string,
  mode: "beginner" | "advanced",
  ctx: ProviderContext,
): Promise<Envelope<PlayerInsights>> {
  const requestedMode = normalizeContextMode(ctx.dataMode);
  if (requestedMode === "fixture") {
    const fixtureEnvelope = await fetchFixturePlayerInsights(sport, playerId, mode, ctx.cacheBust);
    return {
      ...fixtureEnvelope,
      meta: buildHybridMeta({
        baseMeta: fixtureEnvelope.meta,
        sourceUsed: "fixture",
        attemptedSources: ["fixture"],
        warnings: [],
        hydrationUsed: false,
        dataModeEffective: "fixture",
      }),
    };
  }

  const attempted: ProviderAttemptSource[] = ["apiSports"];
  const warnings: string[] = [];
  const apiEnvelope = await apiSportsInsights.getPlayerInsights(sport, playerId, mode, "live", ctx.cacheBust);
  const apiData = apiEnvelope.data;
  const apiMissingSections = insightsMissingSections(apiData, sport, mode);
  if (!apiEnvelope.error && apiMissingSections.length === 0) {
    return {
      ...apiEnvelope,
      meta: buildHybridMeta({
        baseMeta: apiEnvelope.meta,
        sourceUsed: resolveSourceWithCache("apiSports", apiEnvelope.meta),
        attemptedSources: attempted,
        warnings,
        hydrationUsed: false,
        dataModeEffective: "live",
      }),
    };
  }
  if (apiEnvelope.meta.warning) {
    warnings.push(apiEnvelope.meta.warning);
  }
  if (apiMissingSections.length > 0) {
    warnings.push(`API-Sports insights missing sections: ${apiMissingSections.join(", ")}.`);
  }

  attempted.push("espn");
  const espnEnvelope = await espnInsights.getPlayerInsights(sport, playerId, mode, "live", ctx.cacheBust);
  const mergedLive = mergeInsights(apiData, espnEnvelope.data);
  const mergedMissingSections = insightsMissingSections(mergedLive, sport, mode);
  const sourceUsed = apiData
    ? resolveSourceWithCache("apiSports", apiEnvelope.meta)
    : resolveSourceWithCache("espn", espnEnvelope.meta);

  if (mergedMissingSections.length === 0 && mergedLive) {
    return {
      data: mergedLive,
      meta: buildHybridMeta({
        baseMeta: sourceUsed === "apiSports" || sourceUsed === "cache" ? apiEnvelope.meta : espnEnvelope.meta,
        sourceUsed,
        attemptedSources: attempted,
        warnings,
        hydrationUsed: Boolean(apiData && espnEnvelope.data),
        dataModeEffective: "live",
      }),
    };
  }
  if (espnEnvelope.meta.warning) {
    warnings.push(espnEnvelope.meta.warning);
  }
  if (mergedMissingSections.length > 0) {
    warnings.push(`Live insights still missing sections after ESPN enrichment: ${mergedMissingSections.join(", ")}.`);
  }

  if (requestedMode === "auto") {
    attempted.push("fixture");
    const fixtureEnvelope = await fetchFixturePlayerInsights(sport, playerId, mode, ctx.cacheBust);
    const mergedFixture = mergeInsights(mergedLive, fixtureEnvelope.data);
    const mergedFixtureMissing = insightsMissingSections(mergedFixture, sport, mode);
    const hydrationImproved = mergedFixtureMissing.length < mergedMissingSections.length;
    if (mergedFixture) {
      const hydrationNote = hydrationImproved
        ? "Live player insights remained incomplete after ESPN; using fixture fallback for missing sections."
        : "Live player insights remained incomplete after ESPN; returning fixture fallback.";
      return {
        data: mergedFixture,
        meta: buildHybridMeta({
          baseMeta: fixtureEnvelope.meta,
          sourceUsed: "fixture",
          attemptedSources: attempted,
          warnings: [...warnings, hydrationNote],
          hydrationUsed: Boolean(fixtureEnvelope.data && (apiData || espnEnvelope.data)),
          dataModeEffective: "fixture",
        }),
      };
    }
    return {
      data: null,
      meta: buildHybridMeta({
        baseMeta: fixtureEnvelope.meta,
        sourceUsed: "fixture",
        attemptedSources: attempted,
        warnings,
        hydrationUsed: false,
        dataModeEffective: "fixture",
      }),
      error: fixtureEnvelope.error ?? espnEnvelope.error ?? apiEnvelope.error,
    };
  }

  return {
    data: mergedLive,
    meta: buildHybridMeta({
      baseMeta: sourceUsed === "apiSports" || sourceUsed === "cache" ? apiEnvelope.meta : espnEnvelope.meta,
      sourceUsed,
      attemptedSources: attempted,
      warnings,
      hydrationUsed: Boolean(apiData && espnEnvelope.data),
      dataModeEffective: "live",
    }),
    error: espnEnvelope.error ?? apiEnvelope.error,
  };
}

async function resolveTeamsSearchAuto(
  sport: SportKey,
  q: string,
  limit: number,
  ctx: ProviderContext,
): Promise<Envelope<TeamSearchResult[]>> {
  const mode = normalizeContextMode(ctx.dataMode);
  if (mode === "fixture") {
    const fixtureEnvelope = await fetchFixtureTeamsSearch(sport, q, limit, ctx.cacheBust);
    return {
      ...fixtureEnvelope,
      meta: buildHybridMeta({
        baseMeta: fixtureEnvelope.meta,
        sourceUsed: "fixture",
        attemptedSources: ["fixture"],
        warnings: [],
        hydrationUsed: false,
        dataModeEffective: "fixture",
      }),
    };
  }

  const attempted: ProviderAttemptSource[] = ["apiSports"];
  const warnings: string[] = [];
  const apiEnvelope = await apiSportsTeams.searchTeams(sport, q, limit, "live", ctx.cacheBust);
  const apiRows = safeArray(apiEnvelope.data);
  if (!apiEnvelope.error && apiRows.length > 0) {
    let rows = apiRows;
    let hydrationUsed = false;

    const needsEspnIds = rows.some((row) => !row.espnTeamId);
    if (needsEspnIds) {
      attempted.push("espn");
      const espnHydrateEnvelope = await espnTeams.searchTeams(sport, q, "live", limit, ctx.cacheBust);
      const espnRows = safeArray(espnHydrateEnvelope.data);
      if (!espnHydrateEnvelope.error && espnRows.length > 0) {
        const mergedRows = mergeTeamSearchRows(rows, espnRows);
        hydrationUsed = mergedRows.some((row, idx) => row.espnTeamId && !rows[idx]?.espnTeamId);
        rows = mergedRows;
      } else if (espnHydrateEnvelope.meta.warning) {
        warnings.push(espnHydrateEnvelope.meta.warning);
      }
    }

    return {
      data: rows,
      meta: buildHybridMeta({
        baseMeta: apiEnvelope.meta,
        sourceUsed: resolveSourceWithCache("apiSports", apiEnvelope.meta),
        attemptedSources: attempted,
        warnings,
        hydrationUsed,
        dataModeEffective: "live",
      }),
    };
  }
  if (apiEnvelope.meta.warning) {
    warnings.push(apiEnvelope.meta.warning);
  }

  attempted.push("espn");
  const espnEnvelope = await espnTeams.searchTeams(sport, q, "live", limit, ctx.cacheBust);
  const espnRows = safeArray(espnEnvelope.data);
  if (!espnEnvelope.error && espnRows.length > 0) {
    let rows = espnRows;
    let hydrationUsed = false;

    const needsApiIds = rows.some((row) => !row.apiSportsTeamId);
    if (needsApiIds) {
      const apiHydrateEnvelope = await apiSportsTeams.searchTeams(sport, q, limit, "live", ctx.cacheBust);
      const apiHydrateRows = safeArray(apiHydrateEnvelope.data);
      if (!apiHydrateEnvelope.error && apiHydrateRows.length > 0) {
        const mergedRows = mergeTeamSearchRows(rows, apiHydrateRows);
        hydrationUsed = mergedRows.some((row, idx) => row.apiSportsTeamId && !rows[idx]?.apiSportsTeamId);
        rows = mergedRows;
      } else if (apiHydrateEnvelope.meta.warning) {
        warnings.push(apiHydrateEnvelope.meta.warning);
      }
    }

    return {
      data: rows,
      meta: buildHybridMeta({
        baseMeta: espnEnvelope.meta,
        sourceUsed: resolveSourceWithCache("espn", espnEnvelope.meta),
        attemptedSources: attempted,
        warnings,
        hydrationUsed,
        dataModeEffective: "live",
      }),
    };
  }
  if (espnEnvelope.meta.warning) {
    warnings.push(espnEnvelope.meta.warning);
  }

  if (mode === "auto") {
    attempted.push("fixture");
    const fixtureEnvelope = await fetchFixtureTeamsSearch(sport, q, limit, ctx.cacheBust);
    return {
      ...fixtureEnvelope,
      data: safeArray(fixtureEnvelope.data),
      meta: buildHybridMeta({
        baseMeta: fixtureEnvelope.meta,
        sourceUsed: "fixture",
        attemptedSources: attempted,
        warnings,
        hydrationUsed: false,
        dataModeEffective: "fixture",
      }),
      error: fixtureEnvelope.error ?? espnEnvelope.error ?? apiEnvelope.error,
    };
  }

  return {
    ...espnEnvelope,
    data: safeArray(espnEnvelope.data),
    meta: buildHybridMeta({
      baseMeta: espnEnvelope.meta,
      sourceUsed: resolveSourceWithCache("espn", espnEnvelope.meta),
      attemptedSources: attempted,
      warnings,
      hydrationUsed: false,
      dataModeEffective: "live",
    }),
    error: espnEnvelope.error ?? apiEnvelope.error,
  };
}

async function resolveTeamsAdvancedAuto(
  sport: SportKey,
  teamKeys: string[],
  mode: "beginner" | "advanced",
  ctx: ProviderContext,
): Promise<Envelope<TeamsAdvancedResult>> {
  const normalizedRefs = normalizeTeamRefs(teamKeys, ctx.teamRefs);
  const normalizedTeamKeys = normalizedRefs.map((row) => row.teamKey);
  const requestedMode = normalizeContextMode(ctx.dataMode);
  if (requestedMode === "fixture") {
    const fixtureEnvelope = await fetchFixtureTeamsAdvanced(sport, normalizedTeamKeys, mode, ctx.cacheBust);
    return {
      ...fixtureEnvelope,
      data: fixtureEnvelope.data
        ? { ...fixtureEnvelope.data, teams: applyTeamRefs(fixtureEnvelope.data.teams, normalizedRefs) }
        : fixtureEnvelope.data,
      meta: buildHybridMeta({
        baseMeta: fixtureEnvelope.meta,
        sourceUsed: "fixture",
        attemptedSources: ["fixture"],
        warnings: [],
        hydrationUsed: false,
        dataModeEffective: "fixture",
      }),
    };
  }

  const attempted: ProviderAttemptSource[] = ["apiSports"];
  const warnings: string[] = [];
  const apiEnvelope = await apiSportsAdvanced.getTeamsAdvanced(sport, normalizedRefs, mode, "live", ctx.cacheBust);
  const apiData = apiEnvelope.data
    ? { ...apiEnvelope.data, teams: applyTeamRefs(apiEnvelope.data.teams, normalizedRefs) }
    : apiEnvelope.data;
  const apiMissingSections = (apiData?.teams ?? []).flatMap((team) => teamMissingSections(team, mode));
  if (!apiEnvelope.error && apiMissingSections.length === 0 && isTeamsAdvancedComplete(apiData, mode)) {
    return {
      ...apiEnvelope,
      meta: buildHybridMeta({
        baseMeta: apiEnvelope.meta,
        sourceUsed: resolveSourceWithCache("apiSports", apiEnvelope.meta),
        attemptedSources: attempted,
        warnings,
        hydrationUsed: false,
        dataModeEffective: "live",
      }),
    };
  }
  if (apiEnvelope.meta.warning) {
    warnings.push(apiEnvelope.meta.warning);
  }
  if (apiMissingSections.length > 0) {
    warnings.push(`API-Sports teams advanced missing sections: ${uniqueStrings(apiMissingSections).join(", ")}.`);
  }

  attempted.push("espn");
  const espnEnvelope = await espnAdvanced.getTeamsAdvanced(sport, normalizedTeamKeys, mode, "live", ctx.cacheBust);
  const espnData = espnEnvelope.data
    ? { ...espnEnvelope.data, teams: applyTeamRefs(espnEnvelope.data.teams, normalizedRefs) }
    : espnEnvelope.data;
  const apiTeamsMap = new Map((apiData?.teams ?? []).map((team) => [team.teamKey.toUpperCase(), team]));
  const espnTeamsMap = new Map((espnData?.teams ?? []).map((team) => [team.teamKey.toUpperCase(), team]));
  const mergedTeams = Array.from(new Set(normalizedTeamKeys.map((teamKey) => teamKey.trim().toUpperCase()).filter(Boolean)))
    .map((teamKey) => mergeTeamAdvancedRow(apiTeamsMap.get(teamKey), espnTeamsMap.get(teamKey)))
    .filter((team): team is TeamAdvanced => team !== null);
  const mergedLive: TeamsAdvancedResult | null = mergedTeams.length > 0 ? { sport, teams: mergedTeams } : espnData;
  const mergedMissingSections = (mergedLive?.teams ?? []).flatMap((team) => teamMissingSections(team, mode));
  const sourceUsed = apiData?.teams?.length
    ? resolveSourceWithCache("apiSports", apiEnvelope.meta)
    : resolveSourceWithCache("espn", espnEnvelope.meta);

  if (mergedMissingSections.length === 0 && isTeamsAdvancedComplete(mergedLive, mode)) {
    return {
      data: mergedLive,
      meta: buildHybridMeta({
        baseMeta: sourceUsed === "apiSports" || sourceUsed === "cache" ? apiEnvelope.meta : espnEnvelope.meta,
        sourceUsed,
        attemptedSources: attempted,
        warnings,
        hydrationUsed: Boolean(apiData?.teams?.length && espnData?.teams?.length),
        dataModeEffective: "live",
      }),
    };
  }
  if (espnEnvelope.meta.warning) {
    warnings.push(espnEnvelope.meta.warning);
  }
  if (mergedMissingSections.length > 0) {
    warnings.push(`Live teams advanced still missing sections after ESPN enrichment: ${uniqueStrings(mergedMissingSections).join(", ")}.`);
  }

  if (requestedMode === "auto") {
    attempted.push("fixture");
    const fixtureEnvelope = await fetchFixtureTeamsAdvanced(sport, normalizedTeamKeys, mode, ctx.cacheBust);
    const fixtureData = fixtureEnvelope.data
      ? { ...fixtureEnvelope.data, teams: applyTeamRefs(fixtureEnvelope.data.teams, normalizedRefs) }
      : fixtureEnvelope.data;
    const fixtureMap = new Map((fixtureData?.teams ?? []).map((team) => [team.teamKey.toUpperCase(), team]));
    const hydratedTeams = Array.from(new Set(normalizedTeamKeys.map((teamKey) => teamKey.trim().toUpperCase()).filter(Boolean)))
      .map((teamKey) => mergeTeamAdvancedRow(mergedLive?.teams.find((team) => team.teamKey.toUpperCase() === teamKey), fixtureMap.get(teamKey)))
      .filter((team): team is TeamAdvanced => team !== null);
    const hydratedResult: TeamsAdvancedResult | null = hydratedTeams.length > 0 ? { sport, teams: hydratedTeams } : fixtureData;
    const hydratedMissingSections = (hydratedResult?.teams ?? []).flatMap((team) => teamMissingSections(team, mode));
    const hydrationImproved = hydratedMissingSections.length < mergedMissingSections.length;
    if (hydratedResult) {
      const hydrationNote = hydrationImproved
        ? "Live team advanced data remained incomplete after ESPN; using fixture fallback for missing sections."
        : "Live team advanced data remained incomplete after ESPN; returning fixture fallback.";
      return {
        data: hydratedResult,
        meta: buildHybridMeta({
          baseMeta: fixtureEnvelope.meta,
          sourceUsed: "fixture",
          attemptedSources: attempted,
          warnings: [...warnings, hydrationNote],
          hydrationUsed: Boolean(hydratedTeams.length && mergedLive?.teams?.length),
          dataModeEffective: "fixture",
        }),
      };
    }
    return {
      data: null,
      meta: buildHybridMeta({
        baseMeta: fixtureEnvelope.meta,
        sourceUsed: "fixture",
        attemptedSources: attempted,
        warnings,
        hydrationUsed: false,
        dataModeEffective: "fixture",
      }),
      error: fixtureEnvelope.error ?? espnEnvelope.error ?? apiEnvelope.error,
    };
  }

  return {
    data: mergedLive,
    meta: buildHybridMeta({
      baseMeta: sourceUsed === "apiSports" || sourceUsed === "cache" ? apiEnvelope.meta : espnEnvelope.meta,
      sourceUsed,
      attemptedSources: attempted,
      warnings,
      hydrationUsed: Boolean(apiData?.teams?.length && espnData?.teams?.length),
      dataModeEffective: "live",
    }),
    error: espnEnvelope.error ?? apiEnvelope.error,
  };
}

export const hybridProviders: HybridProviderContract = {
  async searchPlayers(sport, q, limit, ctx) {
    return resolveSearchPlayers(sport, q, limit, ctx);
  },
  async getPlayerProfile(sport, playerId, ctx) {
    return resolvePlayerProfileAuto(sport, playerId, ctx);
  },
  async getPlayerInsights(sport, playerId, mode, ctx) {
    return resolvePlayerInsightsAuto(sport, playerId, mode, ctx);
  },
  async searchTeams(sport, q, limit, ctx) {
    return resolveTeamsSearchAuto(sport, q, limit, ctx);
  },
  async getTeamAdvanced(sport, teamKeys, mode, ctx) {
    return resolveTeamsAdvancedAuto(sport, teamKeys, mode, ctx);
  },
};

export async function resolvePlayersSearch(
  sport: SportKey,
  q: string,
  limit: number,
  ctx: ProviderContext,
): Promise<Envelope<PlayerSearchResult[]>> {
  return hybridProviders.searchPlayers(sport, q, limit, ctx);
}

export async function resolvePlayerProfile(
  sport: SportKey,
  playerId: string,
  ctx: ProviderContext,
): Promise<Envelope<PlayerProfile>> {
  return hybridProviders.getPlayerProfile(sport, playerId, ctx);
}

export async function resolvePlayerInsights(
  sport: SportKey,
  playerId: string,
  mode: "beginner" | "advanced",
  ctx: ProviderContext,
): Promise<Envelope<PlayerInsights>> {
  return hybridProviders.getPlayerInsights(sport, playerId, mode, ctx);
}

export async function resolveTeamsSearch(
  sport: SportKey,
  q: string,
  limit: number,
  ctx: ProviderContext,
): Promise<Envelope<TeamSearchResult[]>> {
  return hybridProviders.searchTeams(sport, q, limit, ctx);
}

export async function resolveTeamAdvanced(
  sport: SportKey,
  teamKeys: string[],
  mode: "beginner" | "advanced",
  ctx: ProviderContext,
): Promise<Envelope<TeamsAdvancedResult>> {
  return hybridProviders.getTeamAdvanced(sport, teamKeys, mode, ctx);
}

