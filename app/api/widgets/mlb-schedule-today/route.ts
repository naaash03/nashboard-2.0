import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getTodaysSchedule, type MlbScheduleGame } from "@/lib/providers/espn/mlb";
import { fetchGameDayWeather, type GameDayWeather } from "@/lib/providers/weather/client";
import { fetchGameOdds, type MlbGameOdds } from "@/lib/providers/odds/client";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import type { Meta } from "@/lib/providers/types";

type EnrichedGame = MlbScheduleGame & {
  weather: GameDayWeather | null;
  odds: MlbGameOdds;
};

type WeatherShape = {
  tempF: number | null;
  windMph: number | null;
  condition: string | null;
  weatherImpact: string;
  isOutdoor: boolean;
  isFallback: boolean;
  fallbackReason?: string;
};

type ShapedGame = {
  id: string;
  date: string;
  status: string;
  broadcaster?: string;
  awayTeam: { key: string; name: string; record?: string };
  homeTeam: { key: string; name: string; record?: string };
  probables?: Array<{ homeAway: "home" | "away"; name: string }>;
  oddsSummary?: string;
  odds?: {
    homeMoneyline: number | null;
    awayMoneyline: number | null;
    overUnder: number | null;
    isFallback: boolean;
    fallbackReason?: string;
  };
  weather?: WeatherShape;
  venueName?: string;
};

function recordToString(record?: { wins: number; losses: number }): string | undefined {
  if (!record) return undefined;
  return `${record.wins}-${record.losses}`;
}

function oddsSummaryLabel(
  homeMoneyline: number | null,
  awayMoneyline: number | null,
  homeTeamName: string,
  awayTeamName: string,
): string {
  if (homeMoneyline === null && awayMoneyline === null) return "Odds unavailable";
  const home = homeMoneyline ?? 0;
  const away = awayMoneyline ?? 0;
  const spread = Math.abs(home - away);
  if (spread <= 10) return "Pick 'em";
  if (spread <= 25) {
    const favored = home < away ? homeTeamName : awayTeamName;
    return `Slight favorite: ${favored}`;
  }
  const favored = home < away ? homeTeamName : awayTeamName;
  return `${favored} favored`;
}

function shapeWeather(w: GameDayWeather): WeatherShape {
  return {
    tempF: w.tempF,
    windMph: w.windMph,
    condition: w.condition,
    weatherImpact: w.weatherImpact,
    isOutdoor: w.isOutdoor,
    isFallback: w.isFallback,
    fallbackReason: w.fallbackReason,
  };
}

function shapeGame(game: EnrichedGame, mode: string): ShapedGame {
  const base: ShapedGame = {
    id: game.id,
    date: game.date,
    status: game.status,
    broadcaster: game.broadcaster,
    awayTeam: { key: game.awayTeam.key, name: game.awayTeam.name, record: recordToString(game.awayTeam.record) },
    homeTeam: { key: game.homeTeam.key, name: game.homeTeam.name, record: recordToString(game.homeTeam.record) },
    probables: game.probables.length > 0
      ? game.probables.map((p) => ({ homeAway: p.homeAway, name: p.name }))
      : undefined,
  };

  if (mode === "advanced") {
    base.venueName = game.venueName;
    base.odds = {
      homeMoneyline: game.odds.homeMoneyline,
      awayMoneyline: game.odds.awayMoneyline,
      overUnder: game.odds.overUnder,
      isFallback: game.odds.isFallback,
      fallbackReason: game.odds.fallbackReason,
    };
    if (game.weather) {
      base.weather = shapeWeather(game.weather);
    }
  } else {
    base.oddsSummary = oddsSummaryLabel(
      game.odds.homeMoneyline,
      game.odds.awayMoneyline,
      game.homeTeam.name,
      game.awayTeam.name,
    );
    if (game.weather?.isOutdoor) {
      base.weather = shapeWeather(game.weather);
    }
  }

  return base;
}

function fallbackMeta(warning: string): Meta {
  return {
    sourceUsed: "espn",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  try {
    const { games, meta, dateUsed } = await getTodaysSchedule(resolvedDataMode, cacheBust);

    const enriched = await Promise.all(
      games.map(async (game): Promise<EnrichedGame> => {
        const [weather, odds] = await Promise.all([
          game.venueName
            ? fetchGameDayWeather(game.venueName, game.venueCity ?? game.venueName)
            : Promise.resolve(null),
          fetchGameOdds("baseball_mlb", game.homeTeam.name, game.awayTeam.name),
        ]);
        return { ...game, weather, odds };
      }),
    );

    const shaped = enriched.map((game) => shapeGame(game, mode));
    const contract = toWidgetPayload({
      data: shaped,
      meta,
      primaryProvider: "espn",
      notes: [
        "MLB schedule from ESPN scoreboard.",
        "Weather via OpenWeather for outdoor venues; isFallback when key absent or venue indoor.",
        "Odds via The Odds API if configured; isFallback when unavailable.",
      ],
    });

    return NextResponse.json({
      data: {
        sport: "MLB",
        dateUsed,
        games: shaped,
        userFacingMessage: games.length > 0
          ? `Showing ${games.length} MLB game${games.length > 1 ? "s" : ""} today.`
          : "No MLB games scheduled today.",
      },
      meta,
      contract,
      error: null,
    });
  } catch (error) {
    const message = `Failed to load MLB schedule: ${String(error)}`;
    const meta = fallbackMeta(message);
    const contract = toWidgetPayload({ data: [], error: message, meta, primaryProvider: "espn" });

    return NextResponse.json(
      {
        data: {
          sport: "MLB",
          dateUsed: new Date().toISOString().slice(0, 10),
          games: [],
          userFacingMessage: "Could not load today's MLB schedule.",
        },
        meta,
        contract,
        error: message,
      },
      { status: 502 },
    );
  }
}
