import { describe, expect, it } from "vitest";
import { normalizeTeamSearchText, playerSearchSubtitleLine, selectExactTeamResult, teamCardSecondaryLabel, teamCardStatusLabel } from "@/components/widgets/WatchlistWidget";
import type { TeamSearchResult } from "@/lib/types/players";

const SAMPLE_RESULTS: TeamSearchResult[] = [
  { teamKey: "NYM", displayName: "New York Mets", league: "mlb" },
  { teamKey: "NYY", displayName: "New York Yankees", league: "mlb" },
];

describe("watchlist team search selection", () => {
  it("normalizes team search input text", () => {
    expect(normalizeTeamSearchText("  New   York  Mets ")).toBe("new york mets");
    expect(normalizeTeamSearchText("LA-Lakers")).toBe("la lakers");
  });

  it("returns exact display name match when Enter is pressed", () => {
    const selected = selectExactTeamResult("new york mets", SAMPLE_RESULTS);
    expect(selected?.teamKey).toBe("NYM");
  });

  it("returns exact team key match when Enter is pressed", () => {
    const selected = selectExactTeamResult("nym", SAMPLE_RESULTS);
    expect(selected?.displayName).toBe("New York Mets");
  });

  it("does not auto-select non-exact matches", () => {
    const selected = selectExactTeamResult("new york", SAMPLE_RESULTS);
    expect(selected).toBeNull();
  });

  it("prioritizes last game in team card status when no game today", () => {
    const label = teamCardStatusLabel(undefined, {
      teamKey: "NYM",
      status: { sport: "mlb", teamKey: "NYM", hasGameToday: false },
      lastGame: { when: "2026-03-01", vs: "ATL", result: "W", score: "4-2" },
    });
    expect(label.startsWith("Last:")).toBe(true);
  });

  it("shows next-game secondary context when both last and next exist", () => {
    const secondary = teamCardSecondaryLabel(undefined, {
      teamKey: "NYM",
      status: { sport: "mlb", teamKey: "NYM", hasGameToday: false },
      lastGame: { when: "2026-03-01", vs: "ATL", result: "W", score: "4-2" },
      nextGame: { when: "2026-03-03", vs: "PHI", homeAway: "home" },
    });
    expect(secondary).toContain("Next:");
  });

  it("formats player search subtitle with context and id", () => {
    const subtitle = playerSearchSubtitleLine(
      {
        playerId: "40286",
        fullName: "Juan Soto",
        teamName: "New York Mets",
        position: "RF",
      },
      "mlb",
    );
    expect(subtitle).toContain("RF");
    expect(subtitle).toContain("New York Mets");
    expect(subtitle).toContain("ID 40286");
  });
});
