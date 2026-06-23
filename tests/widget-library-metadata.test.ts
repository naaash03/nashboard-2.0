import { describe, expect, it } from "vitest";
import { WIDGET_DEFINITIONS } from "@/lib/widgets/registry";

describe("widget metadata trust labels", () => {
  it("marks data health as admin-oriented with advanced audience", () => {
    const widget = WIDGET_DEFINITIONS.find((entry) => entry.key === "data_health");
    expect(widget?.stability).toBe("admin");
    expect(widget?.audience).toBe("advanced");
  });

  it("uses trustworthy watchlist metadata copy", () => {
    const widget = WIDGET_DEFINITIONS.find((entry) => entry.key === "watchlist");
    expect(widget?.description.includes("NFL only")).toBe(false);
    expect(widget?.description.includes("prioritized")).toBe(true);
    expect(widget?.stability).toBe("stable");
  });

  it("registers mlb_series_tracker under MLB category", () => {
    const widget = WIDGET_DEFINITIONS.find((entry) => entry.key === "mlb_series_tracker");
    expect(widget?.sportCategory).toBe("MLB");
    expect(widget?.audience).toBe("mixed");
  });

  it("registers the four NBA analytics widgets", () => {
    const keys = WIDGET_DEFINITIONS.map((entry) => entry.key);
    expect(keys).toEqual(expect.arrayContaining([
      "nba_next_7_games",
      "nba_recent_form",
      "nba_offensive_defensive_breakdown",
      "nba_playoff_picture",
    ]));
  });
});
