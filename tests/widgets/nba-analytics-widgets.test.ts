import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("NBA recent form route", () => {
  it("returns a hot/warm/cool/cold rating from completed games", async () => {
    const mod = await import("@/app/api/widgets/nba-recent-form/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-recent-form?teamKey=NYK&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.sourceUsed).toBe("fixture");
    expect(body.data.teamKey).toBe("NYK");
    expect(body.data.games.length).toBeGreaterThan(0);
    expect(["Hot", "Warm", "Cool", "Cold"]).toContain(body.data.rating);
    expect(body.data.record.wins + body.data.record.losses).toBe(body.data.games.length);
  });
});

describe("NBA next 7 games route", () => {
  it("falls back to recent results when out of season (no upcoming games)", async () => {
    const mod = await import("@/app/api/widgets/nba-next-7-games/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-next-7-games?teamKey=NYK&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.inSeason).toBe(false);
    expect(body.data.games.length).toBe(0);
    expect(body.data.recent.length).toBeGreaterThan(0);
  });
});

describe("NBA offensive/defensive breakdown route", () => {
  it("returns scoring offense, defense, and net rating", async () => {
    const mod = await import("@/app/api/widgets/nba-offensive-defensive-breakdown/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-offensive-defensive-breakdown?teamKey=NYK&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.data.pointsFor).toBe("number");
    expect(typeof body.data.pointsAgainst).toBe("number");
    expect(body.data.netRating).toBeCloseTo(body.data.pointsFor - body.data.pointsAgainst, 1);
  });
});

describe("NBA playoff picture route", () => {
  it("returns seeded east/west conferences", async () => {
    const mod = await import("@/app/api/widgets/nba-playoff-picture/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-playoff-picture?dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data.east)).toBe(true);
    expect(Array.isArray(body.data.west)).toBe(true);
    expect(body.data.east[0]).toEqual(expect.objectContaining({
      rank: 1,
      seedLabel: expect.any(String),
    }));
  });
});
