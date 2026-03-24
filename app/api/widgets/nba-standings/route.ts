import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getStandingsSnapshot } from "@/lib/providers/espn/nba";
import { normalizeStandingsRowFromEspn } from "@/lib/sports/adapters";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { shapeNbaStandings } from "@/lib/templates/nbaStandings";
import type { Meta } from "@/lib/providers/types";

function fallbackMeta(mode: "auto" | "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : "espn",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: mode,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  try {
    const standings = await getStandingsSnapshot(mode, resolvedDataMode, cacheBust);
    const canonicalRows = [
      ...standings.data.east.map((row, index) => {
        const normalized = normalizeStandingsRowFromEspn({
          team: { abbreviation: row.key, displayName: row.team },
          stats: [
            { name: "wins", value: row.wins },
            { name: "losses", value: row.losses },
            { name: "winPercent", value: row.pct },
            { name: "rank", value: index + 1 },
          ],
        }, "NBA");
        normalized.conference = "EAST";
        return normalized;
      }),
      ...standings.data.west.map((row, index) => {
        const normalized = normalizeStandingsRowFromEspn({
          team: { abbreviation: row.key, displayName: row.team },
          stats: [
            { name: "wins", value: row.wins },
            { name: "losses", value: row.losses },
            { name: "winPercent", value: row.pct },
            { name: "rank", value: index + 1 },
          ],
        }, "NBA");
        normalized.conference = "WEST";
        return normalized;
      }),
    ];
    const contract = toWidgetPayload({
      data: canonicalRows,
      meta: standings.meta,
      primaryProvider: "espn",
    });

    return NextResponse.json({
      data: shapeNbaStandings(standings.data, mode),
      meta: standings.meta,
      contract,
      error: null,
    });
  } catch (error) {
    const message = `Failed to load NBA standings: ${String(error)}`;
    const meta = fallbackMeta(resolvedDataMode, message);
    const contract = toWidgetPayload({
      data: [],
      error: message,
      meta,
      primaryProvider: "espn",
    });

    return NextResponse.json({
      data: { east: [], west: [] },
      meta,
      contract,
      error: message,
    }, { status: 502 });
  }
}
