import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getPlayerInsights } from "@/lib/providers/espn/playerInsights";
import { normalizeSportKey } from "@/lib/providers/espn/playerDirectory";
import type { Meta } from "@/lib/providers/types";
import type { Envelope } from "@/lib/types/players";
import type { PlayerInsights } from "@/lib/types/playerInsights";

type BatchResult = {
  sport: "nfl" | "mlb" | "nba";
  players: PlayerInsights[];
};

function fallbackMeta(dataMode: "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: dataMode === "fixture" ? "fixture" : "espn",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode,
  };
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const cappedLimit = Math.max(1, limit);
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(cappedLimit, tasks.length) }, () => worker()));
  return results;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = normalizeSportKey(searchParams.get("sport"));
  const playerIds = (searchParams.get("playerIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const mode = (searchParams.get("mode") ?? "advanced").toLowerCase() === "beginner" ? "beginner" : "advanced";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (playerIds.length === 0) {
    const envelope: Envelope<BatchResult> = {
      data: null,
      meta: fallbackMeta(resolvedDataMode, "playerIds is required"),
      error: {
        message: "playerIds is required",
        code: "MISSING_PLAYER_IDS",
      },
    };
    return NextResponse.json(envelope, { status: 400 });
  }

  try {
    const uniqueIds = Array.from(new Set(playerIds));
    const tasks = uniqueIds.map((playerId) => async () => getPlayerInsights(sport, playerId, mode, resolvedDataMode, cacheBust));
    const envelopes = await runWithConcurrency(tasks, 4);

    const players = envelopes
      .map((envelope) => envelope.data)
      .filter((player): player is PlayerInsights => player !== null);

    const warningMessages = envelopes
      .map((envelope) => envelope.meta.warning)
      .filter((warning): warning is string => Boolean(warning));
    const sourceUsed = envelopes[0]?.meta.sourceUsed ?? (resolvedDataMode === "fixture" ? "fixture" : "espn");

    const envelope: Envelope<BatchResult> = {
      data: {
        sport,
        players,
      },
      meta: {
        sourceUsed,
        updatedAt: new Date().toISOString(),
        requestId: randomUUID(),
        warning: warningMessages.length > 0 ? warningMessages.join(" ") : undefined,
        dataMode: resolvedDataMode,
      },
    };

    return NextResponse.json(envelope);
  } catch (error) {
    const message = `Unexpected error in players insights batch route: ${String(error)}`;
    const envelope: Envelope<BatchResult> = {
      data: null,
      meta: fallbackMeta(resolvedDataMode, message),
      error: {
        message,
        code: "ROUTE_UNHANDLED",
      },
    };
    return NextResponse.json(envelope, { status: 500 });
  }
}
