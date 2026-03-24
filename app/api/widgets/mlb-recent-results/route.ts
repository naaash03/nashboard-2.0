import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamKey = (searchParams.get("teamKey") ?? "").toUpperCase();
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(10, parseInt(limitParam, 10))) : 3;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!teamKey) {
    return NextResponse.json({ error: "teamKey is required" }, { status: 400 });
  }

  const { data, meta } = await mlbProvider.getRecentResults(teamKey, limit, resolvedDataMode);
  return NextResponse.json({ data, meta });
}
