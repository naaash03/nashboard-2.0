import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

afterEach(() => {
  vi.doUnmock("@/lib/providers/balldontlie");
  delete process.env.BALL_DONT_LIE_KEY;
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
    expect(body.data?.sourceLabel).toContain("Live");
    expect(body.data?.away?.key).toBe("BOS");
    expect(body.data?.home?.key).toBe("NYK");
  });
});
