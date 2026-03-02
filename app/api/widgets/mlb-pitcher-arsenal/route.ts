import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";
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
    return NextResponse.json({
      data: null,
      meta: fallbackMeta(resolvedDataMode, error),
      error,
    }, { status: 400 });
  }

  try {
    const providerResult = await mlbProvider.getPitcherArsenal(playerId, resolvedDataMode, cacheBust);
    const shaped = providerResult.data ? shapeMlbPitcherArsenal(providerResult.data, mode) : null;

    return NextResponse.json({
      data: shaped,
      meta: providerResult.meta,
      error: null,
    });
  } catch (error) {
    const message = `Failed to load MLB pitcher arsenal: ${String(error)}`;
    return NextResponse.json({
      data: null,
      meta: fallbackMeta(resolvedDataMode, message),
      error: message,
    }, { status: 502 });
  }
}

