import { randomUUID } from "node:crypto";
import { getDataMode, fetchEspnJson } from "@/lib/providers/espn/client";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, PlayerProfile, PlayerSearchResult, SportKey } from "@/lib/types/players";

type ModeArg = "live" | "fixture";

type SportConfig = {
  siteSport: string;
  siteLeague: string;
  searchFixtureFile: string;
  profileFixtureFile: string;
  sportFilter: string;
  leagueFilter: string;
  coreSport: string;
  coreLeague: string;
};

const SPORT_CONFIG: Record<SportKey, SportConfig> = {
  nfl: {
    siteSport: "football",
    siteLeague: "nfl",
    searchFixtureFile: "nfl_search_daniel_jones.json",
    profileFixtureFile: "nfl_profile_sample.json",
    sportFilter: "football",
    leagueFilter: "nfl",
    coreSport: "football",
    coreLeague: "nfl",
  },
  mlb: {
    siteSport: "baseball",
    siteLeague: "mlb",
    searchFixtureFile: "mlb_search_juan_soto.json",
    profileFixtureFile: "mlb_profile_sample.json",
    sportFilter: "baseball",
    leagueFilter: "mlb",
    coreSport: "baseball",
    coreLeague: "mlb",
  },
  nba: {
    siteSport: "basketball",
    siteLeague: "nba",
    searchFixtureFile: "nba_search_lebron_james.json",
    profileFixtureFile: "nba_profile_sample.json",
    sportFilter: "basketball",
    leagueFilter: "nba",
    coreSport: "basketball",
    coreLeague: "nba",
  },
};

