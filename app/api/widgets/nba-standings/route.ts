import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getStandingsSnapshot } from "@/lib/providers/espn/nba";
import { shapeNbaStandings } from "@/lib/templates/nbaStandings";
import type { Meta } from "@/lib/providers/types";

function fallbackMeta(mode: "live" | "fixture", warning: string): Meta {
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
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  try {
    const standings = await getStandingsSnapshot(mode, resolvedDataMode, cacheBust);
    return NextResponse.json({
      data: shapeNbaStandings(standings.data, mode),
      meta: standings.meta,
      error: null,
    });
  } catch (error) {
    const message = `Failed to load NBA standings: ${String(error)}`;
    return NextResponse.json({
      data: { east: [], west: [] },
      meta: fallbackMeta(resolvedDataMode, message),
      error: message,
    }, { status: 502 });
  }
}
