import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getTodaysSlate } from "@/lib/providers/espn/nba";
import { shapeNbaTonightsSlate } from "@/lib/templates/nbaTonightsSlate";
import type { Meta } from "@/lib/providers/types";

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
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  try {
    const slate = await getTodaysSlate(mode, resolvedDataMode, cacheBust);
    return NextResponse.json({
      data: {
        dateUsed: slate.dateUsed,
        games: shapeNbaTonightsSlate(slate.games, mode),
        userFacingMessage: slate.games.length > 0
          ? "Showing today's NBA slate."
          : "No NBA games scheduled today.",
      },
      meta: slate.meta,
      error: null,
    });
  } catch (error) {
    const message = `Failed to load NBA tonight's slate: ${String(error)}`;
    return NextResponse.json({
      data: {
        dateUsed: new Date().toISOString().slice(0, 10),
        games: [],
        userFacingMessage: message,
      },
      meta: fallbackMeta(resolvedDataMode, message),
      error: message,
    }, { status: 502 });
  }
}

