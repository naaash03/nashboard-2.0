import type { Mode } from "@/lib/providers/types";
import type { NflTeamContextCardData } from "@/lib/types/nfl";

export type NflTeamContextCardUi = NflTeamContextCardData & {
  summary: string;
  statusLabel: string;
  seasonLabel: string | null;
};

export function shapeNflTeamContextCard(data: NflTeamContextCardData, mode: Mode): NflTeamContextCardUi {
  const recordLabel = data.currentRecord
    ? `${data.currentRecord.wins}-${data.currentRecord.losses}${data.currentRecord.ties ? `-${data.currentRecord.ties}` : ""}`
    : "Record unavailable";
  const nextLabel = data.nextGame
    ? `Next up: ${data.nextGame.awayTeam.teamKey} at ${data.nextGame.homeTeam.teamKey} in Week ${data.nextGame.week}.`
    : data.mostRecentGame
      ? `Last game: ${data.mostRecentGame.awayTeam.teamKey} at ${data.mostRecentGame.homeTeam.teamKey} in Week ${data.mostRecentGame.week}.`
      : "No game card is available right now.";

  return {
    ...data,
    seasonLabel: data.isHistoricalSeason ? `${data.season} Season` : null,
    statusLabel: data.isOffseason
      ? "Offseason"
      : data.isByeWeek
        ? "Bye week"
        : data.nextGame
          ? "What's next"
          : "Last game",
    summary: mode === "advanced"
      ? `${nextLabel} Current record: ${recordLabel}.${data.isHistoricalSeason ? ` This card is pinned to the completed ${data.season} season.` : ""} ${data.divisionRank ? `Division rank: ${data.divisionRank}.` : ""} ${data.currentRank ? `Conference seed: ${data.currentRank}.` : ""}`.trim()
      : data.isHistoricalSeason
        ? `${nextLabel} ${recordLabel === "Record unavailable" ? "" : `${data.season} finished at ${recordLabel}.`}`.trim()
        : data.isOffseason
        ? `No games scheduled right now. ${recordLabel === "Record unavailable" ? "" : `${recordLabel} was the latest known record.`}`.trim()
        : data.isByeWeek
          ? `This team is in a quieter spot before the next game. ${recordLabel === "Record unavailable" ? "" : `They are ${recordLabel} so far.`}`.trim()
          : `${nextLabel} ${recordLabel === "Record unavailable" ? "" : `The current record is ${recordLabel}.`}`.trim(),
  };
}
