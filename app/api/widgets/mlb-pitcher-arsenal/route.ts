import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { shapeMlbPitcherArsenal } from "@/lib/templates/mlbPitcherArsenal";
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
  const playerId = (searchParams.get("playerId") ?? "").trim();
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!playerId) {
    const error = "playerId is required";
    const meta = fallbackMeta(resolvedDataMode, error);
    return NextResponse.json({
      data: null,
      meta,
      contract: toWidgetPayload({
        data: null,
        error,
        meta,
        primaryProvider: "mlb",
      }),
      error,
    }, { status: 400 });
  }

  try {
    const providerResult = await mlbProvider.getPitcherArsenal(playerId, resolvedDataMode, cacheBust);
    const shaped = providerResult.data ? shapeMlbPitcherArsenal(providerResult.data, mode) : null;

    return NextResponse.json({
      data: shaped,
      meta: providerResult.meta,
      contract: toWidgetPayload({
        data: providerResult.data
          ? {
            playerId: `mlb-${providerResult.data.playerId}`,
            league: "MLB",
            stats: { pitches: providerResult.data.pitches },
            sourceMeta: {
              provider: providerResult.meta.sourceUsed,
              fetchedAt: providerResult.meta.updatedAt,
              stale: providerResult.meta.sourceUsed === "cache",
            },
          }
          : null,
        error: null,
        meta: providerResult.meta,
        primaryProvider: "mlb",
      }),
      error: null,
    });
  } catch (error) {
    const message = `Failed to load MLB pitcher arsenal: ${String(error)}`;
    const meta = fallbackMeta(resolvedDataMode, message);
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
