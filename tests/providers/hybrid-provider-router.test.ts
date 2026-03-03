import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  apiSearchPlayers: vi.fn(),
  apiGetPlayerProfile: vi.fn(),
  apiGetPlayerInsights: vi.fn(),
  apiSearchTeams: vi.fn(),
  apiGetTeamsAdvanced: vi.fn(),
  espnSearchPlayers: vi.fn(),
  espnGetPlayerProfile: vi.fn(),
  espnGetPlayerInsights: vi.fn(),
  espnSearchTeams: vi.fn(),
  espnGetTeamsAdvanced: vi.fn(),
}));

vi.mock("@/lib/providers/apiSports/playerDirectory", () => ({
  searchPlayers: hoisted.apiSearchPlayers,
  getPlayerProfile: hoisted.apiGetPlayerProfile,
}));

vi.mock("@/lib/providers/apiSports/playerInsights", () => ({
  getPlayerInsights: hoisted.apiGetPlayerInsights,
}));

vi.mock("@/lib/providers/apiSports/teamDirectory", () => ({
  searchTeams: hoisted.apiSearchTeams,
}));

vi.mock("@/lib/providers/apiSports/teamAdvanced", () => ({
  getTeamsAdvanced: hoisted.apiGetTeamsAdvanced,
}));

vi.mock("@/lib/providers/espn/playerDirectory", () => ({
  searchPlayers: hoisted.espnSearchPlayers,
  getPlayerProfile: hoisted.espnGetPlayerProfile,
}));

vi.mock("@/lib/providers/espn/playerInsights", () => ({
  getPlayerInsights: hoisted.espnGetPlayerInsights,
}));

vi.mock("@/lib/providers/espn/teamDirectory", () => ({
  searchTeams: hoisted.espnSearchTeams,
}));

vi.mock("@/lib/providers/espn/teamAdvanced", () => ({
  getTeamsAdvanced: hoisted.espnGetTeamsAdvanced,
}));

function loadFixture<T>(fixturePath: string): T {
  return JSON.parse(readFileSync(fixturePath, "utf8").replace(/^\uFEFF/, "")) as T;
}

