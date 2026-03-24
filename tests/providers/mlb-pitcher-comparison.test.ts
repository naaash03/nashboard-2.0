import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("MLB pitcher comparison boundary", () => {
  it("falls back to prior completed regular season for established preseason starters", async () => {
    const mod = await import("@/lib/providers/mlb/pitcherComparison");
    const result = await mod.resolveMlbPitcherComparisonStats({
      playerId: "1001",
      fallbackName: "David Peterson",
      selectedGameTime: "2026-03-12T23:10:00.000Z",
      dataMode: "fixture",
    });

    expect(result.card?.statsBasis).toBe("prior_regular_season");
    expect(result.card?.statsBasisLabel).toBe("Using 2025 regular season");
    expect(result.card?.era).toBe(3.41);
    expect(result.card?.whip).toBe(1.19);
    expect(result.card?.inningsPitched).toBe(147.2);
    expect(result.card?.strikeouts).toBe(163);
    expect(result.card?.kPer9).toBe(9.9);
    expect(result.card?.bbPer9).toBe(2.9);
    expect(result.card?.hrPer9).toBe(1);
    expect(result.card?.opponentAvg).toBe(0.231);
  });

  it("keeps thin current-season regular sample from suppressing prior-season mapped values", async () => {
    const mod = await import("@/lib/providers/mlb/pitcherComparison");
    const result = await mod.resolveMlbPitcherComparisonStats({
      playerId: "1002",
      fallbackName: "Gerrit Cole",
      selectedGameTime: "2026-03-12T23:10:00.000Z",
      dataMode: "fixture",
    });

    expect(result.card?.statsBasisLabel).toBe("Using 2025 regular season");
    expect(result.card?.era).toBe(2.96);
    expect(result.card?.inningsPitched).toBe(171.1);
    expect(result.card?.kPer9).toBe(10.6);
  });

  it("uses spring sample only when regular-season splits are unavailable", async () => {
    vi.doMock("@/lib/providers/mlb/client", async () => {
      const actual = await vi.importActual<typeof import("@/lib/providers/mlb/client")>("@/lib/providers/mlb/client");
      const baseMeta = {
        sourceUsed: "mlb" as const,
        updatedAt: "2026-03-09T12:00:00.000Z",
        requestId: "mock-mlb",
        dataMode: "live" as const,
        dataModeEffective: "live" as const,
      };

      return {
        ...actual,
        fetchMlbJson: vi.fn(async ({ endpoint, params }: { endpoint: string; params?: Record<string, unknown> }) => {
          if (endpoint === "/people/search") {
            return {
              data: {
                people: [{ id: 608331, fullName: "Max Fried" }],
              },
              meta: {
                ...baseMeta,
                endpointUrl: "https://statsapi.mlb.com/api/v1/people/search",
              },
            };
          }

          const hydrate = String(params?.hydrate ?? "");
          const season = Number((hydrate.match(/season=(\d{4})/)?.[1] ?? "0"));
          const gameType = hydrate.match(/gameType=\[([A-Z])\]/)?.[1] ?? "R";
          const type = hydrate.match(/type=\[([a-zA-Z]+)\]/)?.[1] ?? "season";

          const regularSplits: Record<string, unknown>[] = [];
          const springSeasonSplit = {
            season: String(season),
            gameType: "S",
            stat: {
              wins: 0,
              losses: 0,
              era: "2.70",
              whip: "1.05",
              inningsPitched: "10.0",
              strikeOuts: 11,
              baseOnBalls: 2,
              homeRuns: 1,
              avg: ".220",
              strikeoutsPer9Inn: "9.9",
              walksPer9Inn: "1.8",
              homeRunsPer9: "0.9",
            },
          };

          const statsGroup = (() => {
            if (type === "season") {
              return {
                type: { displayName: "season" },
                group: { displayName: "pitching" },
                splits: gameType === "S" ? [springSeasonSplit] : regularSplits,
              };
            }
            if (type === "gameLog") {
              return {
                type: { displayName: "gameLog" },
                group: { displayName: "pitching" },
                splits: gameType === "S"
                  ? [
                    { season: String(season), gameType: "S", date: "2026-03-06", opponent: { abbreviation: "BOS" }, stat: { inningsPitched: "3.0", earnedRuns: 1, strikeOuts: 4 } },
                    { season: String(season), gameType: "S", date: "2026-03-01", opponent: { abbreviation: "TOR" }, stat: { inningsPitched: "3.0", earnedRuns: 1, strikeOuts: 3 } },
                    { season: String(season), gameType: "S", date: "2026-02-24", opponent: { abbreviation: "TB" }, stat: { inningsPitched: "4.0", earnedRuns: 1, strikeOuts: 4 } },
                  ]
                  : [],
              };
            }
            if (type === "homeAndAway") {
              return {
                type: { displayName: "homeAndAway" },
                group: { displayName: "pitching" },
                splits: [],
              };
            }
            return {
              type: { displayName: "statSplits" },
              group: { displayName: "pitching" },
              splits: [],
            };
          })();

          return {
            data: {
              people: [
                {
                  id: 608331,
                  fullName: "Max Fried",
                  pitchHand: { code: "L", description: "Left" },
                  stats: [statsGroup],
                },
              ],
            },
            meta: {
              ...baseMeta,
              endpointUrl: `https://statsapi.mlb.com/api/v1/people/608331?hydrate=${encodeURIComponent(hydrate)}`,
            },
          };
        }),
      };
    });

    const mod = await import("@/lib/providers/mlb/pitcherComparison");
    const result = await mod.resolveMlbPitcherComparisonStats({
      playerId: "608331",
      fallbackName: "Max Fried",
      selectedGameTime: "2026-03-12T23:10:00.000Z",
      dataMode: "live",
    });

    expect(result.card?.statsBasis).toBe("spring_sample_only");
    expect(result.card?.statsBasisLabel).toBe("Using spring sample only");
    expect(result.card?.era).toBe(2.7);
    expect(result.meta.notes?.some((note) => note.includes("Pitcher stat diagnostic"))).toBe(true);
  });
});
