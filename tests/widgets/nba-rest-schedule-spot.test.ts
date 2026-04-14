import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

afterEach(() => {
  vi.doUnmock("@/lib/providers/balldontlie");
  delete process.env.BALL_DONT_LIE_KEY;
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
                date: "2026-04-13",
                season: 2025,
                status: "Scheduled",
                period: 0,
                time: "8:00 PM ET",
                postseason: false,
                postponed: false,
                home_team_score: 0,
                visitor_team_score: 0,
                datetime: "2026-04-13T00:00:00.000Z",
                home_team: wolves,
                visitor_team: suns,
              },
              {
                id: 3,
                date: "2026-04-15",
                season: 2025,
                status: "Scheduled",
                period: 0,
                time: "9:00 PM ET",
                postseason: false,
                postponed: false,
                home_team_score: 0,
                visitor_team_score: 0,
                datetime: "2026-04-15T00:00:00.000Z",
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
                date: "2026-04-13",
                season: 2025,
                status: "Scheduled",
                period: 0,
                time: "8:00 PM ET",
                postseason: false,
                postponed: false,
                home_team_score: 0,
                visitor_team_score: 0,
                datetime: "2026-04-13T00:00:00.000Z",
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
    expect(body.data?.team?.key).toBe("MIN");
    expect(body.data?.opponent?.key).toBe("PHX");
  });
});
