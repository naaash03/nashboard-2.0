import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId") ?? "";
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  const { data, meta } = await mlbProvider.getPitcherArsenal(playerId, resolvedDataMode);
  return NextResponse.json({ data, meta });
}
