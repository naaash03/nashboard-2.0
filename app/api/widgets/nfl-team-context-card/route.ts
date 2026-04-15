import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { resolveNflTeamContextCard } from "@/lib/sports/resolvers/nflWidgets";
import { shapeNflTeamContextCard } from "@/lib/templates/nflTeamContextCard";

function parseSeason(value: string | null): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!/^\d{4}$/.test(normalized)) return Number.NaN;

  const season = Number.parseInt(normalized, 10);
  const currentYear = new Date().getUTCFullYear();
  if (season < 2000 || season > currentYear) return Number.NaN;
  return season;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const teamKey = (searchParams.get("teamKey") ?? "").trim().toUpperCase() || undefined;
  const season = parseSeason(searchParams.get("season"));
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (Number.isNaN(season)) {
    return NextResponse.json(
      {
        data: null,
        meta: null,
        contract: null,
        error: `Invalid season. Use a 4-digit year between 2000 and ${new Date().getUTCFullYear()}.`,
      },
      { status: 400 },
    );
  }

  const resolved = await resolveNflTeamContextCard({
    teamKey,
    season: season ?? undefined,
    dataMode: resolvedDataMode,
    cacheBust,
  });
  const contract = toWidgetPayload({
    data: resolved.data,
    error: null,
    meta: resolved.meta,
    primaryProvider: "espn",
    notes: ["NFL team context uses ESPN first, then API-Sports NFL fallback when ESPN is unavailable, then demo when no live team key is selected or both live providers fail."],
  });

  return NextResponse.json({
    data: shapeNflTeamContextCard(resolved.data, mode),
    meta: resolved.meta,
    contract,
    error: null,
  });
}
