import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamKey = (searchParams.get("teamKey") ?? "").toUpperCase();
  const gameType = (searchParams.get("gameType") ?? "R").toUpperCase() === "S" ? "S" : "R";
  const seriesId = searchParams.get("seriesId") ?? undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!teamKey) {
    return NextResponse.json({ error: "teamKey is required" }, { status: 400 });
  }

  const { data, meta } = await mlbProvider.getSeriesTracker(
    teamKey,
    resolvedDataMode,
    undefined,
    gameType,
    seriesId,
  );
  return NextResponse.json({ data, meta });
}
