import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "player";
  const playerId = (searchParams.get("playerId") ?? "").trim();
  const teamKey = (searchParams.get("teamKey") ?? "").trim().toUpperCase();
  const seasonParam = searchParams.get("season");
  const season = seasonParam ? parseInt(seasonParam, 10) : new Date().getFullYear();
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (mode === "player") {
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required for mode=player" }, { status: 400 });
    }
    const { data, meta } = await mlbProvider.getPlayerSeasonStats(playerId, resolvedDataMode);
    const contract = toWidgetPayload({ data, error: null, meta, primaryProvider: "mlb" });
    if (process.env.NODE_ENV === "development") {
      const missing: string[] = [];
      if (contract.ok === undefined || contract.ok === null) missing.push("ok");
      if (!contract.source?.provider) missing.push("source.provider");
      if (!contract.source?.mode) missing.push("source.mode");
      if (!contract.source?.fetchedAt) missing.push("source.fetchedAt");
      if (!contract.debug?.requestId) missing.push("debug.requestId");
      if (missing.length > 0) {
        console.warn(`[contract] mlb-season-stats missing fields: ${missing.join(", ")}`);
      }
    }
    return NextResponse.json({ data, meta, contract });
  }

  if (mode === "team") {
    if (!teamKey) {
      return NextResponse.json({ error: "teamKey is required for mode=team" }, { status: 400 });
    }
    const { data, meta } = await mlbProvider.getTeamSeasonStats(teamKey, season, resolvedDataMode);
    const contract = toWidgetPayload({ data, error: null, meta, primaryProvider: "mlb" });
    if (process.env.NODE_ENV === "development") {
      const missing: string[] = [];
      if (contract.ok === undefined || contract.ok === null) missing.push("ok");
      if (!contract.source?.provider) missing.push("source.provider");
      if (!contract.source?.mode) missing.push("source.mode");
      if (!contract.source?.fetchedAt) missing.push("source.fetchedAt");
      if (!contract.debug?.requestId) missing.push("debug.requestId");
      if (missing.length > 0) {
        console.warn(`[contract] mlb-season-stats missing fields: ${missing.join(", ")}`);
      }
    }
    return NextResponse.json({ data, meta, contract });
  }

  return NextResponse.json({ error: "mode must be 'player' or 'team'" }, { status: 400 });
}
