import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getEspnScoreboardLocalDate } from "@/lib/providers/espn/date";
import { getTodaysSlate } from "@/lib/providers/espn/nba";
import { fetchGameOdds, type MlbGameOdds } from "@/lib/providers/odds/client";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import type { Meta, SlateGame } from "@/lib/providers/types";

type ShapedGame = {
  id: string;
  date: string;
  status: string;
  broadcaster?: string;
  awayTeam: { key: string; name: string; record?: string };
  homeTeam: { key: string; name: string; record?: string };
  oddsSummary?: string;
  odds?: {
    homeMoneyline: number | null;
    awayMoneyline: number | null;
    overUnder: number | null;
    isFallback: boolean;
    fallbackReason?: string;
  };
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

function shapeGame(game: SlateGame, odds: MlbGameOdds, mode: string): ShapedGame {
  const base: ShapedGame = {
    id: game.id,
    date: game.date,
    status: game.status,
    broadcaster: game.broadcaster,
    awayTeam: { key: game.awayTeam.key, name: game.awayTeam.name, record: recordToString(game.awayTeam.record) },
    homeTeam: { key: game.homeTeam.key, name: game.homeTeam.name, record: recordToString(game.homeTeam.record) },
  };

  if (mode === "advanced") {
    base.odds = {
      homeMoneyline: odds.homeMoneyline,
      awayMoneyline: odds.awayMoneyline,
      overUnder: odds.overUnder,
      isFallback: odds.isFallback,
      fallbackReason: odds.fallbackReason,
    };
  } else {
    base.oddsSummary = oddsSummaryLabel(
      odds.homeMoneyline,
      odds.awayMoneyline,
      game.homeTeam.name,
      game.awayTeam.name,
    );
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
    const { games, meta, dateUsed } = await getTodaysSlate(mode, resolvedDataMode, cacheBust);

    const enriched = await Promise.all(
      games.map(async (game) => {
        const odds = await fetchGameOdds("basketball_nba", game.homeTeam.name, game.awayTeam.name);
        return { game, odds };
      }),
    );

    const shaped = enriched.map(({ game, odds }) => shapeGame(game, odds, mode));
    const contract = toWidgetPayload({
      data: shaped,
      meta,
      primaryProvider: "espn",
      notes: [
        "NBA schedule from ESPN scoreboard.",
        "Odds via The Odds API if configured; isFallback when unavailable.",
      ],
    });

    return NextResponse.json({
      data: {
        sport: "NBA",
        dateUsed,
        games: shaped,
        userFacingMessage: games.length > 0
          ? `Showing ${games.length} NBA game${games.length > 1 ? "s" : ""} today.`
          : "No NBA games scheduled today.",
      },
      meta,
      contract,
      error: null,
    });
  } catch (error) {
    const message = `Failed to load NBA schedule: ${String(error)}`;
    const meta = fallbackMeta(message);
    const contract = toWidgetPayload({ data: [], error: message, meta, primaryProvider: "espn" });

    return NextResponse.json(
      {
        data: {
          sport: "NBA",
          dateUsed: getEspnScoreboardLocalDate(),
          games: [],
          userFacingMessage: "Could not load today's NBA schedule.",
        },
        meta,
        contract,
        error: message,
      },
      { status: 502 },
    );
  }
}
