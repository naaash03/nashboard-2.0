import type { Mode } from "@/lib/providers/types";
import type {
  MlbPitcherVsProjectedLineup,
  MlbPitcherVsProjectedLineupComponent,
  MlbPitcherVsProjectedLineupConfidence,
  MlbPitcherVsProjectedLineupVerdict,
} from "@/lib/providers/mlb";

export type MlbPitcherVsProjectedLineupUi = {
  teamKey: string;
  teamName: string;
  game: MlbPitcherVsProjectedLineup["game"];
  verdict?: MlbPitcherVsProjectedLineupVerdict;
  matchupScore?: number;
  confidenceLabel?: MlbPitcherVsProjectedLineupConfidence;
  reasons: string[];
  componentBreakdown?: MlbPitcherVsProjectedLineupComponent[];
  pitcherSummary: MlbPitcherVsProjectedLineup["pitcherSummary"];
  lineupSummary: MlbPitcherVsProjectedLineup["lineupSummary"];
  assumptionsNote: string;
  selectableGames: Array<{ gameId: string; label: string }>;
  pitcherSelection?: MlbPitcherVsProjectedLineup["pitcherSelection"];
  state: "success" | "partial";
  notes?: string[];
};

export function shapeMlbPitcherVsProjectedLineup(
  data: MlbPitcherVsProjectedLineup,
  mode: Mode,
): MlbPitcherVsProjectedLineupUi {
  return {
    teamKey: data.teamKey,
    teamName: data.teamName,
    game: data.game,
    verdict: data.verdict,
    matchupScore: data.matchupScore,
    confidenceLabel: data.confidenceLabel,
    reasons: data.reasons.slice(0, 3),
    componentBreakdown: mode === "advanced" ? data.componentBreakdown : undefined,
    pitcherSummary: data.pitcherSummary,
    lineupSummary: data.lineupSummary,
    assumptionsNote: data.assumptionsNote,
    selectableGames: data.selectableGames,
    pitcherSelection: mode === "advanced" ? data.pitcherSelection : undefined,
    state: data.state,
    notes: mode === "advanced" ? data.notes : undefined,
  };
}