function resolveSportKey(input: string | null | undefined): SportKey {
  if (input === "mlb" || input === "nba" || input === "nfl") {
    return input;
  }
  return "nfl";
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
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

function extractIdFromRef(value: unknown): string | undefined {
  const ref = readString(value);
  if (!ref) return undefined;
  const match = ref.match(/\/athletes\/(\d+)/);
  return match?.[1];
}

function extractHeadshot(candidate: Record<string, unknown>): string | undefined {
  const direct = readString(candidate.headshot) ?? readString(candidate.headshotUrl) ?? readString(candidate.image);
  if (direct) {
    return direct;
  }

  const headshotObj = asObject(candidate.headshot);
  if (headshotObj) {
    return readString(headshotObj.href) ?? readString(headshotObj.url);
  }

  return undefined;
}

function toSearchResult(candidateInput: unknown): PlayerSearchResult | null {
  const outer = asObject(candidateInput);
  if (!outer) {
    return null;
  }

  const athlete = asObject(outer.athlete) ?? outer;
  const team = asObject(athlete.team);
  const position = asObject(athlete.position);

  const playerId =
    readString(athlete.id) ??
    readString(outer.id) ??
    readString(athlete.playerId) ??
    extractIdFromRef(athlete.$ref) ??
    extractIdFromRef(outer.$ref);

  const fullName =
    readString(athlete.fullName) ??
    readString(athlete.displayName) ??
    readString(outer.displayName) ??
    readString(outer.fullName) ??
    readString(athlete.shortName) ??
    readString(outer.shortName);

  if (!playerId || !fullName) {
    return null;
  }

  const result: PlayerSearchResult = {
    playerId,
    fullName,
  };

  const teamName = readString(team?.displayName) ?? readString(team?.name) ?? readString(outer.label);
  if (teamName) {
    result.teamName = teamName;
  }

  const positionName =
    readString(position?.abbreviation) ??
    readString(position?.displayName) ??
    readString(position?.name);
  if (positionName) {
    result.position = positionName;
  }

  const headshot = extractHeadshot(athlete) ?? extractHeadshot(outer);
  if (headshot) {
    result.headshot = headshot;
  }

  return result;
}

function mapSearchPayload(payload: unknown, sport: SportKey): { results: PlayerSearchResult[]; warning?: string } {
  const data = asObject(payload);
  if (!data) {
    return {
      results: [],
      warning: "Upstream search payload was not an object.",
    };
  }

  const athletesArray = Array.isArray(data.athletes) ? data.athletes : [];
  const itemsArray = Array.isArray(data.items) ? data.items : [];

  const config = SPORT_CONFIG[sport];

  const filteredItems = itemsArray.filter((row) => {
    const item = asObject(row);
    if (!item) return false;
    const type = readString(item.type);
    const sportKey = readString(item.sport)?.toLowerCase();
    const leagueKey = readString(item.league)?.toLowerCase();

    if (type && type.toLowerCase() !== "player") {
      return false;
    }

    if (sportKey && sportKey !== config.sportFilter) {
      return false;
    }

    if (leagueKey && leagueKey !== config.leagueFilter) {
      return false;
    }

    return true;
  });

  const rows = athletesArray.length > 0 ? athletesArray : filteredItems;
  const mapped = rows
    .map((row) => toSearchResult(row))
    .filter((row): row is PlayerSearchResult => row !== null);

  const deduped = mapped.filter((row, index, all) => all.findIndex((candidate) => candidate.playerId === row.playerId) === index);

  return {
    results: deduped,
    warning: rows.length > 0 && deduped.length === 0
      ? "Upstream search payload was missing expected athlete fields."
      : undefined,
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
    ?? readString(position?.name);
  if (positionName) {
    profile.position = positionName;
  }

  const headshot = extractHeadshot(athlete);
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

function fallbackMeta(dataMode: ModeArg, sourceUsed: Meta["sourceUsed"], warning?: string): Meta {
  return {
    sourceUsed,
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode,
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

async function fetchSearchPayload(sport: SportKey, query: string, dataMode: ModeArg): Promise<{ payload: unknown; meta: Meta }> {
  const config = SPORT_CONFIG[sport];
  const primaryUrl = `https://site.api.espn.com/apis/site/v2/sports/${config.siteSport}/${config.siteLeague}/athletes?search=${encodeURIComponent(query)}`;
  const commonSearchWarning = "League athlete search endpoint unavailable; used common search.";

  const fetchCommonSearch = async () => {
    const fallback = await fetchEspnJson<unknown>({
      endpoint: "https://site.web.api.espn.com/apis/common/v3/search",
      params: {
        query,
        type: "player",
        limit: 20,
      },
      fixtureFile: config.searchFixtureFile,
      fixtureSubdir: "players",
      ttlSeconds: 300,
      dataMode,
    });

    return {
      payload: fallback.data,
      meta: mergeWarning(fallback.meta, commonSearchWarning),
    };
  };

  if (sport === "mlb" || sport === "nba") {
    return fetchCommonSearch();
  }

  if (dataMode === "fixture") {
    const fixture = await fetchEspnJson<unknown>({
      endpoint: primaryUrl,
      fixtureFile: config.searchFixtureFile,
      fixtureSubdir: "players",
      ttlSeconds: 300,
      dataMode,
    });

    return {
      payload: fixture.data,
      meta: fixture.meta,
    };
  }

  try {
    const primary = await fetchEspnJson<unknown>({
      endpoint: primaryUrl,
      ttlSeconds: 300,
      dataMode,
    });
    return {
      payload: primary.data,
      meta: primary.meta,
    };
  } catch {
    return fetchCommonSearch();
  }
}

async function fetchProfilePayload(sport: SportKey, playerId: string, dataMode: ModeArg): Promise<{ payload: unknown; meta: Meta }> {
  const config = SPORT_CONFIG[sport];
  const primaryUrl = `https://site.api.espn.com/apis/site/v2/sports/${config.siteSport}/${config.siteLeague}/athletes/${encodeURIComponent(playerId)}`;

  if (dataMode === "fixture") {
    const fixture = await fetchEspnJson<unknown>({
      endpoint: primaryUrl,
      fixtureFile: config.profileFixtureFile,
      fixtureSubdir: "players",
      ttlSeconds: 600,
      dataMode,
    });

    return {
      payload: fixture.data,
      meta: fixture.meta,
    };
  }

  try {
    const primary = await fetchEspnJson<unknown>({
      endpoint: primaryUrl,
      ttlSeconds: 600,
      dataMode,
    });

    return {
      payload: primary.data,
      meta: primary.meta,
    };
  } catch {
    const fallback = await fetchEspnJson<unknown>({
      endpoint: `https://sports.core.api.espn.com/v2/sports/${config.coreSport}/leagues/${config.coreLeague}/athletes/${encodeURIComponent(playerId)}`,
      params: {
        lang: "en",
        region: "us",
      },
      ttlSeconds: 600,
      dataMode,
    });

    return {
      payload: fallback.data,
      meta: mergeWarning(fallback.meta, "Using ESPN core athlete profile (site athlete endpoint returned 404 for this league)."),
    };
  }
}

export async function searchPlayers(
  sportInput: SportKey,
  query: string,
  dataMode?: ModeArg,
  limit = 8,
): Promise<Envelope<PlayerSearchResult[]>> {
  const sport = resolveSportKey(sportInput);
  const mode = getDataMode(dataMode);
  const trimmed = query.trim();
  const resolvedLimit = Math.max(1, Math.min(8, Math.floor(limit)));

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

  try {
    const fetched = await fetchSearchPayload(sport, trimmed, mode);
    const mapped = mapSearchPayload(fetched.payload, sport);
    return {
      data: mapped.results.slice(0, resolvedLimit),
      meta: mergeWarning(fetched.meta, mapped.warning),
    };
  } catch (error) {
    return {
      data: null,
      meta: fallbackMeta(mode, mode === "fixture" ? "fixture" : "espn", String(error)),
      error: {
        message: `Failed to search players: ${String(error)}`,
        code: "UPSTREAM_ERROR",
      },
    };
  }
}

export async function getPlayerProfile(
  sportInput: SportKey,
  playerId: string,
  dataMode?: ModeArg,
): Promise<Envelope<PlayerProfile>> {
  const sport = resolveSportKey(sportInput);
  const mode = getDataMode(dataMode);
  const trimmedPlayerId = playerId.trim();

  if (!trimmedPlayerId) {
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
    const fetched = await fetchProfilePayload(sport, trimmedPlayerId, mode);
    const mapped = mapProfilePayload(fetched.payload, trimmedPlayerId);

    if (!mapped.profile) {
      return {
        data: null,
        meta: mergeWarning(fetched.meta, mapped.warning ?? "No player profile data returned from upstream."),
      };
    }

    return {
      data: mapped.profile,
      meta: mergeWarning(fetched.meta, mapped.warning),
    };
  } catch (error) {
    return {
      data: null,
      meta: fallbackMeta(mode, mode === "fixture" ? "fixture" : "espn", String(error)),
      error: {
        message: `Failed to load player profile: ${String(error)}`,
        code: "UPSTREAM_ERROR",
      },
    };
  }
}

export function normalizeSportKey(input: string | null | undefined): SportKey {
  return resolveSportKey(input);
}
