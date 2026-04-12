import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("NBA player role + form route", () => {
  it("returns a demo-backed player role scaffold", async () => {
    const mod = await import("@/app/api/widgets/nba-player-role-form/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-player-role-form?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("demo");
    expect(body.meta?.dataMode).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      summary: expect.any(String),
      selectedScenarioId: expect.any(String),
      availableScenarios: expect.any(Array),
      sourceLabel: expect.any(String),
    }));
    expect(body.data.player).toEqual(expect.objectContaining({
      fullName: expect.any(String),
      teamName: expect.any(String),
      role: expect.any(String),
    }));
    expect(body.data.metrics.length).toBeGreaterThan(0);
    expect(body.data.roleSignals.length).toBeGreaterThan(0);
    expect(body.data.recentGames.length).toBeGreaterThan(0);
  });
});
