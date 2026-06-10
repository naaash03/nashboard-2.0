import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import type { DataSource, Meta } from "@/lib/providers/types";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import {
  resolveMlbPitcherProjection,
  type ProjectionMode,
} from "@/lib/sports/resolvers/mlbPitcherProjection";

function normalizeMode(value: string | null): ProjectionMode {
  return (value ?? "").toUpperCase() === "ADVANCED" ? "ADVANCED" : "BEGINNER";
}

function toCanonicalSource(sourceUsed: string, resolvedDataMode: "auto" | "live" | "fixture"): DataSource {
  if (resolvedDataMode === "fixture") return "fixture";
  if (sourceUsed === "cache") return "cache";
  if (sourceUsed === "demo") return "demo";
  if (sourceUsed === "fixture") return "fixture";
  if (sourceUsed.includes("mlb")) return "mlb";
  if (sourceUsed.includes("espn")) return "espn";
  return "mlb";
}

function buildContractMeta(args: {
  sourceUsed: string;
  generatedAt: string;
  requestId: string;
  resolvedDataMode: "auto" | "live" | "fixture";
  warning?: string;
  fallbackReason?: string;
}): Meta {
  return {
    sourceUsed: toCanonicalSource(args.sourceUsed, args.resolvedDataMode),
    updatedAt: args.generatedAt,
    requestId: args.requestId,
    warning: args.warning,
    notes: args.fallbackReason ? [args.fallbackReason] : undefined,
    dataMode: args.resolvedDataMode,
    dataModeEffective: args.resolvedDataMode === "fixture" ? "fixture" : "live",
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pitcherTeamKey = (searchParams.get("pitcherTeamKey") ?? "").trim().toUpperCase();
  const gameIdRaw = (searchParams.get("gameId") ?? "").trim();
  const gameId = gameIdRaw.length > 0 ? gameIdRaw : undefined;
  const mode = normalizeMode(searchParams.get("mode"));
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!pitcherTeamKey) {
    const requestId = randomUUID();
    const generatedAt = new Date().toISOString();
    const error = "pitcherTeamKey query param is required";
    const contractMeta = buildContractMeta({
      sourceUsed: "mlb",
      generatedAt,
      requestId,
      resolvedDataMode,
      warning: error,
      fallbackReason: error,
    });
    const contract = toWidgetPayload({ data: null, error, meta: contractMeta, primaryProvider: "mlb" });
    return NextResponse.json({
      data: null,
      meta: {
        sourceUsed: contractMeta.sourceUsed,
        generatedAt,
        updatedAt: generatedAt,
        isFallback: true,
        requestId,
        warning: error,
      },
      error,
      contract,
    }, { status: 400 });
  }

  const result = await resolveMlbPitcherProjection({
    pitcherTeamKey,
    gameId,
    mode,
    dataMode: resolvedDataMode,
  });

  const status = result.ok ? 200 : (result.error?.code === "MISSING_TEAM_KEY" ? 400 : 502);
  const error = result.error?.message ?? null;
  const contractMeta = buildContractMeta({
    sourceUsed: result.meta.sourceUsed,
    generatedAt: result.meta.generatedAt,
    requestId: result.meta.requestId,
    resolvedDataMode,
    warning: result.meta.warning,
    fallbackReason: result.meta.fallbackReason,
  });
  const contract = toWidgetPayload({
    data: result.data,
    error,
    meta: contractMeta,
    primaryProvider: "mlb",
  });

  return NextResponse.json({
    data: result.data,
    meta: {
      sourceUsed: result.meta.sourceUsed,
      generatedAt: result.meta.generatedAt,
      updatedAt: result.meta.generatedAt,
      isFallback: result.meta.isFallback,
      fallbackReason: result.meta.fallbackReason,
      requestId: result.meta.requestId,
      pitcherName: result.meta.pitcherName,
      venue: result.meta.venue,
      warning: result.meta.warning,
    },
    error,
    contract,
  }, { status });
}
