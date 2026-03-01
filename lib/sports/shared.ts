import "server-only";

export type Sport = "NFL" | "NBA" | "MLB";

export type SlateGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  league: Sport;
  venue?: string;
  status?: string;
};

export interface ApiSportsResponse<T> {
  response?: T[];
  data?: T[];
}

export type SlateFetchResult = {
  games: SlateGame[];
  source: "api-sports" | "mock";
  message?: string;
};

export function getApiSportsTimezone(): string {
  return process.env.SPORTS_API_TIMEZONE ?? "America/New_York";
}

export function getTodayYyyyMmDd(timezone: string = getApiSportsTimezone()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    new Date()
  );
}

export function getApiSportsDate(timezone?: string): string {
  const override = process.env.SPORTS_API_DATE_OVERRIDE?.trim();
  if (override) {
    return override;
  }
  return getTodayYyyyMmDd(timezone);
}

export function buildApiSportsHeaders() {
  const apiKey = process.env.SPORTS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing SPORTS_API_KEY in environment");
  }

  return {
    "x-apisports-key": apiKey,
    Accept: "application/json",
  };
}

