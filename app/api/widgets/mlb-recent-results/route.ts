import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";
import type { Meta } from "@/lib/providers/types";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";

function buildRouteMeta(warning: string, resolvedDataMode: "auto" | "live" | "fixture"): Meta {
  return {
    sourceUsed: resolvedDataMode === "fixture" ? "fixture" : "mlb",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: resolvedDataMode,
    dataModeEffective: resolvedDataMode === "fixture" ? "fixture" : "live",
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamKey = (searchParams.get("teamKey") ?? "").trim().toUpperCase();
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(10, parseInt(limitParam, 10))) : 3;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!teamKey) {
    const error = "teamKey is required";
    const meta = buildRouteMeta(error, resolvedDataMode);
    const contract = toWidgetPayload({ data: null, error, meta, primaryProvider: "mlb" });
    return NextResponse.json({ data: null, meta, error, contract }, { status: 400 });
  }

  const { data, meta } = await mlbProvider.getRecentResults(teamKey, limit, resolvedDataMode);
  const contract = toWidgetPayload({ data, error: null, meta, primaryProvider: "mlb" });
  return NextResponse.json({ data, meta, error: null, contract });
}
