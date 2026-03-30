import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";
import type { Meta } from "@/lib/providers/types";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { shapeMlbPitcherVsProjectedLineup } from "@/lib/templates/mlbPitcherVsProjectedLineup";

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
  const gameIdRaw = (searchParams.get("gameId") ?? "").trim();
  const gameId = gameIdRaw.length > 0 ? gameIdRaw : undefined;
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const selectedPitcherIdRaw = (searchParams.get("selectedPitcherId") ?? "").trim();
  const selectedPitcherId = mode === "advanced" && selectedPitcherIdRaw.length > 0 ? selectedPitcherIdRaw : undefined;
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  try {
    const providerResult = await mlbProvider.getPitcherVsProjectedLineup(teamKey, {
      gameId,
      selectedPitcherId,
      includePitcherOptions: mode === "advanced",
      dataMode: resolvedDataMode,
      cacheBust,
    });
    const shaped = providerResult.data ? shapeMlbPitcherVsProjectedLineup(providerResult.data, mode) : null;

    return NextResponse.json({
      data: shaped,
      meta: providerResult.meta,
      contract: toWidgetPayload({
        data: shaped,
        error: null,
        meta: providerResult.meta,
        primaryProvider: "mlb",
        notes: providerResult.data?.notes,
      }),
      error: null,
    });
  } catch (error) {
    const message = "Failed to load pitcher vs projected lineup";
    const meta = fallbackMeta(resolvedDataMode, `MLB pitcher vs projected lineup upstream failure: ${String(error)}`);
    return NextResponse.json({
      data: null,
      meta,
      contract: toWidgetPayload({
        data: null,
        error: message,
        meta,
        primaryProvider: "mlb",
      }),
      error: message,
    }, { status: 502 });
  }
}
