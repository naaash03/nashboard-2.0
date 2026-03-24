import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  let gamePk = searchParams.get("gamePk");
  const teamKey = (searchParams.get("teamKey") ?? "").toUpperCase();

  // If no gamePk but teamKey given, resolve the team's next scheduled game
  if (!gamePk && teamKey) {
    const next7 = await mlbProvider.getNextSevenGames(teamKey, "beginner", resolvedDataMode);
    const firstGame = next7.data?.games[0];
    if (!firstGame) {
      return NextResponse.json({ data: null, meta: next7.meta });
    }
    gamePk = String(firstGame.gamePk);
  }

  if (!gamePk) {
    return NextResponse.json(
      { error: "Provide gamePk or teamKey" },
      { status: 400 },
    );
  }

  const { data, meta } = await mlbProvider.getStartingPitcherMatchup(
    gamePk,
    resolvedDataMode,
  );
  return NextResponse.json({ data, meta });
}
