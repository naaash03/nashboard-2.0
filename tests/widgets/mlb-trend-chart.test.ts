import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("MLB trend chart route", () => {
  it("returns fixture envelope with NYY games", async () => {
    const mod = await import("@/app/api/widgets/mlb-trend-chart/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-trend-chart?teamKey=NYY&mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data.teamKey).toBe("NYY");
    expect(body.data.teamName).toBe("New York Yankees");
    expect(Array.isArray(body.data.games)).toBe(true);
    expect(body.data.games.length).toBeGreaterThan(0);
  });

  it("game shape is correct", async () => {
    const mod = await import("@/app/api/widgets/mlb-trend-chart/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-trend-chart?teamKey=NYY&mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(game).toEqual(expect.objectContaining({
      gamePk: expect.any(Number),
      gameNumber: expect.any(Number),
      date: expect.any(String),
      dateISO: expect.any(String),
      opponent: expect.any(String),
      opponentKey: expect.any(String),
      runsScored: expect.any(Number),
      runsAllowed: expect.any(Number),
      result: expect.stringMatching(/^[WL]$/),
    }));
  });

  it("gameNumber starts at 1 and increments", async () => {
    const mod = await import("@/app/api/widgets/mlb-trend-chart/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-trend-chart?teamKey=NYY&mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const numbers = body.data.games.map((g: { gameNumber: number }) => g.gameNumber);
    expect(numbers[0]).toBe(1);
    expect(numbers[numbers.length - 1]).toBe(body.data.games.length);
  });

  it("fixture has 15 games — isPartial false", async () => {
    const mod = await import("@/app/api/widgets/mlb-trend-chart/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-trend-chart?teamKey=NYY&mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.data.games).toHaveLength(15);
    expect(body.data.isPartial).toBe(false);
    expect(body.data.gamesShown).toBe(15);
  });

  it("summary wins + losses equals games count", async () => {
    const mod = await import("@/app/api/widgets/mlb-trend-chart/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-trend-chart?teamKey=NYY&mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const { summary, games } = body.data;
    expect(summary.wins + summary.losses).toBe(games.length);
    expect(typeof summary.avgRunsScored).toBe("string");
    expect(summary.avgRunsScored).toMatch(/^\d+\.\d$/);
    expect(summary.avgRunsAllowed).toMatch(/^\d+\.\d$/);
  });

  it("beginner mode: no isHome on games, streakLabel present, no raw streak", async () => {
    const mod = await import("@/app/api/widgets/mlb-trend-chart/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-trend-chart?teamKey=NYY&mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(game.isHome).toBeUndefined();
    expect(game.homeAway).toBeUndefined();

    const { summary } = body.data;
    expect(typeof summary.streakLabel).toBe("string");
    expect(summary.streakLabel).toMatch(/^(Won|Lost) last \d+$/);
    expect(summary.streak).toBeUndefined();
  });

  it("advanced mode: isHome present, raw streak code, no streakLabel", async () => {
    const mod = await import("@/app/api/widgets/mlb-trend-chart/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-trend-chart?teamKey=NYY&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(typeof game.isHome).toBe("boolean");

    const { summary } = body.data;
    expect(typeof summary.streak).toBe("string");
    expect(summary.streak).toMatch(/^[WL]\d+$/);
    expect(summary.streakLabel).toBeUndefined();
  });

  it("streak reflects last 3 wins (W3)", async () => {
    const mod = await import("@/app/api/widgets/mlb-trend-chart/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-trend-chart?teamKey=NYY&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(body.data.summary.streak).toBe("W3");
  });

  it("missing teamKey returns 400", async () => {
    const mod = await import("@/app/api/widgets/mlb-trend-chart/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-trend-chart?mode=beginner&dataMode=fixture"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("unknown teamKey returns 400", async () => {
    const mod = await import("@/app/api/widgets/mlb-trend-chart/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-trend-chart?teamKey=ZZZZZ&mode=beginner&dataMode=fixture"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("contract source mode is fixture", async () => {
    const mod = await import("@/app/api/widgets/mlb-trend-chart/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-trend-chart?teamKey=NYY&mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.contract?.source?.mode).toBe("fixture");
    expect(body.contract?.ok).toBe(true);
  });

  it("meta sourceUsed is honest", async () => {
    const mod = await import("@/app/api/widgets/mlb-trend-chart/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-trend-chart?teamKey=NYY&mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.meta.sourceUsed).toBe("fixture");
    expect(body.meta.requestId).toBeDefined();
  });
});
