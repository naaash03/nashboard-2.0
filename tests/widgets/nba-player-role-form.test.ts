import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

afterEach(() => {
  vi.doUnmock("@/lib/providers/balldontlie");
  delete process.env.BALL_DONT_LIE_KEY;
});

describe("NBA player role + form route", () => {
  it("returns a demo-backed player role scaffold", async () => {
    const mod = await import("@/app/api/widgets/nba-player-role-form/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-player-role-form?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("demo");
    expect(body.meta?.dataMode).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      summary: expect.any(String),
      selectedScenarioId: expect.any(String),
      availableScenarios: expect.any(Array),
      sourceLabel: expect.any(String),
    }));
    expect(body.data.player).toEqual(expect.objectContaining({
      fullName: expect.any(String),
      teamName: expect.any(String),
      role: expect.any(String),
    }));
    expect(body.data.metrics.length).toBeGreaterThan(0);
    expect(body.data.roleSignals.length).toBeGreaterThan(0);
    expect(body.data.recentGames.length).toBeGreaterThan(0);
  });

  it("returns live player role data when a player is selected", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    process.env.BALL_DONT_LIE_KEY = "test-key";

    const meta = {
      sourceUsed: "balldontlie" as const,
      updatedAt: "2026-04-12T12:00:00.000Z",
      requestId: "live-player-role",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };
    const player = {
      id: 115,
      first_name: "Stephen",
      last_name: "Curry",
      position: "G",
      jersey_number: "30",
      team: {
        id: 10,
        conference: "West",
        division: "Pacific",
        city: "Golden State",
        name: "Warriors",
        full_name: "Golden State Warriors",
        abbreviation: "GSW",
      },
    };

    vi.doMock("@/lib/providers/balldontlie", () => ({
      currentNbaSeason: () => 2025,
      isBallDontLieConfigured: () => true,
      findBestNbaPlayerMatch: async () => ({ data: player, meta }),
      findNbaTeamByKey: async () => ({ data: null, meta }),
      getNbaPlayerSeasonStats: async () => ({
        data: [
          {
            id: 1,
            min: "34",
            fgm: 10,
            fga: 20,
            fg_pct: 0.5,
            fg3m: 5,
            fg3a: 11,
            fg3_pct: 0.455,
            ftm: 6,
            fta: 6,
            ft_pct: 1,
            oreb: 0,
            dreb: 4,
            reb: 4,
            ast: 8,
            stl: 1,
            blk: 0,
            turnover: 2,
            pf: 2,
            pts: 31,
            plus_minus: 8,
            team: player.team,
            game: {
              id: 201,
              date: "2026-04-10",
              season: 2025,
              status: "Final",
              period: 4,
              postseason: false,
              home_team_id: 10,
              visitor_team_id: 14,
              home_team_score: 118,
              visitor_team_score: 112,
            },
          },
          {
            id: 2,
            min: "36",
            fgm: 11,
            fga: 21,
            fg_pct: 0.524,
            fg3m: 6,
            fg3a: 12,
            fg3_pct: 0.5,
            ftm: 5,
            fta: 5,
            ft_pct: 1,
            oreb: 0,
            dreb: 5,
            reb: 5,
            ast: 7,
            stl: 2,
            blk: 0,
            turnover: 3,
            pf: 1,
            pts: 33,
            plus_minus: 10,
            team: player.team,
            game: {
              id: 202,
              date: "2026-04-08",
              season: 2025,
              status: "Final",
              period: 4,
              postseason: false,
              home_team_id: 21,
              visitor_team_id: 10,
              home_team_score: 110,
              visitor_team_score: 120,
            },
          },
        ],
        meta,
      }),
      getNbaTeamSeasonGames: async () => ({ data: [], meta }),
      getNbaTeams: async () => ({
        data: [
          player.team,
          {
            id: 14,
            conference: "West",
            division: "Pacific",
            city: "Los Angeles",
            name: "Lakers",
            full_name: "Los Angeles Lakers",
            abbreviation: "LAL",
          },
          {
            id: 21,
            conference: "West",
            division: "Northwest",
            city: "Oklahoma City",
            name: "Thunder",
            full_name: "Oklahoma City Thunder",
            abbreviation: "OKC",
          },
        ],
        meta,
      }),
    }));

    const mod = await import("@/app/api/widgets/nba-player-role-form/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nba-player-role-form?mode=advanced&dataMode=live&playerName=Stephen%20Curry&playerTeamKey=GSW"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("balldontlie");
    expect(body.data?.sourceLabel).toContain("Live");
    expect(body.data?.player?.fullName).toBe("Stephen Curry");
    expect(body.data?.metrics.length).toBeGreaterThan(0);
  });
});
