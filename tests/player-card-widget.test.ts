import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPlayerSearchUrl, normalizePlayerName, selectExactPlayerResult } from "@/components/widgets/PlayerCardWidget";

describe("PlayerCardWidget search wiring", () => {
  it("builds local API search URL with encoded q parameter", () => {
    const url = buildPlayerSearchUrl("daniel jones", "live", 8);
    expect(url.startsWith("/api/players/search?")).toBe(true);
    expect(url).toContain("sport=nfl");
    expect(url).toContain("q=daniel+jones");
    expect(url).toContain("limit=8");
    expect(url).toContain("dataMode=live");
  });

  it("normalizes player names for exact-match Enter selection", () => {
    expect(normalizePlayerName("  LeBron   James  ")).toBe("lebron james");
    expect(normalizePlayerName("Clay-Holmes")).toBe("clay holmes");
  });

  it("does not auto-select top suggestion when Enter is not an exact match", () => {
    const selected = selectExactPlayerResult("Clay Holmes", [
      { playerId: "40286", fullName: "Juan Soto", teamName: "New York Mets", position: "RF" },
      { playerId: "1966", fullName: "LeBron James", teamName: "Los Angeles Lakers", position: "F" },
    ]);
    expect(selected).toBeNull();
  });

  it("selects exact normalized match on Enter", () => {
    const selected = selectExactPlayerResult(" lebron   james ", [
      { playerId: "40286", fullName: "Juan Soto", teamName: "New York Mets", position: "RF" },
      { playerId: "1966", fullName: "LeBron James", teamName: "Los Angeles Lakers", position: "F" },
    ]);
    expect(selected?.playerId).toBe("1966");
    expect(selected?.fullName).toBe("LeBron James");
  });

  it("contains no direct ESPN client URL calls", () => {
    const source = readFileSync("components/widgets/PlayerCardWidget.tsx", "utf8");
    expect(source.includes("site.web.api.espn.com")).toBe(false);
    expect(source.includes("core.api.espn.com")).toBe(false);
    expect(source.includes("site.api.espn.com")).toBe(false);
  });
});
