import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("players profile api route", () => {
  it("returns fixture envelope with basic profile fields", async () => {
    const mod = await import("@/app/api/players/profile/route");
    const res = await mod.GET(new Request("http://localhost/api/players/profile?sport=nfl&playerId=3917792&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.sourceUsed).toBe("fixture");
    expect(body.data).toEqual(expect.objectContaining({
      playerId: expect.any(String),
      fullName: expect.any(String),
    }));
  });

  it("supports MLB and NBA fixture profiles", async () => {
    const mod = await import("@/app/api/players/profile/route");

    const mlbRes = await mod.GET(new Request("http://localhost/api/players/profile?sport=mlb&playerId=40286&dataMode=fixture"));
    const mlbBody = await mlbRes.json();
    expect(mlbRes.status).toBe(200);
    expect(mlbBody.meta.sourceUsed).toBe("fixture");
    expect(mlbBody.data.fullName).toContain("Juan");

    const nbaRes = await mod.GET(new Request("http://localhost/api/players/profile?sport=nba&playerId=1966&dataMode=fixture"));
    const nbaBody = await nbaRes.json();
    expect(nbaRes.status).toBe(200);
    expect(nbaBody.meta.sourceUsed).toBe("fixture");
    expect(nbaBody.data.fullName).toContain("LeBron");
  });

  it("returns 400 envelope when playerId is missing", async () => {
    const mod = await import("@/app/api/players/profile/route");
    const res = await mod.GET(new Request("http://localhost/api/players/profile?sport=nfl&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.data).toBeNull();
    expect(body.error?.code).toBe("MISSING_PLAYER_ID");
    expect(body.meta.sourceUsed).toBe("fixture");
  });
});
