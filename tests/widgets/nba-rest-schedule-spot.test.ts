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

describe("NBA rest / schedule spot route", () => {
  it("returns a demo-backed rest spot scaffold", async () => {
    const mod = await import("@/app/api/widgets/nba-rest-schedule-spot/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-rest-schedule-spot?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("demo");
    expect(body.meta?.dataMode).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      spotLabel: expect.any(String),
      signal: expect.any(String),
      summary: expect.any(String),
      selectedScenarioId: expect.any(String),
      availableScenarios: expect.any(Array),
      sourceState: "demo",
      sourceDetail: expect.any(String),
    }));
    expect(body.data.factors.length).toBeGreaterThan(0);
    expect(body.data.recentWindow.length).toBeGreaterThan(0);
    expect(body.data.nextWindow.length).toBeGreaterThan(0);
  });

  it("returns live schedule context for a selected team key", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    process.env.BALL_DONT_LIE_KEY = "test-key";

    const meta = {
      sourceUsed: "balldontlie" as const,
      updatedAt: "2026-04-12T12:00:00.000Z",
      requestId: "live-rest-spot",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };
    const wolves = {
      id: 17,
      conference: "West",
      division: "Northwest",
      city: "Minnesota",
      name: "Timberwolves",
      full_name: "Minnesota Timberwolves",
      abbreviation: "MIN",
    };
    const suns = {
      id: 24,
      conference: "West",
      division: "Pacific",
      city: "Phoenix",
      name: "Suns",
      full_name: "Phoenix Suns",
      abbreviation: "PHX",
    };

    vi.doMock("@/lib/providers/balldontlie", () => ({
      currentNbaSeason: () => 2025,
      isBallDontLieConfigured: () => true,
      findBestNbaPlayerMatch: async () => ({ data: null, meta }),
      findNbaTeamByKey: async () => ({ data: wolves, meta }),
      getNbaPlayerSeasonStats: async () => ({ data: [], meta }),
      getNbaTeamSeasonGames: async (teamId: number) => ({
        data: teamId === wolves.id
          ? [
              {
                id: 1,
                date: "2026-04-09",
                season: 2025,
                status: "Final",
                period: 4,
                time: "Final",
                postseason: false,
                postponed: false,
                home_team_score: 118,
                visitor_team_score: 104,
                datetime: "2026-04-09T23:00:00.000Z",
                home_team: wolves,
                visitor_team: {
                  id: 30,
                  conference: "West",
                  division: "Northwest",
                  city: "Utah",
                  name: "Jazz",
                  full_name: "Utah Jazz",
                  abbreviation: "UTA",
                },
              },
              {
                id: 2,
                date: "2099-04-13",
                season: 2025,
                status: "Scheduled",
                period: 0,
                time: "8:00 PM ET",
                postseason: false,
                postponed: false,
                home_team_score: 0,
                visitor_team_score: 0,
                datetime: "2099-04-13T00:00:00.000Z",
                home_team: wolves,
                visitor_team: suns,
              },
              {
                id: 3,
                date: "2099-04-15",
                season: 2025,
                status: "Scheduled",
                period: 0,
                time: "9:00 PM ET",
                postseason: false,
                postponed: false,
                home_team_score: 0,
                visitor_team_score: 0,
                datetime: "2099-04-15T00:00:00.000Z",
                home_team: {
                  id: 21,
                  conference: "West",
                  division: "Northwest",
                  city: "Oklahoma City",
                  name: "Thunder",
                  full_name: "Oklahoma City Thunder",
                  abbreviation: "OKC",
                },
                visitor_team: wolves,
              },
            ]
          : [
              {
                id: 4,
                date: "2026-04-12",
                season: 2025,
                status: "Final",
                period: 4,
                time: "Final",
                postseason: false,
                postponed: false,
                home_team_score: 111,
                visitor_team_score: 108,
                datetime: "2026-04-12T23:00:00.000Z",
                home_team: suns,
                visitor_team: {
                  id: 13,
                  conference: "West",
                  division: "Pacific",
                  city: "Los Angeles",
                  name: "Lakers",
                  full_name: "Los Angeles Lakers",
                  abbreviation: "LAL",
                },
              },
              {
                id: 2,
                date: "2099-04-13",
                season: 2025,
                status: "Scheduled",
                period: 0,
                time: "8:00 PM ET",
                postseason: false,
                postponed: false,
                home_team_score: 0,
                visitor_team_score: 0,
                datetime: "2099-04-13T00:00:00.000Z",
                home_team: wolves,
                visitor_team: suns,
              },
            ],
        meta,
      }),
      getNbaTeams: async () => ({ data: [wolves, suns], meta }),
    }));

    const mod = await import("@/app/api/widgets/nba-rest-schedule-spot/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-rest-schedule-spot?mode=advanced&dataMode=live&teamKey=MIN"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("balldontlie");
    expect(body.data?.sourceLabel).toContain("Live");
    expect(body.data?.sourceState).toBe("live");
    expect(body.data?.sourceDetail).toMatch(/BALLDONTLIE/i);
    expect(body.data?.team?.key).toBe("MIN");
    expect(body.data?.opponent?.key).toBe("PHX");
  });

  it("returns an explicit sparse live state when no upcoming game is posted", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    process.env.BALL_DONT_LIE_KEY = "test-key";

    const meta = {
      sourceUsed: "balldontlie" as const,
      updatedAt: "2026-04-12T12:00:00.000Z",
      requestId: "live-rest-sparse",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };
    const wolves = {
      id: 17,
      conference: "West",
      division: "Northwest",
      city: "Minnesota",
      name: "Timberwolves",
      full_name: "Minnesota Timberwolves",
      abbreviation: "MIN",
    };

    vi.doMock("@/lib/providers/balldontlie", () => ({
      currentNbaSeason: () => 2025,
      isBallDontLieConfigured: () => true,
      findBestNbaPlayerMatch: async () => ({ data: null, meta }),
      findNbaTeamByKey: async () => ({ data: wolves, meta }),
      getNbaPlayerSeasonStats: async () => ({ data: [], meta }),
      getNbaTeamSeasonGames: async () => ({
        data: [
          {
            id: 1,
            date: "2026-04-09",
            season: 2025,
            status: "Final",
            period: 4,
            time: "Final",
            postseason: false,
            postponed: false,
            home_team_score: 118,
            visitor_team_score: 104,
            datetime: "2026-04-09T23:00:00.000Z",
            home_team: wolves,
            visitor_team: {
              id: 30,
              conference: "West",
              division: "Northwest",
              city: "Utah",
              name: "Jazz",
              full_name: "Utah Jazz",
              abbreviation: "UTA",
            },
          },
        ],
        meta,
      }),
      getNbaTeams: async () => ({ data: [wolves], meta }),
    }));

    const mod = await import("@/app/api/widgets/nba-rest-schedule-spot/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-rest-schedule-spot?mode=advanced&dataMode=live&teamKey=MIN"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("balldontlie");
    expect(body.data?.sourceState).toBe("partial");
    expect(body.data?.sourceLabel).toContain("sparse");
    expect(body.data?.opponent?.name).toContain("No upcoming opponent");
  });

  it("falls back to API-Sports live schedule context before demo when BALLDONTLIE fails", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    process.env.BALL_DONT_LIE_KEY = "test-key";
    process.env.SPORTS_API_KEY = "live-nba-api-key-2025xx";
    process.env.NBA_LEAGUE_ID = "12";
    process.env.NBA_SEASON = "2025";

    vi.doMock("@/lib/providers/balldontlie", () => ({
      currentNbaSeason: () => 2025,
      isBallDontLieConfigured: () => true,
      findBestNbaPlayerMatch: async () => {
        throw new Error("BALLDONTLIE 429: rate limit");
      },
      findNbaTeamByKey: async () => {
        throw new Error("BALLDONTLIE 429: rate limit");
      },
      getNbaPlayerSeasonStats: async () => {
        throw new Error("BALLDONTLIE 429: rate limit");
      },
      getNbaTeamSeasonGames: async () => {
        throw new Error("BALLDONTLIE 429: rate limit");
      },
      getNbaTeams: async () => {
        throw new Error("BALLDONTLIE 429: rate limit");
      },
    }));

    vi.doMock("@/lib/providers/apiSports/teamAdvanced", () => ({
      getTeamsAdvanced: async (_sport: string, teamRefsOrKeys: Array<{ teamKey: string } | string>) => {
        const refs = teamRefsOrKeys.map((item) => typeof item === "string" ? item : item.teamKey);
        return {
          data: {
            sport: "nba",
            teams: refs.includes("MIN")
              ? [
                  {
                    teamKey: "MIN",
                    teamName: "Minnesota Timberwolves",
                    status: { sport: "nba", teamKey: "MIN", hasGameToday: false },
                    nextGame: { when: "2026-04-15T00:00:00.000Z", vs: "PHX", homeAway: "home" },
                    record: { wins: 52, losses: 30, streak: "W2", last10: "7-3" },
                    standings: { rank: "3", division: "Northwest", conference: "West" },
                    lastGame: { when: "2026-04-12T00:00:00.000Z", vs: "UTA", result: "W", score: "118-104" },
                    metaNotes: [],
                  },
                  {
                    teamKey: "PHX",
                    teamName: "Phoenix Suns",
                    status: { sport: "nba", teamKey: "PHX", hasGameToday: false },
                    nextGame: { when: "2026-04-15T00:00:00.000Z", vs: "MIN", homeAway: "away" },
                    record: { wins: 46, losses: 36, streak: "L1", last10: "5-5" },
                    standings: { rank: "7", division: "Pacific", conference: "West" },
                    lastGame: { when: "2026-04-13T00:00:00.000Z", vs: "LAL", result: "L", score: "108-111" },
                    metaNotes: [],
                  },
                ]
              : [
                  {
                    teamKey: "PHX",
                    teamName: "Phoenix Suns",
                    status: { sport: "nba", teamKey: "PHX", hasGameToday: false },
                    nextGame: { when: "2026-04-15T00:00:00.000Z", vs: "MIN", homeAway: "away" },
                    record: { wins: 46, losses: 36, streak: "L1", last10: "5-5" },
                    standings: { rank: "7", division: "Pacific", conference: "West" },
                    lastGame: { when: "2026-04-13T00:00:00.000Z", vs: "LAL", result: "L", score: "108-111" },
                    metaNotes: [],
                  },
                ],
          },
          meta: {
            sourceUsed: "apiSports" as const,
            updatedAt: "2026-04-12T12:00:00.000Z",
            requestId: "api-sports-rest",
            dataMode: "live" as const,
            dataModeEffective: "live" as const,
          },
        };
      },
    }));

    const mod = await import("@/app/api/widgets/nba-rest-schedule-spot/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-rest-schedule-spot?mode=advanced&dataMode=live&teamKey=MIN"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("apiSports");
    expect(body.data?.sourceState).toBe("partial");
    expect(body.data?.sourceDetail).toMatch(/API-Sports NBA/i);
    expect(body.data?.team?.key).toBe("MIN");
    expect(body.data?.opponent?.key).toBe("PHX");
  });

  it("preserves live schedule context on cache-bust refresh when the fresh BALLDONTLIE path fails", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    process.env.BALL_DONT_LIE_KEY = "test-key";

    const meta = {
      sourceUsed: "balldontlie" as const,
      updatedAt: "2026-04-12T12:00:00.000Z",
      requestId: "cached-rest-spot",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
      cacheHit: true,
    };
    const wolves = {
      id: 17,
      conference: "West",
      division: "Northwest",
      city: "Minnesota",
      name: "Timberwolves",
      full_name: "Minnesota Timberwolves",
      abbreviation: "MIN",
    };
    const suns = {
      id: 24,
      conference: "West",
      division: "Pacific",
      city: "Phoenix",
      name: "Suns",
      full_name: "Phoenix Suns",
      abbreviation: "PHX",
    };

    vi.doMock("@/lib/providers/balldontlie", () => ({
      currentNbaSeason: () => 2025,
      isBallDontLieConfigured: () => true,
      findBestNbaPlayerMatch: async () => ({ data: null, meta }),
      findNbaTeamByKey: async (_teamKey: string, _mode: string, cacheBust?: string) => {
        if (cacheBust) {
          throw new Error("BALLDONTLIE 429: rate limit");
        }
        return { data: wolves, meta };
      },
      getNbaPlayerSeasonStats: async () => ({ data: [], meta }),
      getNbaTeamSeasonGames: async (teamId: number) => ({
        data: teamId === wolves.id
          ? [
              {
                id: 1,
                date: "2026-04-09",
                season: 2025,
                status: "Final",
                period: 4,
                time: "Final",
                postseason: false,
                postponed: false,
                home_team_score: 118,
                visitor_team_score: 104,
                datetime: "2026-04-09T23:00:00.000Z",
                home_team: wolves,
                visitor_team: {
                  id: 30,
                  conference: "West",
                  division: "Northwest",
                  city: "Utah",
                  name: "Jazz",
                  full_name: "Utah Jazz",
                  abbreviation: "UTA",
                },
              },
              {
                id: 2,
                date: "2099-04-13",
                season: 2025,
                status: "Scheduled",
                period: 0,
                time: "8:00 PM ET",
                postseason: false,
                postponed: false,
                home_team_score: 0,
                visitor_team_score: 0,
                datetime: "2099-04-13T00:00:00.000Z",
                home_team: wolves,
                visitor_team: suns,
              },
            ]
          : [
              {
                id: 2,
                date: "2099-04-13",
                season: 2025,
                status: "Scheduled",
                period: 0,
                time: "8:00 PM ET",
                postseason: false,
                postponed: false,
                home_team_score: 0,
                visitor_team_score: 0,
                datetime: "2099-04-13T00:00:00.000Z",
                home_team: wolves,
                visitor_team: suns,
              },
              {
                id: 4,
                date: "2026-04-12",
                season: 2025,
                status: "Final",
                period: 4,
                time: "Final",
                postseason: false,
                postponed: false,
                home_team_score: 111,
                visitor_team_score: 108,
                datetime: "2026-04-12T23:00:00.000Z",
                home_team: suns,
                visitor_team: {
                  id: 13,
                  conference: "West",
                  division: "Pacific",
                  city: "Los Angeles",
                  name: "Lakers",
                  full_name: "Los Angeles Lakers",
                  abbreviation: "LAL",
                },
              },
            ],
        meta,
      }),
      getNbaTeams: async () => ({ data: [wolves, suns], meta }),
    }));

    const mod = await import("@/app/api/widgets/nba-rest-schedule-spot/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-rest-schedule-spot?mode=advanced&dataMode=live&teamKey=MIN&cacheBust=1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("balldontlie");
    expect(body.data?.sourceState).toBe("live");
    expect(body.data?.team?.key).toBe("MIN");
    expect(body.data?.opponent?.key).toBe("PHX");
    expect(body.meta?.warning).toMatch(/last-known real data/i);
  });
});
