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
});