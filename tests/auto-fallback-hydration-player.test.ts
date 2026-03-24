import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  getPlayerProfile: vi.fn(),
  getGameLog: vi.fn(),
  getTeamStatus: vi.fn(),
}));

vi.mock("@/lib/providers/espn/playerDirectory", () => ({
  getPlayerProfile: hoisted.getPlayerProfile,
  getGameLog: hoisted.getGameLog,
}));

vi.mock("@/lib/providers/espn/teamStatus", () => ({
  getTeamStatus: hoisted.getTeamStatus,
}));

describe("auto fallback hydration - player insights", () => {
  beforeEach(() => {
    vi.resetModules();
    hoisted.getPlayerProfile.mockReset();
    hoisted.getGameLog.mockReset();
    hoisted.getTeamStatus.mockReset();

    hoisted.getPlayerProfile.mockImplementation(async (_sport: string, playerId: string, dataMode: string) => ({
      data: {
        playerId,
        fullName: "Clay Holmes",
        teamAbbrev: "NYM",
        teamName: "New York Mets",
        position: "P",
      },
      meta: {
        sourceUsed: dataMode === "fixture" ? "fixture" : "espn",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: `profile-${dataMode}`,
        dataMode,
      },
    }));

    hoisted.getGameLog.mockImplementation(async ({ dataMode }: { dataMode: string }) => {
      if (dataMode === "live") {
        return {
          data: {
            events: [],
          },
          meta: {
            sourceUsed: "espn",
            updatedAt: "2026-03-02T00:00:00.000Z",
            requestId: "gamelog-live",
            dataMode: "live",
          },
        };
      }
      return {
        data: {
          events: [
            {
              date: "2026-03-01",
              opponent: "ATL",
              result: "W",
              stats: { ip: 6, er: 2, hits: 5, bb: 1, k: 7 },
            },
            {
              date: "2026-02-24",
              opponent: "PHI",
              result: "L",
              stats: { ip: 5, er: 3, hits: 6, bb: 2, k: 5 },
            },
          ],
        },
        meta: {
          sourceUsed: "fixture",
          updatedAt: "2026-03-02T00:00:00.000Z",
          requestId: "gamelog-fixture",
          dataMode: "fixture",
        },
      };
    });

    hoisted.getTeamStatus.mockImplementation(async (_sport: string, teamKey: string, dataMode: string) => ({
      data: {
        sport: "mlb",
        teamKey,
        hasGameToday: false,
      },
      meta: {
        sourceUsed: dataMode === "fixture" ? "fixture" : "espn",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: `status-${dataMode}`,
        dataMode,
      },
    }));
  });

  it("hydrates missing live season highlights from fixture in auto mode", async () => {
    const { getPlayerInsights } = await import("@/lib/providers/espn/playerInsights");
    const result = await getPlayerInsights("mlb", "1234", "advanced", "auto", "refresh-7");

    expect(result.error).toBeUndefined();
    expect(result.data?.season?.metrics.length ?? 0).toBeGreaterThan(0);
    expect(result.data?.recent?.games.length ?? 0).toBeGreaterThan(0);
    expect(result.meta.warning ?? "").toContain("AUTO mode");

    expect(hoisted.getGameLog).toHaveBeenCalledWith(expect.objectContaining({
      sport: "mlb",
      playerId: "1234",
      dataMode: "live",
      cacheBust: "refresh-7",
    }));
    expect(hoisted.getGameLog).toHaveBeenCalledWith(expect.objectContaining({
      sport: "mlb",
      playerId: "1234",
      dataMode: "fixture",
      cacheBust: "refresh-7",
    }));
  });
});
