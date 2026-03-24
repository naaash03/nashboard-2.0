import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Meta } from "@/lib/providers/types";
import {
  calculateSeriesScore,
  groupMlbSeriesGames,
  resolveMlbSeriesTracker,
  resolveSeriesSelection,
  type MlbSeriesTrackerResult,
} from "@/lib/sports/resolvers/mlbSeriesTracker";
import { selectMatchupGame } from "@/lib/sports/resolvers/mlbStartingPitcherMatchup";
import type { MlbScheduledGame } from "@/lib/providers/mlb";

function testMeta(sourceUsed: Meta["sourceUsed"] = "mlb"): Meta {
  return {
    sourceUsed,
    updatedAt: "2026-03-09T12:00:00.000Z",
    requestId: `test-${sourceUsed}`,
    dataMode: "fixture",
    dataModeEffective: "fixture",
  };
}

function makeGame(args: {
  gamePk: number;
  gameDate: string;
  status?: "scheduled" | "live" | "final";
  abstractState?: string;
  detailedState?: string;
  homeId: number;
  homeKey: string;
  homeName: string;
  awayId: number;
  awayKey: string;
  awayName: string;
  homeScore?: number;
  awayScore?: number;
  homeProbableName?: string;
  awayProbableName?: string;
  homeProbableId?: string;
  awayProbableId?: string;
  gameType?: string;
  seriesGameNumber?: number;
  gamesInSeries?: number;
  seriesDescription?: string;
  doubleHeader?: string;
  gameNumber?: number;
  rescheduleDate?: string;
  rescheduledFrom?: string;
}): MlbScheduledGame {
  return {
    gamePk: args.gamePk,
    gameDate: args.gameDate,
    officialDate: args.gameDate.slice(0, 10),
    gameType: args.gameType ?? "R",
    status: args.status ?? "scheduled",
    abstractState: args.abstractState,
    detailedState: args.detailedState,
    venue: "Test Park",
    homeScore: args.homeScore,
    awayScore: args.awayScore,
    seriesDescription: args.seriesDescription,
    seriesGameNumber: args.seriesGameNumber,
    gamesInSeries: args.gamesInSeries,
    doubleHeader: args.doubleHeader,
    gameNumber: args.gameNumber,
    rescheduleDate: args.rescheduleDate,
    rescheduledFrom: args.rescheduledFrom,
    awayTeam: {
      id: args.awayId,
      key: args.awayKey,
      name: args.awayName,
      probableStarter: {
        playerId: args.awayProbableId,
        fullName: args.awayProbableName,
      },
    },
    homeTeam: {
      id: args.homeId,
      key: args.homeKey,
      name: args.homeName,
      probableStarter: {
        playerId: args.homeProbableId,
        fullName: args.homeProbableName,
      },
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("MLB Series Tracker route", () => {
  it("returns standardized envelope", async () => {
    const mod = await import("@/app/api/widgets/mlb-series-tracker/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-series-tracker?teamKey=NYM&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      seriesId: expect.any(String),
      gameTimeline: expect.any(Array),
      selectableSeries: expect.any(Array),
      groupingMode: expect.any(String),
    }));
    expect(body.meta).toEqual(expect.objectContaining({
      sourceUsed: "fixture",
      seriesGroupingMethod: expect.any(String),
      seriesGroupingMode: expect.any(String),
      season: expect.any(Number),
      seriesType: expect.any(String),
    }));
    expect(body.contract).toEqual(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        groupingMode: expect.any(String),
      }),
    }));
  });

  it("supports selected seriesId override when explicitly pinned", async () => {
    const mod = await import("@/app/api/widgets/mlb-series-tracker/route");
    const first = await mod.GET(new Request("http://localhost/api/widgets/mlb-series-tracker?teamKey=NYM&mode=advanced&dataMode=fixture"));
    const firstBody = await first.json();
    const selectable = firstBody.data?.selectableSeries ?? [];
    const completed = selectable.find((row: { lifecycle: string }) => row.lifecycle === "completed");

    expect(completed?.seriesId).toBeTruthy();

    const second = await mod.GET(new Request(`http://localhost/api/widgets/mlb-series-tracker?teamKey=NYM&mode=advanced&seriesId=${encodeURIComponent(completed.seriesId)}&selectionPinned=1&dataMode=fixture`));
    const secondBody = await second.json();

    expect(second.status).toBe(200);
    expect(secondBody.data?.seriesId).toBe(completed.seriesId);
  });
});

