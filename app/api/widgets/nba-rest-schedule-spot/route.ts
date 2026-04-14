import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { resolveNbaRestScheduleSpot } from "@/lib/sports/resolvers/nbaScaffolds";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { shapeNbaRestScheduleSpot } from "@/lib/templates/nbaRestScheduleSpot";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const scenarioId = (searchParams.get("scenario") ?? "").trim() || undefined;
  const teamKey = (searchParams.get("teamKey") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  const resolved = await resolveNbaRestScheduleSpot({
    scenarioId,
    teamKey,
    dataMode: resolvedDataMode,
  });
  const contract = toWidgetPayload({
    data: resolved.data,
    error: null,
    meta: resolved.meta,
    primaryProvider: "balldontlie",
    notes: ["Rest / schedule context is sourced from BALLDONTLIE when a team key is selected; otherwise the widget stays on its demo scaffold."],
  });

  return NextResponse.json({
    data: shapeNbaRestScheduleSpot(resolved.data, mode),
    meta: resolved.meta,
    contract,
    error: null,
  });
}
