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

describe("NFL recent form route", () => {
  it("returns a demo-backed recent-form card in fixture mode", async () => {
    const mod = await import("@/app/api/widgets/nfl-recent-form/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-recent-form?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("demo");
    expect(body.data?.source).toBe("demo");
    expect(body.data?.recentGames.length).toBeGreaterThan(0);
  });

  it("returns live recent-form context for a selected team key", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    const meta = {
      sourceUsed: "espn" as const,
      updatedAt: "2026-04-14T12:00:00.000Z",
      requestId: "nfl-recent-form-live",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };
    const recordByKey: Record<string, string> = {
      PHI: "2-0",
      DAL: "0-2",
      WSH: "1-1",
      NYG: "1-1",
      BUF: "2-0",
      SEA: "1-1",
    };

    vi.doMock("@/lib/providers/espn/nfl", async () => {
      const actual = await vi.importActual<typeof import("@/lib/providers/espn/nfl")>("@/lib/providers/espn/nfl");
      return {
        ...actual,
        getNflTeamProfile: async (teamKey: string) => ({
          data: {
            season: { year: 2026, type: 2 },
            team: {
              id: teamKey.toUpperCase(),
              abbreviation: teamKey.toUpperCase(),
              displayName: `${teamKey.toUpperCase()} Team`,
              recordSummary: recordByKey[teamKey.toUpperCase()] ?? "1-1",
              standingSummary: "1st in NFC East",
            },
          },
          meta,
        }),
        getNflTeamSchedule: async () => ({
          data: {
            season: { year: 2026, type: 2 },
            events: [
              {
                id: "g1",
                date: "2026-09-01T20:20:00.000Z",
                week: { number: 1 },
                seasonType: { type: 2 },
                competitions: [{
                  date: "2026-09-01T20:20:00.000Z",
                  status: { type: { state: "post", detail: "Final" } },
                  competitors: [
                    { id: "21", homeAway: "home", team: { id: "21", abbreviation: "PHI", displayName: "Philadelphia Eagles", logos: [{ href: "phi.png" }] }, score: { value: 24 } },
                    { id: "6", homeAway: "away", team: { id: "6", abbreviation: "DAL", displayName: "Dallas Cowboys", logos: [{ href: "dal.png" }] }, score: { value: 17 } },
                  ],
                }],
              },
              {
                id: "g2",
                date: "2026-09-08T20:20:00.000Z",
                week: { number: 2 },
                seasonType: { type: 2 },
                competitions: [{
                  date: "2026-09-08T20:20:00.000Z",
                  status: { type: { state: "post", detail: "Final" } },
                  competitors: [
                    { id: "28", homeAway: "home", team: { id: "28", abbreviation: "WSH", displayName: "Washington Commanders", logos: [{ href: "wsh.png" }] }, score: { value: 21 } },
                    { id: "21", homeAway: "away", team: { id: "21", abbreviation: "PHI", displayName: "Philadelphia Eagles", logos: [{ href: "phi.png" }] }, score: { value: 27 } },
                  ],
                }],
              },
              {
                id: "g3",
                date: "2099-09-15T20:20:00.000Z",
                week: { number: 3 },
                seasonType: { type: 2 },
                competitions: [{
                  date: "2099-09-15T20:20:00.000Z",
                  status: { type: { state: "pre", detail: "Scheduled" } },
                  competitors: [
                    { id: "21", homeAway: "home", team: { id: "21", abbreviation: "PHI", displayName: "Philadelphia Eagles", logos: [{ href: "phi.png" }] }, score: { value: 0 } },
                    { id: "17", homeAway: "away", team: { id: "17", abbreviation: "NYG", displayName: "New York Giants", logos: [{ href: "nyg.png" }] }, score: { value: 0 } },
                  ],
                }],
              },
            ],
          },
          meta,
        }),
      };
    });

    const mod = await import("@/app/api/widgets/nfl-recent-form/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-recent-form?mode=advanced&dataMode=live&teamKey=PHI"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("espn");
    expect(body.data?.source).toBe("live");
    expect(body.data?.teamKey).toBe("PHI");
    expect(body.data?.recentGames.length).toBe(2);
    expect(body.data?.scheduleLabel).toEqual(expect.any(String));
  });

  it("falls back to API-Sports NFL recent-form context before demo when ESPN fails", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    process.env.API_SPORTS_KEY = "api-sports-key-long-enough-12345";
    process.env.NFL_LEAGUE_ID = "1";
    process.env.NFL_SEASON = "2026";

    const apiMeta = {
      sourceUsed: "apiSports" as const,
      updatedAt: "2026-04-15T12:00:00.000Z",
      requestId: "nfl-recent-form-api",
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
        getNflTeamSchedule: async () => {
          throw new Error("ESPN 503");
        },
      };
    });

    vi.doMock("@/lib/providers/apiSports/teamAdvanced", () => ({
      getTeamsAdvanced: async (_sport: string, teamRefsOrKeys: Array<{ teamKey: string } | string>) => ({
        data: {
          sport: "nfl",
          teams: teamRefsOrKeys.map((item) => {
            const teamKey = typeof item === "string" ? item : item.teamKey;
            const recordByKey: Record<string, { wins: number; losses: number }> = {
              PHI: { wins: 2, losses: 0 },
              DAL: { wins: 0, losses: 2 },
              WSH: { wins: 1, losses: 1 },
            };
            const record = recordByKey[teamKey] ?? { wins: 1, losses: 1 };
            return {
              teamKey,
              teamName: `${teamKey} Team`,
              apiSportsTeamId: teamKey === "PHI" ? "21" : teamKey,
              record: { wins: record.wins, losses: record.losses, pct: `${(record.wins / Math.max(1, record.wins + record.losses)).toFixed(3)}`, streak: "W1" },
              standings: { rank: "1", division: "East", conference: "NFC" },
              status: { sport: "nfl", teamKey, hasGameToday: false },
            };
          }),
        },
        meta: apiMeta,
      }),
    }));

    vi.doMock("@/lib/providers/apiSports/client", () => ({
      fetchApiSportsJson: async () => ({
        data: {
          response: [
            {
              id: "g1",
              date: { date: "2026-09-01T20:20:00.000Z" },
              status: { short: "Final", long: "Final" },
              week: { number: 1 },
              teams: {
                home: { id: "21", code: "PHI", name: "Philadelphia Eagles" },
                away: { id: "6", code: "DAL", name: "Dallas Cowboys" },
              },
              scores: { home: { total: 24 }, away: { total: 17 } },
            },
            {
              id: "g2",
              date: { date: "2026-09-08T20:20:00.000Z" },
              status: { short: "Final", long: "Final" },
              week: { number: 2 },
              teams: {
                home: { id: "28", code: "WSH", name: "Washington Commanders" },
                away: { id: "21", code: "PHI", name: "Philadelphia Eagles" },
              },
              scores: { home: { total: 21 }, away: { total: 27 } },
            },
            {
              id: "g3",
              date: { date: "2099-09-15T20:20:00.000Z" },
              status: { short: "Scheduled", long: "Scheduled" },
              week: { number: 3 },
              teams: {
                home: { id: "21", code: "PHI", name: "Philadelphia Eagles" },
                away: { id: "19", code: "NYG", name: "New York Giants" },
              },
              scores: { home: { total: 0 }, away: { total: 0 } },
            },
          ],
        },
        meta: apiMeta,
      }),
    }));

    const mod = await import("@/app/api/widgets/nfl-recent-form/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-recent-form?mode=advanced&dataMode=live&teamKey=PHI"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("apiSports");
    expect(body.meta?.warning).toMatch(/API-Sports NFL fallback/i);
    expect(body.data?.source).toBe("live");
    expect(body.data?.recentGames.length).toBe(2);
  });
});
