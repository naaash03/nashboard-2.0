import type { Mode } from "@/lib/providers/types";
import type { RestScheduleDemoData } from "@/lib/providers/espn/nbaScaffolds";

export type NbaRestScheduleSpotUi = RestScheduleDemoData & {
  summary: string;
};

export function shapeNbaRestScheduleSpot(
  data: RestScheduleDemoData,
  mode: Mode,
): NbaRestScheduleSpotUi {
  return {
    ...data,
    summary: mode === "advanced" ? data.advancedSummary : data.beginnerSummary,
  };
}
