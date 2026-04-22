import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
  delete process.env.THE_ODDS_KEY;
  delete process.env.OPEN_WEATHER_KEY;
});

describe("MLB schedule today route", () => {
  it("returns fixture envelope with MLB games", async () => {
    const mod = await import("@/app/api/widgets/mlb-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      sport: "MLB",
      dateUsed: expect.any(String),
      games: expect.any(Array),
      userFacingMessage: expect.any(String),
    }));
    expect(body.data.games.length).toBeGreaterThan(0);
  });

  it("game shape includes required fields", async () => {
    const mod = await import("@/app/api/widgets/mlb-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(game).toEqual(expect.objectContaining({
      id: expect.any(String),
      date: expect.any(String),
      status: expect.any(String),
      awayTeam: expect.objectContaining({ key: expect.any(String), name: expect.any(String) }),
      homeTeam: expect.objectContaining({ key: expect.any(String), name: expect.any(String) }),
    }));
  });

  it("beginner mode: oddsSummary present, no raw odds object", async () => {
    const mod = await import("@/app/api/widgets/mlb-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(typeof game.oddsSummary).toBe("string");
    expect(game.odds).toBeUndefined();
  });

  it("beginner mode: oddsSummary is 'Odds unavailable' when THE_ODDS_KEY absent", async () => {
    const mod = await import("@/app/api/widgets/mlb-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.data.games[0].oddsSummary).toBe("Odds unavailable");
  });

  it("advanced mode: raw odds present with isFallback when key absent", async () => {
    const mod = await import("@/app/api/widgets/mlb-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-schedule-today?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(game.odds).toBeDefined();
    expect(game.odds.isFallback).toBe(true);
    expect(typeof game.odds.fallbackReason).toBe("string");
    expect(game.oddsSummary).toBeUndefined();
  });

  it("indoor game (Minute Maid Park): weather isOutdoor false, isFallback false", async () => {
    const mod = await import("@/app/api/widgets/mlb-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-schedule-today?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    // Second game in fixture is Minute Maid Park (indoor)
    const indoorGame = body.data.games.find((g: { homeTeam: { key: string } }) => g.homeTeam.key === "HOU");
    expect(indoorGame).toBeDefined();
    expect(indoorGame.weather).toBeDefined();
    expect(indoorGame.weather.isOutdoor).toBe(false);
    expect(indoorGame.weather.isFallback).toBe(false);
    expect(indoorGame.weather.weatherImpact).toBe("none");
  });

  it("outdoor game (Citizens Bank Park): weather isFallback true when key absent", async () => {
    const mod = await import("@/app/api/widgets/mlb-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-schedule-today?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    const outdoorGame = body.data.games.find((g: { homeTeam: { key: string } }) => g.homeTeam.key === "PHI");
    expect(outdoorGame).toBeDefined();
    expect(outdoorGame.weather).toBeDefined();
    expect(outdoorGame.weather.isFallback).toBe(true);
    expect(typeof outdoorGame.weather.fallbackReason).toBe("string");
  });

  it("outdoor game beginner mode: weather not shown when isFallback (isOutdoor false)", async () => {
    const mod = await import("@/app/api/widgets/mlb-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    // In beginner mode, weather only shown if isOutdoor is true
    // Citizens Bank Park returns isOutdoor: false when OPEN_WEATHER_KEY absent
    const outdoorGame = body.data.games.find((g: { homeTeam: { key: string } }) => g.homeTeam.key === "PHI");
    expect(outdoorGame.weather).toBeUndefined();
  });

  it("probable pitchers present from fixture", async () => {
    const mod = await import("@/app/api/widgets/mlb-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const phiGame = body.data.games.find((g: { homeTeam: { key: string } }) => g.homeTeam.key === "PHI");
    expect(phiGame.probables).toBeDefined();
    expect(phiGame.probables.length).toBeGreaterThan(0);
    expect(phiGame.probables[0]).toEqual(expect.objectContaining({
      homeAway: expect.stringMatching(/home|away/),
      name: expect.any(String),
    }));
  });

  it("userFacingMessage contains sport when games present", async () => {
    const mod = await import("@/app/api/widgets/mlb-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.data.userFacingMessage).toMatch(/MLB/);
  });

  it("meta sourceUsed is honest", async () => {
    const mod = await import("@/app/api/widgets/mlb-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.meta.sourceUsed).toBe("fixture");
    expect(body.meta.requestId).toBeDefined();
    expect(body.meta.updatedAt).toBeDefined();
  });

  it("contract source mode is fixture in fixture mode", async () => {
    const mod = await import("@/app/api/widgets/mlb-schedule-today/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-schedule-today?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.contract?.source?.mode).toBe("fixture");
    expect(body.contract?.ok).toBe(true);
  });
});
