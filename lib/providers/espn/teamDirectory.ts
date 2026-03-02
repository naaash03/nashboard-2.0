import { randomUUID } from "node:crypto";
import { fetchEspnJson, getDataMode } from "@/lib/providers/espn/client";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, SportKey, TeamSearchResult } from "@/lib/types/players";

type ModeArg = "auto" | "live" | "fixture";
type CacheBustArg = string | number | null | undefined;

type SportConfig = {
  sport: "football" | "baseball" | "basketball";
  league: "nfl" | "mlb" | "nba";
  fixtureFile: string;
};

const SPORT_CONFIG: Record<SportKey, SportConfig> = {
  nfl: {
    sport: "football",
    league: "nfl",
    fixtureFile: "nfl_team_search_jets.json",
  },
  mlb: {
    sport: "baseball",
    league: "mlb",
    fixtureFile: "mlb_team_search_mets.json",
  },
  nba: {
    sport: "basketball",
    league: "nba",
    fixtureFile: "nba_team_search_lakers.json",
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
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function fallbackMeta(dataMode: ModeArg, warning?: string): Meta {
  return {
    sourceUsed: dataMode === "fixture" ? "fixture" : "espn",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode,
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

function pickLogo(item: Record<string, unknown>): string | undefined {
  const logos = Array.isArray(item.logos) ? item.logos : [];
  for (const logo of logos) {
    const typed = asObject(logo);
    if (!typed) continue;
    const href = readString(typed.href) ?? readString(typed.url);
    if (href) {
      return href;
    }
  }
  return undefined;
}

function normalizeTeamItem(row: unknown): TeamSearchResult | null {
  const item = asObject(row);
  if (!item) {
    return null;
  }

  const teamKey = readString(item.abbreviation) ?? readString(item.shortDisplayName) ?? readString(item.teamKey);
  const displayName = readString(item.displayName) ?? readString(item.name) ?? readString(item.location);
  const league = readString(item.league)?.toLowerCase();

  if (!teamKey || !displayName || (league !== "nfl" && league !== "mlb" && league !== "nba")) {
    return null;
  }

  return {
    teamKey: teamKey.toUpperCase(),
    displayName,
    league,
    logo: pickLogo(item),
  };
}

export async function searchTeams(
  sportInput: SportKey,
  queryInput: string,
  dataMode?: ModeArg,
  limit = 8,
  cacheBust?: CacheBustArg,
): Promise<Envelope<TeamSearchResult[]>> {
  const sport = resolveSportKey(sportInput);
  const query = queryInput.trim();
  const mode = dataMode ?? "auto";
  const normalizedLimit = Math.max(1, Math.min(8, Math.floor(limit)));

  if (!query) {
    return {
      data: null,
      meta: fallbackMeta(mode, "q is required"),
      error: {
        message: "q is required",
        code: "MISSING_QUERY",
      },
    };
  }

  const config = SPORT_CONFIG[sport];

  const runForMode = async (directMode: "live" | "fixture"): Promise<Envelope<TeamSearchResult[]>> => {
    try {
      const response = await fetchEspnJson<unknown>({
        endpoint: "https://site.web.api.espn.com/apis/common/v3/search",
        params: {
          query,
          type: "team",
          limit: normalizedLimit,
        },
        fixtureFile: config.fixtureFile,
        fixtureSubdir: "teams",
        ttlSeconds: 300,
        dataMode: directMode,
        cacheBust: cacheBust ?? undefined,
      });

      const payload = asObject(response.data);
      const rows = Array.isArray(payload?.items) ? payload.items : [];
      const normalized = rows
        .map((row) => normalizeTeamItem(row))
        .filter((row): row is TeamSearchResult => row !== null)
        .filter((row) => row.league === config.league)
        .slice(0, normalizedLimit);

      const warning = rows.length > 0 && normalized.length === 0
        ? `No ${config.league.toUpperCase()} teams were found for this query.`
        : undefined;

      return {
        data: normalized,
        meta: appendWarning(response.meta, warning),
      };
    } catch (error) {
      return {
        data: [],
        meta: fallbackMeta(directMode, `Team search unavailable right now: ${String(error)}`),
      };
    }
  };

  if (mode !== "auto") {
    return runForMode(getDataMode(mode));
  }

  const liveEnvelope = await runForMode("live");
  if (!liveEnvelope.error && (liveEnvelope.data?.length ?? 0) > 0) {
    return {
      ...liveEnvelope,
      meta: appendWarning(liveEnvelope.meta, "AUTO mode selected live team search response."),
    };
  }

  const fixtureEnvelope = await runForMode("fixture");
  if (!fixtureEnvelope.error && (fixtureEnvelope.data?.length ?? 0) > 0) {
    return {
      ...fixtureEnvelope,
      meta: appendWarning(
        fixtureEnvelope.meta,
        "AUTO fallback applied for team search because live search returned no results or failed.",
      ),
    };
  }

  return {
    data: fixtureEnvelope.data ?? liveEnvelope.data ?? [],
    meta: appendWarning(
      liveEnvelope.meta,
      "AUTO mode tried live and fixture team search; returning best available response.",
    ),
    error: liveEnvelope.error ?? fixtureEnvelope.error,
  };
}

export function normalizeTeamSearchSport(input: string | null | undefined): SportKey {
  return resolveSportKey(input);
}
