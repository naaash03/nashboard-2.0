import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { shapeNbaTeamMatchupProfile } from "@/lib/templates/nbaTeamMatchupProfile";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { resolveNbaTeamMatchupProfile } from "@/lib/sports/resolvers/nbaScaffolds";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const scenarioId = (searchParams.get("scenario") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  const resolved = await resolveNbaTeamMatchupProfile({
    scenarioId,
    dataMode: resolvedDataMode,
  });
  const contract = toWidgetPayload({
    data: resolved.data,
    error: null,
    meta: resolved.meta,
    primaryProvider: "balldontlie",
    notes: ["Live team context comes from BALLDONTLIE when available; matchup pillar cards remain scaffolded until richer team split data is connected."],
  });

  return NextResponse.json({
    data: shapeNbaTeamMatchupProfile(resolved.data, mode),
    meta: resolved.meta,
    contract,
    error: null,
  });
}
