import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("NBA standings route", () => {
  it("returns fixture envelope with conference snapshots", async () => {
    const mod = await import("@/app/api/widgets/nba-standings/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-standings?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("fixture");
    expect(body.meta?.dataMode).toBe("fixture");
    expect(body.error).toBeNull();
    expect(Array.isArray(body.data?.east)).toBe(true);
    expect(Array.isArray(body.data?.west)).toBe(true);
    expect(body.data.east.length).toBeGreaterThan(0);
    expect(body.data.west.length).toBeGreaterThan(0);
    expect(body.data.east[0]).toEqual(expect.objectContaining({
      rank: expect.any(Number),
      team: expect.any(String),
      wins: expect.any(Number),
      losses: expect.any(Number),
      pct: expect.any(String),
    }));
  });
});
