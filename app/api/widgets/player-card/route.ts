import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getPlayer } from "@/lib/providers/espn/nfl";
import { shapePlayerCard } from "@/lib/templates/playerCard";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = (searchParams.get("sport") ?? "NFL").toUpperCase();
  const playerId = (searchParams.get("playerId") ?? "").trim();
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (sport !== "NFL") {
    return NextResponse.json({ error: "Only NFL is supported in this route" }, { status: 400 });
  }

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  try {
    const response = await getPlayer(playerId, resolvedDataMode);
    if (!response.player) {
      return NextResponse.json({
        data: null,
        meta: {
          ...response.meta,
          warning: response.meta.warning ?? "No player data returned from ESPN.",
        },
      }, { status: 200 });
    }

    return NextResponse.json({
      data: shapePlayerCard(response.player, mode),
      meta: response.meta,
    });
  } catch (error) {
    return NextResponse.json({ error: `Failed to load player card: ${String(error)}` }, { status: 502 });
  }
}
