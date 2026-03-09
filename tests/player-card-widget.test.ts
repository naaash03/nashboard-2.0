import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPlayerSearchSubtitle, buildPlayerSearchUrl, normalizePlayerName, sanitizePlayerCardWarning, selectExactPlayerResult } from "@/components/widgets/PlayerCardWidget";

describe("PlayerCardWidget search wiring", () => {
  it("builds local API search URL with encoded q parameter", () => {
    const url = buildPlayerSearchUrl("daniel jones", "live", 8);
    expect(url.startsWith("/api/players/search?")).toBe(true);
    expect(url).toContain("sport=nfl");
    expect(url).toContain("q=daniel+jones");
    expect(url).toContain("limit=8");
    expect(url).toContain("dataMode=live");
  });

  it("appends cacheBust when provided", () => {
    const url = buildPlayerSearchUrl("daniel jones", "live", 8, "nfl", 12);
    expect(url).toContain("cacheBust=12");
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

  it("builds stable search subtitle with identity context", () => {
    const subtitle = buildPlayerSearchSubtitle({
      playerId: "1966",
      fullName: "LeBron James",
      teamName: "Los Angeles Lakers",
      position: "F",
    });
    expect(subtitle).toContain("Los Angeles Lakers");
    expect(subtitle).toContain("F");
    expect(subtitle).toContain("ID 1966");
  });

  it("contains no direct ESPN client URL calls", () => {
    const source = readFileSync("components/widgets/PlayerCardWidget.tsx", "utf8");
    expect(source.includes("site.web.api.espn.com")).toBe(false);
    expect(source.includes("core.api.espn.com")).toBe(false);
    expect(source.includes("site.api.espn.com")).toBe(false);
  });

  it("keeps advanced section shells visible for partial provider payloads", () => {
    const source = readFileSync("components/widgets/PlayerCardWidget.tsx", "utf8");
    expect(source.includes("Live Context")).toBe(true);
    expect(source.includes("Season Highlights")).toBe(true);
    expect(source.includes("Recent Games")).toBe(true);
    expect(source.includes("Status / Injury")).toBe(true);
    expect(source.includes("Advanced insights unavailable right now.")).toBe(true);
    expect(source.includes("No players found.")).toBe(true);
  });

  it("sanitizes provider diagnostics from user-facing warnings", () => {
    const warning = sanitizePlayerCardWarning("No schedule rows found for MLB", "Season insights unavailable.");
    expect(warning).toBe("Season insights unavailable.");
  });

  it("keeps provider warning details in debug section only", () => {
    const source = readFileSync("components/widgets/PlayerCardWidget.tsx", "utf8");
    expect(source.includes("Profile warning:")).toBe(true);
    expect(source.includes("Insights warning:")).toBe(true);
  });
});
