import { beforeEach, describe, expect, it, vi } from "vitest";

type MockLineupPlayer = {
  id: number;
  batSide?: "L" | "R" | "S";
};

type MockBullpenPitcher = {
  id: number;
  fullName: string;
  gamesStarted: number;
  strikeOuts?: number;
  baseOnBalls?: number;
  inningsPitched?: string;
  appearances?: Array<{
    date: string;
    inningsPitched: string;
    numberOfPitches: number;
    strikes?: number;
  }>;
};

function installClientMock(args: {
  probableStarterPosted: boolean;
  lineupPlayers: MockLineupPlayer[];
  hitting?: { avg?: string; strikeOuts?: number };
  record?: { wins: number; losses: number; pct?: string };
  bullpenPitchers?: MockBullpenPitcher[];
}) {
  const baseMeta = {
    sourceUsed: "fixture" as const,
    updatedAt: "2026-03-30T12:00:00.000Z",
    requestId: "mock-mlb-lineup",
    dataMode: "fixture" as const,
    dataModeEffective: "fixture" as const,
  };
  const bullpenPitchers = args.bullpenPitchers ?? [];
  const bullpenPitcherById = new Map(bullpenPitchers.map((pitcher) => [pitcher.id, pitcher]));

  vi.doMock("@/lib/providers/mlb/client", () => ({
    getMlbDataMode: () => "fixture" as const,
    fetchMlbJson: vi.fn(async ({ endpoint, params }: { endpoint: string; params?: Record<string, unknown> }) => {
      if (endpoint === "/schedule") {
        if (params?.teamId === 121 && params?.gameType === "R,S") {
          return {
            data: {
              dates: [
                {
                  date: "2026-03-28",
                  games: [
                    {
                      gamePk: 499901,
                      gameDate: "2026-03-28T23:10:00Z",
                      officialDate: "2026-03-28",
                      gameType: "R",
                      status: { abstractGameState: "Final", detailedState: "Final" },
                      teams: {
                        away: {
                          team: { id: 121, name: "New York Mets" },
                          score: 4,
                        },
                        home: {
                          team: { id: 119, name: "Los Angeles Dodgers" },
                          score: 2,
                        },
                      },
                    },
                  ],
                },
              ],
            },
            meta: baseMeta,
          };
        }

        return {
          data: {
            dates: [
              {
                date: "2026-04-02",
                games: [
                  {
                    gamePk: 500001,
                    gameDate: "2026-04-02T23:10:00Z",
                    officialDate: "2026-04-02",
                    status: { abstractGameState: "Preview", detailedState: "Scheduled" },
                    teams: {
                      away: {
                        team: { id: 121, name: "New York Mets" },
                        probablePitcher: args.probableStarterPosted ? { id: 9001, fullName: "David Peterson" } : undefined,
                      },
                      home: {
                        team: { id: 117, name: "Houston Astros" },
                        probablePitcher: { id: 9010, fullName: "Hunter Brown" },
                      },
                    },
                  },
                ],
              },
            ],
          },
          meta: baseMeta,
        };
      }

      if (endpoint === "/teams/117/roster") {
        return {
          data: {
            roster: args.lineupPlayers.map((player, index) => ({
              person: { id: player.id, fullName: `Astros Hitter ${index + 1}` },
              position: { code: "IF", name: "Infielder", type: "Infielder", abbreviation: "IF" },
              status: { code: "A", description: "Active" },
            })),
          },
          meta: baseMeta,
        };
      }

      if (endpoint === "/teams/121/roster") {
        return {
          data: {
            roster: bullpenPitchers.map((pitcher) => ({
              person: { id: pitcher.id, fullName: pitcher.fullName },
              position: { code: "P", name: "Pitcher", type: "Pitcher", abbreviation: "P" },
              status: { code: "A", description: "Active" },
            })),
          },
          meta: baseMeta,
        };
      }

      if (endpoint === "/people") {
        return {
          data: {
            people: args.lineupPlayers.map((player, index) => ({
              id: player.id,
              fullName: `Astros Hitter ${index + 1}`,
              batSide: player.batSide ? { code: player.batSide, description: player.batSide } : undefined,
            })),
          },
          meta: baseMeta,
        };
      }

      if (endpoint === "/game/499901/boxscore") {
        return {
          data: {
            teams: {
              away: {
                pitchers: [9001],
                players: {
                  ID9001: {
                    person: { id: 9001, fullName: "David Peterson" },
                    stats: {
                      pitching: {
                        inningsPitched: "6.0",
                        numberOfPitches: 92,
                        strikes: 61,
                      },
                    },
                  },
                },
              },
              home: {
                pitchers: [],
                players: {},
              },
            },
          },
          meta: baseMeta,
        };
      }

      const seasonStatsMatch = endpoint.match(/^\/people\/(\d+)\/stats$/);
      if (seasonStatsMatch) {
        const pitcherId = Number(seasonStatsMatch[1]);
        const pitcher = bullpenPitcherById.get(pitcherId);

        if (params?.stats === "season" && params?.group === "pitching") {
          return {
            data: {
              stats: [
                {
                  group: { displayName: "pitching" },
                  splits: pitcher
                    ? [
                        {
                          stat: {
                            gamesStarted: pitcher.gamesStarted,
                            strikeOuts: pitcher.strikeOuts ?? 40,
                            baseOnBalls: pitcher.baseOnBalls ?? 10,
                            inningsPitched: pitcher.inningsPitched ?? "40.0",
                          },
                        },
                      ]
                    : [],
                },
              ],
            },
            meta: baseMeta,
          };
        }

        if (params?.stats === "gameLog" && params?.group === "pitching") {
          return {
            data: {
              stats: [
                {
                  splits: (pitcher?.appearances ?? []).map((appearance) => ({
                    date: appearance.date,
                    stat: {
                      inningsPitched: appearance.inningsPitched,
                      numberOfPitches: appearance.numberOfPitches,
                      strikes: appearance.strikes,
                    },
                  })),
                },
              ],
            },
            meta: baseMeta,
          };
        }
      }

      if (endpoint === "/teams/stats") {
        if (params?.group === "hitting") {
          return {
            data: {
              stats: [
                {
                  group: { displayName: "hitting" },
                  splits: args.hitting
                    ? [
                      {
                        team: { id: 117, name: "Houston Astros" },
                        stat: {
                          avg: args.hitting.avg,
                          strikeOuts: args.hitting.strikeOuts,
                        },
                      },
                    ]
                    : [],
                },
              ],
            },
            meta: baseMeta,
          };
        }

        return {
          data: {
            stats: [
              {
                group: { displayName: "pitching" },
                splits: [],
              },
            ],
          },
          meta: baseMeta,
        };
      }

      if (endpoint === "/standings") {
        return {
          data: {
            records: [
              {
                teamRecords: args.record
                  ? [
                    {
                      team: { id: 117, name: "Houston Astros" },
                      wins: args.record.wins,
                      losses: args.record.losses,
                      pct: args.record.pct ?? ".500",
                    },
                  ]
                  : [],
              },
            ],
          },
          meta: baseMeta,
        };
      }

      throw new Error(`Unhandled MLB client mock endpoint: ${endpoint}`);
    }),
  }));
}

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("MLB pitcher vs projected lineup provider", () => {
  it("returns partial state with exactly three reasons when the probable starter is missing", async () => {
    installClientMock({
      probableStarterPosted: false,
      lineupPlayers: [
        { id: 1, batSide: "R" },
        { id: 2, batSide: "R" },
        { id: 3, batSide: "L" },
        { id: 4, batSide: "R" },
        { id: 5, batSide: "L" },
        { id: 6, batSide: "R" },
        { id: 7, batSide: "S" },
        { id: 8, batSide: "R" },
      ],
      hitting: { avg: ".246", strikeOuts: 320 },
      record: { wins: 20, losses: 20 },
    });

    vi.doMock("@/lib/providers/mlb/pitcherComparison", () => ({
      resolveMlbPitcherComparisonStats: vi.fn(),
    }));

    const { mlbProvider } = await import("@/lib/providers/mlb/provider");
    const result = await mlbProvider.getPitcherVsProjectedLineup("NYM", { dataMode: "fixture" });

    expect(result.data?.state).toBe("partial");
    expect(result.data?.pitcherSummary).toBeNull();
    expect(result.data?.reasons).toHaveLength(3);
    expect(result.data?.reasons[0]).toContain("Probable starter");
    expect(result.data?.assumptionsNote).toContain("approximate lineup");
    expect(result.data?.assumptionsNote).toContain("not a confirmed batting order");
  });

  it("keeps sparse preseason inputs conservative and only returns allowed breakdown factors", async () => {
    installClientMock({
      probableStarterPosted: true,
      lineupPlayers: [
        { id: 1, batSide: "R" },
        { id: 2, batSide: "L" },
        { id: 3, batSide: "R" },
        { id: 4, batSide: "S" },
        { id: 5, batSide: "R" },
      ],
    });

    vi.doMock("@/lib/providers/mlb/pitcherComparison", () => ({
      resolveMlbPitcherComparisonStats: vi.fn(async () => ({
        card: {
          playerId: "9001",
          fullName: "David Peterson",
          handedness: "L",
          era: 3.5,
          kPer9: 10.2,
          bbPer9: 2.8,
          statsBasis: "spring_sample_only",
          statsBasisLabel: "Using spring sample only",
          last3Starts: [],
        },
        warning: undefined,
        meta: {
          sourceUsed: "fixture" as const,
          updatedAt: "2026-03-30T12:00:00.000Z",
          requestId: "mock-pitcher-comparison",
          dataMode: "fixture" as const,
          dataModeEffective: "fixture" as const,
        },
      })),
    }));

    const { mlbProvider } = await import("@/lib/providers/mlb/provider");
    const result = await mlbProvider.getPitcherVsProjectedLineup("NYM", { dataMode: "fixture" });

    expect(result.data?.state).toBe("success");
    expect(result.data?.reasons).toHaveLength(3);
    expect(result.data?.verdict).toBe("Neutral matchup");
    expect(result.data?.matchupScore).toBeGreaterThanOrEqual(45);
    expect(result.data?.matchupScore).toBeLessThanOrEqual(55);
    expect(result.data?.confidenceLabel).toBe("Low");
    expect(result.data?.componentBreakdown.map((component) => component.key)).toEqual([
      "handedness",
      "strikeoutSkill",
      "control",
      "recentForm",
      "opponentContact",
    ]);
    expect(result.data?.notes).toContain("Projected lineup uses an active-roster approximation.");
    expect(result.data?.notes).toContain("Opponent team contact and strikeout inputs are partial.");
  });

  it("supports advanced bullpen selection while keeping the probable starter as the default baseline", async () => {
    installClientMock({
      probableStarterPosted: true,
      lineupPlayers: [
        { id: 1, batSide: "R" },
        { id: 2, batSide: "L" },
        { id: 3, batSide: "R" },
        { id: 4, batSide: "S" },
        { id: 5, batSide: "R" },
      ],
      bullpenPitchers: [
        { id: 9001, fullName: "David Peterson", gamesStarted: 6, strikeOuts: 40, baseOnBalls: 12, inningsPitched: "35.0" },
        { id: 9002, fullName: "Tylor Megill", gamesStarted: 5, inningsPitched: "28.0" },
        { id: 9003, fullName: "Paul Blackburn", gamesStarted: 4, inningsPitched: "24.0" },
        { id: 9004, fullName: "Jose Butto", gamesStarted: 3, inningsPitched: "21.0" },
        { id: 9005, fullName: "Griffin Canning", gamesStarted: 2, inningsPitched: "18.0" },
        {
          id: 9101,
          fullName: "Reed Garrett",
          gamesStarted: 0,
          strikeOuts: 48,
          baseOnBalls: 14,
          inningsPitched: "39.0",
          appearances: [{ date: "2026-03-28", inningsPitched: "1.0", numberOfPitches: 17, strikes: 11 }],
        },
        {
          id: 9102,
          fullName: "Ryne Stanek",
          gamesStarted: 0,
          strikeOuts: 45,
          baseOnBalls: 18,
          inningsPitched: "37.0",
          appearances: [{ date: "2026-03-27", inningsPitched: "1.0", numberOfPitches: 14, strikes: 9 }],
        },
      ],
    });

    vi.doMock("@/lib/providers/mlb/pitcherComparison", () => ({
      resolveMlbPitcherComparisonStats: vi.fn(async ({ playerId, fallbackName }: { playerId?: string; fallbackName: string }) => ({
        card: playerId === "9101"
          ? {
              playerId: "9101",
              fullName: "Reed Garrett",
              handedness: "R",
              era: 2.95,
              kPer9: 11.1,
              bbPer9: 3.4,
              statsBasis: "current_regular_season",
              statsBasisLabel: "Using 2025 regular season",
              last3Starts: [],
            }
          : {
              playerId: playerId ?? "9001",
              fullName: fallbackName,
              handedness: "L",
              era: 3.5,
              kPer9: 10.2,
              bbPer9: 2.8,
              statsBasis: "current_regular_season",
              statsBasisLabel: "Using 2025 regular season",
              last3Starts: [
                { innings: "5.0", earnedRuns: 2 },
                { innings: "6.0", earnedRuns: 1 },
                { innings: "6.0", earnedRuns: 2 },
              ],
            },
        warning: undefined,
        meta: {
          sourceUsed: "fixture" as const,
          updatedAt: "2026-03-30T12:00:00.000Z",
          requestId: "mock-pitcher-comparison",
          dataMode: "fixture" as const,
          dataModeEffective: "fixture" as const,
        },
      })),
    }));

    const { mlbProvider } = await import("@/lib/providers/mlb/provider");

    const baseline = await mlbProvider.getPitcherVsProjectedLineup("NYM", {
      dataMode: "fixture",
      includePitcherOptions: true,
    });
    const custom = await mlbProvider.getPitcherVsProjectedLineup("NYM", {
      dataMode: "fixture",
      includePitcherOptions: true,
      selectedPitcherId: "9101",
    });

    expect(baseline.data?.pitcherSelection).toEqual(expect.objectContaining({
      label: "Probable starter baseline",
      optionValue: "",
      selectedPitcherRole: "starter",
      selectedPitcherName: "David Peterson",
    }));
    expect(baseline.data?.pitcherSelection?.options.map((option) => option.label)).toEqual(expect.arrayContaining([
      "David Peterson | Probable starter",
      "Reed Garrett | Bullpen (Available)",
    ]));

    expect(custom.data?.pitcherSelection).toEqual(expect.objectContaining({
      label: "Custom advanced pitcher selection",
      optionValue: "9101",
      selectedPitcherRole: "bullpen",
      selectedPitcherName: "Reed Garrett",
    }));
    expect(custom.data?.pitcherSummary?.playerId).toBe("9101");
    expect(custom.data?.pitcherSummary?.fullName).toBe("Reed Garrett");
    expect(custom.data?.pitcherSummary?.recentFormEra).toBeUndefined();
    expect(custom.data?.notes).toContain("Custom advanced pitcher selection is active for Reed Garrett.");
    expect(custom.data?.pitcherSummary?.confidenceNote).toContain("Bullpen selection uses season-level pitching data");
  });
});
