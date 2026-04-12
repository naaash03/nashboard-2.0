import type { Mode } from "@/lib/providers/types";
import type { PlayerRoleFormDemoData } from "@/lib/providers/espn/nbaScaffolds";

export type NbaPlayerRoleFormUi = PlayerRoleFormDemoData & {
  summary: string;
};

export function shapeNbaPlayerRoleForm(
  data: PlayerRoleFormDemoData,
  mode: Mode,
): NbaPlayerRoleFormUi {
  return {
    ...data,
    summary: mode === "advanced" ? data.advancedSummary : data.beginnerSummary,
  };
}
