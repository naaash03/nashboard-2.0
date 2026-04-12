import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("NBA team matchup profile route", () => {
  it("returns a demo-backed matchup profile scaffold", async () => {
    const mod = await import("@/app/api/widgets/nba-team-matchup-profile/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-team-matchup-profile?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("demo");
    expect(body.meta?.dataMode).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      matchup: expect.any(String),
      summary: expect.any(String),
      selectedScenarioId: expect.any(String),
      availableScenarios: expect.any(Array),
      sourceLabel: expect.any(String),
    }));
    expect(body.data.pillars.length).toBeGreaterThan(0);
    expect(body.data.pillars[0]).toEqual(expect.objectContaining({
      label: expect.any(String),
      takeaway: expect.any(String),
      whyItMatters: expect.any(String),
    }));
  });
});
