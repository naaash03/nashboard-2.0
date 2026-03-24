import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { resolvedDataMode } = resolveDataModeFromRequest(req);
  const teamKey = (searchParams.get("teamKey") ?? "").toUpperCase();
  const gamePk = searchParams.get("gamePk") ?? "";

  if (!teamKey && !gamePk) {
    return NextResponse.json({ error: "Provide teamKey or gamePk" }, { status: 400 });
  }

  const { data, meta } = await mlbProvider.getStartingPitcherMatchup(
    gamePk,
    resolvedDataMode,
    undefined,
    teamKey || undefined,
  );
  return NextResponse.json({ data, meta });
}
