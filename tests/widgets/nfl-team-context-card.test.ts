import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

afterEach(() => {
  vi.doUnmock("@/lib/providers/espn/nfl");
  vi.doUnmock("@/lib/providers/apiSports/teamAdvanced");
  vi.doUnmock("@/lib/providers/apiSports/client");
  delete process.env.API_SPORTS_KEY;
  delete process.env.NFL_LEAGUE_ID;
  delete process.env.NFL_SEASON;
});

describe("NFL team context card route", () => {
  it("returns a demo-backed team context card in fixture mode", async () => {
    const mod = await import("@/app/api/widgets/nfl-team-context-card/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-team-context-card?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("demo");
    expect(body.data?.source).toBe("demo");
    expect(body.data?.teamKey).toBe("PHI");
    expect(body.data?.seasonLabel).toBe("2025 Season");
  });

  it("rejects an invalid season query", async () => {
    const mod = await import("@/app/api/widgets/nfl-team-context-card/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-team-context-card?season=24A4"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid season/i);
  });

  it("returns live next-game context for a selected team key", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    const meta = {
      sourceUsed: "espn" as const,
      updatedAt: "2026-04-14T12:00:00.000Z",
      requestId: "nfl-team-context-live",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };

    vi.doMock("@/lib/providers/espn/nfl", async () => {
      const actual = await vi.importActual<typeof import("@/lib/providers/espn/nfl")>("@/lib/providers/espn/nfl");
      return {
        ...actual,
        getNflTeamProfile: async () => ({
          data: {
            season: { year: 2026, type: 2 },
            team: {
              id: "21",
              abbreviation: "PHI",
              displayName: "Philadelphia Eagles",
              recordSummary: "1-0",
              standingSummary: "1st in NFC East",
              record: { items: [{ type: "total", summary: "1-0", stats: [{ name: "playoffSeed", value: 2 }] }] },
            },
          },
          meta,
        }),
        getNflTeamSchedule: async () => ({
          data: {
            season: { year: 2026, type: 2 },
            events: [
              {
                id: "game-prev",
                date: "2026-09-01T20:20:00.000Z",
                week: { number: 1 },
                seasonType: { type: 2 },
                competitions: [{
                  date: "2026-09-01T20:20:00.000Z",
                  venue: { fullName: "Lincoln Financial Field" },
                  status: { type: { state: "post", detail: "Final" } },
                  competitors: [
                    { id: "21", homeAway: "home", team: { id: "21", abbreviation: "PHI", displayName: "Philadelphia Eagles", logos: [{ href: "phi.png" }] }, score: { value: 24 } },
                    { id: "6", homeAway: "away", team: { id: "6", abbreviation: "DAL", displayName: "Dallas Cowboys", logos: [{ href: "dal.png" }] }, score: { value: 17 } },
                  ],
                }],
              },
              {
                id: "game-next",
                date: "2099-09-08T20:20:00.000Z",
                week: { number: 2 },
                seasonType: { type: 2 },
                competitions: [{
                  date: "2099-09-08T20:20:00.000Z",
                  venue: { fullName: "FedExField" },
                  status: { type: { state: "pre", detail: "Scheduled" } },
                  competitors: [
                    { id: "28", homeAway: "home", team: { id: "28", abbreviation: "WSH", displayName: "Washington Commanders", logos: [{ href: "wsh.png" }] }, score: { value: 0 } },
                    { id: "21", homeAway: "away", team: { id: "21", abbreviation: "PHI", displayName: "Philadelphia Eagles", logos: [{ href: "phi.png" }] }, score: { value: 0 } },
                  ],
                }],
              },
            ],
          },
          meta,
        }),
      };
    });

    const mod = await import("@/app/api/widgets/nfl-team-context-card/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-team-context-card?mode=advanced&dataMode=live&teamKey=PHI"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("espn");
    expect(body.data?.source).toBe("live");
    expect(body.data?.teamKey).toBe("PHI");
    expect(body.data?.nextGame?.week).toBe(2);
  });

  it("defaults offseason team context to the last completed season when none is selected", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    const meta = {
      sourceUsed: "espn" as const,
      updatedAt: "2026-04-14T12:00:00.000Z",
      requestId: "nfl-team-context-offseason",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };
    let capturedSeason: number | undefined;

    vi.doMock("@/lib/providers/espn/nfl", async () => {
      const actual = await vi.importActual<typeof import("@/lib/providers/espn/nfl")>("@/lib/providers/espn/nfl");
      return {
        ...actual,
        getNflTeamProfile: async () => ({
          data: {
            season: { year: 2025, type: 4 },
            team: {
              id: "21",
              abbreviation: "PHI",
              displayName: "Philadelphia Eagles",
              recordSummary: "0-0",
              standingSummary: "Offseason",
            },
          },
          meta,
        }),
        getNflTeamSchedule: async (_teamKey: string, _dataMode: string, _cacheBust: string | undefined, season?: number) => {
          capturedSeason = season;
          return {
            data: {
              season: { year: 2026, type: 4 },
              requestedSeason: { year: season },
              events: [
                {
                  id: "hist-1",
                  date: "2026-01-04T21:25:00.000Z",
                  week: { number: 17 },
                  seasonType: { type: 2 },
                  competitions: [{
                    date: "2026-01-04T21:25:00.000Z",
                    venue: { fullName: "Lincoln Financial Field" },
                    status: { type: { state: "post", detail: "Final" } },
                    competitors: [
                      { id: "21", homeAway: "home", team: { id: "21", abbreviation: "PHI", displayName: "Philadelphia Eagles", logos: [{ href: "phi.png" }] }, score: { value: 27 } },
                      { id: "6", homeAway: "away", team: { id: "6", abbreviation: "DAL", displayName: "Dallas Cowboys", logos: [{ href: "dal.png" }] }, score: { value: 20 } },
                    ],
                  }],
                },
                {
                  id: "hist-2",
                  date: "2025-12-28T21:25:00.000Z",
                  week: { number: 16 },
                  seasonType: { type: 2 },
                  competitions: [{
                    date: "2025-12-28T21:25:00.000Z",
                    venue: { fullName: "FedExField" },
                    status: { type: { state: "post", detail: "Final" } },
                    competitors: [
                      { id: "28", homeAway: "home", team: { id: "28", abbreviation: "WSH", displayName: "Washington Commanders", logos: [{ href: "wsh.png" }] }, score: { value: 17 } },
                      { id: "21", homeAway: "away", team: { id: "21", abbreviation: "PHI", displayName: "Philadelphia Eagles", logos: [{ href: "phi.png" }] }, score: { value: 24 } },
                    ],
                  }],
                },
              ],
            },
            meta,
          };
        },
      };
    });

    const mod = await import("@/app/api/widgets/nfl-team-context-card/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-team-context-card?mode=beginner&dataMode=live&teamKey=PHI"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(capturedSeason).toBe(2025);
    expect(body.data?.season).toBe(2025);
    expect(body.data?.seasonLabel).toBe("2025 Season");
    expect(body.data?.currentRecord).toEqual({ wins: 2, losses: 0, ties: 0 });
    expect(body.data?.nextGame).toBeNull();
  });

  it("falls back to API-Sports NFL team context before demo when ESPN fails", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    process.env.API_SPORTS_KEY = "api-sports-key-long-enough-12345";
    process.env.NFL_LEAGUE_ID = "1";
    process.env.NFL_SEASON = "2026";

    const apiMeta = {
      sourceUsed: "apiSports" as const,
      updatedAt: "2026-04-15T12:00:00.000Z",
      requestId: "nfl-team-context-api",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };

    vi.doMock("@/lib/providers/espn/nfl", async () => {
      const actual = await vi.importActual<typeof import("@/lib/providers/espn/nfl")>("@/lib/providers/espn/nfl");
      return {
        ...actual,
        getNflTeamProfile: async () => {
          throw new Error("ESPN 503");
        },
      };
    });

    vi.doMock("@/lib/providers/apiSports/teamAdvanced", () => ({
      getTeamsAdvanced: async () => ({
        data: {
          sport: "nfl",
          teams: [{
            teamKey: "PHI",
            teamName: "Philadelphia Eagles",
            apiSportsTeamId: "21",
            record: { wins: 12, losses: 5, pct: "0.706", streak: "W2" },
            standings: { rank: "1", division: "East", conference: "NFC" },
            lastGame: { when: "2026-01-04T21:25:00.000Z", vs: "DAL", result: "W", score: "27-20" },
            nextGame: { when: "2099-09-08T20:20:00.000Z", vs: "WSH", homeAway: "away" },
            status: { sport: "nfl", teamKey: "PHI", hasGameToday: false },
          }],
        },
        meta: apiMeta,
      }),
    }));

    vi.doMock("@/lib/providers/apiSports/client", () => ({
      fetchApiSportsJson: async () => ({
        data: {
          response: [
            {
              id: "api-prev",
              date: { date: "2026-01-04T21:25:00.000Z" },
              status: { short: "Final", long: "Final" },
              week: { number: 18 },
              teams: {
                home: { id: "21", code: "PHI", name: "Philadelphia Eagles" },
                away: { id: "6", code: "DAL", name: "Dallas Cowboys" },
              },
              scores: { home: { total: 27 }, away: { total: 20 } },
              venue: { name: "Lincoln Financial Field" },
            },
            {
              id: "api-next",
              date: { date: "2099-09-08T20:20:00.000Z" },
              status: { short: "Scheduled", long: "Scheduled" },
              week: { number: 2 },
              teams: {
                home: { id: "28", code: "WSH", name: "Washington Commanders" },
                away: { id: "21", code: "PHI", name: "Philadelphia Eagles" },
              },
              scores: { home: { total: 0 }, away: { total: 0 } },
              venue: { name: "FedExField" },
            },
          ],
        },
        meta: apiMeta,
      }),
    }));

    const mod = await import("@/app/api/widgets/nfl-team-context-card/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-team-context-card?mode=advanced&dataMode=live&teamKey=PHI"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("apiSports");
    expect(body.meta?.warning).toMatch(/API-Sports NFL fallback/i);
    expect(body.data?.source).toBe("live");
    expect(body.data?.teamKey).toBe("PHI");
    expect(body.data?.nextGame?.week).toBe(2);
  });
});
