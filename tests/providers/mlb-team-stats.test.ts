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

  it("does not truncate bullpen ids and can infer starters from starter-length workloads", async () => {
    const fetchMlbJson = vi.fn(async ({ endpoint, params }: { endpoint: string; params?: Record<string, unknown> }) => {
      if (endpoint === "/teams/121/roster") {
        return {
          data: {
            team: { id: 121, name: "New York Mets" },
            roster: Array.from({ length: 21 }, (_, index) => ({
              person: { id: 900001 + index, fullName: `Pitcher ${index + 1}` },
              position: { abbreviation: index === 20 ? "P" : "RP", type: "Pitcher" },
            })),
          },
          meta: testMeta(),
        };
      }

      if (endpoint === "/people") {
        const personIds = String(params?.personIds ?? "").split(",");
        expect(personIds).toHaveLength(21);
        expect(personIds.at(-1)).toBe("900021");
        return {
          data: {
            people: [
              {
                id: 900021,
                fullName: "Pitcher 21",
                stats: [
                  {
                    type: { displayName: "gameLog" },
                    splits: [
                      {
                        date: "2026-03-28",
                        stat: {
                          inningsPitched: "5.0",
                          numberOfPitches: 82,
                          strikes: 55,
                          strikeOuts: 6,
                        },
                      },
                      {
                        date: "2026-03-22",
                        stat: {
                          inningsPitched: "4.1",
                          numberOfPitches: 74,
                          strikes: 48,
                          strikeOuts: 5,
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
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
    const result = await teamStats.mlbGetBullpenFatigue("NYM", "live");

    expect(result.data?.starters).toEqual([
      expect.objectContaining({ playerId: "900021", fullName: "Pitcher 21" }),
    ]);
    expect(result.data?.relievers.some((pitcher) => pitcher.playerId === "900021")).toBe(false);
    expect(result.meta.warning).toContain("Inferred 1 starter");
  });

  it("falls back to handedness when only one probable starter has split data", async () => {
    const fetchMlbJson = vi.fn(async ({ endpoint }: { endpoint: string }) => {
      if (endpoint === "/people/1") {
        return {
          data: {
            people: [
              {
                id: 1,
                fullName: "Away Arm",
                pitchHand: { code: "R" },
                stats: [
                  {
                    type: { displayName: "statSplits" },
                    splits: [
                      { split: { code: "vl", description: "vs Left" }, stat: { era: "2.40", whip: "1.02", avg: ".220", ops: ".630", battersFaced: 120 } },
                      { split: { code: "vr", description: "vs Right" }, stat: { era: "3.50", whip: "1.14", avg: ".251", ops: ".721", battersFaced: 180 } },
                    ],
                  },
                ],
              },
            ],
          },
          meta: testMeta(),
        };
      }

      if (endpoint === "/people/2") {
        return {
          data: {
            people: [
              {
                id: 2,
                fullName: "Home Arm",
                pitchHand: { code: "L" },
                stats: [
                  {
                    type: { displayName: "statSplits" },
                    splits: [],
                  },
                ],
              },
            ],
          },
          meta: testMeta(),
        };
      }

      throw new Error(`Unexpected endpoint ${endpoint}`);
    });

    vi.doMock("@/lib/providers/mlb/client", () => ({
      getMlbDataMode: () => "live",
      fetchMlbJson,
    }));
    vi.doMock("@/lib/providers/mlb/provider", () => ({
      getMlbUpcomingScheduleWithProbables: vi.fn(async () => ({
        data: {
          teamKey: "NYM",
          teamId: 121,
          games: [
            {
              gamePk: 42,
              officialDate: "2026-04-01",
              gameDate: "2026-04-01T23:10:00Z",
              awayTeam: { key: "ATL", name: "Atlanta Braves", probableStarter: { playerId: "1", fullName: "Away Arm" } },
              homeTeam: { key: "NYM", name: "New York Mets", probableStarter: { playerId: "2", fullName: "Home Arm" } },
            },
          ],
        },
        meta: testMeta(),
      })),
    }));

    const teamStats = await import("@/lib/providers/mlb/teamStats");
    const result = await teamStats.mlbGetPlatoonAdvantage("NYM", "live");

    expect(result.data?.analysisMode).toBe("handedness");
    expect(result.data?.explanation).toContain("Only one probable starter has usable split data");
    expect(result.meta.warning).toContain("Only one probable starter currently has split data");
  });
});
