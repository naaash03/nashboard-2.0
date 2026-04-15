import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { resolveNflDivisionSnapshot } from "@/lib/sports/resolvers/nflWidgets";
import { shapeNflDivisionSnapshot } from "@/lib/templates/nflDivisionSnapshot";
import type { NflConference, NflDivision } from "@/lib/types/nfl";

function parseConference(value: string | null): NflConference | undefined {
  const normalized = (value ?? "").trim().toUpperCase();
  return normalized === "AFC" || normalized === "NFC" ? normalized : undefined;
}

function parseDivision(value: string | null): NflDivision | undefined {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "east") return "East";
  if (normalized === "north") return "North";
  if (normalized === "south") return "South";
  if (normalized === "west") return "West";
  return undefined;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const conference = parseConference(searchParams.get("conference"));
  const division = parseDivision(searchParams.get("division"));
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  const resolved = await resolveNflDivisionSnapshot({
    conference,
    division,
    dataMode: resolvedDataMode,
    cacheBust,
  });
  const contract = toWidgetPayload({
    data: resolved.data,
    error: null,
    meta: resolved.meta,
    primaryProvider: "espn",
    notes: ["NFL division standings use ESPN first, then API-Sports NFL fallback when ESPN is unavailable or offseason data is too sparse, then demo as the last resort."],
  });

  return NextResponse.json({
    data: shapeNflDivisionSnapshot(resolved.data, mode, { conference, division }),
    meta: resolved.meta,
    contract,
    error: null,
  });
}
