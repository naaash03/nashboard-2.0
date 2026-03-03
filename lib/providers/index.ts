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
import type { Envelope, PlayerProfile, PlayerSearchResult, SportKey, TeamSearchResult } from "@/lib/types/players";
import type { PlayerInsights, TeamAdvanced } from "@/lib/types/playerInsights";

export type ProviderAttemptSource = "apiSports" | "espn" | "fixture";
export type ProviderDataModeEffective = "live" | "fixture";

export type ProviderContext = {
  dataMode: DataMode;
  cacheBust?: string | number | undefined;
  mode?: "beginner" | "advanced";
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
  return {
    ...secondary,
    ...primary,
    fullName: primary.fullName ?? secondary.fullName,
    teamAbbrev: primary.teamAbbrev ?? secondary.teamAbbrev,
    teamName: primary.teamName ?? secondary.teamName,
    injury: primary.injury ?? secondary.injury ?? null,
    live: primary.live ?? secondary.live ?? null,
    season: primary.season ?? secondary.season,
    recent: primary.recent ?? secondary.recent,
    metaNotes: mergedMetaNotes.length > 0 ? mergedMetaNotes : undefined,
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
  return {
    teamKey: primary.teamKey || secondary.teamKey,
    teamName: primary.teamName ?? secondary.teamName,
    status: primary.status?.hasGameToday || secondary.status?.hasGameToday ? (primary.status ?? secondary.status) : secondary.status,
    nextGame: primary.nextGame ?? secondary.nextGame ?? null,
    record: primary.record ?? secondary.record ?? null,
    standings: primary.standings ?? secondary.standings ?? null,
    lastGame: primary.lastGame ?? secondary.lastGame ?? null,
    metaNotes: [...(primary.metaNotes ?? []), ...(secondary.metaNotes ?? [])],
  };
}

export function isPlayerProfileComplete(profile: PlayerProfile | null): boolean {
  if (!profile?.fullName) {
    return false;
  }
  const hasTeamOrPosition = Boolean(profile.teamName || profile.teamAbbrev || profile.position);
  const hasBioField = Boolean(profile.headshot || typeof profile.age === "number" || profile.height || profile.weight);
  return hasTeamOrPosition && hasBioField;
}

export function isPlayerInsightsComplete(
  insights: PlayerInsights | null,
  sport: SportKey,
  mode: "beginner" | "advanced",
): boolean {
  if (!insights) {
    return false;
  }
  if (mode !== "advanced") {
    return Boolean(insights.fullName || insights.teamName || insights.teamAbbrev);
  }

  const hasSeason = Boolean(insights.season?.metrics && insights.season.metrics.length > 0);
  const hasRecent = Boolean(insights.recent?.games && insights.recent.games.length > 0);
  if (sport === "mlb") {
    return hasSeason || hasRecent;
  }
  if (sport === "nba") {
    return hasSeason || hasRecent;
  }
  return hasSeason || hasRecent;
}

export function isTeamAdvancedComplete(team: TeamAdvanced | null | undefined): boolean {
  if (!team) {
    return false;
  }
  const hasIdentity = Boolean(team.teamName || team.teamKey);
  const hasDetail = Boolean(
    team.status?.hasGameToday
      || team.nextGame
      || team.record
      || team.standings
      || team.lastGame,
  );
  return hasIdentity && hasDetail;
}

function isTeamsAdvancedComplete(result: TeamsAdvancedResult | null | undefined): boolean {
  if (!result || result.teams.length === 0) {
    return false;
  }
  return result.teams.every((team) => isTeamAdvancedComplete(team));
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
  if (!apiEnvelope.error && isPlayerProfileComplete(apiData)) {
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
  const espnEnvelope = await espnPlayers.getPlayerProfile(sport, playerId, "live", ctx.cacheBust);
  const mergedLive = mergeProfile(apiData, espnEnvelope.data);
  if (isPlayerProfileComplete(mergedLive)) {
    const sourceUsed = apiData
      ? resolveSourceWithCache("apiSports", apiEnvelope.meta)
      : resolveSourceWithCache("espn", espnEnvelope.meta);
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

  if (mode === "auto") {
    attempted.push("fixture");
    const fixtureEnvelope = await fetchFixturePlayerProfile(sport, playerId, ctx.cacheBust);
    const mergedFixture = mergeProfile(mergeProfile(apiData, espnEnvelope.data), fixtureEnvelope.data);
    if (mergedFixture) {
      const sourceUsed = isPlayerProfileComplete(mergeProfile(apiData, espnEnvelope.data))
        ? (apiData ? resolveSourceWithCache("apiSports", apiEnvelope.meta) : resolveSourceWithCache("espn", espnEnvelope.meta))
        : fixtureEnvelope.data ? "fixture" : (apiData ? resolveSourceWithCache("apiSports", apiEnvelope.meta) : resolveSourceWithCache("espn", espnEnvelope.meta));
      return {
        data: mergedFixture,
        meta: buildHybridMeta({
          baseMeta: sourceUsed === "fixture" ? fixtureEnvelope.meta : (apiData ? apiEnvelope.meta : espnEnvelope.meta),
          sourceUsed,
          attemptedSources: attempted,
          warnings: [...warnings, "Hydrated profile gaps using fixture fallback."],
          hydrationUsed: Boolean(fixtureEnvelope.data && (apiData || espnEnvelope.data)),
          dataModeEffective: sourceUsed === "fixture" ? "fixture" : "live",
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
      baseMeta: espnEnvelope.meta,
      sourceUsed: resolveSourceWithCache("espn", espnEnvelope.meta),
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
  if (!apiEnvelope.error && isPlayerInsightsComplete(apiData, sport, mode)) {
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
  const espnEnvelope = await espnInsights.getPlayerInsights(sport, playerId, mode, "live", ctx.cacheBust);
  const mergedLive = mergeInsights(apiData, espnEnvelope.data);
  if (isPlayerInsightsComplete(mergedLive, sport, mode)) {
    const sourceUsed = apiData
      ? resolveSourceWithCache("apiSports", apiEnvelope.meta)
      : resolveSourceWithCache("espn", espnEnvelope.meta);
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

  if (requestedMode === "auto") {
    attempted.push("fixture");
    const fixtureEnvelope = await fetchFixturePlayerInsights(sport, playerId, mode, ctx.cacheBust);
    const mergedFixture = mergeInsights(mergeInsights(apiData, espnEnvelope.data), fixtureEnvelope.data);
    if (mergedFixture) {
      return {
        data: mergedFixture,
        meta: buildHybridMeta({
          baseMeta: fixtureEnvelope.meta,
          sourceUsed: fixtureEnvelope.data
            ? "fixture"
            : (apiData ? resolveSourceWithCache("apiSports", apiEnvelope.meta) : resolveSourceWithCache("espn", espnEnvelope.meta)),
          attemptedSources: attempted,
          warnings: [...warnings, "Hydrated player insights gaps using fixture fallback."],
          hydrationUsed: Boolean(fixtureEnvelope.data && (apiData || espnEnvelope.data)),
          dataModeEffective: fixtureEnvelope.data ? "fixture" : "live",
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
      baseMeta: espnEnvelope.meta,
      sourceUsed: resolveSourceWithCache("espn", espnEnvelope.meta),
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
  if (!apiEnvelope.error && safeArray(apiEnvelope.data).length > 0) {
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
  const espnEnvelope = await espnTeams.searchTeams(sport, q, "live", limit, ctx.cacheBust);
  if (!espnEnvelope.error && safeArray(espnEnvelope.data).length > 0) {
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
  const requestedMode = normalizeContextMode(ctx.dataMode);
  if (requestedMode === "fixture") {
    const fixtureEnvelope = await fetchFixtureTeamsAdvanced(sport, teamKeys, mode, ctx.cacheBust);
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
  const apiEnvelope = await apiSportsAdvanced.getTeamsAdvanced(sport, teamKeys, mode, "live", ctx.cacheBust);
  const apiData = apiEnvelope.data;
  if (!apiEnvelope.error && isTeamsAdvancedComplete(apiData)) {
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
  const espnEnvelope = await espnAdvanced.getTeamsAdvanced(sport, teamKeys, mode, "live", ctx.cacheBust);
  const apiTeamsMap = new Map((apiData?.teams ?? []).map((team) => [team.teamKey.toUpperCase(), team]));
  const espnTeamsMap = new Map((espnEnvelope.data?.teams ?? []).map((team) => [team.teamKey.toUpperCase(), team]));
  const mergedTeams = Array.from(new Set(teamKeys.map((teamKey) => teamKey.trim().toUpperCase()).filter(Boolean)))
    .map((teamKey) => mergeTeamAdvancedRow(apiTeamsMap.get(teamKey), espnTeamsMap.get(teamKey)))
    .filter((team): team is TeamAdvanced => team !== null);
  const mergedLive: TeamsAdvancedResult | null = mergedTeams.length > 0 ? { sport, teams: mergedTeams } : espnEnvelope.data;
  if (isTeamsAdvancedComplete(mergedLive)) {
    const sourceUsed = apiData?.teams?.length
      ? resolveSourceWithCache("apiSports", apiEnvelope.meta)
      : resolveSourceWithCache("espn", espnEnvelope.meta);
    return {
      data: mergedLive,
      meta: buildHybridMeta({
        baseMeta: sourceUsed === "apiSports" || sourceUsed === "cache" ? apiEnvelope.meta : espnEnvelope.meta,
        sourceUsed,
        attemptedSources: attempted,
        warnings,
        hydrationUsed: Boolean(apiData?.teams?.length && espnEnvelope.data?.teams?.length),
        dataModeEffective: "live",
      }),
    };
  }
  if (espnEnvelope.meta.warning) {
    warnings.push(espnEnvelope.meta.warning);
  }

  if (requestedMode === "auto") {
    attempted.push("fixture");
    const fixtureEnvelope = await fetchFixtureTeamsAdvanced(sport, teamKeys, mode, ctx.cacheBust);
    const fixtureMap = new Map((fixtureEnvelope.data?.teams ?? []).map((team) => [team.teamKey.toUpperCase(), team]));
    const hydratedTeams = Array.from(new Set(teamKeys.map((teamKey) => teamKey.trim().toUpperCase()).filter(Boolean)))
      .map((teamKey) => mergeTeamAdvancedRow(mergedLive?.teams.find((team) => team.teamKey.toUpperCase() === teamKey), fixtureMap.get(teamKey)))
      .filter((team): team is TeamAdvanced => team !== null);
    const hydratedResult: TeamsAdvancedResult | null = hydratedTeams.length > 0 ? { sport, teams: hydratedTeams } : fixtureEnvelope.data;
    if (hydratedResult) {
      return {
        data: hydratedResult,
        meta: buildHybridMeta({
          baseMeta: fixtureEnvelope.meta,
          sourceUsed: "fixture",
          attemptedSources: attempted,
          warnings: [...warnings, "Hydrated team advanced gaps using fixture fallback."],
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
      baseMeta: espnEnvelope.meta,
      sourceUsed: resolveSourceWithCache("espn", espnEnvelope.meta),
      attemptedSources: attempted,
      warnings,
      hydrationUsed: Boolean(apiData?.teams?.length && espnEnvelope.data?.teams?.length),
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

