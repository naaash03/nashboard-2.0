import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getMostRecentSlateBefore, getNextLeagueSlateAfter, getScoreboard } from "@/lib/providers/espn/nfl";
import { shapeTonightsSlate } from "@/lib/templates/tonightsSlate";
import type { Meta } from "@/lib/providers/types";

type SlateState = "today" | "next_slate" | "schedule_not_posted";

function buildDiagnostics(meta: Meta | null, fallbackMode: "live" | "fixture") {
  return {
    endpointUrl: meta?.endpointUrl ?? null,
    upstreamStatus: meta?.upstreamStatus ?? null,
    upstreamMessage: meta?.upstreamMessage ?? meta?.warning ?? null,
    lastErrorMessage: meta?.upstreamMessage ?? null,
    provider: meta?.sourceUsed === "fixture" ? "mock" : "espn",
    requestId: meta?.requestId ?? randomUUID(),
    dataMode: meta?.dataMode ?? fallbackMode,
  };
}

function responsePayload(args: {
  state: SlateState;
  dateUsed: string;
  nextDate?: string | null;
  games: ReturnType<typeof shapeTonightsSlate>;
  historical?: { date: string; games: ReturnType<typeof shapeTonightsSlate> } | null;
  userFacingMessage: string;
  meta: Meta;
}) {
  const { state, dateUsed, nextDate = null, games, historical = null, userFacingMessage, meta } = args;
  return {
    data: {
      state,
      dateUsed,
      nextDate,
      games,
      historical,
      userFacingMessage,
    },
    meta,
    diagnostics: buildDiagnostics(meta, meta.dataMode ?? "live"),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = (searchParams.get("sport") ?? "NFL").toUpperCase();
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const { resolvedDataMode } = resolveDataModeFromRequest(req);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  if (sport !== "NFL") {
    return NextResponse.json({ error: "Only NFL is supported in this route" }, { status: 400 });
  }

  try {
    const todaySlate = await getScoreboard(date, resolvedDataMode);
    if (todaySlate.games.length > 0) {
      return NextResponse.json(responsePayload({
        state: "today",
        dateUsed: date,
        games: shapeTonightsSlate(todaySlate.games, mode),
        userFacingMessage: "Showing today's NFL slate.",
        meta: todaySlate.meta,
      }));
    }

    const nextSlate = await getNextLeagueSlateAfter(date, resolvedDataMode, 21);
    if (nextSlate.games.length > 0 && nextSlate.nextDateISO) {
      return NextResponse.json(responsePayload({
        state: "next_slate",
        dateUsed: date,
        nextDate: nextSlate.nextDateISO,
        games: shapeTonightsSlate(nextSlate.games, mode),
        userFacingMessage: `No games were scheduled on ${date}. Showing the next slate on ${nextSlate.nextDateISO}.`,
        meta: {
          ...nextSlate.meta,
          warning: `No games were scheduled on ${date}. Showing the next slate on ${nextSlate.nextDateISO}.`,
        },
      }));
    }

    const historical = await getMostRecentSlateBefore(date, resolvedDataMode, 60);
    const scheduleMessage = "Next season schedule has not been posted by the league yet.";
    return NextResponse.json(responsePayload({
      state: "schedule_not_posted",
      dateUsed: date,
      nextDate: null,
      games: [],
      historical: historical.dateISO
        ? {
            date: historical.dateISO,
            games: shapeTonightsSlate(historical.games, mode),
          }
        : null,
      userFacingMessage: historical.dateISO
        ? `${scheduleMessage} Showing the most recent slate from ${historical.dateISO} for context.`
        : `${scheduleMessage} No recent historical slate was found in the past 60 days.`,
      meta: {
        ...historical.meta,
        warning: scheduleMessage,
      },
    }));
  } catch (error) {
    const message = `Failed to load tonight's slate: ${String(error)}`;
    return NextResponse.json({
      error: message,
      data: {
        state: "schedule_not_posted" as const,
        dateUsed: date,
        nextDate: null,
        games: [],
        historical: null,
        userFacingMessage: message,
      },
      diagnostics: buildDiagnostics(null, resolvedDataMode),
    }, { status: 502 });
  }
}
