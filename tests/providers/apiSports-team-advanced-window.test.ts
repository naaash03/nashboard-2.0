import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  process.env.NASHBOARD_DATA_MODE = "fixture";
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-03T16:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("api-sports team advanced schedule window", () => {
  it("selects yesterday final as lastGame and future pregame as nextGame in ET window", async () => {
    const { getTeamsAdvanced } = await import("@/lib/providers/apiSports/teamAdvanced");
    const result = await getTeamsAdvanced(
      "mlb",
      [{ teamKey: "NYM", teamName: "New York Mets", apiSportsTeamId: "5" }],
      "advanced",
      "fixture",
      "refresh-window-1",
    );

    expect(result.error).toBeUndefined();
    expect(result.meta.sourceUsed).toBe("fixture");
    expect(result.meta.notes?.[0]).toContain("America/New_York");
    expect(result.data?.teams).toHaveLength(1);

    const team = result.data?.teams[0];
    expect(team?.teamKey).toBe("NYM");
    expect(team?.apiSportsTeamId).toBe("5");
    expect(team?.lastGame?.when).toContain("2026-03-02");
    expect(team?.nextGame?.when).toContain("2026-03-04");
  });
});
