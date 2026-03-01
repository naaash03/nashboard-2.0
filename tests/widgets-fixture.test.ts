import { beforeEach, describe, expect, it, vi } from "vitest";

type SearchResult = { fullName: string };

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "live";
});

describe("widgets routes visible output guarantees", () => {
  it("offseason empty today uses next slate search result", async () => {
    process.env.NASHBOARD_FIXTURE_SCENARIO = "slate_empty_today";
    const mod = await import("@/app/api/widgets/tonights-slate/route");

    const res = await mod.GET(new Request("http://localhost/api/widgets/tonights-slate?sport=NFL&mode=beginner&dataMode=fixture&date=2026-02-25"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.state).toBe("next_slate");
    expect(body.data.nextDate).toBeTruthy();
    expect(body.data.games.length).toBeGreaterThan(0);
    expect(body.data.userFacingMessage).toContain("Showing the next slate");
  });

  it("schedule not posted returns message and historical fallback context", async () => {
    process.env.NASHBOARD_FIXTURE_SCENARIO = "next_season_not_posted";
    const mod = await import("@/app/api/widgets/tonights-slate/route");

    const res = await mod.GET(new Request("http://localhost/api/widgets/tonights-slate?sport=NFL&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.state).toBe("schedule_not_posted");
    expect(String(body.data.userFacingMessage)).toContain("Next season schedule has not been posted");
    expect(Array.isArray(body.data.games)).toBe(true);
    expect(body.data.games).toHaveLength(0);
    expect(body.data.historical === null || Array.isArray(body.data.historical.games)).toBe(true);
  });

  it("tonights slate diagnostics fields are always present", async () => {
    process.env.NASHBOARD_FIXTURE_SCENARIO = "slate_empty_today";
    const mod = await import("@/app/api/widgets/tonights-slate/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/tonights-slate?sport=NFL&mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.diagnostics).toBeDefined();
    expect(body.diagnostics).toEqual(expect.objectContaining({
      endpointUrl: expect.anything(),
      provider: expect.any(String),
      requestId: expect.any(String),
      dataMode: expect.any(String),
    }));
    expect(Object.prototype.hasOwnProperty.call(body.diagnostics, "upstreamStatus")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(body.diagnostics, "upstreamMessage")).toBe(true);
  });

  it("widget route reads cookie dataMode when query param is absent", async () => {
    const mod = await import("@/app/api/widgets/tonights-slate/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/tonights-slate?sport=NFL&mode=beginner", {
      headers: { cookie: "nashboard_dataMode=fixture" },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.sourceUsed).toBe("fixture");
    expect(body.meta.dataMode).toBe("fixture");
  });

  it("search requires 3+ chars and returns <=8 strict NFL matches", async () => {
    const mod = await import("@/app/api/search/players/route");

    const shortRes = await mod.GET(new Request("http://localhost/api/search/players?sport=NFL&q=sa&dataMode=fixture"));
    const shortBody = await shortRes.json();
    expect(shortBody.results).toHaveLength(0);

    const goodRes = await mod.GET(new Request("http://localhost/api/search/players?sport=NFL&q=saquon%20barkley&limit=8&dataMode=fixture"));
    const goodBody = await goodRes.json();
    expect(goodBody.results.length).toBeLessThanOrEqual(8);
    expect(goodBody.results.some((r: SearchResult) => r.fullName === "Saquon Barkley")).toBe(true);
    expect(goodBody.results.some((r: SearchResult) => r.fullName === "LeBron James")).toBe(false);
  });

  it("player card id-only returns visible player payload in fixture mode", async () => {
    const mod = await import("@/app/api/widgets/player-card/route");

    const missingRes = await mod.GET(new Request("http://localhost/api/widgets/player-card?sport=NFL&dataMode=fixture"));
    expect(missingRes.status).toBe(400);

    const okRes = await mod.GET(new Request("http://localhost/api/widgets/player-card?sport=NFL&playerId=42&mode=advanced&dataMode=fixture"));
    const okBody = await okRes.json();
    expect(okRes.status).toBe(200);
    expect(okBody.data.playerId).toBe("42");
    expect(okBody.data.fullName).toBe("Saquon Barkley");
  });

  it("rb vs dline returns stats or structured offseason empty state", async () => {
    const mod = await import("@/app/api/widgets/rb-vs-dline/route");

    const inSeasonRes = await mod.GET(new Request("http://localhost/api/widgets/rb-vs-dline?teamKey=PHI&mode=beginner&dataMode=fixture"));
    const inSeasonBody = await inSeasonRes.json();
    expect(inSeasonRes.status).toBe(200);
    expect(inSeasonBody.data.rbAttempts).toBeDefined();

    const offseasonRes = await mod.GET(new Request("http://localhost/api/widgets/rb-vs-dline?teamKey=NYJ&mode=beginner&dataMode=fixture"));
    const offseasonBody = await offseasonRes.json();
    expect(offseasonRes.status).toBe(200);
    expect(Boolean(offseasonBody.data.emptyState)).toBe(true);
    expect(String(offseasonBody.data.title)).toContain("offseason");
  });
});
