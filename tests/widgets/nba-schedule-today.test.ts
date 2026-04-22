import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
  delete process.env.THE_ODDS_KEY;
});

describe("NBA schedule today route", () => {
  it("returns fixture envelope with NBA games", async () => {
    const mod = await import("@/app/api/widgets/nba-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      sport: "NBA",
      dateUsed: expect.any(String),
      games: expect.any(Array),
      userFacingMessage: expect.any(String),
    }));
    expect(body.data.games.length).toBeGreaterThan(0);
  });

  it("game shape is correct — no weather field", async () => {
    const mod = await import("@/app/api/widgets/nba-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-schedule-today?mode=beginner&dataMode=fixture"));
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
    const mod = await import("@/app/api/widgets/nba-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(typeof game.oddsSummary).toBe("string");
    expect(game.odds).toBeUndefined();
  });

  it("odds isFallback when THE_ODDS_KEY absent (advanced mode)", async () => {
    const mod = await import("@/app/api/widgets/nba-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-schedule-today?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(game.odds.isFallback).toBe(true);
    expect(typeof game.odds.fallbackReason).toBe("string");
  });

  it("contract source mode is fixture in fixture mode", async () => {
    const mod = await import("@/app/api/widgets/nba-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.contract?.source?.mode).toBe("fixture");
    expect(body.contract?.ok).toBe(true);
  });

  it("meta sourceUsed is honest", async () => {
    const mod = await import("@/app/api/widgets/nba-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.meta.sourceUsed).toBe("fixture");
    expect(body.meta.requestId).toBeDefined();
  });
});
