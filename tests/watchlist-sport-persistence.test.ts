import { describe, expect, it } from "vitest";
import { addTeamToSportWatchlist } from "@/components/widgets/WatchlistWidget";

describe("watchlist per-sport team persistence", () => {
  it("keeps team lists isolated per sport", () => {
    const start = {
      nfl: ["NYJ"],
      mlb: ["NYM"],
      nba: ["LAL"],
    };

    const next = addTeamToSportWatchlist(start, "mlb", "LAD");

    expect(next.mlb).toEqual(["NYM", "LAD"]);
    expect(next.nfl).toEqual(["NYJ"]);
    expect(next.nba).toEqual(["LAL"]);
    expect(next.nfl.includes("LAD")).toBe(false);
  });
});
