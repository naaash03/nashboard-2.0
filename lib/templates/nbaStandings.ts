import type { NbaStandingsSnapshot } from "@/lib/providers/espn/nba";
import type { Mode } from "@/lib/providers/types";

export type NbaStandingsUiRow = {
  rank: number;
  team: string;
  wins: number;
  losses: number;
  pct: string;
  key?: string;
};

export type NbaStandingsUi = {
  east: NbaStandingsUiRow[];
  west: NbaStandingsUiRow[];
};

function toPct(value: number): string {
  return value.toFixed(3).replace(/^0/, "");
}

function shapeRows(rows: NbaStandingsSnapshot["east"], mode: Mode): NbaStandingsUiRow[] {
  return rows.map((row, index) => ({
    rank: index + 1,
    team: row.team,
    wins: row.wins,
    losses: row.losses,
    pct: toPct(row.pct),
    key: mode === "advanced" ? row.key : undefined,
  }));
}

export function shapeNbaStandings(snapshot: NbaStandingsSnapshot, mode: Mode): NbaStandingsUi {
  return {
    east: shapeRows(snapshot.east, mode),
    west: shapeRows(snapshot.west, mode),
  };
}
