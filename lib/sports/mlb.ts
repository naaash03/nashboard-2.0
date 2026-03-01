import "server-only";
import {
  SlateGame,
  SlateFetchResult,
  buildApiSportsHeaders,
  ApiSportsResponse,
  getApiSportsTimezone,
  getApiSportsDate,
} from "./shared";

const MOCK_MLB_SLATE: SlateGame[] = [
  {
    id: "mock-mlb-1",
    homeTeam: "Yankees",
    awayTeam: "Red Sox",
    startTime: new Date().toISOString(),
    venue: "Yankee Stadium",
    league: "MLB",
  },
];

type ProviderGame = {
  id?: string | number;
  gameId?: string | number;
  teams?: {
    home?: { name?: string; nickname?: string };
    away?: { name?: string; nickname?: string };
  };
  date?: { start?: string; timestamp?: number } | string;
  venue?: { name?: string };
  league?: { name?: string };
};

function normalizeMlbStartTime(date: ProviderGame["date"]): string {
  if (typeof date === "string" && date) {
    return date;
  }

  if (date && typeof date === "object") {
    if (date.start) {
      return date.start;
    }
    if (date.timestamp) {
      return new Date(date.timestamp * 1000).toISOString();
    }
  }

  return new Date().toISOString();
}

const buildMockResult = (message: string): SlateFetchResult => ({
  games: MOCK_MLB_SLATE,
  source: "mock",
  message,
});

const buildEmptyApiResult = (message: string): SlateFetchResult => ({
  games: [],
  source: "api-sports",
  message,
});

export async function fetchTonightMlbSlate(): Promise<SlateFetchResult> {
  const baseUrl =
    process.env.SPORTS_API_MLB_BASE_URL ?? "https://v1.baseball.api-sports.io";

  let headers: HeadersInit;
  try {
    headers = buildApiSportsHeaders();
  } catch (err) {
    console.error("[MLB] API-Sports headers error:", err);
    return buildMockResult(
      "Missing SPORTS_API_KEY. Showing demo MLB slate until the key is configured."
    );
  }


  if (!process.env.MLB_LEAGUE_ID || !process.env.MLB_SEASON) {
    console.warn(
      "[MLB] Missing MLB_LEAGUE_ID or MLB_SEASON in .env – using mock slate."
    );
    return buildMockResult(
      "MLB league/season are not configured. Add MLB_LEAGUE_ID and MLB_SEASON to pull API-Sports data."
    );
  }

  const timezone = getApiSportsTimezone();
  const dateParam = getApiSportsDate(timezone);
  const params = new URLSearchParams({ date: dateParam, timezone });

  if (process.env.MLB_LEAGUE_ID) {
    params.append("league", process.env.MLB_LEAGUE_ID);
  }
  if (process.env.MLB_SEASON) {
    params.append("season", process.env.MLB_SEASON);
  }

  const url = `${baseUrl}/games?${params.toString()}`;

  try {
    const res = await fetch(url, { headers, cache: "no-store" });

    if (!res.ok) {
      console.error(
        "[MLB] API-Sports response error:",
        res.status,
        await res.text()
      );
      return buildMockResult(
        `API-Sports responded with ${res.status}. Showing demo MLB slate instead.`
      );
    }

    const json = (await res.json()) as ApiSportsResponse<ProviderGame>;
    const raw = json.response ?? json.data ?? [];
    const data: ProviderGame[] = raw;

    const games: SlateGame[] = data.map((g, idx) => {
      const homeTeam = g.teams?.home?.name ?? g.teams?.home?.nickname ?? "Home";
      const awayTeam = g.teams?.away?.name ?? g.teams?.away?.nickname ?? "Away";

      const startTime = normalizeMlbStartTime(g.date);

      const venue = g.venue?.name ?? g.league?.name ?? undefined;

      return {
        id: String(g.id ?? g.gameId ?? `mlb-${idx}`),
        homeTeam,
        awayTeam,
        startTime,
        venue,
        league: "MLB",
      };
    });

    if (!games.length) {
      return buildEmptyApiResult(
        "No MLB games scheduled today per API-Sports (off day or offseason)."
      );
    }

    return { games, source: "api-sports" };
  } catch (err) {
    console.error("[MLB] Error fetching slate from API-Sports:", err);
    return buildMockResult(
      "API-Sports request failed. Showing demo MLB slate."
    );
  }
}

