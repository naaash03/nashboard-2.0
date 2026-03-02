import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("teams search api route", () => {
  it("returns nfl teams in fixture mode", async () => {
    const mod = await import("@/app/api/teams/search/route");
    const res = await mod.GET(new Request("http://localhost/api/teams/search?sport=nfl&q=jets&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.sourceUsed).toBe("fixture");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toEqual(expect.objectContaining({
      teamKey: expect.any(String),
      displayName: expect.any(String),
      league: "nfl",
    }));
  });

  it("returns mlb teams in fixture mode", async () => {
    const mod = await import("@/app/api/teams/search/route");
    const res = await mod.GET(new Request("http://localhost/api/teams/search?sport=mlb&q=mets&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.sourceUsed).toBe("fixture");
    expect(body.data[0]).toEqual(expect.objectContaining({
      teamKey: expect.any(String),
      displayName: expect.any(String),
      league: "mlb",
    }));
  });

  it("returns nba teams in fixture mode", async () => {
    const mod = await import("@/app/api/teams/search/route");
    const res = await mod.GET(new Request("http://localhost/api/teams/search?sport=nba&q=lakers&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.sourceUsed).toBe("fixture");
    expect(body.data[0]).toEqual(expect.objectContaining({
      teamKey: expect.any(String),
      displayName: expect.any(String),
      league: "nba",
    }));
  });

  it("returns 400 when query is missing", async () => {
    const mod = await import("@/app/api/teams/search/route");
    const res = await mod.GET(new Request("http://localhost/api/teams/search?sport=nba&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe("MISSING_QUERY");
  });
});
