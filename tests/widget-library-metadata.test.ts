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

  it("registers mlb-series-tracker under MLB category", () => {
    const widget = WIDGET_DEFINITIONS.find((entry) => entry.key === "mlb-series-tracker");
    expect(widget?.sportCategory).toBe("MLB");
    expect(widget?.audience).toBe("mixed");
  });
});
