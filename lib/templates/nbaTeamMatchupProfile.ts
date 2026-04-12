import type { Mode } from "@/lib/providers/types";
import type { TeamMatchupDemoData } from "@/lib/providers/espn/nbaScaffolds";

export type NbaTeamMatchupProfileUi = TeamMatchupDemoData & {
  summary: string;
};

export function shapeNbaTeamMatchupProfile(
  data: TeamMatchupDemoData,
  mode: Mode,
): NbaTeamMatchupProfileUi {
  return {
    ...data,
    summary: mode === "advanced" ? data.advancedSummary : data.beginnerSummary,
  };
}
