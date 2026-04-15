import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

afterEach(() => {
  vi.doUnmock("@/lib/providers/balldontlie");
  vi.doUnmock("@/lib/providers/apiSports/teamAdvanced");
  delete process.env.BALL_DONT_LIE_KEY;
  delete process.env.SPORTS_API_KEY;
  delete process.env.NBA_LEAGUE_ID;
  delete process.env.NBA_SEASON;
});

describe("NBA team matchup profile route", () => {
  it("returns a demo-backed matchup profile scaffold", async () => {
    const mod = await import("@/app/api/widgets/nba-team-matchup-profile/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-team-matchup-profile?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("demo");
    expect(body.meta?.dataMode).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      matchup: expect.any(String),
      summary: expect.any(String),
      selectedScenarioId: expect.any(String),
      availableScenarios: expect.any(Array),
      sourceLabel: expect.any(String),
      sourceState: "demo",
      sourceDetail: expect.any(String),
    }));
    expect(body.data.pillars.length).toBeGreaterThan(0);
    expect(body.data.pillars[0]).toEqual(expect.objectContaining({
      label: expect.any(String),
      takeaway: expect.any(String),
      whyItMatters: expect.any(String),
    }));
  });

  it("returns live team context when BALLDONTLIE is available", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    process.env.BALL_DONT_LIE_KEY = "test-key";

    const meta = {
      sourceUsed: "balldontlie" as const,
      updatedAt: "2026-04-12T12:00:00.000Z",
      requestId: "live-team-matchup",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };
    const awayTeam = {
      id: 2,
      conference: "East",
      division: "Atlantic",
      city: "Boston",
      name: "Celtics",
      full_name: "Boston Celtics",
      abbreviation: "BOS",
    };
    const homeTeam = {
      id: 20,
      conference: "East",
      division: "Atlantic",
      city: "New York",
      name: "Knicks",
      full_name: "New York Knicks",
      abbreviation: "NYK",
    };

    vi.doMock("@/lib/providers/balldontlie", () => ({
      currentNbaSeason: () => 2025,
      isBallDontLieConfigured: () => true,
      findBestNbaPlayerMatch: async () => ({ data: null, meta }),
      findNbaTeamByKey: async (teamKey: string) => ({
        data: teamKey === "BOS" ? awayTeam : homeTeam,
        meta,
      }),
      getNbaPlayerSeasonStats: async () => ({ data: [], meta }),
      getNbaTeamSeasonGames: async (teamId: number) => ({
        data: teamId === awayTeam.id
          ? [
              {
                id: 1,
                date: "2026-04-10",
                season: 2025,
                status: "Final",
                period: 4,
                time: "Final",
                postseason: false,
                postponed: false,
                home_team_score: 112,
                visitor_team_score: 106,
                datetime: "2026-04-10T23:00:00.000Z",
                home_team: awayTeam,
                visitor_team: homeTeam,
              },
              {
                id: 2,
                date: "2026-04-14",
                season: 2025,
                status: "Scheduled",
                period: 0,
                time: "7:30 PM ET",
                postseason: false,
                postponed: false,
                home_team_score: 0,
                visitor_team_score: 0,
                datetime: "2026-04-14T23:30:00.000Z",
                home_team: homeTeam,
                visitor_team: awayTeam,
              },
            ]
          : [
              {
                id: 1,
                date: "2026-04-10",
                season: 2025,
                status: "Final",
                period: 4,
                time: "Final",
                postseason: false,
                postponed: false,
                home_team_score: 112,
                visitor_team_score: 106,
                datetime: "2026-04-10T23:00:00.000Z",
                home_team: awayTeam,
                visitor_team: homeTeam,
              },
              {
                id: 3,
                date: "2026-04-12",
                season: 2025,
                status: "Final",
                period: 4,
                time: "Final",
                postseason: false,
                postponed: false,
                home_team_score: 109,
                visitor_team_score: 101,
                datetime: "2026-04-12T23:00:00.000Z",
                home_team: homeTeam,
                visitor_team: {
                  id: 14,
                  conference: "East",
                  division: "Central",
                  city: "Miami",
                  name: "Heat",
                  full_name: "Miami Heat",
                  abbreviation: "MIA",
                },
              },
            ],
        meta,
      }),
      getNbaTeams: async () => ({ data: [awayTeam, homeTeam], meta }),
    }));

    const mod = await import("@/app/api/widgets/nba-team-matchup-profile/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-team-matchup-profile?mode=advanced&dataMode=live&scenario=bos-at-nyk"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("balldontlie");
    expect(body.data?.sourceLabel).toContain("Hybrid");
    expect(body.data?.sourceState).toBe("hybrid");
    expect(body.data?.sourceDetail).toMatch(/pillar board is still scaffolded/i);
    expect(body.data?.away?.key).toBe("BOS");
    expect(body.data?.home?.key).toBe("NYK");
  });

  it("uses awayKey and homeKey overrides instead of staying on the demo scenario pair", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    process.env.BALL_DONT_LIE_KEY = "test-key";

    const meta = {
      sourceUsed: "balldontlie" as const,
      updatedAt: "2026-04-12T12:00:00.000Z",
      requestId: "live-team-matchup-override",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };
    const lakers = {
      id: 13,
      conference: "West",
      division: "Pacific",
      city: "Los Angeles",
      name: "Lakers",
      full_name: "Los Angeles Lakers",
      abbreviation: "LAL",
    };
    const warriors = {
      id: 10,
      conference: "West",
      division: "Pacific",
      city: "Golden State",
      name: "Warriors",
      full_name: "Golden State Warriors",
      abbreviation: "GSW",
    };

    vi.doMock("@/lib/providers/balldontlie", () => ({
      currentNbaSeason: () => 2025,
      isBallDontLieConfigured: () => true,
      findBestNbaPlayerMatch: async () => ({ data: null, meta }),
      findNbaTeamByKey: async () => ({ data: null, meta }),
      getNbaPlayerSeasonStats: async () => ({ data: [], meta }),
      getNbaTeamSeasonGames: async (teamId: number) => ({
        data: teamId === lakers.id
          ? [
              {
                id: 1,
                date: "2026-04-10",
                season: 2025,
                status: "Final",
                period: 4,
                time: "Final",
                postseason: false,
                postponed: false,
                home_team_score: 119,
                visitor_team_score: 112,
                datetime: "2026-04-10T23:00:00.000Z",
                home_team: lakers,
                visitor_team: warriors,
              },
            ]
          : [
              {
                id: 1,
                date: "2026-04-10",
                season: 2025,
                status: "Final",
                period: 4,
                time: "Final",
                postseason: false,
                postponed: false,
                home_team_score: 119,
                visitor_team_score: 112,
                datetime: "2026-04-10T23:00:00.000Z",
                home_team: lakers,
                visitor_team: warriors,
              },
              {
                id: 2,
                date: "2026-04-14",
                season: 2025,
                status: "Scheduled",
                period: 0,
                time: "10:00 PM ET",
                postseason: false,
                postponed: false,
                home_team_score: 0,
                visitor_team_score: 0,
                datetime: "2026-04-14T23:30:00.000Z",
                home_team: warriors,
                visitor_team: lakers,
              },
            ],
        meta,
      }),
      getNbaTeams: async () => ({ data: [lakers, warriors], meta }),
    }));

    const mod = await import("@/app/api/widgets/nba-team-matchup-profile/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-team-matchup-profile?mode=advanced&dataMode=live&scenario=bos-at-nyk&awayKey=LAL&homeKey=GSW"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("balldontlie");
    expect(body.data?.away?.key).toBe("LAL");
    expect(body.data?.home?.key).toBe("GSW");
    expect(body.data?.away?.name).toBe("Los Angeles Lakers");
    expect(body.data?.home?.name).toBe("Golden State Warriors");
  });

  it("rejects invalid away/home key formats", async () => {
    const mod = await import("@/app/api/widgets/nba-team-matchup-profile/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-team-matchup-profile?mode=advanced&awayKey=LAL1&homeKey=GSW"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/awayKey and homeKey/i);
  });

  it("falls back to API-Sports team context before demo when BALLDONTLIE fails", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    process.env.BALL_DONT_LIE_KEY = "test-key";
    process.env.SPORTS_API_KEY = "live-nba-api-key-2025xx";
    process.env.NBA_LEAGUE_ID = "12";
    process.env.NBA_SEASON = "2025";

    vi.doMock("@/lib/providers/balldontlie", () => ({
      currentNbaSeason: () => 2025,
      isBallDontLieConfigured: () => true,
      findBestNbaPlayerMatch: async () => ({ data: null, meta: null }),
      findNbaTeamByKey: async () => {
        throw new Error("BALLDONTLIE 429: rate limit");
      },
      getNbaPlayerSeasonStats: async () => ({ data: [], meta: null }),
      getNbaTeamSeasonGames: async () => {
        throw new Error("BALLDONTLIE 429: rate limit");
      },
      getNbaTeams: async () => ({ data: [], meta: null }),
    }));

    vi.doMock("@/lib/providers/apiSports/teamAdvanced", () => ({
      getTeamsAdvanced: async () => ({
        data: {
          sport: "nba",
          teams: [
            {
              teamKey: "BOS",
              teamName: "Boston Celtics",
              status: { sport: "nba", teamKey: "BOS", hasGameToday: false },
              nextGame: { when: "2026-04-15T00:00:00.000Z", vs: "NYK", homeAway: "away" },
              record: { wins: 58, losses: 24, streak: "W3", last10: "8-2" },
              standings: { rank: "2", division: "Atlantic", conference: "East" },
              lastGame: { when: "2026-04-12T00:00:00.000Z", vs: "MIA", result: "W", score: "112-106" },
              metaNotes: [],
            },
            {
              teamKey: "NYK",
              teamName: "New York Knicks",
              status: { sport: "nba", teamKey: "NYK", hasGameToday: false },
              nextGame: { when: "2026-04-15T00:00:00.000Z", vs: "BOS", homeAway: "home" },
              record: { wins: 50, losses: 32, streak: "L1", last10: "6-4" },
              standings: { rank: "4", division: "Atlantic", conference: "East" },
              lastGame: { when: "2026-04-11T00:00:00.000Z", vs: "CHI", result: "W", score: "118-109" },
              metaNotes: [],
            },
          ],
        },
        meta: {
          sourceUsed: "apiSports" as const,
          updatedAt: "2026-04-12T12:00:00.000Z",
          requestId: "api-matchup",
          dataMode: "live" as const,
          dataModeEffective: "live" as const,
        },
      }),
    }));

    const mod = await import("@/app/api/widgets/nba-team-matchup-profile/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-team-matchup-profile?mode=advanced&dataMode=live&scenario=bos-at-nyk"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("apiSports");
    expect(body.data?.sourceState).toBe("hybrid");
    expect(body.data?.sourceDetail).toMatch(/API-Sports NBA/i);
    expect(body.data?.away?.key).toBe("BOS");
    expect(body.data?.home?.key).toBe("NYK");
  });

  it("preserves hybrid matchup context on cache-bust refresh when the fresh BALLDONTLIE path fails", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    process.env.BALL_DONT_LIE_KEY = "test-key";

    const meta = {
      sourceUsed: "balldontlie" as const,
      updatedAt: "2026-04-12T12:00:00.000Z",
      requestId: "cached-team-matchup",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
      cacheHit: true,
    };
    const awayTeam = {
      id: 2,
      conference: "East",
      division: "Atlantic",
      city: "Boston",
      name: "Celtics",
      full_name: "Boston Celtics",
      abbreviation: "BOS",
    };
    const homeTeam = {
      id: 20,
      conference: "East",
      division: "Atlantic",
      city: "New York",
      name: "Knicks",
      full_name: "New York Knicks",
      abbreviation: "NYK",
    };

    vi.doMock("@/lib/providers/balldontlie", () => ({
      currentNbaSeason: () => 2025,
      isBallDontLieConfigured: () => true,
      findBestNbaPlayerMatch: async () => ({ data: null, meta }),
      findNbaTeamByKey: async () => ({ data: null, meta }),
      getNbaPlayerSeasonStats: async () => ({ data: [], meta }),
      getNbaTeamSeasonGames: async (teamId: number) => ({
        data: teamId === awayTeam.id
          ? [
              {
                id: 1,
                date: "2026-04-10",
                season: 2025,
                status: "Final",
                period: 4,
                time: "Final",
                postseason: false,
                postponed: false,
                home_team_score: 112,
                visitor_team_score: 106,
                datetime: "2026-04-10T23:00:00.000Z",
                home_team: awayTeam,
                visitor_team: homeTeam,
              },
              {
                id: 2,
                date: "2026-04-14",
                season: 2025,
                status: "Scheduled",
                period: 0,
                time: "7:30 PM ET",
                postseason: false,
                postponed: false,
                home_team_score: 0,
                visitor_team_score: 0,
                datetime: "2026-04-14T23:30:00.000Z",
                home_team: homeTeam,
                visitor_team: awayTeam,
              },
            ]
          : [
              {
                id: 1,
                date: "2026-04-10",
                season: 2025,
                status: "Final",
                period: 4,
                time: "Final",
                postseason: false,
                postponed: false,
                home_team_score: 112,
                visitor_team_score: 106,
                datetime: "2026-04-10T23:00:00.000Z",
                home_team: awayTeam,
                visitor_team: homeTeam,
              },
              {
                id: 3,
                date: "2026-04-12",
                season: 2025,
                status: "Final",
                period: 4,
                time: "Final",
                postseason: false,
                postponed: false,
                home_team_score: 109,
                visitor_team_score: 101,
                datetime: "2026-04-12T23:00:00.000Z",
                home_team: homeTeam,
                visitor_team: {
                  id: 14,
                  conference: "East",
                  division: "Central",
                  city: "Miami",
                  name: "Heat",
                  full_name: "Miami Heat",
                  abbreviation: "MIA",
                },
              },
            ],
        meta,
      }),
      getNbaTeams: async (_mode: string, cacheBust?: string) => {
        if (cacheBust) {
          throw new Error("BALLDONTLIE 429: rate limit");
        }
        return { data: [awayTeam, homeTeam], meta };
      },
    }));

    const mod = await import("@/app/api/widgets/nba-team-matchup-profile/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-team-matchup-profile?mode=advanced&dataMode=live&scenario=bos-at-nyk&cacheBust=1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("balldontlie");
    expect(body.data?.sourceState).toBe("hybrid");
    expect(body.data?.away?.key).toBe("BOS");
    expect(body.data?.home?.key).toBe("NYK");
    expect(body.meta?.warning).toMatch(/last-known real data/i);
  });
});
