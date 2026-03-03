import type { SportKey } from "@/lib/types/players";

type ApiSportsSportConfig = {
  baseUrl?: string;
  league?: string;
  season?: string;
};

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
      baseUrl: readEnv("MLB_API_BASE_URL", "SPORTS_API_MLB_BASE_URL"),
      league: readEnv("MLB_LEAGUE_ID"),
      season: readEnv("MLB_SEASON"),
    };
  }

  if (sport === "nba") {
    return {
      baseUrl: readEnv("NBA_API_BASE_URL", "SPORTS_API_NBA_BASE_URL"),
      league: readEnv("NBA_LEAGUE_ID"),
      season: readEnv("NBA_SEASON"),
    };
  }

  return {
    baseUrl: readEnv("NFL_API_BASE_URL", "SPORTS_API_NFL_BASE_URL"),
    league: readEnv("NFL_LEAGUE_ID"),
    season: readEnv("NFL_SEASON"),
  };
}

