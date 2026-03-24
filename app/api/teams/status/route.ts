import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getTeamStatus, normalizeTeamStatusSport } from "@/lib/providers/espn/teamStatus";
import { toCanonicalTeamStatus } from "@/lib/sports/resolvers";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import type { Meta } from "@/lib/providers/types";
import type { Envelope } from "@/lib/types/players";
import type { TeamStatus } from "@/lib/types/teamStatus";

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
  if (code === "MISSING_TEAM_KEY") {
    return 400;
  }
  return 502;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = normalizeTeamStatusSport(searchParams.get("sport"));
  const teamKey = (searchParams.get("teamKey") ?? "").trim();
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!teamKey) {
    const meta = fallbackMeta(resolvedDataMode, "teamKey is required");
    const envelope: Envelope<TeamStatus> = {
      data: null,
      meta,
      error: {
        message: "teamKey is required",
        code: "MISSING_TEAM_KEY",
      },
    };
    const contract = toWidgetPayload({
      data: null,
      error: "teamKey is required",
      meta,
      primaryProvider: "apiSports",
    });
    return NextResponse.json({ ...envelope, contract }, { status: 400 });
  }

  try {
    const envelope = await getTeamStatus(sport, teamKey, resolvedDataMode, cacheBust);
    const contract = toWidgetPayload({
      data: envelope.data ? toCanonicalTeamStatus(envelope.data, "espn") : null,
      error: envelope.error?.message ?? null,
      meta: envelope.meta,
      primaryProvider: "apiSports",
    });
    if (envelope.error) {
      return NextResponse.json({ ...envelope, contract }, { status: errorStatus(envelope.error.code) });
    }
    return NextResponse.json({ ...envelope, contract });
  } catch (error) {
    const message = `Unexpected error in teams status route: ${String(error)}`;
    const meta = fallbackMeta(resolvedDataMode, message);
    const envelope: Envelope<TeamStatus> = {
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