describe("MLB Series Tracker resolver domain correctness", () => {
  it("fixes truncated opponent label regression in summary and dropdown labels", async () => {
    const result = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
    }, {
      fetchSchedule: async () => ({
        data: {
          teamKey: "NYM",
          teamId: 121,
          season: 2026,
          games: [
            makeGame({
              gamePk: 10,
              gameDate: "2026-03-11T23:10:00.000Z",
              homeId: 121,
              homeKey: "NYM",
              homeName: "New York Mets",
              awayId: 136,
              awayKey: "S",
              awayName: "Seattle Mariners",
            }),
          ],
        },
        meta: testMeta("fixture"),
      }),
      now: () => new Date("2026-03-09T15:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.data?.opponent.name).toBe("Seattle Mariners");
    expect(result.data?.selectableSeries[0]?.label).toContain("Seattle Mariners");
    expect(/\bvs\s+[A-Z]\b/.test(result.data?.summary ?? "")).toBe(false);
  });

  it("classifies low-confidence spring training groupings as spring_matchup", async () => {
    const result = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
    }, {
      fetchSchedule: async () => ({
        data: {
          teamKey: "NYM",
          teamId: 121,
          season: 2026,
          games: [
            makeGame({
              gamePk: 20,
              gameDate: "2026-03-12T23:10:00.000Z",
              gameType: "S",
              homeId: 121,
              homeKey: "NYM",
              homeName: "New York Mets",
              awayId: 144,
              awayKey: "ATL",
              awayName: "Atlanta Braves",
            }),
            makeGame({
              gamePk: 21,
              gameDate: "2026-03-13T23:10:00.000Z",
              gameType: "S",
              homeId: 121,
              homeKey: "NYM",
              homeName: "New York Mets",
              awayId: 144,
              awayKey: "ATL",
              awayName: "Atlanta Braves",
            }),
          ],
        },
        meta: testMeta("fixture"),
      }),
      now: () => new Date("2026-03-09T15:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.data?.groupingMode).toBe("spring_matchup");
    expect(result.data?.seriesType).toBe("spring_training_matchup");
    expect(result.data?.statusLine).toBe("Next spring training game");
  });

  it("uses spring-training matchup wording when no active spring series exists", async () => {
    const result = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
    }, {
      fetchSchedule: async () => ({
        data: {
          teamKey: "NYM",
          teamId: 121,
          season: 2026,
          games: [
            makeGame({
              gamePk: 30,
              gameDate: "2026-03-12T23:10:00.000Z",
              gameType: "S",
              homeId: 121,
              homeKey: "NYM",
              homeName: "New York Mets",
              awayId: 146,
              awayKey: "MIA",
              awayName: "Miami Marlins",
            }),
          ],
        },
        meta: testMeta("fixture"),
      }),
      now: () => new Date("2026-03-09T15:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.data?.groupingMode).toBe("spring_matchup");
    expect(result.data?.summary.toLowerCase()).toContain("spring training matchup");
    expect(result.data?.message).toBe("No active spring training series detected");
  });

  it("regular-season inferred series still works", async () => {
    const result = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
    }, {
      fetchSchedule: async () => ({
        data: {
          teamKey: "NYM",
          teamId: 121,
          season: 2026,
          games: [
            makeGame({
              gamePk: 40,
              gameDate: "2026-03-09T23:10:00.000Z",
              gameType: "R",
              homeId: 121,
              homeKey: "NYM",
              homeName: "New York Mets",
              awayId: 143,
              awayKey: "PHI",
              awayName: "Philadelphia Phillies",
            }),
            makeGame({
              gamePk: 41,
              gameDate: "2026-03-10T23:10:00.000Z",
              gameType: "R",
              homeId: 121,
              homeKey: "NYM",
              homeName: "New York Mets",
              awayId: 143,
              awayKey: "PHI",
              awayName: "Philadelphia Phillies",
            }),
          ],
        },
        meta: testMeta("fixture"),
      }),
      now: () => new Date("2026-03-09T15:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.data?.groupingMode).toBe("inferred_series");
    expect(result.data?.groupingMethod).toBe("opponent_consecutive_dates");
  });

  it("prefers official grouping when official markers are present", async () => {
    const result = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
    }, {
      fetchSchedule: async () => ({
        data: {
          teamKey: "NYM",
          teamId: 121,
          season: 2026,
          games: [
            makeGame({
              gamePk: 50,
              gameDate: "2026-03-09T23:10:00.000Z",
              gameType: "R",
              seriesDescription: "Regular Season",
              seriesGameNumber: 1,
              gamesInSeries: 3,
              homeId: 121,
              homeKey: "NYM",
              homeName: "New York Mets",
              awayId: 143,
              awayKey: "PHI",
              awayName: "Philadelphia Phillies",
            }),
            makeGame({
              gamePk: 51,
              gameDate: "2026-03-10T23:10:00.000Z",
              gameType: "R",
              seriesDescription: "Regular Season",
              seriesGameNumber: 2,
              gamesInSeries: 3,
              homeId: 121,
              homeKey: "NYM",
              homeName: "New York Mets",
              awayId: 143,
              awayKey: "PHI",
              awayName: "Philadelphia Phillies",
            }),
          ],
        },
        meta: testMeta("fixture"),
      }),
      now: () => new Date("2026-03-09T15:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.data?.groupingMode).toBe("official_series");
    expect(result.data?.groupingMethod).toBe("official");
  });

  it("beginner mode does not overstate spring training as series", async () => {
    const result = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "beginner",
      dataMode: "fixture",
    }, {
      fetchSchedule: async () => ({
        data: {
          teamKey: "NYM",
          teamId: 121,
          season: 2026,
          games: [
            makeGame({
              gamePk: 60,
              gameDate: "2026-03-12T23:10:00.000Z",
              gameType: "S",
              homeId: 121,
              homeKey: "NYM",
              homeName: "New York Mets",
              awayId: 147,
              awayKey: "NYY",
              awayName: "New York Yankees",
              homeProbableName: "David Peterson",
              awayProbableName: "Gerrit Cole",
            }),
          ],
        },
        meta: testMeta("fixture"),
      }),
      now: () => new Date("2026-03-09T15:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.data?.groupingMode).toBe("spring_matchup");
    expect(result.data?.summary.toLowerCase()).toContain("spring training matchup");
    expect(result.data?.summary.toLowerCase().includes("open a")).toBe(false);
    expect(result.data?.labels.includes("Series opener")).toBe(false);
  });

  it("keeps timeline ordering and postponed handling", async () => {
    const result = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
    });

    const timeline = result.data?.gameTimeline ?? [];
    expect(timeline.length).toBeGreaterThan(0);
    for (let index = 1; index < timeline.length; index += 1) {
      expect(new Date(timeline[index].dateTime).getTime()).toBeGreaterThanOrEqual(new Date(timeline[index - 1].dateTime).getTime());
    }
    expect(timeline.some((game) => game.status === "postponed")).toBe(true);
    expect(timeline.some((game) => game.postponed?.isPostponed)).toBe(true);
  });

  it("provides probable starter display data", async () => {
    const result = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
    });

    const starterRows = result.data?.gameTimeline.filter((game) => game.probableStarter?.fullName) ?? [];
    expect(starterRows.length).toBeGreaterThan(0);
    expect(starterRows[0].probableStarter?.fullName).toBeTruthy();
  });

  it("calculateSeriesScore and selection resolver stay stable", () => {
    const grouped = groupMlbSeriesGames({
      teamKey: "NYM",
      season: 2026,
      teamId: 121,
      now: new Date("2026-03-09T15:00:00.000Z"),
      games: [
        makeGame({
          gamePk: 70,
          gameDate: "2026-03-08T23:10:00.000Z",
          status: "final",
          abstractState: "Final",
          detailedState: "Final",
          gameType: "R",
          homeId: 121,
          homeKey: "NYM",
          homeName: "New York Mets",
          awayId: 144,
          awayKey: "ATL",
          awayName: "Atlanta Braves",
          homeScore: 4,
          awayScore: 3,
        }),
        makeGame({
          gamePk: 71,
          gameDate: "2026-03-09T23:10:00.000Z",
          gameType: "R",
          homeId: 121,
          homeKey: "NYM",
          homeName: "New York Mets",
          awayId: 144,
          awayKey: "ATL",
          awayName: "Atlanta Braves",
        }),
      ],
    });

    const score = calculateSeriesScore(grouped[0]);
    expect(score.teamWins).toBe(1);
    expect(score.opponentWins).toBe(0);
    const resolved = resolveSeriesSelection({
      series: grouped,
      now: new Date("2026-03-09T15:00:00.000Z"),
    });
    expect(resolved.selected?.lifecycle).toBe("active");
  });

  it("returns stable non-throwing result object", async () => {
    const result: MlbSeriesTrackerResult = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
    });

    expect(typeof result.ok).toBe("boolean");
    expect(result.meta).toBeTruthy();
    expect(result.error === null || typeof result.error === "object").toBe(true);
  });

  it("auto-promotes stale persisted spring matchup to current/upcoming", async () => {
    const now = new Date("2026-03-09T15:00:00.000Z");
    const games = [
      makeGame({
        gamePk: 200,
        gameDate: "2026-02-20T18:10:00.000Z",
        status: "final",
        abstractState: "Final",
        detailedState: "Final",
        gameType: "S",
        homeId: 121,
        homeKey: "NYM",
        homeName: "New York Mets",
        awayId: 147,
        awayKey: "NYY",
        awayName: "New York Yankees",
        homeScore: 4,
        awayScore: 2,
      }),
      makeGame({
        gamePk: 201,
        gameDate: "2026-03-09T23:10:00.000Z",
        gameType: "S",
        homeId: 121,
        homeKey: "NYM",
        homeName: "New York Mets",
        awayId: 147,
        awayKey: "NYY",
        awayName: "New York Yankees",
      }),
    ];
    const grouped = groupMlbSeriesGames({
      teamKey: "NYM",
      season: 2026,
      teamId: 121,
      games,
      now,
    });
    const staleSeriesId = grouped.find((series) => series.startDate === "2026-02-20")?.seriesId;
    expect(staleSeriesId).toBeTruthy();

    const result = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
      seriesId: staleSeriesId,
      selectionPinned: false,
    }, {
      fetchSchedule: async () => ({
        data: {
          teamKey: "NYM",
          teamId: 121,
          season: 2026,
          games,
        },
        meta: testMeta("fixture"),
      }),
      now: () => now,
    });

    expect(result.ok).toBe(true);
    expect(result.data?.selectionState).toBe("auto_promoted");
    expect(result.data?.seriesId).not.toBe(staleSeriesId);
    expect(result.data?.gameTimeline[0]?.gameId).toBe("201");
  });

  it("preserves intentional past selection when pinned", async () => {
    const now = new Date("2026-03-09T15:00:00.000Z");
    const games = [
      makeGame({
        gamePk: 210,
        gameDate: "2026-02-20T18:10:00.000Z",
        status: "final",
        abstractState: "Final",
        detailedState: "Final",
        gameType: "S",
        homeId: 121,
        homeKey: "NYM",
        homeName: "New York Mets",
        awayId: 147,
        awayKey: "NYY",
        awayName: "New York Yankees",
        homeScore: 3,
        awayScore: 1,
      }),
      makeGame({
        gamePk: 211,
        gameDate: "2026-03-09T23:10:00.000Z",
        gameType: "S",
        homeId: 121,
        homeKey: "NYM",
        homeName: "New York Mets",
        awayId: 147,
        awayKey: "NYY",
        awayName: "New York Yankees",
      }),
    ];
    const grouped = groupMlbSeriesGames({
      teamKey: "NYM",
      season: 2026,
      teamId: 121,
      games,
      now,
    });
    const staleSeriesId = grouped.find((series) => series.startDate === "2026-02-20")?.seriesId;
    expect(staleSeriesId).toBeTruthy();

    const result = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
      seriesId: staleSeriesId,
      selectionPinned: true,
    }, {
      fetchSchedule: async () => ({
        data: {
          teamKey: "NYM",
          teamId: 121,
          season: 2026,
          games,
        },
        meta: testMeta("fixture"),
      }),
      now: () => now,
    });

    expect(result.ok).toBe(true);
    expect(result.data?.selectionState).toBe("persisted_past");
    expect(result.data?.seriesId).toBe(staleSeriesId);
    expect(result.data?.canGoToCurrentSeries).toBe(true);
  });

  it("degrades cleanly when persisted seriesId is missing", async () => {
    const now = new Date("2026-03-09T15:00:00.000Z");
    const result = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
      seriesId: "missing-series-id",
    }, {
      fetchSchedule: async () => ({
        data: {
          teamKey: "NYM",
          teamId: 121,
          season: 2026,
          games: [
            makeGame({
              gamePk: 220,
              gameDate: "2026-03-09T23:10:00.000Z",
              gameType: "S",
              homeId: 121,
              homeKey: "NYM",
              homeName: "New York Mets",
              awayId: 146,
              awayKey: "MIA",
              awayName: "Miami Marlins",
            }),
          ],
        },
        meta: testMeta("fixture"),
      }),
      now: () => now,
    });

    expect(result.ok).toBe(true);
    expect(result.data?.selectionState).toBe("persisted_missing");
    expect(result.data?.seriesId).toBeTruthy();
    expect(result.data?.message).toBe("No active spring training series detected");
  });

  it("selects current spring matchup on first load and aligns with starting-pitcher game truth path", async () => {
    const now = new Date("2026-03-09T15:00:00.000Z");
    const games = [
      makeGame({
        gamePk: 230,
        gameDate: "2026-02-20T18:10:00.000Z",
        status: "final",
        abstractState: "Final",
        detailedState: "Final",
        gameType: "S",
        homeId: 121,
        homeKey: "NYM",
        homeName: "New York Mets",
        awayId: 147,
        awayKey: "NYY",
        awayName: "New York Yankees",
        homeScore: 6,
        awayScore: 2,
      }),
      makeGame({
        gamePk: 231,
        gameDate: "2026-03-09T23:10:00.000Z",
        gameType: "S",
        homeId: 121,
        homeKey: "NYM",
        homeName: "New York Mets",
        awayId: 147,
        awayKey: "NYY",
        awayName: "New York Yankees",
      }),
      makeGame({
        gamePk: 232,
        gameDate: "2026-03-10T23:10:00.000Z",
        gameType: "S",
        homeId: 121,
        homeKey: "NYM",
        homeName: "New York Mets",
        awayId: 147,
        awayKey: "NYY",
        awayName: "New York Yankees",
      }),
    ];

    const matchupGames = [
      {
        gameId: "230",
        startTime: "2026-02-20T18:10:00.000Z",
        dateKey: "2026-02-20",
        status: "final",
        awayTeam: { key: "NYY", name: "New York Yankees" },
        homeTeam: { key: "NYM", name: "New York Mets" },
        probableAway: null,
        probableHome: null,
      },
      {
        gameId: "231",
        startTime: "2026-03-09T23:10:00.000Z",
        dateKey: "2026-03-09",
        status: "scheduled",
        awayTeam: { key: "NYY", name: "New York Yankees" },
        homeTeam: { key: "NYM", name: "New York Mets" },
        probableAway: null,
        probableHome: null,
      },
      {
        gameId: "232",
        startTime: "2026-03-10T23:10:00.000Z",
        dateKey: "2026-03-10",
        status: "scheduled",
        awayTeam: { key: "NYY", name: "New York Yankees" },
        homeTeam: { key: "NYM", name: "New York Mets" },
        probableAway: null,
        probableHome: null,
      },
    ] as const;
    const matchupSelected = selectMatchupGame({
      games: matchupGames as unknown as Array<{
        gameId: string;
        startTime: string;
        dateKey: string;
        venue?: string;
        status: "scheduled" | "live" | "final";
        statusText?: string;
        awayTeam: { key: string; name: string; apiSportsTeamId?: string; logoUrl?: string };
        homeTeam: { key: string; name: string; apiSportsTeamId?: string; logoUrl?: string };
        probableAway: null;
        probableHome: null;
      }>,
      now,
      timeZone: "America/New_York",
    }).selected;

    const seriesResult = await resolveMlbSeriesTracker({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
    }, {
      fetchSchedule: async () => ({
        data: {
          teamKey: "NYM",
          teamId: 121,
          season: 2026,
          games,
        },
        meta: testMeta("fixture"),
      }),
      now: () => now,
    });

    expect(matchupSelected?.gameId).toBe("231");
    expect(seriesResult.data?.selectionState).toBe("current");
    expect(seriesResult.data?.gameTimeline[0]?.gameId).toBe(matchupSelected?.gameId);
  });
});
