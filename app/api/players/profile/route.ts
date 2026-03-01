import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getPlayerProfile, normalizeSportKey } from "@/lib/providers/espn/playerDirectory";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, PlayerProfile } from "@/lib/types/players";

function fallbackMeta(dataMode: "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: dataMode === "fixture" ? "fixture" : "espn",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode,
  };
}

function errorStatus(code?: string): number {
  if (code === "MISSING_PLAYER_ID" || code === "INVALID_SPORT") {
    return 400;
  }
  return 502;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = normalizeSportKey(searchParams.get("sport"));
  const playerId = (searchParams.get("playerId") ?? "").trim();
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!playerId) {
    const meta = fallbackMeta(resolvedDataMode, "playerId is required");
    const envelope: Envelope<PlayerProfile> = {
      data: null,
      meta,
      error: {
        message: "playerId is required",
        code: "MISSING_PLAYER_ID",
      },
    };
    return NextResponse.json(envelope, { status: 400 });
  }

  try {
    const envelope = await getPlayerProfile(sport, playerId, resolvedDataMode);
    if (envelope.error) {
      return NextResponse.json(envelope, { status: errorStatus(envelope.error.code) });
    }

    return NextResponse.json(envelope);
  } catch (error) {
    const message = `Unexpected error in players profile route: ${String(error)}`;
    const envelope: Envelope<PlayerProfile> = {
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