describe("hybrid provider precedence", () => {
  beforeEach(() => {
    vi.resetModules();

    hoisted.apiSearchPlayers.mockReset();
    hoisted.apiGetPlayerProfile.mockReset();
    hoisted.apiGetPlayerInsights.mockReset();
    hoisted.apiSearchTeams.mockReset();
    hoisted.apiGetTeamsAdvanced.mockReset();
    hoisted.espnSearchPlayers.mockReset();
    hoisted.espnGetPlayerProfile.mockReset();
    hoisted.espnGetPlayerInsights.mockReset();
    hoisted.espnSearchTeams.mockReset();
    hoisted.espnGetTeamsAdvanced.mockReset();

    hoisted.apiGetPlayerInsights.mockResolvedValue({
      data: null,
      meta: {
        sourceUsed: "apiSports",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: "api-insights",
        dataMode: "live",
      },
    });
    hoisted.apiSearchTeams.mockResolvedValue({
      data: [],
      meta: {
        sourceUsed: "apiSports",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: "api-teams",
        dataMode: "live",
      },
    });
    hoisted.apiGetTeamsAdvanced.mockResolvedValue({
      data: { sport: "mlb", teams: [] },
      meta: {
        sourceUsed: "apiSports",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: "api-advanced",
        dataMode: "live",
      },
    });
    hoisted.espnGetPlayerInsights.mockResolvedValue({
      data: null,
      meta: {
        sourceUsed: "espn",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: "espn-insights",
        dataMode: "live",
      },
    });
    hoisted.espnSearchTeams.mockResolvedValue({
      data: [],
      meta: {
        sourceUsed: "espn",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: "espn-teams",
        dataMode: "live",
      },
    });
    hoisted.espnGetTeamsAdvanced.mockResolvedValue({
      data: { sport: "mlb", teams: [] },
      meta: {
        sourceUsed: "espn",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: "espn-advanced",
        dataMode: "live",
      },
    });
  });

  it("uses API-Sports when it returns complete search results", async () => {
    hoisted.apiSearchPlayers.mockResolvedValue({
      data: [
        {
          playerId: "40286",
          fullName: "Juan Soto",
          teamName: "New York Mets",
          position: "RF",
          headshot: "https://example.test/soto.png",
        },
      ],
      meta: {
        sourceUsed: "apiSports",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: "api-search",
        dataMode: "live",
      },
    });

    hoisted.espnSearchPlayers.mockResolvedValue({
      data: [],
      meta: {
        sourceUsed: "espn",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: "espn-search",
        dataMode: "live",
      },
    });

    const { resolvePlayersSearch } = await import("@/lib/providers");
    const result = await resolvePlayersSearch("mlb", "soto", 8, { dataMode: "auto", cacheBust: "refresh-1" });

    expect(result.error).toBeUndefined();
    expect(result.meta.sourceUsed).toBe("apiSports");
    expect(result.meta.attemptedSources).toEqual(["apiSports"]);
    expect(hoisted.apiSearchPlayers).toHaveBeenCalledTimes(1);
    expect(hoisted.espnSearchPlayers).not.toHaveBeenCalled();
  });

  it("hydrates incomplete API-Sports profile with ESPN profile fields", async () => {
    hoisted.apiGetPlayerProfile.mockResolvedValue({
      data: {
        playerId: "40286",
        fullName: "Juan Soto",
      },
      meta: {
        sourceUsed: "apiSports",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: "api-profile",
        dataMode: "live",
      },
    });

    hoisted.espnGetPlayerProfile.mockResolvedValue({
      data: {
        playerId: "40286",
        fullName: "Juan Soto",
        teamName: "New York Mets",
        position: "RF",
        headshot: "https://example.test/soto.png",
      },
      meta: {
        sourceUsed: "espn",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: "espn-profile",
        dataMode: "live",
      },
    });

    const { resolvePlayerProfile } = await import("@/lib/providers");
    const result = await resolvePlayerProfile("mlb", "40286", { dataMode: "auto", cacheBust: "refresh-2" });

    expect(result.error).toBeUndefined();
    expect(result.data?.teamName).toBe("New York Mets");
    expect(result.data?.position).toBe("RF");
    expect(result.meta.hydrationUsed).toBe(true);
    expect(result.meta.attemptedSources).toEqual(["apiSports", "espn"]);
    expect(hoisted.apiGetPlayerProfile).toHaveBeenCalledTimes(1);
    expect(hoisted.espnGetPlayerProfile).toHaveBeenCalledTimes(1);
  });

  it("falls back to fixture when API-Sports and ESPN search are empty", async () => {
    hoisted.apiSearchPlayers.mockResolvedValue({
      data: [],
      meta: {
        sourceUsed: "apiSports",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: "api-empty",
        dataMode: "live",
      },
    });

    hoisted.espnSearchPlayers.mockImplementation(async (_sport: string, _query: string, dataMode: string) => {
      if (dataMode === "fixture") {
        return {
          data: [
            {
              playerId: "40286",
              fullName: "Juan Soto",
              teamName: "New York Mets",
              position: "RF",
            },
          ],
          meta: {
            sourceUsed: "fixture",
            updatedAt: "2026-03-02T00:00:00.000Z",
            requestId: "fixture-search",
            dataMode: "fixture",
          },
        };
      }
      return {
        data: [],
        meta: {
          sourceUsed: "espn",
          updatedAt: "2026-03-02T00:00:00.000Z",
          requestId: "espn-empty",
          dataMode: "live",
        },
      };
    });

    const { resolvePlayersSearch } = await import("@/lib/providers");
    const result = await resolvePlayersSearch("mlb", "soto", 8, { dataMode: "auto", cacheBust: "refresh-3" });

    expect(result.error).toBeUndefined();
    expect(result.data?.[0]?.fullName).toBe("Juan Soto");
    expect(result.meta.sourceUsed).toBe("fixture");
    expect(result.meta.dataModeEffective).toBe("fixture");
    expect(result.meta.attemptedSources).toEqual(["apiSports", "espn", "fixture"]);
  });

  it("enriches API-Sports advanced insights with ESPN when sections are missing", async () => {
    const apiMinimal = loadFixture("tests/fixtures/hybrid/apiSports/player_insights_minimal.json");
    const espnEnriched = loadFixture("tests/fixtures/hybrid/espn/player_insights_enriched.json");
    const expected = loadFixture<{ season: { metrics: unknown[] }; recent: { games: unknown[] } }>("tests/fixtures/hybrid/merged/player_insights_expected.json");

    hoisted.apiGetPlayerInsights.mockResolvedValue({
      data: apiMinimal,
      meta: {
        sourceUsed: "apiSports",
        updatedAt: "2026-03-03T00:00:00.000Z",
        requestId: "api-insights-minimal",
        dataMode: "live",
      },
    });

    hoisted.espnGetPlayerInsights.mockResolvedValue({
      data: espnEnriched,
      meta: {
        sourceUsed: "espn",
        updatedAt: "2026-03-03T00:00:00.000Z",
        requestId: "espn-insights-enriched",
        dataMode: "live",
      },
    });

    const { resolvePlayerInsights } = await import("@/lib/providers");
    const result = await resolvePlayerInsights("mlb", "40286", "advanced", { dataMode: "auto", cacheBust: "refresh-4" });

    expect(result.error).toBeUndefined();
    expect(result.meta.sourceUsed).toBe("apiSports");
    expect(result.meta.hydrationUsed).toBe(true);
    expect(result.meta.attemptedSources).toEqual(["apiSports", "espn"]);
    expect(result.data?.season?.metrics.length).toBe(expected.season.metrics.length);
    expect(result.data?.recent?.games.length).toBe(expected.recent.games.length);
    expect(hoisted.espnGetPlayerInsights).toHaveBeenCalledWith("mlb", "40286", "advanced", "live", "refresh-4");
    expect(hoisted.espnGetPlayerInsights).toHaveBeenCalledTimes(1);
  });

  it("falls back to fixture insights when API-Sports and ESPN remain incomplete", async () => {
    const apiMinimal = loadFixture("tests/fixtures/hybrid/apiSports/player_insights_minimal.json");
    const fixtureExpected = loadFixture("tests/fixtures/hybrid/merged/player_insights_expected.json");

    hoisted.apiGetPlayerInsights.mockResolvedValue({
      data: apiMinimal,
      meta: {
        sourceUsed: "apiSports",
        updatedAt: "2026-03-03T00:00:00.000Z",
        requestId: "api-insights-minimal",
        dataMode: "live",
      },
    });

    hoisted.espnGetPlayerInsights.mockImplementation(async (_sport: string, _playerId: string, _mode: string, dataMode: string) => {
      if (dataMode === "fixture") {
        return {
          data: fixtureExpected,
          meta: {
            sourceUsed: "fixture",
            updatedAt: "2026-03-03T00:00:00.000Z",
            requestId: "fixture-insights",
            dataMode: "fixture",
          },
        };
      }
      return {
        data: apiMinimal,
        meta: {
          sourceUsed: "espn",
          updatedAt: "2026-03-03T00:00:00.000Z",
          requestId: "espn-insights-still-minimal",
          dataMode: "live",
        },
      };
    });

    const { resolvePlayerInsights } = await import("@/lib/providers");
    const result = await resolvePlayerInsights("mlb", "40286", "advanced", { dataMode: "auto", cacheBust: "refresh-5" });

    expect(result.error).toBeUndefined();
    expect(result.meta.sourceUsed).toBe("fixture");
    expect(result.meta.dataModeEffective).toBe("fixture");
    expect(result.meta.attemptedSources).toEqual(["apiSports", "espn", "fixture"]);
    expect(result.data?.recent?.games.length ?? 0).toBeGreaterThan(0);
    expect(hoisted.espnGetPlayerInsights).toHaveBeenCalledTimes(2);
    expect(hoisted.espnGetPlayerInsights).toHaveBeenNthCalledWith(2, "mlb", "40286", "advanced", "fixture", "refresh-5");
  });

  it("enriches API-Sports team advanced rows with ESPN game context/details", async () => {
    const apiTeamMinimal = loadFixture("tests/fixtures/hybrid/apiSports/team_advanced_minimal.json");
    const espnTeamEnriched = loadFixture("tests/fixtures/hybrid/espn/team_advanced_enriched.json");
    const expected = loadFixture<{ teams: Array<{ status: { hasGameToday: boolean }; standings: unknown; lastGame: unknown }> }>("tests/fixtures/hybrid/merged/team_advanced_expected.json");

    hoisted.apiGetTeamsAdvanced.mockResolvedValue({
      data: apiTeamMinimal,
      meta: {
        sourceUsed: "apiSports",
        updatedAt: "2026-03-03T00:00:00.000Z",
        requestId: "api-team-advanced",
        dataMode: "live",
      },
    });

    hoisted.espnGetTeamsAdvanced.mockResolvedValue({
      data: espnTeamEnriched,
      meta: {
        sourceUsed: "espn",
        updatedAt: "2026-03-03T00:00:00.000Z",
        requestId: "espn-team-advanced",
        dataMode: "live",
      },
    });

    const { resolveTeamAdvanced } = await import("@/lib/providers");
    const result = await resolveTeamAdvanced("nba", ["LAL"], "advanced", { dataMode: "auto", cacheBust: "refresh-6" });

    expect(result.error).toBeUndefined();
    expect(result.meta.sourceUsed).toBe("apiSports");
    expect(result.meta.hydrationUsed).toBe(true);
    expect(result.meta.attemptedSources).toEqual(["apiSports", "espn"]);
    expect(result.data?.teams[0]?.status.hasGameToday).toBe(expected.teams[0].status.hasGameToday);
    expect(Boolean(result.data?.teams[0]?.standings)).toBe(Boolean(expected.teams[0].standings));
    expect(Boolean(result.data?.teams[0]?.lastGame)).toBe(Boolean(expected.teams[0].lastGame));
  });

  it("passes provider team refs to API-Sports team advanced provider when IDs are available", async () => {
    hoisted.apiGetTeamsAdvanced.mockResolvedValue({
      data: {
        sport: "nba",
        teams: [
          {
            teamKey: "LAL",
            teamName: "Los Angeles Lakers",
            status: { sport: "nba", teamKey: "LAL", hasGameToday: false },
            nextGame: null,
            record: null,
            standings: null,
            lastGame: null,
          },
        ],
      },
      meta: {
        sourceUsed: "apiSports",
        updatedAt: "2026-03-03T00:00:00.000Z",
        requestId: "api-team-refs",
        dataMode: "live",
      },
    });

    hoisted.espnGetTeamsAdvanced.mockResolvedValue({
      data: { sport: "nba", teams: [] },
      meta: {
        sourceUsed: "espn",
        updatedAt: "2026-03-03T00:00:00.000Z",
        requestId: "espn-team-refs",
        dataMode: "live",
      },
    });

    const { resolveTeamAdvanced } = await import("@/lib/providers");
    await resolveTeamAdvanced("nba", ["LAL"], "advanced", {
      dataMode: "live",
      cacheBust: "refresh-team-ids",
      teamRefs: [{ teamKey: "LAL", teamName: "Los Angeles Lakers", apiSportsTeamId: "40", espnTeamId: "13" }],
    });

    expect(hoisted.apiGetTeamsAdvanced).toHaveBeenCalledWith(
      "nba",
      [{ teamKey: "LAL", teamName: "Los Angeles Lakers", apiSportsTeamId: "40", espnTeamId: "13" }],
      "advanced",
      "live",
      "refresh-team-ids",
    );
  });

  it("uses fixture fallback for team advanced when API-Sports + ESPN remain incomplete", async () => {
    const apiTeamMinimal = loadFixture("tests/fixtures/hybrid/apiSports/team_advanced_minimal.json");
    const fixtureExpected = loadFixture("tests/fixtures/hybrid/merged/team_advanced_expected.json");

    hoisted.apiGetTeamsAdvanced.mockResolvedValue({
      data: apiTeamMinimal,
      meta: {
        sourceUsed: "apiSports",
        updatedAt: "2026-03-03T00:00:00.000Z",
        requestId: "api-team-advanced-minimal",
        dataMode: "live",
      },
    });

    hoisted.espnGetTeamsAdvanced.mockImplementation(async (_sport: string, _teamKeys: string[], _mode: string, dataMode: string) => {
      if (dataMode === "fixture") {
        return {
          data: fixtureExpected,
          meta: {
            sourceUsed: "fixture",
            updatedAt: "2026-03-03T00:00:00.000Z",
            requestId: "fixture-team-advanced",
            dataMode: "fixture",
          },
        };
      }
      return {
        data: apiTeamMinimal,
        meta: {
          sourceUsed: "espn",
          updatedAt: "2026-03-03T00:00:00.000Z",
          requestId: "espn-team-advanced-minimal",
          dataMode: "live",
        },
      };
    });

    const { resolveTeamAdvanced } = await import("@/lib/providers");
    const result = await resolveTeamAdvanced("nba", ["LAL"], "advanced", { dataMode: "auto", cacheBust: "refresh-7" });

    expect(result.error).toBeUndefined();
    expect(result.meta.sourceUsed).toBe("fixture");
    expect(result.meta.dataModeEffective).toBe("fixture");
    expect(result.meta.attemptedSources).toEqual(["apiSports", "espn", "fixture"]);
    expect(result.data?.teams[0]?.status.hasGameToday).toBe(true);
    expect(hoisted.espnGetTeamsAdvanced).toHaveBeenCalledTimes(2);
    expect(hoisted.espnGetTeamsAdvanced).toHaveBeenNthCalledWith(2, "nba", ["LAL"], "advanced", "fixture", "refresh-7");
  });
});
