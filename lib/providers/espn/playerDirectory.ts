import { randomUUID } from "node:crypto";
import { fetchEspnJson, getDataMode } from "@/lib/providers/espn/client";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, PlayerProfile, PlayerSearchResult, SportKey } from "@/lib/types/players";

type ModeArg = "live" | "fixture";
type CacheBustArg = string | number | null | undefined;

type SportConfig = {
  sportPath: "football" | "baseball" | "basketball";
  league: "nfl" | "mlb" | "nba";
  searchFixtureFile: string;
  profileFixtureFile: string;
  gamelogFixtureFile: string;
  scoreboardFixtureFile: string;
  scoreboardFixtureSubdir: string;
};

type SearchArgs = {
  sport: SportKey;
  query: string;
  limit?: number;
  dataMode?: ModeArg;
  cacheBust?: CacheBustArg;
};

type CoreAthleteArgs = {
  sport: SportKey;
  playerId: string;
  dataMode?: ModeArg;
  cacheBust?: CacheBustArg;
};

type GameLogArgs = {
  sport: SportKey;
  playerId: string;
  dataMode?: ModeArg;
  cacheBust?: CacheBustArg;
};

type ScoreboardArgs = {
  sport: SportKey;
  date?: string;
  dataMode?: ModeArg;
  cacheBust?: CacheBustArg;
};

const SPORT_CONFIG: Record<SportKey, SportConfig> = {
  nfl: {
    sportPath: "football",
    league: "nfl",
    searchFixtureFile: "nfl_search_daniel_jones.json",
    profileFixtureFile: "nfl_profile_sample.json",
    gamelogFixtureFile: "nfl_athlete_gamelog_sample.json",
    scoreboardFixtureFile: "scoreboard_with_games.json",
    scoreboardFixtureSubdir: "nfl",
  },
  mlb: {
    sportPath: "baseball",
    league: "mlb",
    searchFixtureFile: "mlb_search_juan_soto.json",
    profileFixtureFile: "mlb_profile_sample.json",
    gamelogFixtureFile: "mlb_athlete_gamelog_32827.json",
    scoreboardFixtureFile: "mlb_scoreboard_sample.json",
    scoreboardFixtureSubdir: "scoreboard",
  },
  nba: {
    sportPath: "basketball",
    league: "nba",
    searchFixtureFile: "nba_search_lebron_james.json",
    profileFixtureFile: "nba_profile_sample.json",
    gamelogFixtureFile: "nba_athlete_gamelog_1966.json",
    scoreboardFixtureFile: "nba_scoreboard_sample.json",
    scoreboardFixtureSubdir: "scoreboard",
  },
};

