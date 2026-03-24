import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSeriesAnalyticsGroupingMode } from "@/components/widgets/MlbSeriesTrackerWidget";

describe("MLB series tracker widget spring honesty", () => {
  it("only enables full series analytics for official or inferred series", () => {
    expect(isSeriesAnalyticsGroupingMode("official_series")).toBe(true);
    expect(isSeriesAnalyticsGroupingMode("inferred_series")).toBe(true);
    expect(isSeriesAnalyticsGroupingMode("spring_matchup")).toBe(false);
    expect(isSeriesAnalyticsGroupingMode("single_game_event")).toBe(false);
  });

  it("renders spring matchup wording branch for beginner mode", () => {
    const source = readFileSync("components/widgets/MlbSeriesTrackerWidget.tsx", "utf8");
    expect(source.includes("springMatchupMode && leadGame")).toBe(true);
    expect(source.includes("Spring training matchup")).toBe(true);
  });
});
