import type { Mode } from "@/lib/providers/types";
import { formatRecentFormSentence, recentFormRecord } from "@/lib/sports/resolvers/nflWidgets";
import type { NflRecentFormData } from "@/lib/types/nfl";

export type NflRecentFormUi = NflRecentFormData & {
  summary: string;
  streakSentence: string;
  recordLabel: string;
};

export function shapeNflRecentForm(data: NflRecentFormData, mode: Mode): NflRecentFormUi {
  const streakSentence = formatRecentFormSentence(data.currentStreak);
  const recordLabel = recentFormRecord(data.recentGames);
  const difficultyPct = Math.round(data.scheduleDifficulty * 100);

  return {
    ...data,
    streakSentence,
    recordLabel,
    summary: mode === "advanced"
      ? `${streakSentence} Last five: ${recordLabel}. Difficulty read: ${difficultyPct}% - ${data.scheduleLabel}.`
      : data.isOffseason
        ? `${streakSentence} These are the final five games from the completed season.`
        : `${streakSentence} Recent stretch reads as ${data.scheduleLabel.toLowerCase()}.`,
  };
}
