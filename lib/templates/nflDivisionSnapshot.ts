import type { Mode } from "@/lib/providers/types";
import { formatDivisionFilterLabel } from "@/lib/sports/resolvers/nflWidgets";
import type { NflConference, NflDivision, NflDivisionSnapshotData } from "@/lib/types/nfl";

export type NflDivisionSnapshotUi = NflDivisionSnapshotData & {
  title: string;
  summary: string;
  seasonLabel: string | null;
};

export function shapeNflDivisionSnapshot(
  data: NflDivisionSnapshotData,
  mode: Mode,
  filters?: { conference?: NflConference; division?: NflDivision },
): NflDivisionSnapshotUi {
  const filterLabel = formatDivisionFilterLabel(filters?.conference, filters?.division);
  const leaderCount = data.divisions.reduce((sum, group) => sum + group.teams.filter((team) => team.divisionLeader).length, 0);
  const pointDiffNote = mode === "advanced"
    ? ` Advanced mode includes win percentage, points for/against, and point differential context.`
    : "";
  const leader = data.divisions[0]?.teams[0];
  const leaderNote = leader
    ? `${leader.name} sets the visible pace at ${leader.wins}-${leader.losses}${leader.ties ? `-${leader.ties}` : ""}.`
    : "No live standings rows were available.";

  return {
    ...data,
    title: `${filterLabel} Standings`,
    seasonLabel: data.isOffseason ? `${data.season} Final Standings` : null,
    summary: data.isOffseason
      ? `Final ${data.season} standings snapshot for ${filterLabel}. ${leaderCount} visible division leader${leaderCount === 1 ? "" : "s"} are shown.${pointDiffNote}`
      : `${leaderNote}${pointDiffNote}`,
    divisions: data.divisions,
  } as NflDivisionSnapshotUi;
}
