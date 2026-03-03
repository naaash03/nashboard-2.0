import type { SportKey } from "@/lib/types/players";

type ApiSportsSportConfig = {
  baseUrl?: string;
  league?: string;
  season?: string;
};

const DEFAULT_BASE_URL_BY_SPORT: Record<SportKey, string> = {
  nba: "https://v1.basketball.api-sports.io",
  mlb: "https://v1.baseball.api-sports.io",
  nfl: "https://v1.american-football.api-sports.io",
};

function normalizeBaseUrl(sport: SportKey, value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_BASE_URL_BY_SPORT[sport];
  }

  // Legacy NBA host is no longer supported for the hybrid provider stack.
  if (sport === "nba" && /v2\.nba\.api-sports\.io/i.test(trimmed)) {
    return DEFAULT_BASE_URL_BY_SPORT.nba;
  }

  return trimmed;
}

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function resolveApiSportsKey(): string | undefined {
  return readEnv("API_SPORTS_KEY", "SPORTS_API_KEY");
}

export function getApiSportsConfig(sport: SportKey): ApiSportsSportConfig {
  if (sport === "mlb") {
    return {
      baseUrl: normalizeBaseUrl("mlb", readEnv("MLB_API_BASE_URL", "SPORTS_API_MLB_BASE_URL")),
      league: readEnv("MLB_LEAGUE_ID"),
      season: readEnv("MLB_SEASON"),
    };
  }

  if (sport === "nba") {
    return {
      baseUrl: normalizeBaseUrl("nba", readEnv("NBA_API_BASE_URL", "SPORTS_API_NBA_BASE_URL")),
      league: readEnv("NBA_LEAGUE_ID"),
      season: readEnv("NBA_SEASON"),
    };
  }

  return {
    baseUrl: normalizeBaseUrl("nfl", readEnv("NFL_API_BASE_URL", "SPORTS_API_NFL_BASE_URL")),
    league: readEnv("NFL_LEAGUE_ID"),
    season: readEnv("NFL_SEASON"),
  };
}
