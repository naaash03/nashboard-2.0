import { describe, expect, it } from "vitest";
import { addTeamToSportWatchlist, upsertTeamProviderIds } from "@/components/widgets/WatchlistWidget";

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

  it("stores provider-specific team IDs by sport", () => {
    const start = {
      nfl: {},
      mlb: {},
      nba: {},
    };

    const withMlb = upsertTeamProviderIds(start, "mlb", "NYM", { apiSportsTeamId: "5", espnTeamId: "21" });
    const withNba = upsertTeamProviderIds(withMlb, "nba", "NY", { apiSportsTeamId: "40", espnTeamId: "18" });

    expect(withMlb.mlb.NYM).toEqual({ apiSportsTeamId: "5", espnTeamId: "21" });
    expect(withNba.nba.NY).toEqual({ apiSportsTeamId: "40", espnTeamId: "18" });
    expect(withNba.nfl).toEqual({});
  });
});

