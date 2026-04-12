import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dashboard widget wiring aliases", () => {
  it("wires both underscore and hyphen MLB registry keys to concrete components", () => {
    const source = readFileSync("components/dashboard/DashboardPage.tsx", "utf8");

    expect(source.includes("\"mlb-starting-pitcher-matchup\": (props) => <MlbStartingPitcherMatchupWidget {...props} />")).toBe(true);
    expect(source.includes("\"mlb-series-tracker\": (props) => <MlbSeriesTrackerWidget {...props} />")).toBe(true);
    expect(source.includes("mlb_starting_pitcher_matchup: (props) => <MlbStartingPitcherMatchupWidget {...props} />")).toBe(true);
    expect(source.includes("mlb_series_tracker: (props) => <MlbSeriesTrackerWidget {...props} />")).toBe(true);
  });
});
