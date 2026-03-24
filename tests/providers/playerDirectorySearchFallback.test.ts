import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("player directory fallback search behavior", () => {
  it("uses ESPN common search endpoint for MLB", async () => {
    const mod = await import("@/lib/providers/espn/playerDirectory");
    const result = await mod.searchPlayers("mlb", "juan soto", "fixture", 8);

    expect(result.error).toBeUndefined();
    expect(result.meta.sourceUsed).toBe("fixture");
    expect(result.meta.endpointUrl).toContain("site.web.api.espn.com/apis/common/v3/search");
    expect(result.meta.endpointUrl).not.toContain("/sports/baseball/mlb/athletes");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data?.length ?? 0).toBeGreaterThan(0);
    expect(result.data?.length ?? 0).toBeLessThanOrEqual(8);
  });

  it("uses ESPN common search endpoint for NBA", async () => {
    const mod = await import("@/lib/providers/espn/playerDirectory");
    const result = await mod.searchPlayers("nba", "lebron james", "fixture", 8);

    expect(result.error).toBeUndefined();
    expect(result.meta.sourceUsed).toBe("fixture");
    expect(result.meta.endpointUrl).toContain("site.web.api.espn.com/apis/common/v3/search");
    expect(result.meta.endpointUrl).not.toContain("/sports/basketball/nba/athletes");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data?.length ?? 0).toBeGreaterThan(0);
    expect(result.data?.length ?? 0).toBeLessThanOrEqual(8);
  });
});
