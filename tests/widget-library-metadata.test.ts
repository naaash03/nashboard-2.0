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

  it("exposes only one canonical starting pitcher matchup widget", () => {
    const widgets = WIDGET_DEFINITIONS.filter((entry) => entry.key.includes("starting_pitcher_matchup"));
    expect(widgets).toHaveLength(1);
    expect(widgets[0]?.key).toBe("mlb_starting_pitcher_matchup");
  });

  it("registers the scaffolded NBA teaching widgets", () => {
    const keys = new Set(WIDGET_DEFINITIONS.map((entry) => entry.key));
    expect(keys.has("nba_team_matchup_profile")).toBe(true);
    expect(keys.has("nba_rest_schedule_spot")).toBe(true);
    expect(keys.has("nba_player_role_form")).toBe(true);
  });

  it("registers the new NFL baseline widgets cleanly", () => {
    const nflWidgets = WIDGET_DEFINITIONS.filter((entry) => entry.sportCategory === "NFL");
    const keys = new Set(nflWidgets.map((entry) => entry.key));
    expect(keys.has("nfl_division_snapshot")).toBe(true);
    expect(keys.has("nfl_team_context_card")).toBe(true);
    expect(keys.has("nfl_recent_form")).toBe(true);
  });
});
