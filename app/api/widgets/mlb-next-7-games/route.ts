import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";
import { shapeMlbNext7Games } from "@/lib/templates/mlbNext7Games";
import type { Meta } from "@/lib/providers/types";

function fallbackMeta(mode: "auto" | "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : "mlb",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: mode,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamKey = (searchParams.get("teamKey") ?? "NYM").trim().toUpperCase();
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  try {
    const providerResult = await mlbProvider.getNextSevenGames(teamKey, mode, resolvedDataMode, cacheBust);
    const shaped = providerResult.data ? shapeMlbNext7Games(providerResult.data, mode) : null;

    return NextResponse.json({
      data: shaped,
      meta: providerResult.meta,
      error: null,
    });
  } catch (error) {
    const message = `Failed to load MLB next 7 games: ${String(error)}`;
    return NextResponse.json({
      data: null,
      meta: fallbackMeta(resolvedDataMode, message),
      error: message,
    }, { status: 502 });
  }
}

