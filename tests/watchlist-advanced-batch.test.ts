import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { playerInsightsSummary, sanitizeRuntimeMessage, teamCardStatusLabel } from "@/components/widgets/WatchlistWidget";

describe("watchlist advanced players pipeline", () => {
  it("uses batch insights endpoint for advanced player rows", () => {
    const source = readFileSync("components/widgets/WatchlistWidget.tsx", "utf8");
    expect(source.includes("/api/players/insights/batch")).toBe(true);
  });

  it("builds non-empty summary when insights include season or recent data", () => {
    const summary = playerInsightsSummary({
      sport: "nba",
      playerId: "1966",
      season: {
        headline: "PPG 26.4 · RPG 8.1 · APG 7.2",
        metrics: [
          { key: "ppg", label: "PPG", value: "26.4" },
        ],
        source: "derived",
      },
      recent: null,
    });
    if (!summary) {
      throw new Error("Expected summary to be populated");
    }
    expect(summary).toContain("PPG");
  });

  it("uses clean team fallback status when no schedule context exists", () => {
    const label = teamCardStatusLabel(undefined, undefined);
    expect(label).toBe("No scheduled games available right now");
  });

  it("sanitizes noisy runtime diagnostics for user-facing errors", () => {
    const message = sanitizeRuntimeMessage("No schedule rows found for NYM in 2026-03-01..2026-03-10", "Team data unavailable.");
    expect(message).toBe("Team data unavailable.");
  });

  it("does not render provider meta note text in team/player details", () => {
    const source = readFileSync("components/widgets/WatchlistWidget.tsx", "utf8");
    expect(source.includes("Note: {advanced.metaNotes[0]}")).toBe(false);
    expect(source.includes("Note: {insight.metaNotes[0]}")).toBe(false);
  });

  it("uses admin/debug label instead of plain debug label", () => {
    const source = readFileSync("components/widgets/WatchlistWidget.tsx", "utf8");
    expect(source.includes("Admin / Debug")).toBe(true);
  });

  it("includes lightweight search caches for repeated queries", () => {
    const source = readFileSync("components/widgets/WatchlistWidget.tsx", "utf8");
    expect(source.includes("playerSearchCacheRef")).toBe(true);
    expect(source.includes("teamSearchCacheRef")).toBe(true);
  });
});
