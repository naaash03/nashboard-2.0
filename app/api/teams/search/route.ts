import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { resolveTeamsSearch } from "@/lib/providers";
import { normalizeTeamSearchSport } from "@/lib/providers/espn/teamDirectory";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, TeamSearchResult } from "@/lib/types/players";

function fallbackMeta(dataMode: "auto" | "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: dataMode === "fixture" ? "fixture" : "apiSports",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode,
  };
}

function errorStatus(code?: string): number {
  if (code === "MISSING_QUERY") {
    return 400;
  }
  return 502;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = normalizeTeamSearchSport(searchParams.get("sport"));
  const query = (searchParams.get("q") ?? "").trim();
  const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "8", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(8, parsedLimit)) : 8;
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!query) {
    const envelope: Envelope<TeamSearchResult[]> = {
      data: null,
      meta: fallbackMeta(resolvedDataMode, "q is required"),
      error: {
        message: "q is required",
        code: "MISSING_QUERY",
      },
    };
    return NextResponse.json(envelope, { status: 400 });
  }

  try {
    const envelope = await resolveTeamsSearch(sport, query, limit, {
      dataMode: resolvedDataMode,
      cacheBust,
    });
    if (envelope.error) {
      return NextResponse.json(envelope, { status: errorStatus(envelope.error.code) });
    }
    return NextResponse.json(envelope);
  } catch (error) {
    const message = `Unexpected error in teams search route: ${String(error)}`;
    const envelope: Envelope<TeamSearchResult[]> = {
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