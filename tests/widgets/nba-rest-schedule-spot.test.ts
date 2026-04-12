import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("NBA rest / schedule spot route", () => {
  it("returns a demo-backed rest spot scaffold", async () => {
    const mod = await import("@/app/api/widgets/nba-rest-schedule-spot/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-rest-schedule-spot?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("demo");
    expect(body.meta?.dataMode).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      spotLabel: expect.any(String),
      signal: expect.any(String),
      summary: expect.any(String),
      selectedScenarioId: expect.any(String),
      availableScenarios: expect.any(Array),
    }));
    expect(body.data.factors.length).toBeGreaterThan(0);
    expect(body.data.recentWindow.length).toBeGreaterThan(0);
    expect(body.data.nextWindow.length).toBeGreaterThan(0);
  });
});
