import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getPlayerInsights } from "@/lib/providers/espn/playerInsights";
import { normalizeSportKey } from "@/lib/providers/espn/playerDirectory";
import type { Meta } from "@/lib/providers/types";
import type { Envelope } from "@/lib/types/players";
import type { PlayerInsights } from "@/lib/types/playerInsights";

function fallbackMeta(dataMode: "auto" | "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: dataMode === "fixture" ? "fixture" : "espn",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode,
  };
}

function errorStatus(code?: string): number {
  if (code === "MISSING_PLAYER_ID") {
    return 400;
  }
  return 502;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = normalizeSportKey(searchParams.get("sport"));
  const playerId = (searchParams.get("playerId") ?? "").trim();
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!playerId) {
    const envelope: Envelope<PlayerInsights> = {
      data: null,
      meta: fallbackMeta(resolvedDataMode, "playerId is required"),
      error: {
        message: "playerId is required",
        code: "MISSING_PLAYER_ID",
      },
    };
    return NextResponse.json(envelope, { status: 400 });
  }

  try {
    const envelope = await getPlayerInsights(sport, playerId, mode, resolvedDataMode, cacheBust);
    if (envelope.error) {
      return NextResponse.json(envelope, { status: errorStatus(envelope.error.code) });
    }
    return NextResponse.json(envelope);
  } catch (error) {
    const message = `Unexpected error in players insights route: ${String(error)}`;
    const envelope: Envelope<PlayerInsights> = {
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

