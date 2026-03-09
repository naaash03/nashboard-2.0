import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildPlayerSearchSubtitle,
  buildPlayerSearchUrl,
  isLowConfidencePlayerResult,
  normalizePlayerName,
  rankPlayerSearchResults,
  sanitizePlayerCardWarning,
  selectExactPlayerResult,
} from "@/components/widgets/PlayerCardWidget";

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
    expect(subtitle).not.toContain("ID 1966");
    expect(subtitle).toContain("Los Angeles Lakers");
    expect(subtitle).toContain("F");
  });

  it("includes id in subtitle only when explicitly requested", () => {
    const subtitle = buildPlayerSearchSubtitle({
      playerId: "1966",
      fullName: "LeBron James",
    }, { includeId: true });
    expect(subtitle).toContain("ID 1966");
  });

  it("ranks richer player identity matches above weaker rows", () => {
    const ranked = rankPlayerSearchResults("lebron", [
      { playerId: "1", fullName: "LeBron James" },
      { playerId: "2", fullName: "LeBron James", teamName: "Los Angeles Lakers", position: "F" },
    ]);
    expect(ranked[0]?.playerId).toBe("2");
    expect(isLowConfidencePlayerResult(ranked[0])).toBe(false);
    expect(isLowConfidencePlayerResult(ranked[1])).toBe(true);
  });

  it("deduplicates repeated player search rows", () => {
    const ranked = rankPlayerSearchResults("lebron", [
      { playerId: "2", fullName: "LeBron James", teamName: "Los Angeles Lakers" },
      { playerId: "2", fullName: "LeBron James", teamName: "Los Angeles Lakers" },
    ]);
    expect(ranked).toHaveLength(1);
  });

  it("returns null subtitle for weak rows in beginner contexts", () => {
    const subtitle = buildPlayerSearchSubtitle({
      playerId: "999",
      fullName: "Unknown Player",
    });
    expect(subtitle).toBeNull();
  });

  it("contains no direct ESPN client URL calls", () => {
    const source = readFileSync("components/widgets/PlayerCardWidget.tsx", "utf8");
    expect(source.includes("site.web.api.espn.com")).toBe(false);
    expect(source.includes("core.api.espn.com")).toBe(false);
    expect(source.includes("site.api.espn.com")).toBe(false);
  });

  it("keeps advanced sections user-facing and compact when partial data is missing", () => {
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

  it("keeps provider warning details in admin/debug section", () => {
    const source = readFileSync("components/widgets/PlayerCardWidget.tsx", "utf8");
    expect(source.includes("Admin / Debug")).toBe(true);
    expect(source.includes("Profile warning:")).toBe(true);
    expect(source.includes("Insights warning:")).toBe(true);
  });

  it("does not fetch beginner-mode insights from advanced endpoint mode", () => {
    const source = readFileSync("components/widgets/PlayerCardWidget.tsx", "utf8");
    expect(source.includes("if (props.mode !== \"ADVANCED\" || !selectedPlayerId)")).toBe(true);
  });

  it("keeps lightweight in-memory caches for repeated search/profile/insights requests", () => {
    const source = readFileSync("components/widgets/PlayerCardWidget.tsx", "utf8");
    expect(source.includes("searchCacheRef")).toBe(true);
    expect(source.includes("profileCacheRef")).toBe(true);
    expect(source.includes("insightsCacheRef")).toBe(true);
  });
});
