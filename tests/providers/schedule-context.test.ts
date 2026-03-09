import { describe, expect, it } from "vitest";
import { resolveLeagueSeasonContext, resolveScheduleQueryContext } from "@/lib/providers/scheduleContext";

describe("schedule season context", () => {
  it("overrides mismatched configured season for MLB window date", () => {
    const resolved = resolveLeagueSeasonContext({
      sport: "mlb",
      configuredSeason: "2024",
      dateIso: "2026-03-03",
    });

    expect(resolved.season).toBe("2026");
    expect(resolved.hadConfiguredMismatch).toBe(true);
    expect(resolved.usedConfiguredSeason).toBe(false);
  });

  it("uses prior season year for NBA dates before October", () => {
    const resolved = resolveLeagueSeasonContext({
      sport: "nba",
      configuredSeason: "2026",
      dateIso: "2026-03-03",
    });

    expect(resolved.season).toBe("2025");
    expect(resolved.hadConfiguredMismatch).toBe(true);
  });

  it("builds schedule query context with coherent season and window notes", () => {
    const context = resolveScheduleQueryContext({
      sport: "mlb",
      configuredSeason: "2024",
      now: new Date("2026-03-03T16:00:00.000Z"),
    });

    expect(context.window.startDate).toBe("2026-02-28");
    expect(context.window.endDate).toBe("2026-03-10");
    expect(context.season).toBe("2026");
    expect(context.notes.join(" ")).toContain("season 2026");
  });
});
