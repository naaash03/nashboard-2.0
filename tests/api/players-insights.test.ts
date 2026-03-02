import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("players insights api route", () => {
  it("returns fixture envelope with live/season/recent data", async () => {
    const mod = await import("@/app/api/players/insights/route");
    const res = await mod.GET(new Request("http://localhost/api/players/insights?sport=nba&playerId=1966&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.sourceUsed).toBe("fixture");
    expect(body.data).toEqual(expect.objectContaining({
      playerId: expect.any(String),
      sport: "nba",
    }));
    expect(body.data.live).toEqual(expect.objectContaining({
      hasGameToday: expect.any(Boolean),
      teamKey: expect.any(String),
    }));
    expect(Array.isArray(body.data.recent?.games)).toBe(true);
    expect(body.data.recent.games.length).toBeLessThanOrEqual(5);
    if (body.data.season) {
      expect(["upstream", "derived"]).toContain(body.data.season.source);
    }
  });

  it("returns 400 envelope when playerId is missing", async () => {
    const mod = await import("@/app/api/players/insights/route");
    const res = await mod.GET(new Request("http://localhost/api/players/insights?sport=nfl&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.data).toBeNull();
    expect(body.error?.code).toBe("MISSING_PLAYER_ID");
    expect(body.meta.sourceUsed).toBe("fixture");
  });
});