function resolveSportKey(input: string | null | undefined): SportKey {
  if (input === "mlb" || input === "nba" || input === "nfl") {
    return input;
  }
  return "nfl";
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const next = value.trim();
  return next.length > 0 ? next : undefined;
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

function normalizeCacheBust(value: CacheBustArg): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractIdFromRef(value: unknown): string | undefined {
  const ref = readString(value);
  if (!ref) return undefined;
  const match = ref.match(/\/athletes\/(\d+)/);
  return match?.[1];
}

function extractHeadshot(candidateInput: unknown): string | undefined {
  const candidate = asObject(candidateInput);
  if (!candidate) {
    return undefined;
  }

  const direct = readString(candidate.headshot)
    ?? readString(candidate.headshotUrl)
    ?? readString(candidate.image)
    ?? readString(candidate.href)
    ?? readString(candidate.url);
  if (direct) {
    return direct;
  }

  const headshotObj = asObject(candidate.headshot);
  if (headshotObj) {
    return readString(headshotObj.href) ?? readString(headshotObj.url);
  }

  const images = Array.isArray(candidate.images) ? candidate.images : [];
  for (const image of images) {
    const typed = asObject(image);
    if (!typed) continue;
    const type = readString(typed.type)?.toLowerCase();
    if (!type || type.includes("athlete") || type.includes("headshot")) {
      const found = readString(typed.url) ?? readString(typed.href);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

function extractTeamLogo(candidateInput: unknown): string | undefined {
  const candidate = asObject(candidateInput);
  if (!candidate) {
    return undefined;
  }

  const direct = readString(candidate.teamLogoUrl) ?? readString(candidate.logo);
  if (direct) {
    return direct;
  }

  const images = Array.isArray(candidate.images) ? candidate.images : [];
  for (const image of images) {
    const typed = asObject(image);
    if (!typed) continue;
    const type = readString(typed.type)?.toLowerCase();
    if (type && (type.includes("team") || type.includes("logo"))) {
      const found = readString(typed.url) ?? readString(typed.href);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

function toSearchResult(candidateInput: unknown): PlayerSearchResult | null {
  const outer = asObject(candidateInput);
  if (!outer) {
    return null;
  }

  const athlete = asObject(outer.athlete) ?? outer;
  const team = asObject(athlete.team) ?? asObject(outer.team);
  const position = asObject(athlete.position) ?? asObject(outer.position);

  const playerId =
    readString(athlete.id)
    ?? readString(outer.id)
    ?? readString(athlete.playerId)
    ?? extractIdFromRef(athlete.$ref)
    ?? extractIdFromRef(outer.$ref);

  const fullName =
    readString(athlete.fullName)
    ?? readString(athlete.displayName)
    ?? readString(outer.displayName)
    ?? readString(outer.fullName)
    ?? readString(athlete.shortName)
    ?? readString(outer.shortName)
    ?? readString(outer.name);

  if (!playerId || !fullName) {
    return null;
  }

  const result: PlayerSearchResult = {
    playerId,
    fullName,
  };

  const teamName =
    readString(team?.displayName)
    ?? readString(team?.name)
    ?? readString(outer.teamName)
    ?? readString(outer.description);
  if (teamName) {
    result.teamName = teamName;
  }

  const teamAbbr = readString(team?.abbreviation) ?? readString(outer.teamAbbr) ?? readString(outer.teamKey);
  if (teamAbbr) {
    result.teamAbbr = teamAbbr.toUpperCase();
  }

  const positionName =
    readString(position?.abbreviation)
    ?? readString(position?.displayName)
    ?? readString(position?.name)
    ?? readString(outer.position)
    ?? readString(outer.positionName);
  if (positionName) {
    result.position = positionName;
  }

  const jersey = readString(athlete.jersey) ?? readString(outer.jersey);
  if (jersey) {
    result.jersey = jersey;
  }

  const headshotUrl = extractHeadshot(athlete) ?? extractHeadshot(outer);
  if (headshotUrl) {
    result.headshot = headshotUrl;
    result.headshotUrl = headshotUrl;
  }

  const teamLogoUrl = extractTeamLogo(athlete) ?? extractTeamLogo(outer);
  if (teamLogoUrl) {
    result.teamLogoUrl = teamLogoUrl;
  }

  return result;
}

function mapSearchPayload(payload: unknown): { results: PlayerSearchResult[]; warning?: string } {
  const data = asObject(payload);
  if (!data) {
    return {
      results: [],
      warning: "Upstream search payload was not an object.",
    };
  }

  const athletesArray = Array.isArray(data.athletes) ? data.athletes : [];
  const itemsArray = Array.isArray(data.items) ? data.items : [];
  const resultsArray = Array.isArray(data.results) ? data.results : [];
  const rows = athletesArray.length > 0 ? athletesArray : (itemsArray.length > 0 ? itemsArray : resultsArray);

  const mapped = rows
    .map((row) => toSearchResult(row))
    .filter((row): row is PlayerSearchResult => row !== null);

  const deduped = mapped.filter((row, index, all) => all.findIndex((candidate) => candidate.playerId === row.playerId) === index);

  return {
    results: deduped,
    warning: rows.length > 0 && deduped.length === 0
      ? "Upstream search payload was missing expected player fields."
      : undefined,
  };
}

function mergeWarning(meta: Meta, warning?: string): Meta {
  if (!warning) {
    return meta;
  }

  const combined = meta.warning ? `${meta.warning} ${warning}` : warning;
  return {
    ...meta,
    warning: combined,
  };
}

function fallbackMeta(dataMode: ModeArg, sourceUsed: Meta["sourceUsed"], warning?: string): Meta {
  return {
    sourceUsed,
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode,
  };
}

function mapProfilePayload(payload: unknown, fallbackPlayerId: string): { profile: PlayerProfile | null; warning?: string } {
  const data = asObject(payload);
  if (!data) {
    return {
      profile: null,
      warning: "Upstream profile payload was not an object.",
    };
  }

  const athlete = asObject(data.athlete)
    ?? (Array.isArray(data.athletes) ? asObject(data.athletes[0]) : null)
    ?? data;

  if (!athlete) {
    return {
      profile: null,
      warning: "Upstream profile payload did not include athlete details.",
    };
  }

  const team = asObject(athlete.team);
  const position = asObject(athlete.position);

  const playerId = readString(athlete.id) ?? fallbackPlayerId;
  const fullName =
    readString(athlete.fullName)
    ?? readString(athlete.displayName)
    ?? [readString(athlete.firstName), readString(athlete.lastName)].filter(Boolean).join(" ")
    ?? fallbackPlayerId;

  if (!playerId || !fullName) {
    return {
      profile: null,
      warning: "Upstream profile payload was missing player identity fields.",
    };
  }

  const profile: PlayerProfile = {
    playerId,
    fullName,
  };

  const teamName = readString(team?.displayName) ?? readString(team?.name);
  if (teamName) {
    profile.teamName = teamName;
  }

  const teamAbbrev = readString(team?.abbreviation) ?? readString(team?.shortDisplayName);
  if (teamAbbrev) {
    profile.teamAbbrev = teamAbbrev.toUpperCase();
  }

  const positionName =
    readString(position?.abbreviation)
    ?? readString(position?.displayName)
    ?? readString(position?.name)
    ?? readString(athlete.positionAbbreviation);
  if (positionName) {
    profile.position = positionName;
  }

  const headshot = extractHeadshot(athlete) ?? extractHeadshot(data);
  if (headshot) {
    profile.headshot = headshot;
  }

  const jersey = readString(athlete.jersey);
  if (jersey) {
    profile.jersey = jersey;
  }

  const age = readNumber(athlete.age);
  if (typeof age === "number") {
    profile.age = age;
  }

  const height = readString(athlete.displayHeight) ?? readString(athlete.height);
  if (height) {
    profile.height = height;
  }

  const weight = readString(athlete.displayWeight)
    ?? (() => {
      const numeric = readNumber(athlete.weight);
      return typeof numeric === "number" ? `${numeric} lbs` : undefined;
    })();
  if (weight) {
    profile.weight = weight;
  }

  const battingHand = asObject(athlete.battingHand) ?? asObject(athlete.batHand) ?? asObject(athlete.batSide);
  const throwingHand = asObject(athlete.throwingHand) ?? asObject(athlete.pitchHand);

  const bats = readString(battingHand?.abbreviation) ?? readString(battingHand?.displayName) ?? readString(battingHand?.name) ?? readString(athlete.bats);
  if (bats) {
    profile.bats = bats;
  }

  const throws = readString(throwingHand?.abbreviation) ?? readString(throwingHand?.displayName) ?? readString(throwingHand?.name) ?? readString(athlete.throws);
  if (throws) {
    profile.throws = throws;
  }

  const injuries = Array.isArray(athlete.injuries) ? athlete.injuries : [];
  const injury = injuries.length > 0 ? asObject(injuries[0]) : null;
  if (injury) {
    profile.injury = {
      status: readString(injury.status) ?? readString(injury.type),
      detail: readString(injury.detail) ?? readString(injury.shortComment) ?? readString(injury.longComment),
    };
  }

  const warning = !profile.teamName && !profile.position && !profile.headshot
    ? "Profile loaded with limited fields from upstream."
    : undefined;

  return { profile, warning };
}

function mergeProfiles(primary: PlayerProfile | null, secondary: PlayerProfile | null): PlayerProfile | null {
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
    playerId: secondary.playerId || primary.playerId,
    fullName: secondary.fullName || primary.fullName,
    teamAbbrev: secondary.teamAbbrev ?? primary.teamAbbrev,
    teamName: secondary.teamName ?? primary.teamName,
    position: secondary.position ?? primary.position,
    headshot: secondary.headshot ?? primary.headshot,
    jersey: secondary.jersey ?? primary.jersey,
    age: secondary.age ?? primary.age,
    height: secondary.height ?? primary.height,
    weight: secondary.weight ?? primary.weight,
    bats: secondary.bats ?? primary.bats,
    throws: secondary.throws ?? primary.throws,
    injury: secondary.injury ?? primary.injury,
    whyItMatters: secondary.whyItMatters ?? primary.whyItMatters,
    tooltip: secondary.tooltip ?? primary.tooltip,
    stats: secondary.stats ?? primary.stats,
    learnMore: secondary.learnMore ?? primary.learnMore,
  };
}

export function getSportEndpointConfig(sportInput: SportKey): SportConfig {
  return SPORT_CONFIG[resolveSportKey(sportInput)];
}

export async function getCoreAthlete(args: CoreAthleteArgs): Promise<Envelope<unknown>> {
  const sport = resolveSportKey(args.sport);
  const mode = getDataMode(args.dataMode);
  const playerId = args.playerId.trim();

  if (!playerId) {
    return {
      data: null,
      meta: fallbackMeta(mode, mode === "fixture" ? "fixture" : "espn", "playerId is required"),
      error: {
        message: "playerId is required",
        code: "MISSING_PLAYER_ID",
      },
    };
  }

  try {
    const config = SPORT_CONFIG[sport];
    const response = await fetchEspnJson<unknown>({
      endpoint: `https://sports.core.api.espn.com/v2/sports/${config.sportPath}/leagues/${config.league}/athletes/${encodeURIComponent(playerId)}`,
      params: {
        lang: "en",
        region: "us",
      },
      fixtureFile: config.profileFixtureFile,
      fixtureSubdir: "players",
      ttlSeconds: 600,
      dataMode: mode,
      cacheBust: normalizeCacheBust(args.cacheBust),
    });

    return {
      data: response.data,
      meta: response.meta,
    };
  } catch (error) {
    return {
      data: null,
      meta: fallbackMeta(mode, mode === "fixture" ? "fixture" : "espn", String(error)),
      error: {
        message: `Failed to load core athlete profile: ${String(error)}`,
        code: "UPSTREAM_ERROR",
      },
    };
  }
}

export async function getGameLog(args: GameLogArgs): Promise<Envelope<unknown>> {
  const sport = resolveSportKey(args.sport);
  const mode = getDataMode(args.dataMode);
  const playerId = args.playerId.trim();

  if (!playerId) {
    return {
      data: null,
      meta: fallbackMeta(mode, mode === "fixture" ? "fixture" : "espn", "playerId is required"),
      error: {
        message: "playerId is required",
        code: "MISSING_PLAYER_ID",
      },
    };
  }

  try {
    const config = SPORT_CONFIG[sport];
    const response = await fetchEspnJson<unknown>({
      endpoint: `https://site.web.api.espn.com/apis/common/v3/sports/${config.sportPath}/${config.league}/athletes/${encodeURIComponent(playerId)}/gamelog`,
      fixtureFile: config.gamelogFixtureFile,
      fixtureSubdir: "gamelog",
      ttlSeconds: 240,
      dataMode: mode,
      cacheBust: normalizeCacheBust(args.cacheBust),
    });

    return {
      data: response.data,
      meta: response.meta,
    };
  } catch (error) {
    return {
      data: null,
      meta: fallbackMeta(mode, mode === "fixture" ? "fixture" : "espn", String(error)),
      error: {
        message: `Failed to load player gamelog: ${String(error)}`,
        code: "UPSTREAM_ERROR",
      },
    };
  }
}

export async function getScoreboard(args: ScoreboardArgs): Promise<Envelope<unknown>> {
  const sport = resolveSportKey(args.sport);
  const mode = getDataMode(args.dataMode);

  try {
    const config = SPORT_CONFIG[sport];
    const response = await fetchEspnJson<unknown>({
      endpoint: `https://site.api.espn.com/apis/site/v2/sports/${config.sportPath}/${config.league}/scoreboard`,
      params: {
        dates: args.date,
      },
      fixtureFile: config.scoreboardFixtureFile,
      fixtureSubdir: config.scoreboardFixtureSubdir,
      ttlSeconds: 60,
      dataMode: mode,
      cacheBust: normalizeCacheBust(args.cacheBust),
    });

    return {
      data: response.data,
      meta: response.meta,
    };
  } catch (error) {
    return {
      data: null,
      meta: fallbackMeta(mode, mode === "fixture" ? "fixture" : "espn", String(error)),
      error: {
        message: `Failed to load scoreboard: ${String(error)}`,
        code: "UPSTREAM_ERROR",
      },
    };
  }
}

async function searchPlayersByOptions(args: SearchArgs): Promise<Envelope<PlayerSearchResult[]>> {
  const sport = resolveSportKey(args.sport);
  const mode = getDataMode(args.dataMode);
  const trimmed = args.query.trim();
  const limit = Math.max(1, Math.min(8, Math.floor(args.limit ?? 8)));

  if (!trimmed) {
    return {
      data: null,
      meta: fallbackMeta(mode, mode === "fixture" ? "fixture" : "espn", "q is required"),
      error: {
        message: "q is required",
        code: "MISSING_QUERY",
      },
    };
  }

  const config = SPORT_CONFIG[sport];
  try {
    const searchResponse = await fetchEspnJson<unknown>({
      endpoint: "https://site.web.api.espn.com/apis/common/v3/search",
      params: {
        query: trimmed,
        type: "player",
        limit,
      },
      fixtureFile: config.searchFixtureFile,
      fixtureSubdir: "players",
      ttlSeconds: 300,
      dataMode: mode,
      cacheBust: normalizeCacheBust(args.cacheBust),
    });

    const mapped = mapSearchPayload(searchResponse.data);
    return {
      data: mapped.results.slice(0, limit),
      meta: mergeWarning(searchResponse.meta, mapped.warning),
    };
  } catch (error) {
    const warning = `Common player search unavailable, returning empty results: ${String(error)}`;
    return {
      data: [],
      meta: fallbackMeta(mode, mode === "fixture" ? "fixture" : "espn", warning),
    };
  }
}

export async function searchPlayers(
  sportOrArgs: SportKey | SearchArgs,
  query?: string,
  dataMode?: ModeArg,
  limit = 8,
  cacheBust?: CacheBustArg,
): Promise<Envelope<PlayerSearchResult[]>> {
  if (typeof sportOrArgs === "object") {
    return searchPlayersByOptions(sportOrArgs);
  }

  return searchPlayersByOptions({
    sport: sportOrArgs,
    query: query ?? "",
    dataMode,
    limit,
    cacheBust,
  });
}

export async function getPlayerProfile(
  sportInput: SportKey,
  playerIdInput: string,
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<Envelope<PlayerProfile>> {
  const sport = resolveSportKey(sportInput);
  const mode = getDataMode(dataMode);
  const playerId = playerIdInput.trim();

  if (!playerId) {
    return {
      data: null,
      meta: fallbackMeta(mode, mode === "fixture" ? "fixture" : "espn", "playerId is required"),
      error: {
        message: "playerId is required",
        code: "MISSING_PLAYER_ID",
      },
    };
  }

  const notes: string[] = [];
  const coreEnvelope = await getCoreAthlete({ sport, playerId, dataMode: mode, cacheBust });
  if (coreEnvelope.error || !coreEnvelope.data) {
    return {
      data: null,
      meta: mergeWarning(coreEnvelope.meta, "Unable to load player profile from ESPN core athlete endpoint."),
      error: coreEnvelope.error,
    };
  }

  const coreMapped = mapProfilePayload(coreEnvelope.data, playerId);
  let mergedProfile = coreMapped.profile;
  let mergedMeta = mergeWarning(coreEnvelope.meta, coreMapped.warning);

  if (mode === "live") {
    const config = SPORT_CONFIG[sport];
    try {
      const siteResponse = await fetchEspnJson<unknown>({
        endpoint: `https://site.api.espn.com/apis/site/v2/sports/${config.sportPath}/${config.league}/athletes/${encodeURIComponent(playerId)}`,
        ttlSeconds: 600,
        dataMode: mode,
        cacheBust: normalizeCacheBust(cacheBust),
      });
      const siteMapped = mapProfilePayload(siteResponse.data, playerId);
      mergedProfile = mergeProfiles(mergedProfile, siteMapped.profile);
      mergedMeta = mergeWarning(siteResponse.meta, siteMapped.warning);
    } catch {
      notes.push("Using ESPN core athlete profile (league site athlete endpoint unavailable).");
    }
  }

  if (!mergedProfile) {
    return {
      data: null,
      meta: mergeWarning(mergedMeta, notes.length > 0 ? notes.join(" ") : "No player profile data returned from upstream."),
    };
  }

  return {
    data: mergedProfile,
    meta: mergeWarning(mergedMeta, notes.length > 0 ? notes.join(" ") : undefined),
  };
}

export function normalizeSportKey(input: string | null | undefined): SportKey {
  return resolveSportKey(input);
}
