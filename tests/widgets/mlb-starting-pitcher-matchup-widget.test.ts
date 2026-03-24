import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildBeginnerStatLine,
  buildMatchupSummary,
  buildPitcherMetricTiles,
} from "@/components/widgets/MlbStartingPitcherMatchupWidget";
import type { PitcherMatchupCard } from "@/lib/sports/resolvers/mlbStartingPitcherMatchup";

describe("MLB Starting Pitcher Matchup widget stat tiles", () => {
  it("keeps beginner cards stable with base ERA/W-L tiles", () => {
    const pitcher: PitcherMatchupCard = { fullName: "Max Fried" };
    const tiles = buildPitcherMetricTiles(pitcher, "BEGINNER");
    expect(tiles.map((tile) => tile.label)).toEqual(["ERA", "W-L"]);
  });

  it("does not render excessive blank advanced stat boxes", () => {
    const pitcher: PitcherMatchupCard = { fullName: "Max Fried" };
    const tiles = buildPitcherMetricTiles(pitcher, "ADVANCED");
    expect(tiles).toEqual([]);
  });

  it("shows only available advanced stat tiles", () => {
    const pitcher: PitcherMatchupCard = {
      fullName: "Max Fried",
      era: 2.95,
      record: "11-6",
      whip: 1.08,
    };
    const tiles = buildPitcherMetricTiles(pitcher, "ADVANCED");
    expect(tiles.map((tile) => tile.label)).toEqual(["ERA", "W-L", "WHIP"]);
  });

  it("keeps beginner stat line compact and removes empty stat boxes", () => {
    const empty: PitcherMatchupCard = { fullName: "Pitcher A" };
    const rich: PitcherMatchupCard = { fullName: "Pitcher B", era: 3.11, record: "10-5" };

    expect(buildBeginnerStatLine(empty)).toEqual([]);
    expect(buildBeginnerStatLine(rich)).toEqual(["ERA 3.11", "W-L 10-5"]);
  });

  it("renders one-sided starter summary intentionally in partial states", () => {
    const summary = buildMatchupSummary({
      game: {
        gameId: "1",
        awayTeam: { key: "NYM", name: "New York Mets" },
        homeTeam: { key: "ATL", name: "Atlanta Braves" },
        gameTime: "2026-04-01T23:10:00.000Z",
        status: "partial",
      },
      pitchers: {
        away: { fullName: "David Peterson", era: 3.5 },
        home: null,
      },
      edge: null,
      state: "partial",
    });

    expect(summary).toBe("David Peterson announced. ATL starter TBD.");
  });

  it("keeps advanced sections gated out of beginner mode", () => {
    const source = readFileSync("components/widgets/MlbStartingPitcherMatchupWidget.tsx", "utf8");
    expect(source.includes("mode === \"ADVANCED\" && last3.length > 0")).toBe(true);
    expect(source.includes("mode === \"BEGINNER\" ? (")).toBe(true);
  });
});
