import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPlayerSearchUrl, selectTopPlayerResult } from "@/components/widgets/PlayerCardWidget";

describe("PlayerCardWidget search wiring", () => {
  it("builds local API search URL with encoded q parameter", () => {
    const url = buildPlayerSearchUrl("daniel jones", "live", 8);
    expect(url.startsWith("/api/search/players?")).toBe(true);
    expect(url).toContain("sport=NFL");
    expect(url).toContain("q=daniel+jones");
    expect(url).toContain("limit=8");
    expect(url).toContain("dataMode=live");
  });

  it("selects top result for Enter behavior", () => {
    const selected = selectTopPlayerResult([
      { playerId: "17", fullName: "Daniel Jones", teamName: "New York Giants", position: "QB" },
      { playerId: "18", fullName: "Mac Jones", teamName: "Jacksonville Jaguars", position: "QB" },
    ]);
    expect(selected?.playerId).toBe("17");
    expect(selected?.fullName).toBe("Daniel Jones");
  });

  it("contains no direct ESPN client URL calls", () => {
    const source = readFileSync("components/widgets/PlayerCardWidget.tsx", "utf8");
    expect(source.includes("site.web.api.espn.com")).toBe(false);
    expect(source.includes("core.api.espn.com")).toBe(false);
    expect(source.includes("site.api.espn.com")).toBe(false);
  });
});
