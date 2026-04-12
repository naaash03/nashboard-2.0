import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dashboard widget wiring aliases", () => {
  it("keeps legacy MLB widget aliases while rendering and storing canonical keys", () => {
    const dashboardSource = readFileSync("components/dashboard/DashboardPage.tsx", "utf8");
    const aliasSource = readFileSync("lib/widgets/widgetType.ts", "utf8");

    expect(aliasSource.includes("\"mlb-starting-pitcher-matchup\": \"mlb_starting_pitcher_matchup\"")).toBe(true);
    expect(aliasSource.includes("\"mlb-series-tracker\": \"mlb_series_tracker\"")).toBe(true);
    expect(dashboardSource.includes("widgetType: canonicalWidgetType")).toBe(true);
    expect(dashboardSource.includes("const resolvedWidgetType = canonicalizeWidgetType(widget.widgetType);")).toBe(true);
    expect(dashboardSource.includes("const Component = WIDGET_COMPONENTS[resolvedWidgetType];")).toBe(true);
    expect(dashboardSource.includes("mlb_starting_pitcher_matchup: (props) => <MlbStartingPitcherMatchupWidget {...props} />")).toBe(true);
    expect(dashboardSource.includes("mlb_series_tracker: (props) => <MlbSeriesTrackerWidget {...props} />")).toBe(true);
  });
});
