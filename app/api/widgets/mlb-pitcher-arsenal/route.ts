import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { resolvePlayersSearch } from "@/lib/providers";
import { mlbProvider } from "@/lib/providers/mlb";
import type { Meta } from "@/lib/providers/types";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { shapeMlbPitcherArsenal } from "@/lib/templates/mlbPitcherArsenal";
import type { PlayerSearchResult } from "@/lib/types/players";

function fallbackMeta(mode: "auto" | "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : "mlb",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: mode,
  };
}

function isNumericPlayerId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function isUnsupportedArsenalError(error: unknown): boolean {
  const text = String(error).toLowerCase();
  return text.includes("400")
    || text.includes("404")
    || text.includes("422")
    || text.includes("not found")
    || text.includes("invalid")
    || text.includes("pitcharsenal")
    || text.includes("pitch arsenal")
    || text.includes("unsupported")
    || text.includes("not available");
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]|_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolvePlayerIdFromCandidates(query: string, rows: PlayerSearchResult[]): string | null {
  const normalizedQuery = normalizeName(query);
  const exact = rows.find((row) => normalizeName(row.fullName) === normalizedQuery && isNumericPlayerId(row.playerId));
  if (exact) {
    return exact.playerId;
  }
  const prefix = rows.find((row) => normalizeName(row.fullName).startsWith(normalizedQuery) && isNumericPlayerId(row.playerId));
  if (prefix) {
    return prefix.playerId;
  }
  const numeric = rows.find((row) => isNumericPlayerId(row.playerId));
  return numeric?.playerId ?? null;
}

async function resolvePitcherId(input: string, dataMode: "auto" | "live" | "fixture", cacheBust?: string): Promise<string | null> {
  if (isNumericPlayerId(input)) {
    return input.trim();
  }
  const envelope = await resolvePlayersSearch("mlb", input, 8, {
    dataMode,
    cacheBust,
  });
  return resolvePlayerIdFromCandidates(input, envelope.data ?? []);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const playerRef = (searchParams.get("playerId") ?? "").trim();
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!playerRef) {
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
    const playerId = await resolvePitcherId(playerRef, resolvedDataMode, cacheBust);
    if (!playerId) {
      const error = "Could not resolve a valid MLB pitcher id from the provided input.";
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
    if (isUnsupportedArsenalError(error)) {
      const warning = "Pitch arsenal is not available from MLB Stats API for this pitcher id.";
      const meta = fallbackMeta(resolvedDataMode, warning);
      return NextResponse.json({
        data: null,
        meta,
        contract: toWidgetPayload({
          data: null,
          error: null,
          meta,
          primaryProvider: "mlb",
        }),
        error: null,
      });
    }

    const message = "Failed to load MLB pitcher arsenal";
    const meta = fallbackMeta(resolvedDataMode, `MLB pitcher arsenal upstream failure: ${String(error)}`);
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
