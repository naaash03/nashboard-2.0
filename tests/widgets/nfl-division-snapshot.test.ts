import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildFinalSchedule(teamKey: string, wins: number, losses: number) {
  const events = [];
  for (let index = 0; index < wins + losses; index += 1) {
    const didWin = index < wins;
    const week = index + 1;
    events.push({
      id: `${teamKey}-g-${week}`,
      date: `2025-01-${String((week % 28) + 1).padStart(2, "0")}T20:20:00.000Z`,
      week: { number: week },
      seasonType: { type: 2 },
      competitions: [{
        date: `2025-01-${String((week % 28) + 1).padStart(2, "0")}T20:20:00.000Z`,
        status: { type: { state: "post", detail: "Final" } },
        competitors: [
          { id: teamKey, homeAway: "home", team: { id: teamKey, abbreviation: teamKey, displayName: `${teamKey} Team`, logos: [{ href: `${teamKey}.png` }] }, score: { value: didWin ? 24 : 17 } },
          { id: `OPP-${week}`, homeAway: "away", team: { id: `OPP-${week}`, abbreviation: `O${week}`, displayName: `Opponent ${week}`, logos: [{ href: `opp-${week}.png` }] }, score: { value: didWin ? 17 : 24 } },
        ],
      }],
    });
  }
  return events;
}

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

