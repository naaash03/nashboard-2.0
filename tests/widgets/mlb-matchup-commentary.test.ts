import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
  delete process.env.THE_ODDS_KEY;
  delete process.env.GROQ_KEY;
  delete process.env.GEMINI_API_KEY;
});

describe("MLB matchup commentary route", () => {
  it("returns fixture envelope with games", async () => {
    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const res = await mod.GET(
      new Request("http://localhost/api/widgets/mlb-matchup-commentary?mode=beginner&dataMode=fixture"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeNull();
    expect(body.data).toBeTruthy();
    expect(body.data.dateUsed).toBeDefined();
    expect(Array.isArray(body.data.games)).toBe(true);
    expect(body.data.games.length).toBeGreaterThan(0);
  });

  it("each game has required fields and commentary shape", async () => {
    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const res = await mod.GET(
      new Request("http://localhost/api/widgets/mlb-matchup-commentary?mode=beginner&dataMode=fixture"),
    );
    const body = await res.json();

    for (const game of body.data.games) {
      expect(game).toEqual(
        expect.objectContaining({
          gameId: expect.any(String),
          awayTeam: expect.any(String),
          homeTeam: expect.any(String),
          gameTime: expect.any(String),
          division: expect.any(String),
        }),
      );
      expect(game.commentary).toEqual(
        expect.objectContaining({
          text: expect.any(String),
          generatedBy: expect.any(String),
          inputsUsed: expect.any(Array),
          fingerprint: expect.any(String),
        }),
      );
    }
  });

  it("commentary falls back to rules-based when AI keys absent", async () => {
    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const res = await mod.GET(
      new Request("http://localhost/api/widgets/mlb-matchup-commentary?mode=beginner&dataMode=fixture"),
    );
    const body = await res.json();

    expect(body.data.games[0].commentary.generatedBy).toBe("rules");
    expect(body.data.games[0].commentary.isFallback).toBe(true);
  });

  it("commentary text is non-empty for every game", async () => {
    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const res = await mod.GET(
      new Request("http://localhost/api/widgets/mlb-matchup-commentary?mode=beginner&dataMode=fixture"),
    );
    const body = await res.json();

    for (const game of body.data.games) {
      expect(typeof game.commentary.text).toBe("string");
      expect(game.commentary.text.length).toBeGreaterThan(0);
    }
  });

  it("cache hit on second identical request", async () => {
    vi.resetModules();
    process.env.NASHBOARD_DATA_MODE = "fixture";
    delete process.env.THE_ODDS_KEY;
    delete process.env.GROQ_KEY;
    delete process.env.GEMINI_API_KEY;

    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const url =
      "http://localhost/api/widgets/mlb-matchup-commentary?mode=beginner&dataMode=fixture";

    const res1 = await mod.GET(new Request(url));
    const body1 = await res1.json();

    const res2 = await mod.GET(new Request(url));
    const body2 = await res2.json();

    expect(body1.data.games[0].commentary.cachedAt).toBeNull();
    expect(body2.data.games[0].commentary.cachedAt).not.toBeNull();
    expect(body2.meta.cacheStats.hits).toBeGreaterThan(0);
  });

  it("teamKey filter returns only the matching game", async () => {
    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const res = await mod.GET(
      new Request(
        "http://localhost/api/widgets/mlb-matchup-commentary?mode=beginner&dataMode=fixture&teamKey=PHI",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.games.length).toBe(1);
    const game = body.data.games[0];
    const involved = [game.awayTeam, game.homeTeam].join(" ");
    expect(involved).toMatch(/Phillies/);
  });

  it("teamKey with no game today sets noTeamGame true and returns empty games", async () => {
    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const res = await mod.GET(
      new Request(
        "http://localhost/api/widgets/mlb-matchup-commentary?mode=beginner&dataMode=fixture&teamKey=ZZZ",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.noTeamGame).toBe(true);
    expect(body.data.games.length).toBe(0);
    expect(body.error).toBeNull();
  });

  it("beginner mode: inputs key absent on game", async () => {
    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const res = await mod.GET(
      new Request("http://localhost/api/widgets/mlb-matchup-commentary?mode=beginner&dataMode=fixture"),
    );
    const body = await res.json();

    for (const game of body.data.games) {
      expect(game.inputs).toBeUndefined();
      expect(game.commentary.mode).toBe("beginner");
    }
  });

  it("advanced mode: inputs key present on game", async () => {
    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const res = await mod.GET(
      new Request("http://localhost/api/widgets/mlb-matchup-commentary?mode=advanced&dataMode=fixture"),
    );
    const body = await res.json();

    expect(body.data.games.length).toBeGreaterThan(0);
    for (const game of body.data.games) {
      expect(game.inputs).toBeDefined();
      expect(game.commentary.mode).toBe("advanced");
    }
  });

  it("meta cacheStats present", async () => {
    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const res = await mod.GET(
      new Request("http://localhost/api/widgets/mlb-matchup-commentary?mode=beginner&dataMode=fixture"),
    );
    const body = await res.json();

    expect(typeof body.meta.cacheStats.hits).toBe("number");
    expect(typeof body.meta.cacheStats.misses).toBe("number");
  });

  it("contract source mode is fixture", async () => {
    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const res = await mod.GET(
      new Request("http://localhost/api/widgets/mlb-matchup-commentary?mode=beginner&dataMode=fixture"),
    );
    const body = await res.json();

    expect(body.contract?.source?.mode).toBe("fixture");
    expect(body.contract?.ok).toBe(true);
  });

  it("meta sourceUsed is fixture", async () => {
    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const res = await mod.GET(
      new Request("http://localhost/api/widgets/mlb-matchup-commentary?mode=beginner&dataMode=fixture"),
    );
    const body = await res.json();

    expect(body.meta.sourceUsed).toBe("fixture");
    expect(body.meta.requestId).toBeDefined();
  });

  it("fixture games include NYM @ PHI and TBR @ HOU", async () => {
    const mod = await import("@/app/api/widgets/mlb-matchup-commentary/route");
    const res = await mod.GET(
      new Request("http://localhost/api/widgets/mlb-matchup-commentary?mode=beginner&dataMode=fixture"),
    );
    const body = await res.json();

    const teams = body.data.games.flatMap((g: { awayTeam: string; homeTeam: string }) => [
      g.awayTeam,
      g.homeTeam,
    ]);
    expect(teams.some((t: string) => t.includes("Phillies"))).toBe(true);
    expect(teams.some((t: string) => t.includes("Mets"))).toBe(true);
  });
});
