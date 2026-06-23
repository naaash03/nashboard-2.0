import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import {
  getMostRecentSlateBefore,
  getNextLeagueSlateAfter,
  getScoreboardForDate,
} from "@/lib/providers/espn/nba";
import { normalizeGameFromEspn } from "@/lib/sports/adapters";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { shapeNbaTonightsSlate } from "@/lib/templates/nbaTonightsSlate";
import type { Meta, SlateGame } from "@/lib/providers/types";

type SlateState = "today" | "next_slate" | "offseason";

function canonicalGames(games: SlateGame[]) {
  return games.map((game) => normalizeGameFromEspn({
    id: game.id,
    date: game.date,
    status: { type: { description: game.status, state: game.status } },
    competitions: [{
      competitors: [
        { homeAway: "home", team: { abbreviation: game.homeTeam.key, displayName: game.homeTeam.name } },
        { homeAway: "away", team: { abbreviation: game.awayTeam.key, displayName: game.awayTeam.name } },
      ],
    }],
  }, "NBA"));
}

function fallbackMeta(mode: "auto" | "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : "espn",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: mode,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  try {
    // 1) Games today.
    const today = await getScoreboardForDate(date, resolvedDataMode, cacheBust);
    if (today.games.length > 0) {
      return NextResponse.json(buildPayload({
        state: "today",
        dateUsed: date,
        games: today.games,
        userFacingMessage: "Showing today's NBA slate.",
        meta: today.meta,
        mode,
      }));
    }

    // 2) Next scheduled slate (between game days during the season).
    const next = await getNextLeagueSlateAfter(date, resolvedDataMode, 21, cacheBust);
    if (next.games.length > 0 && next.nextDateISO) {
      const message = `No NBA games on ${date}. Showing the next slate on ${next.nextDateISO}.`;
      return NextResponse.json(buildPayload({
        state: "next_slate",
        dateUsed: date,
        nextDate: next.nextDateISO,
        games: next.games,
        userFacingMessage: message,
        meta: { ...next.meta, warning: message },
        mode,
      }));
    }

    // 3) Off-season: surface the most recent real slate for context.
    const historical = await getMostRecentSlateBefore(date, resolvedDataMode, 120, cacheBust);
    const offseasonMessage = "NBA is out of season.";
    return NextResponse.json(buildPayload({
      state: "offseason",
      dateUsed: date,
      games: [],
      historical: historical.dateISO
        ? { date: historical.dateISO, games: shapeNbaTonightsSlate(historical.games, mode) }
        : null,
      userFacingMessage: historical.dateISO
        ? `${offseasonMessage} Showing the most recent slate from ${historical.dateISO} for context.`
        : `${offseasonMessage} No recent slate was found.`,
      meta: { ...historical.meta, warning: offseasonMessage },
      mode,
    }));
  } catch (error) {
    const message = `Failed to load NBA tonight's slate: ${String(error)}`;
    const meta = fallbackMeta(resolvedDataMode, message);
    return NextResponse.json({
      data: { state: "offseason", dateUsed: date, nextDate: null, games: [], historical: null, userFacingMessage: message },
      meta,
      contract: toWidgetPayload({ data: [], error: message, meta, primaryProvider: "espn" }),
      error: message,
    }, { status: 502 });
  }
}

function buildPayload(args: {
  state: SlateState;
  dateUsed: string;
  nextDate?: string | null;
  games: SlateGame[];
  historical?: { date: string; games: ReturnType<typeof shapeNbaTonightsSlate> } | null;
  userFacingMessage: string;
  meta: Meta;
  mode: "beginner" | "advanced";
}) {
  const { state, dateUsed, nextDate = null, games, historical = null, userFacingMessage, meta, mode } = args;
  return {
    data: {
      state,
      dateUsed,
      nextDate,
      games: shapeNbaTonightsSlate(games, mode),
      historical,
      userFacingMessage,
    },
    meta,
    contract: toWidgetPayload({ data: canonicalGames(games), meta, primaryProvider: "espn" }),
    error: null,
  };
}
