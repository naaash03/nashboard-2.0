import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { shapeNbaTeamMatchupProfile } from "@/lib/templates/nbaTeamMatchupProfile";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { resolveNbaTeamMatchupProfile } from "@/lib/sports/resolvers/nbaScaffolds";

function parseTeamKey(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  return /^[A-Z]{2,4}$/.test(normalized) ? normalized : "";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const scenarioId = (searchParams.get("scenario") ?? "").trim() || undefined;
  const awayKey = parseTeamKey(searchParams.get("awayKey"));
  const homeKey = parseTeamKey(searchParams.get("homeKey"));
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (awayKey === "" || homeKey === "") {
    return NextResponse.json({
      data: null,
      meta: null,
      contract: null,
      error: "awayKey and homeKey must be 2-4 uppercase letters.",
    }, { status: 400 });
  }

  const resolved = await resolveNbaTeamMatchupProfile({
    scenarioId,
    awayKey: awayKey ?? undefined,
    homeKey: homeKey ?? undefined,
    dataMode: resolvedDataMode,
    cacheBust,
  });
  const src = resolved.meta.sourceUsed;
  const primaryProvider = (src === "apiSports" || src === "espn" || src === "mlb" || src === "balldontlie" ? src : "balldontlie") as const;
  const contract = toWidgetPayload({
    data: resolved.data,
    error: null,
    meta: resolved.meta,
    primaryProvider,
    notes: [
      resolved.data.sourceDetail,
      "Live team context comes from BALLDONTLIE first, then API-Sports NBA if needed; matchup pillar cards remain scaffolded until richer team split data is connected.",
    ],
  });

  return NextResponse.json({
    data: shapeNbaTeamMatchupProfile(resolved.data, mode),
    meta: resolved.meta,
    contract,
    error: null,
  });
}
