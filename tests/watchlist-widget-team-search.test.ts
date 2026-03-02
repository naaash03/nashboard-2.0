import { describe, expect, it } from "vitest";
import { normalizeTeamSearchText, selectExactTeamResult } from "@/components/widgets/WatchlistWidget";
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
});