describe("NFL division snapshot route", () => {
  it("returns a demo-backed division snapshot in fixture mode", async () => {
    const mod = await import("@/app/api/widgets/nfl-division-snapshot/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-division-snapshot?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("demo");
    expect(body.data?.source).toBe("demo");
    expect(body.data?.isOffseason).toBe(true);
    expect(body.data?.divisions.length).toBeGreaterThan(0);
  });

  it("returns live division rows when team profiles are available", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    const meta = {
      sourceUsed: "espn" as const,
      updatedAt: "2026-04-14T12:00:00.000Z",
      requestId: "nfl-division-live",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };
    const profiles: Record<string, unknown> = {
      PHI: {
        season: { year: 2025, type: 4 },
        team: {
          id: "21",
          abbreviation: "PHI",
          displayName: "Philadelphia Eagles",
          recordSummary: "0-0",
          standingSummary: "1st in NFC East",
          record: { items: [{ type: "total", summary: "0-0", stats: [] }] },
        },
      },
      WSH: {
        season: { year: 2025, type: 4 },
        team: {
          id: "28",
          abbreviation: "WSH",
          displayName: "Washington Commanders",
          recordSummary: "0-0",
          standingSummary: "2nd in NFC East",
          record: { items: [{ type: "total", summary: "0-0", stats: [] }] },
        },
      },
      DAL: {
        season: { year: 2025, type: 4 },
        team: {
          id: "6",
          abbreviation: "DAL",
          displayName: "Dallas Cowboys",
          recordSummary: "0-0",
          standingSummary: "3rd in NFC East",
          record: { items: [{ type: "total", summary: "0-0", stats: [] }] },
        },
      },
      NYG: {
        season: { year: 2025, type: 4 },
        team: {
          id: "19",
          abbreviation: "NYG",
          displayName: "New York Giants",
          recordSummary: "0-0",
          standingSummary: "4th in NFC East",
          record: { items: [{ type: "total", summary: "0-0", stats: [] }] },
        },
      },
    };

    vi.doMock("@/lib/providers/espn/nfl", async () => {
      const actual = await vi.importActual<typeof import("@/lib/providers/espn/nfl")>("@/lib/providers/espn/nfl");
      return {
        ...actual,
        getNflTeamProfile: async (teamKey: string) => ({ data: profiles[teamKey.toUpperCase()] as never, meta }),
        getNflTeamSchedule: async (teamKey: string, _dataMode: string, _cacheBust: string | undefined, season?: number) => ({
          data: {
            season: { year: 2025, type: 4 },
            requestedSeason: { year: season },
            team: {
              id: teamKey.toUpperCase(),
              abbreviation: teamKey.toUpperCase(),
              displayName: `${teamKey.toUpperCase()} Team`,
            },
            events: teamKey.toUpperCase() === "PHI"
              ? buildFinalSchedule("PHI", 14, 3)
              : teamKey.toUpperCase() === "WSH"
                ? buildFinalSchedule("WSH", 12, 5)
                : teamKey.toUpperCase() === "DAL"
                  ? buildFinalSchedule("DAL", 7, 10)
                  : buildFinalSchedule("NYG", 3, 14),
          },
          meta,
        }),
      };
    });

    const mod = await import("@/app/api/widgets/nfl-division-snapshot/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-division-snapshot?mode=advanced&dataMode=live&conference=NFC&division=East"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("espn");
    expect(body.data?.source).toBe("live");
    expect(body.data?.divisions).toHaveLength(1);
    expect(body.data?.seasonLabel).toBe("2024 Final Standings");
    expect(body.data?.divisions[0]?.teams[0]?.wins).toBe(14);
    expect(body.data?.divisions[0]?.teams[0]?.teamKey).toBe("PHI");
    expect(body.data?.divisions[0]?.teams[0]?.divisionLeader).toBe(true);
  });

  it("labels completed prior-season standings honestly when offseason profiles have no upcoming games", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    const meta = {
      sourceUsed: "espn" as const,
      updatedAt: "2026-04-15T12:00:00.000Z",
      requestId: "nfl-division-completed-season",
      endpointUrl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/phi",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };
    const profiles: Record<string, unknown> = {
      PHI: {
        season: { year: 2026, type: 2 },
        team: {
          id: "21",
          abbreviation: "PHI",
          displayName: "Philadelphia Eagles",
          recordSummary: "14-3",
          standingSummary: "1st in NFC East",
          nextEvent: [],
          record: { items: [{ type: "total", summary: "14-3", stats: [{ name: "winPercent", value: 0.824 }, { name: "pointsFor", value: 463 }, { name: "pointsAgainst", value: 303 }] }] },
        },
      },
      WSH: {
        season: { year: 2026, type: 2 },
        team: {
          id: "28",
          abbreviation: "WSH",
          displayName: "Washington Commanders",
          recordSummary: "12-5",
          standingSummary: "2nd in NFC East",
          nextEvent: [],
          record: { items: [{ type: "total", summary: "12-5", stats: [{ name: "winPercent", value: 0.706 }, { name: "pointsFor", value: 485 }, { name: "pointsAgainst", value: 391 }] }] },
        },
      },
      DAL: {
        season: { year: 2026, type: 2 },
        team: {
          id: "6",
          abbreviation: "DAL",
          displayName: "Dallas Cowboys",
          recordSummary: "7-10",
          standingSummary: "3rd in NFC East",
          nextEvent: [],
          record: { items: [{ type: "total", summary: "7-10", stats: [{ name: "winPercent", value: 0.412 }, { name: "pointsFor", value: 350 }, { name: "pointsAgainst", value: 468 }] }] },
        },
      },
      NYG: {
        season: { year: 2026, type: 2 },
        team: {
          id: "19",
          abbreviation: "NYG",
          displayName: "New York Giants",
          recordSummary: "3-14",
          standingSummary: "4th in NFC East",
          nextEvent: [],
          record: { items: [{ type: "total", summary: "3-14", stats: [{ name: "winPercent", value: 0.176 }, { name: "pointsFor", value: 273 }, { name: "pointsAgainst", value: 415 }] }] },
        },
      },
    };

    vi.doMock("@/lib/providers/espn/nfl", async () => {
      const actual = await vi.importActual<typeof import("@/lib/providers/espn/nfl")>("@/lib/providers/espn/nfl");
      return {
        ...actual,
        getNflTeamProfile: async (teamKey: string) => ({ data: profiles[teamKey.toUpperCase()] as never, meta }),
      };
    });

    const mod = await import("@/app/api/widgets/nfl-division-snapshot/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-division-snapshot?mode=advanced&dataMode=live&conference=NFC&division=East"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("espn");
    expect(body.meta?.endpointUrl).toBeUndefined();
    expect(body.data?.source).toBe("live");
    expect(body.data?.isOffseason).toBe(true);
    expect(body.data?.season).toBe(2025);
    expect(body.data?.seasonLabel).toBe("2025 Final Standings");
  });

  it("falls back to API-Sports NFL before demo when ESPN division lookups fail", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    process.env.API_SPORTS_KEY = "api-sports-key-long-enough-12345";
    process.env.NFL_LEAGUE_ID = "1";
    process.env.NFL_SEASON = "2025";

    const apiMeta = {
      sourceUsed: "apiSports" as const,
      updatedAt: "2026-04-15T12:00:00.000Z",
      requestId: "nfl-division-api",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };
    const teamIds: Record<string, string> = { PHI: "21", WSH: "28", DAL: "6", NYG: "19" };
    const buildGames = (teamKey: string, wins: number, losses: number) => ({
      response: Array.from({ length: wins + losses }, (_, index) => {
        const didWin = index < wins;
        const home = index % 2 === 0;
        return {
          id: `${teamKey}-api-${index + 1}`,
          date: { date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T20:20:00.000Z` },
          status: { short: "Final", long: "Final" },
          teams: {
            home: {
              id: home ? teamIds[teamKey] : `opp-${teamKey}-${index}`,
              code: home ? teamKey : `OP${index}`,
              name: home ? `${teamKey} Team` : `Opponent ${index}`,
            },
            away: {
              id: home ? `opp-${teamKey}-${index}` : teamIds[teamKey],
              code: home ? `OP${index}` : teamKey,
              name: home ? `Opponent ${index}` : `${teamKey} Team`,
            },
          },
          scores: {
            home: { total: home ? (didWin ? 27 : 17) : (didWin ? 17 : 27) },
            away: { total: home ? (didWin ? 17 : 27) : (didWin ? 27 : 17) },
          },
          week: { number: index + 1 },
        };
      }),
    });

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
          teams: [
            { teamKey: "PHI", teamName: "Philadelphia Eagles", apiSportsTeamId: "21", standings: { rank: "1", division: "East", conference: "NFC" }, record: { wins: 14, losses: 3, pct: "0.824", streak: "W2" }, status: { sport: "nfl", teamKey: "PHI", hasGameToday: false } },
            { teamKey: "WSH", teamName: "Washington Commanders", apiSportsTeamId: "28", standings: { rank: "2", division: "East", conference: "NFC" }, record: { wins: 12, losses: 5, pct: "0.706", streak: "W5" }, status: { sport: "nfl", teamKey: "WSH", hasGameToday: false } },
            { teamKey: "DAL", teamName: "Dallas Cowboys", apiSportsTeamId: "6", standings: { rank: "3", division: "East", conference: "NFC" }, record: { wins: 7, losses: 10, pct: "0.412", streak: "L2" }, status: { sport: "nfl", teamKey: "DAL", hasGameToday: false } },
            { teamKey: "NYG", teamName: "New York Giants", apiSportsTeamId: "19", standings: { rank: "4", division: "East", conference: "NFC" }, record: { wins: 3, losses: 14, pct: "0.176", streak: "L1" }, status: { sport: "nfl", teamKey: "NYG", hasGameToday: false } },
          ],
        },
        meta: apiMeta,
      }),
    }));

    vi.doMock("@/lib/providers/apiSports/client", () => ({
      fetchApiSportsJson: async (_options: { params?: { team?: string } }) => {
        const teamId = _options.params?.team;
        if (teamId === "21") return { data: buildGames("PHI", 14, 3), meta: apiMeta };
        if (teamId === "28") return { data: buildGames("WSH", 12, 5), meta: apiMeta };
        if (teamId === "6") return { data: buildGames("DAL", 7, 10), meta: apiMeta };
        return { data: buildGames("NYG", 3, 14), meta: apiMeta };
      },
    }));

    const mod = await import("@/app/api/widgets/nfl-division-snapshot/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-division-snapshot?mode=advanced&dataMode=live&conference=NFC&division=East"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("apiSports");
    expect(body.meta?.warning).toMatch(/API-Sports NFL/i);
    expect(body.data?.source).toBe("live");
    expect(body.data?.divisions[0]?.teams[0]?.teamKey).toBe("PHI");
  });
});
