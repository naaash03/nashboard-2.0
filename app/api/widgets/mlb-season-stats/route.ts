import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "player";
  const playerId = searchParams.get("playerId") ?? "";
  const teamKey = (searchParams.get("teamKey") ?? "").toUpperCase();
  const seasonParam = searchParams.get("season");
  const season = seasonParam ? parseInt(seasonParam, 10) : new Date().getFullYear();
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (mode === "player") {
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required for mode=player" }, { status: 400 });
    }
    const { data, meta } = await mlbProvider.getPlayerSeasonStats(playerId, resolvedDataMode);
    return NextResponse.json({ data, meta, mode: "player" });
  }

  if (mode === "team") {
    if (!teamKey) {
      return NextResponse.json({ error: "teamKey is required for mode=team" }, { status: 400 });
    }
    const { data, meta } = await mlbProvider.getTeamSeasonStats(teamKey, season, resolvedDataMode);
    return NextResponse.json({ data, meta, mode: "team" });
  }

  return NextResponse.json({ error: "mode must be 'player' or 'team'" }, { status: 400 });
}
