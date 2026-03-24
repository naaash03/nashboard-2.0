import { randomUUID } from "node:crypto";
import { getApiSportsConfig } from "@/lib/providers/apiSports/config";
import { fetchApiSportsJson } from "@/lib/providers/apiSports/client";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, SportKey, TeamSearchResult } from "@/lib/types/players";

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

function teamRows(payload: unknown): Record<string, unknown>[] {
  const typed = asObject(payload);
  if (!typed) {
    return [];
  }
  const response = Array.isArray(typed.response) ? typed.response : [];
  return response
    .map((row) => asObject(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

function sportLabel(sport: SportKey): SportKey {
  return sport;
}

function normalizeTeamKey(raw: string, displayName: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, "").trim().toUpperCase();
  if (cleaned.length >= 2 && cleaned.length <= 4) {
    return cleaned;
  }
  const fromName = displayName.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const letters = fromName.map((part) => part[0]).join("").toUpperCase();
  return letters.slice(0, 4) || cleaned.slice(0, 4) || "TEAM";
}

function mapTeamRow(sport: SportKey, row: Record<string, unknown>): TeamSearchResult | null {
  const team = asObject(row.team) ?? row;
  const teamId = readString(team.id) ?? readNumber(team.id)?.toString() ?? readString(team.team_id) ?? readNumber(team.team_id)?.toString();
  const displayName = readString(team.name) ?? readString(team.display_name) ?? readString(team.city);
  if (!displayName) {
    return null;
  }
  const abbreviation = readString(team.code) ?? readString(team.abbreviation) ?? readString(team.short_name);
  const rawKey = abbreviation ?? displayName;
  return {
    teamKey: normalizeTeamKey(rawKey, displayName),
    displayName,
    league: sportLabel(sport),
    abbreviation: abbreviation?.toUpperCase(),
    apiSportsTeamId: teamId,
    logo: readString(team.logo),
  };
}

export async function searchTeams(
  sport: SportKey,
  query: string,
  limit = 8,
  dataMode: ModeArg = "live",
  cacheBust?: CacheBustArg,
): Promise<Envelope<TeamSearchResult[]>> {
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
      endpoint: "teams",
      params: {
        search: trimmed,
        league: config.league,
        season: config.season,
      },
      dataMode,
      ttlSeconds: 300,
      cacheBust,
      fixtureFile: "teams_search_sample.json",
    });
    const rows = teamRows(response.data)
      .map((row) => mapTeamRow(sport, row))
      .filter((row): row is TeamSearchResult => row !== null)
      .slice(0, Math.max(1, Math.min(8, limit)));
    return {
      data: rows,
      meta: {
        ...response.meta,
        warning: rows.length === 0 ? (response.meta.warning ?? "API-Sports team search returned no teams.") : response.meta.warning,
      },
    };
  } catch (error) {
    return {
      data: [],
      meta: fallbackMeta(dataMode, `API-Sports team search unavailable: ${String(error)}`),
    };
  }
}
