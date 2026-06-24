import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

afterEach(() => {
  delete process.env.NASHBOARD_FIXTURE_SCENARIO;
});

describe("NBA tonight's slate route", () => {
  it("returns fixture envelope with slate games", async () => {
    const mod = await import("@/app/api/widgets/nba-tonights-slate/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-tonights-slate?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("fixture");
    expect(body.meta?.dataMode).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      state: "today",
      dateUsed: expect.any(String),
      games: expect.any(Array),
      userFacingMessage: expect.any(String),
    }));
    expect(body.data.games.length).toBeGreaterThan(0);
    expect(body.data.games[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      date: expect.any(String),
      status: expect.any(String),
    }));
  });

  it("flags off-season and shows the most recent slate when no games today", async () => {
    process.env.NASHBOARD_FIXTURE_SCENARIO = "offseason";
    const mod = await import("@/app/api/widgets/nba-tonights-slate/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-tonights-slate?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.state).toBe("offseason");
    expect(body.data.games.length).toBe(0);
    expect(body.data.historical).not.toBeNull();
    expect(body.data.historical.games.length).toBeGreaterThan(0);
    expect(body.data.userFacingMessage).toMatch(/out of season/i);
  });
});
