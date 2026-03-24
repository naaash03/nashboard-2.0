import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("MLB next 7 games route", () => {
  it("returns fixture envelope with upcoming games", async () => {
    const mod = await import("@/app/api/widgets/mlb-next-7-games/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-next-7-games?teamKey=NYM&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("fixture");
    expect(body.meta?.dataMode).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data?.teamKey).toBe("NYM");
    expect(Array.isArray(body.data?.games)).toBe(true);
    expect(body.data.games.length).toBeGreaterThan(0);
    expect(body.data.games[0]).toEqual(expect.objectContaining({
      date: expect.any(String),
      opponent: expect.any(String),
      homeAway: expect.any(String),
      probablePitcherName: expect.any(String),
    }));
  });
});
