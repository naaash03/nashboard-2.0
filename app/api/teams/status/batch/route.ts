import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getTeamStatusBatch, normalizeTeamStatusSport } from "@/lib/providers/espn/teamStatus";
import { toCanonicalTeamStatus } from "@/lib/sports/resolvers";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import type { Meta } from "@/lib/providers/types";
import type { Envelope } from "@/lib/types/players";
import type { TeamStatusBatch } from "@/lib/types/teamStatus";

function fallbackMeta(dataMode: "auto" | "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: dataMode === "fixture" ? "fixture" : "espn",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode,
  };
}

function errorStatus(code?: string): number {
  if (code === "MISSING_TEAM_KEYS") {
    return 400;
  }
  return 502;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = normalizeTeamStatusSport(searchParams.get("sport"));
  const teamKeys = (searchParams.get("teamKeys") ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (teamKeys.length === 0) {
    const meta = fallbackMeta(resolvedDataMode, "teamKeys is required");
    const envelope: Envelope<TeamStatusBatch> = {
      data: null,
      meta,
      error: {
        message: "teamKeys is required",
        code: "MISSING_TEAM_KEYS",
      },
    };
    const contract = toWidgetPayload({
      data: null,
      error: "teamKeys is required",
      meta,
      primaryProvider: "apiSports",
    });
    return NextResponse.json({ ...envelope, contract }, { status: 400 });
  }

  try {
    const envelope = await getTeamStatusBatch(sport, teamKeys, resolvedDataMode, cacheBust);
    const contract = toWidgetPayload({
      data: envelope.data?.statuses?.map((status) => toCanonicalTeamStatus(status, "espn")) ?? null,
      error: envelope.error?.message ?? null,
      meta: envelope.meta,
      primaryProvider: "apiSports",
    });

    if (envelope.error) {
      return NextResponse.json({ ...envelope, contract }, { status: errorStatus(envelope.error.code) });
    }
    return NextResponse.json({ ...envelope, contract });
  } catch (error) {
    const message = `Unexpected error in teams status batch route: ${String(error)}`;
    const meta = fallbackMeta(resolvedDataMode, message);
    const envelope: Envelope<TeamStatusBatch> = {
      data: null,
      meta,
      error: {
        message,
        code: "ROUTE_UNHANDLED",
      },
    };
    const contract = toWidgetPayload({
      data: null,
      error: message,
      meta,
      primaryProvider: "apiSports",
    });
    return NextResponse.json({ ...envelope, contract }, { status: 500 });
  }
}
