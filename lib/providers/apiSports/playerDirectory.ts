import { randomUUID } from "node:crypto";
import { getApiSportsConfig } from "@/lib/providers/apiSports/config";
import { fetchApiSportsJson } from "@/lib/providers/apiSports/client";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, PlayerProfile, PlayerSearchResult, SportKey } from "@/lib/types/players";

type ModeArg = "live" | "fixture";
type CacheBustArg = string | number | null | undefined;

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
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

function fallbackMeta(mode: ModeArg, warning: string): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : "apiSports",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: mode,
    dataModeEffective: mode,
  };
}

function appendWarning(meta: Meta, warning?: string): Meta {
  if (!warning) {
    return meta;
  }
  return {
    ...meta,
    warning: meta.warning ? `${meta.warning} ${warning}` : warning,
  };
}

function playerRows(payload: unknown): Record<string, unknown>[] {
  const typed = asObject(payload);
  if (!typed) {
    return [];
  }
  const response = Array.isArray(typed.response) ? typed.response : [];
  return response
    .map((row) => asObject(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

function teamFromRow(row: Record<string, unknown>): Record<string, unknown> | null {
  const stats = Array.isArray(row.statistics) ? row.statistics : [];
  for (const stat of stats) {
    const typed = asObject(stat);
    const team = asObject(typed?.team);
    if (team) {
      return team;
    }
  }
  return asObject(row.team);
}

function mapSearchRow(row: Record<string, unknown>): PlayerSearchResult | null {
  const player = asObject(row.player) ?? row;
  const playerId = readString(player.id) ?? readNumber(player.id)?.toString();
  const fullName = readString(player.name)
    ?? [readString(player.firstname), readString(player.lastname)].filter(Boolean).join(" ")
    ?? readString(player.fullName);
  if (!playerId || !fullName) {
    return null;
  }

  const team = teamFromRow(row);
  const position = (() => {
    const stats = Array.isArray(row.statistics) ? row.statistics : [];
    for (const stat of stats) {
      const typed = asObject(stat);
      const games = asObject(typed?.games);
      const value = readString(games?.position);
      if (value) {
        return value;
      }
    }
    return undefined;
  })();

  const jersey = (() => {
    const stats = Array.isArray(row.statistics) ? row.statistics : [];
    for (const stat of stats) {
      const typed = asObject(stat);
      const games = asObject(typed?.games);
      const value = readString(games?.number) ?? readNumber(games?.number)?.toString();
      if (value) {
        return value;
      }
    }
    return undefined;
  })();

  const teamName = readString(team?.name);
  const teamAbbr = readString(team?.code) ?? readString(team?.abbreviation) ?? readString(team?.short_name);
  return {
    playerId,
    fullName,
    teamName,
    teamAbbr: teamAbbr ? teamAbbr.toUpperCase() : undefined,
    position,
    jersey,
    headshot: readString(player.photo),
    headshotUrl: readString(player.photo),
    teamLogoUrl: readString(team?.logo),
  };
}

function mapProfileRow(playerId: string, row: Record<string, unknown>): PlayerProfile | null {
  const player = asObject(row.player) ?? row;
  const team = teamFromRow(row);
  const resolvedId = readString(player.id) ?? readNumber(player.id)?.toString() ?? playerId;
  const fullName = readString(player.name)
    ?? [readString(player.firstname), readString(player.lastname)].filter(Boolean).join(" ")
    ?? readString(player.fullName);
  if (!resolvedId || !fullName) {
    return null;
  }

  const profile: PlayerProfile = {
    playerId: resolvedId,
    fullName,
    teamName: readString(team?.name),
    teamAbbrev: (() => {
      const value = readString(team?.code) ?? readString(team?.abbreviation) ?? readString(team?.short_name);
      return value ? value.toUpperCase() : undefined;
    })(),
    headshot: readString(player.photo),
    age: readNumber(player.age),
    height: readString(player.height),
    weight: readString(player.weight),
    injury: typeof player.injured === "boolean"
      ? { status: player.injured ? "Injured" : "Available" }
      : null,
  };

  const stats = Array.isArray(row.statistics) ? row.statistics : [];
  for (const stat of stats) {
    const typed = asObject(stat);
    const games = asObject(typed?.games);
    const position = readString(games?.position);
    if (position) {
      profile.position = position;
    }
    const jersey = readString(games?.number) ?? readNumber(games?.number)?.toString();
    if (jersey) {
      profile.jersey = jersey;
    }
  }

  return profile;
}

export async function searchPlayers(
  sport: SportKey,
  query: string,
  limit = 8,
  dataMode: ModeArg = "live",
  cacheBust?: CacheBustArg,
): Promise<Envelope<PlayerSearchResult[]>> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      data: null,
      meta: fallbackMeta(dataMode, "q is required"),
      error: {
        message: "q is required",
        code: "MISSING_QUERY",
      },
    };
  }

  const config = getApiSportsConfig(sport);
  try {
    const response = await fetchApiSportsJson<unknown>({
      sport,
      endpoint: "players",
      params: {
        search: trimmed,
        league: config.league,
        season: config.season,
      },
      dataMode,
      ttlSeconds: 300,
      cacheBust,
      fixtureFile: "players_search_sample.json",
    });

    const mapped = playerRows(response.data)
      .map((row) => mapSearchRow(row))
      .filter((row): row is PlayerSearchResult => row !== null)
      .slice(0, Math.max(1, Math.min(8, limit)));
    return {
      data: mapped,
      meta: appendWarning(response.meta, mapped.length === 0 ? "API-Sports search returned no players." : undefined),
    };
  } catch (error) {
    return {
      data: [],
      meta: fallbackMeta(dataMode, `API-Sports player search unavailable: ${String(error)}`),
    };
  }
}

export async function getPlayerProfile(
  sport: SportKey,
  playerIdInput: string,
  dataMode: ModeArg = "live",
  cacheBust?: CacheBustArg,
): Promise<Envelope<PlayerProfile>> {
  const playerId = playerIdInput.trim();
  if (!playerId) {
    return {
      data: null,
      meta: fallbackMeta(dataMode, "playerId is required"),
      error: {
        message: "playerId is required",
        code: "MISSING_PLAYER_ID",
      },
    };
  }

  const config = getApiSportsConfig(sport);
  try {
    const response = await fetchApiSportsJson<unknown>({
      sport,
      endpoint: "players",
      params: {
        id: playerId,
        league: config.league,
        season: config.season,
      },
      dataMode,
      ttlSeconds: 600,
      cacheBust,
      fixtureFile: "player_profile_sample.json",
    });

    const profile = mapProfileRow(playerId, playerRows(response.data)[0] ?? {});
    if (!profile) {
      return {
        data: null,
        meta: appendWarning(response.meta, "API-Sports profile payload was missing required identity fields."),
      };
    }
    return {
      data: profile,
      meta: response.meta,
    };
  } catch (error) {
    return {
      data: null,
      meta: fallbackMeta(dataMode, `API-Sports player profile unavailable: ${String(error)}`),
      error: {
        message: `API-Sports player profile unavailable: ${String(error)}`,
        code: "UPSTREAM_ERROR",
      },
    };
  }
}

