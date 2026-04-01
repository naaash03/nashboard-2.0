import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Meta } from "@/lib/providers/types";

function testMeta(sourceUsed: Meta["sourceUsed"] = "mlb"): Meta {
  return {
    sourceUsed,
    updatedAt: "2026-03-30T23:00:00.000Z",
    requestId: `test-${sourceUsed}`,
    dataMode: "fixture",
    dataModeEffective: "fixture",
  };
}

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("MLB team-stats provider recovery", () => {
  it("extends the runtime mlbProvider with recovered team-stat methods", async () => {
    const mod = await import("@/lib/providers/mlb");

    expect(typeof mod.mlbProvider.searchPlayers).toBe("function");
    expect(typeof mod.mlbProvider.getRecentResults).toBe("function");
    expect(typeof mod.mlbProvider.getRecentForm).toBe("function");
    expect(typeof mod.mlbProvider.getPlayerSeasonStats).toBe("function");
    expect(typeof mod.mlbProvider.getTeamSeasonStats).toBe("function");
    expect(typeof mod.mlbProvider.getBullpenFatigue).toBe("function");
    expect(typeof mod.mlbProvider.getPlatoonAdvantage).toBe("function");
  });

  it("keeps recovered team-stat flows working in fixture mode", async () => {
    const teamStats = await import("@/lib/providers/mlb/teamStats");

    const search = await teamStats.mlbSearchPlayers("Kodai", 5, "fixture");
    const recentResults = await teamStats.mlbGetRecentResults("NYM", 3, "fixture");
    const recentForm = await teamStats.mlbGetRecentForm(" nym ", "fixture");
    const playerSeason = await teamStats.mlbGetPlayerSeasonStats("673540", "fixture");
    const teamSeason = await teamStats.mlbGetTeamSeasonStats(" nym ", 2026, "fixture");
    const bullpen = await teamStats.mlbGetBullpenFatigue("NYM", "fixture");
    const platoon = await teamStats.mlbGetPlatoonAdvantage("NYM", "fixture");

    expect(search.meta.sourceUsed).toBe("fixture");
    expect(search.data?.[0]?.fullName).toContain("Kodai");
    expect(recentResults.data?.teamKey).toBe("NYM");
    expect(recentResults.data?.results).toHaveLength(3);
    expect(recentResults.data?.results[0]).toEqual(expect.objectContaining({ result: expect.any(String) }));
    expect(recentForm.data?.teamKey).toBe("NYM");
    expect(recentForm.data?.sampleContext).toContain("completed game");
    expect(playerSeason.data?.playerId).toBe("673540");
    expect(playerSeason.data?.hitting[0]).toEqual(expect.objectContaining({ season: 2025, avg: ".317" }));
    expect(teamSeason.data?.teamKey).toBe("NYM");
    expect(teamSeason.data?.record).toEqual(expect.objectContaining({ wins: 2, losses: 0, pct: "1.000" }));
    expect(bullpen.data?.starters.length ?? 0).toBeGreaterThan(0);
    expect(bullpen.data?.relievers.length ?? 0).toBeGreaterThan(0);
    expect(platoon.data?.game.homeTeam.key).toBeTruthy();
    expect(platoon.data?.analysisMode).toBeTruthy();
  });

  it("uses personIds and filters invalid bullpen ids before bulk people requests", async () => {
    const fetchMlbJson = vi.fn(async ({ endpoint, params }: { endpoint: string; params?: Record<string, unknown> }) => {
      if (endpoint === "/teams/121/roster") {
        return {
          data: {
            team: { id: 121, name: "New York Mets" },
            roster: [
              { person: { id: 673540, fullName: "Kodai Senga" }, position: { abbreviation: "SP", type: "Pitcher" } },
              { person: { id: "621345", fullName: "A.J. Minter" }, position: { abbreviation: "RP", type: "Pitcher" } },
              { person: { id: " 621345 ", fullName: "A.J. Minter" }, position: { abbreviation: "RP", type: "Pitcher" } },
              { person: { id: null, fullName: "Missing Id" }, position: { abbreviation: "RP", type: "Pitcher" } },
              { person: { id: "not-a-number", fullName: "Bad Id" }, position: { abbreviation: "RP", type: "Pitcher" } },
            ],
          },
          meta: testMeta(),
        };
      }

      if (endpoint === "/people") {
        expect(String(params?.personIds ?? "")).toBe("673540,621345");
        expect(Object.prototype.hasOwnProperty.call(params ?? {}, "ids")).toBe(false);
        return {
          data: { people: [] },
          meta: testMeta(),
        };
      }

      throw new Error(`Unexpected endpoint ${endpoint}`);
    });

    vi.doMock("@/lib/providers/mlb/client", () => ({
      getMlbDataMode: () => "live",
      fetchMlbJson,
    }));

    const teamStats = await import("@/lib/providers/mlb/teamStats");
    const result = await teamStats.mlbGetBullpenFatigue(" nym ", "live");

    expect(result.data?.teamKey).toBe("NYM");
    expect(result.data?.starters).toEqual([
      expect.objectContaining({ playerId: "673540" }),
    ]);
    expect(result.data?.relievers).toEqual([
      expect.objectContaining({ playerId: "621345" }),
    ]);
    expect(result.meta.warning).toContain("Filtered 3 invalid or duplicate pitcher ids");
    expect(result.meta.warning).toContain("No pitcher game logs were returned");
    expect(fetchMlbJson).toHaveBeenCalledTimes(2);
  });

  it("returns an empty bullpen state instead of throwing when no valid ids remain", async () => {
    const fetchMlbJson = vi.fn(async ({ endpoint }: { endpoint: string }) => {
      if (endpoint === "/teams/121/roster") {
        return {
          data: {
            team: { id: 121, name: "New York Mets" },
            roster: [
              { person: { id: null, fullName: "Missing Id" }, position: { abbreviation: "RP", type: "Pitcher" } },
              { person: { id: "bad", fullName: "Bad Id" }, position: { abbreviation: "RP", type: "Pitcher" } },
            ],
          },
          meta: testMeta(),
        };
      }

      throw new Error("The bulk /people request should not run when no ids remain.");
    });

    vi.doMock("@/lib/providers/mlb/client", () => ({
      getMlbDataMode: () => "live",
      fetchMlbJson,
    }));

    const teamStats = await import("@/lib/providers/mlb/teamStats");
    const result = await teamStats.mlbGetBullpenFatigue("NYM", "live");

    expect(result.data).toEqual({
      teamKey: "NYM",
      teamName: "New York Mets",
      starters: [],
      relievers: [],
      fetchedAt: expect.any(String),
    });
    expect(result.meta.warning).toContain("No valid MLB pitcher ids remained");
    expect(fetchMlbJson).toHaveBeenCalledTimes(1);
  });
});
