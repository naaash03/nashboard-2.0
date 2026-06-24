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

// The NBA regular season runs ~late Oct through mid-April, with playoffs into
// June. July–September is the off-season, when ESPN still serves the final
// standings — so we label them as final rather than live.
function offseasonNote(now = new Date()): string | undefined {
  const month = now.getUTCMonth(); // 0 = Jan
  const isOffseason = month >= 6 && month <= 8; // Jul–Sep
  return isOffseason
    ? "NBA is out of season. Showing the final standings from the most recent season."
    : undefined;
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
    const note = offseasonNote();
    const meta = note ? { ...standings.meta, warning: standings.meta.warning ?? note } : standings.meta;
    const contract = toWidgetPayload({
      data: canonicalRows,
      meta,
      primaryProvider: "espn",
    });

    return NextResponse.json({
      data: shapeNbaStandings(standings.data, mode),
      meta,
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
