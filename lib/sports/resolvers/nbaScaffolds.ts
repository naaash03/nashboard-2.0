import {
  getNbaPlayerRoleFormDemo,
  getNbaRestScheduleSpotDemo,
  getNbaTeamMatchupProfileDemo,
} from "@/lib/providers/espn/nbaScaffolds";

type DataMode = "auto" | "live" | "fixture";

export function resolveNbaTeamMatchupProfile(args: {
  scenarioId?: string;
  dataMode: DataMode;
}) {
  return getNbaTeamMatchupProfileDemo(args.scenarioId, args.dataMode);
}

export function resolveNbaRestScheduleSpot(args: {
  scenarioId?: string;
  dataMode: DataMode;
}) {
  return getNbaRestScheduleSpotDemo(args.scenarioId, args.dataMode);
}

export function resolveNbaPlayerRoleForm(args: {
  scenarioId?: string;
  dataMode: DataMode;
}) {
  return getNbaPlayerRoleFormDemo(args.scenarioId, args.dataMode);
}
