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

describe("refresh cacheBust in hybrid auto mode", () => {
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

    hoisted.apiSearchPlayers.mockResolvedValue({
      data: [],
      meta: {
        sourceUsed: "apiSports",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: "api-live-empty",
        dataMode: "live",
        cacheHit: false,
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
            cacheHit: false,
          },
        };
      }
      return {
        data: [],
        meta: {
          sourceUsed: "espn",
          updatedAt: "2026-03-02T00:00:00.000Z",
          requestId: "espn-live-empty",
          dataMode: "live",
          cacheHit: false,
        },
      };
    });
  });

  it("passes cacheBust to API-Sports live, ESPN live, and fixture fallback calls", async () => {
    const { resolvePlayersSearch } = await import("@/lib/providers");
    const result = await resolvePlayersSearch("mlb", "soto", 8, { dataMode: "auto", cacheBust: "refresh-1" });

    expect(result.meta.sourceUsed).toBe("fixture");

    const apiCall = hoisted.apiSearchPlayers.mock.calls[0];
    expect(apiCall).toEqual(["mlb", "soto", 8, "live", "refresh-1"]);

    const espnCalls = hoisted.espnSearchPlayers.mock.calls;
    expect(espnCalls.length).toBe(2);
    expect(espnCalls[0]).toEqual(["mlb", "soto", "live", 8, "refresh-1"]);
    expect(espnCalls[1]).toEqual(["mlb", "soto", "fixture", 8, "refresh-1"]);
  });
});