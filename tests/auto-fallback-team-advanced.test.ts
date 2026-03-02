import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  fetchEspnJson: vi.fn(),
  getTeamStatusBatch: vi.fn(),
}));

vi.mock("@/lib/providers/espn/client", () => ({
  fetchEspnJson: hoisted.fetchEspnJson,
  getDataMode: (value?: string) => (value === "fixture" ? "fixture" : "live"),
}));

vi.mock("@/lib/providers/espn/teamStatus", () => ({
  getTeamStatusBatch: hoisted.getTeamStatusBatch,
}));

describe("auto fallback hydration - teams advanced", () => {
  beforeEach(() => {
    vi.resetModules();
    hoisted.fetchEspnJson.mockReset();
    hoisted.getTeamStatusBatch.mockReset();

    hoisted.getTeamStatusBatch.mockImplementation(async (_sport: string, teamKeys: string[], dataMode: string) => ({
      data: {
        sport: "nba",
        statuses: teamKeys.map((teamKey) => ({
          sport: "nba",
          teamKey,
          hasGameToday: false,
        })),
      },
      meta: {
        sourceUsed: dataMode === "fixture" ? "fixture" : "espn",
        updatedAt: "2026-03-02T00:00:00.000Z",
        requestId: `status-${dataMode}`,
        dataMode,
      },
    }));

    hoisted.fetchEspnJson.mockImplementation(async ({ endpoint, dataMode }: { endpoint: string; dataMode: string }) => {
      if (endpoint.includes("scoreboard")) {
        return {
          data: { events: [] },
          meta: {
            sourceUsed: dataMode === "fixture" ? "fixture" : "espn",
            updatedAt: "2026-03-02T00:00:00.000Z",
            requestId: `scoreboard-${dataMode}`,
            dataMode,
          },
        };
      }

      if (dataMode === "live") {
        return {
          data: { children: [] },
          meta: {
            sourceUsed: "espn",
            updatedAt: "2026-03-02T00:00:00.000Z",
            requestId: "standings-live",
            dataMode: "live",
          },
        };
      }

      return {
        data: {
          children: [
            {
              name: "West",
              standings: {
                entries: [
                  {
                    team: { abbreviation: "LAL" },
                    stats: [
                      { name: "wins", value: 42 },
                      { name: "losses", value: 24 },
                      { name: "rank", displayValue: "2" },
                      { name: "streak", displayValue: "W3" },
                      { name: "lastTenGames", displayValue: "8-2" },
                    ],
                  },
                ],
              },
            },
          ],
        },
        meta: {
          sourceUsed: "fixture",
          updatedAt: "2026-03-02T00:00:00.000Z",
          requestId: "standings-fixture",
          dataMode: "fixture",
        },
      };
    });
  });

  it("hydrates missing live standings/record data in auto mode", async () => {
    const { getTeamsAdvanced } = await import("@/lib/providers/espn/teamAdvanced");
    const result = await getTeamsAdvanced("nba", ["LAL"], "advanced", "auto", "refresh-22");

    expect(result.error).toBeUndefined();
    expect(result.data?.teams.length).toBe(1);
    expect(result.data?.teams[0]?.teamKey).toBe("LAL");
    expect(Boolean(result.data?.teams[0]?.record || result.data?.teams[0]?.standings)).toBe(true);
    expect(result.meta.warning ?? "").toContain("AUTO mode");
  });
});
