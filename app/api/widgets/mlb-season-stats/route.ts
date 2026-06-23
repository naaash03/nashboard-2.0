import { NextResponse } from "next/server";
import { fallbackMeta, parseWidgetParams, warnMissingContractFields } from "@/lib/api/widgetRoute";
import { mlbProvider } from "@/lib/providers/mlb";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";

export async function GET(req: Request) {
  const { searchParams, teamKey, playerId, resolvedDataMode } = parseWidgetParams(req);
  const mode = searchParams.get("mode") ?? "player";
  const seasonParam = searchParams.get("season");
  const season = seasonParam ? parseInt(seasonParam, 10) : new Date().getFullYear();

  if (mode !== "player" && mode !== "team") {
    return NextResponse.json({ error: "mode must be 'player' or 'team'" }, { status: 400 });
  }
  if (mode === "player" && !playerId) {
    return NextResponse.json({ error: "playerId is required for mode=player" }, { status: 400 });
  }
  if (mode === "team" && !teamKey) {
    return NextResponse.json({ error: "teamKey is required for mode=team" }, { status: 400 });
  }

  try {
    const { data, meta } = mode === "player"
      ? await mlbProvider.getPlayerSeasonStats(playerId, resolvedDataMode)
      : await mlbProvider.getTeamSeasonStats(teamKey, season, resolvedDataMode);
    const contract = toWidgetPayload({ data, error: null, meta, primaryProvider: "mlb" });
    warnMissingContractFields("mlb-season-stats", contract);
    return NextResponse.json({ data, meta, contract });
  } catch (error) {
    const message = "Failed to load MLB season stats";
    const meta = fallbackMeta(resolvedDataMode, `${message}: ${String(error)}`);
    const contract = toWidgetPayload({ data: null, error: message, meta, primaryProvider: "mlb" });
    return NextResponse.json({ data: null, meta, contract, error: message }, { status: 502 });
  }
}
