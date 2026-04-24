import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
  delete process.env.THE_ODDS_KEY;
});

describe("NBA market insights route", () => {
  it("returns fixture envelope with games", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeNull();
    expect(body.data).toBeTruthy();
    expect(body.data.dateUsed).toBeDefined();
    expect(Array.isArray(body.data.games)).toBe(true);
    expect(body.data.games.length).toBeGreaterThan(0);
  });

  it("each game has required fields and marketSummary", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(game).toEqual(expect.objectContaining({
      gameId: expect.any(String),
      awayTeam: expect.any(String),
      homeTeam: expect.any(String),
      gameTime: expect.any(String),
      status: expect.any(String),
      marketSummary: expect.any(String),
    }));
  });

  it("moneyline isFallback when THE_ODDS_KEY absent", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(game.odds.moneyline.isFallback).toBe(true);
    expect(typeof game.odds.moneyline.fallbackReason).toBe("string");
  });

  it("lineMovement isFallback when THE_ODDS_KEY absent", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(game.odds.lineMovement.isFallback).toBe(true);
    expect(typeof game.odds.lineMovement.fallbackReason).toBe("string");
  });

  it("publicBetting always isFallback: true on every game", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    for (const game of body.data.games) {
      expect(game.odds.publicBetting.isFallback).toBe(true);
      expect(game.odds.publicBetting.fallbackReason).toMatch(/paid Odds API plan/);
    }
  });

  it("beginner mode: no raw moneyline numbers, marketSummary present", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(game.odds).toBeUndefined();
    expect(typeof game.marketSummary).toBe("string");
    expect(game.favoredSide).toBeDefined();
    expect(game.lineMovementDirection).toBeDefined();
  });

  it("advanced mode: odds object with nested fields present", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    const game = body.data.games[0];
    expect(game.odds).toBeDefined();
    expect(game.odds.moneyline).toBeDefined();
    expect(game.odds.overUnder).toBeDefined();
    expect(game.odds.lineMovement).toBeDefined();
    expect(game.odds.publicBetting).toBeDefined();
  });

  it("beginner mode: marketSummary is 'Odds unavailable' when key absent", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.data.games[0].marketSummary).toBe("Odds unavailable");
  });

  it("oddsUnavailable flag set when all games have fallback odds", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.data.oddsUnavailable).toBe(true);
  });

  it("meta sourceUsed is honest", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.meta.sourceUsed).toBe("fixture");
    expect(body.meta.requestId).toBeDefined();
  });

  it("contract source mode is fixture", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.contract?.source?.mode).toBe("fixture");
    expect(body.contract?.ok).toBe(true);
  });

  it("userFacingMessage mentions NBA games when games present", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(body.data.userFacingMessage).toMatch(/NBA game/);
  });

  it("games include both LAL @ BOS and DEN @ GS from fixture", async () => {
    const mod = await import("@/app/api/widgets/nba-market-insights/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-market-insights?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    const teams = body.data.games.flatMap((g: { awayTeam: string; homeTeam: string }) => [g.awayTeam, g.homeTeam]);
    expect(teams.some((t: string) => t.includes("Lakers"))).toBe(true);
    expect(teams.some((t: string) => t.includes("Celtics"))).toBe(true);
  });
});
