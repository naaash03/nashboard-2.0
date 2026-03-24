import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamKey = (searchParams.get("teamKey") ?? "").toUpperCase();
  const mode =
    (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced"
      ? "advanced"
      : "beginner";
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!teamKey) {
    return NextResponse.json({ error: "teamKey is required" }, { status: 400 });
  }

  const { data, meta } = await mlbProvider.getNextSevenGames(
    teamKey,
    mode,
    resolvedDataMode,
  );
  return NextResponse.json({ data, meta });
}
