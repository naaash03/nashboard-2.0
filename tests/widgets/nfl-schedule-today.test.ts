import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
  delete process.env.THE_ODDS_KEY;
  delete process.env.NASHBOARD_FIXTURE_SCENARIO;
});

describe("NFL schedule today route", () => {
  it("returns fixture envelope with NFL games", async () => {
    const mod = await import("@/app/api/widgets/nfl-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      sport: "NFL",
      dateUsed: expect.any(String),
      games: expect.any(Array),
      userFacingMessage: expect.any(String),
    }));
    expect(body.data.games.length).toBeGreaterThan(0);
  });

  it("game shape is correct — no weather field", async () => {
    const mod = await import("@/app/api/widgets/nfl-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(game.weather).toBeUndefined();
    expect(game.probables).toBeUndefined();
    expect(game).toEqual(expect.objectContaining({
      id: expect.any(String),
      date: expect.any(String),
      status: expect.any(String),
      awayTeam: expect.objectContaining({ key: expect.any(String), name: expect.any(String) }),
      homeTeam: expect.objectContaining({ key: expect.any(String), name: expect.any(String) }),
    }));
  });

  it("beginner mode: oddsSummary present, no raw odds object", async () => {
    const mod = await import("@/app/api/widgets/nfl-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(typeof game.oddsSummary).toBe("string");
    expect(game.odds).toBeUndefined();
  });

  it("odds isFallback when THE_ODDS_KEY absent (advanced mode)", async () => {
    const mod = await import("@/app/api/widgets/nfl-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-schedule-today?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(game.odds.isFallback).toBe(true);
    expect(typeof game.odds.fallbackReason).toBe("string");
  });

  it("empty slate scenario: games empty, no error", async () => {
    process.env.NASHBOARD_FIXTURE_SCENARIO = "slate_empty_today";
    const mod = await import("@/app/api/widgets/nfl-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.games).toHaveLength(0);
    expect(body.data.userFacingMessage).toMatch(/No NFL games/);
    expect(body.error).toBeNull();
  });

  it("contract source mode is fixture in fixture mode", async () => {
    const mod = await import("@/app/api/widgets/nfl-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.contract?.source?.mode).toBe("fixture");
    expect(body.contract?.ok).toBe(true);
  });

  it("meta sourceUsed is honest", async () => {
    const mod = await import("@/app/api/widgets/nfl-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.meta.sourceUsed).toBe("fixture");
    expect(body.meta.requestId).toBeDefined();
  });
});
