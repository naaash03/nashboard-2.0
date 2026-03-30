import { describe, expect, it } from "vitest";
import {
  buildPitcherVsLineupPitcherStatLine,
  buildPitcherVsProjectedLineupStateNotice,
} from "@/components/widgets/MlbPitcherVsProjectedLineupWidget";
import type { MlbPitcherVsProjectedLineupUi } from "@/lib/templates/mlbPitcherVsProjectedLineup";

function buildFixtureData(overrides?: Partial<MlbPitcherVsProjectedLineupUi>): MlbPitcherVsProjectedLineupUi {
  return {
    teamKey: "NYM",
    teamName: "New York Mets",
    game: {
      gameId: "500001",
      gameDate: "2026-04-02T23:10:00Z",
      officialDate: "2026-04-02",
      opponentKey: "HOU",
      opponentName: "Houston Astros",
      homeAway: "away",
      venue: "Daikin Park",
      probableStarterPosted: true,
    },
    verdict: "Neutral matchup",
    matchupScore: 50,
    confidenceLabel: "Low",
    reasons: ["Reason 1", "Reason 2", "Reason 3"],
    componentBreakdown: [],
    pitcherSummary: {
      fullName: "David Peterson",
      handedness: "L",
      record: "10-7",
      era: 3.5,
      kPer9: 10.2,
      bbPer9: 2.8,
      recentFormEra: 2.95,
      statsBasisLabel: "Using spring sample only",
      confidenceNote: "Recent sample is still thin.",
    },
    lineupSummary: {
      teamKey: "HOU",
      teamName: "Houston Astros",
      projectedLineupLabel: "Active-roster approximation",
      handednessSummary: "Projected mix looks balanced.",
      contactSummary: "AVG 0.246 | K/G 8.0",
    },
    assumptionsNote: "Assumption: approximate lineup, not a confirmed batting order.",
    selectableGames: [{ gameId: "500001", label: "Apr 2 - NYM at HOU" }],
    state: "success",
    notes: ["Projected lineup uses an active-roster approximation."],
    ...overrides,
  };
}

describe("MLB pitcher vs projected lineup widget helpers", () => {
  it("keeps the starter stat line compact for beginner presentation", () => {
    const stats = buildPitcherVsLineupPitcherStatLine(buildFixtureData().pitcherSummary);
    expect(stats).toEqual(["ERA 3.50", "K/9 10.2", "BB/9 2.8"]);
  });

  it("surfaces a clear partial-state notice without exposing advanced detail", () => {
    const notice = buildPitcherVsProjectedLineupStateNotice({
      loading: false,
      error: null,
      data: buildFixtureData({ state: "partial", pitcherSummary: null }),
    });

    expect(notice).toEqual({
      tone: "warning",
      title: "Starter not posted yet",
      detail: "This read uses the projected lineup only until the probable starter is listed.",
    });
  });
});
