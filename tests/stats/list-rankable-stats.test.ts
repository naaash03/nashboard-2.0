import { describe, expect, it } from "vitest";
import { getRankabilityRule, listRankableStats } from "@/lib/stats/rankability";

describe("listRankableStats", () => {
  it("returns every MLB rankable stat with a parsed key and entity type", () => {
    const stats = listRankableStats("MLB");
    expect(stats.length).toBeGreaterThan(0);

    const keys = stats.map((s) => s.statKey);
    expect(keys).toEqual(expect.arrayContaining(["era", "avg", "ops", "run_differential", "w_l_record"]));

    // No "key:sport" composite leaks through.
    expect(keys.every((k) => !k.includes(":"))).toBe(true);

    // Entity types and scope labels round-trip from the registry.
    const era = stats.find((s) => s.statKey === "era");
    expect(era?.entityType).toBe("player");
    expect(era?.scopeLabel).toBe(getRankabilityRule("era", "MLB")?.scopeLabel);

    const runDiff = stats.find((s) => s.statKey === "run_differential");
    expect(runDiff?.entityType).toBe("team");
  });

  it("is case-insensitive and empty for unsupported sports", () => {
    expect(listRankableStats("mlb").length).toBe(listRankableStats("MLB").length);
    expect(listRankableStats("NHL")).toEqual([]);
  });
});
