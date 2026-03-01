import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { normalizeSportKey, searchPlayers } from "@/lib/providers/espn/playerDirectory";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, PlayerSearchResult } from "@/lib/types/players";

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
  if (code === "MISSING_QUERY" || code === "INVALID_SPORT") {
    return 400;
  }
  return 502;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = normalizeSportKey(searchParams.get("sport"));
  const query = (searchParams.get("q") ?? "").trim();
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!query) {
    const meta = fallbackMeta(resolvedDataMode, "q is required");
    const envelope: Envelope<PlayerSearchResult[]> = {
      data: null,
      meta,
      error: {
        message: "q is required",
        code: "MISSING_QUERY",
      },
    };
    return NextResponse.json(envelope, { status: 400 });
  }

  try {
    const envelope = await searchPlayers(sport, query, resolvedDataMode);
    if (envelope.error) {
      return NextResponse.json(envelope, { status: errorStatus(envelope.error.code) });
    }

    return NextResponse.json(envelope);
  } catch (error) {
    const message = `Unexpected error in players search route: ${String(error)}`;
    const envelope: Envelope<PlayerSearchResult[]> = {
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
