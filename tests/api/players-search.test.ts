import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("players search api route", () => {
  it("returns fixture envelope for NFL search", async () => {
    const mod = await import("@/app/api/players/search/route");
    const res = await mod.GET(new Request("http://localhost/api/players/search?sport=nfl&q=daniel%20jones&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.sourceUsed).toBe("fixture");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toEqual(expect.objectContaining({
      playerId: expect.any(String),
      fullName: expect.any(String),
    }));
  });

  it("returns fixture envelope for MLB and NBA search", async () => {
    const mod = await import("@/app/api/players/search/route");

    const mlbRes = await mod.GET(new Request("http://localhost/api/players/search?sport=mlb&q=juan%20soto&dataMode=fixture"));
    const mlbBody = await mlbRes.json();
    expect(mlbRes.status).toBe(200);
    expect(mlbBody.meta.sourceUsed).toBe("fixture");
    expect(mlbBody.data[0].fullName).toContain("Juan");

    const nbaRes = await mod.GET(new Request("http://localhost/api/players/search?sport=nba&q=lebron%20james&dataMode=fixture"));
    const nbaBody = await nbaRes.json();
    expect(nbaRes.status).toBe(200);
    expect(nbaBody.meta.sourceUsed).toBe("fixture");
    expect(nbaBody.data[0].fullName).toContain("LeBron");
  });

  it("returns 400 envelope when q is missing", async () => {
    const mod = await import("@/app/api/players/search/route");
    const res = await mod.GET(new Request("http://localhost/api/players/search?sport=nfl&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.data).toBeNull();
    expect(body.error?.code).toBe("MISSING_QUERY");
    expect(body.meta.sourceUsed).toBe("fixture");
  });
});
