export type StatSport = "MLB" | "NBA" | "NFL";

export type StatBetterDirection = "higher" | "lower" | "contextual";

export type StatThresholdTone = "elite" | "good" | "average" | "warning";

export type StatFormulaPart = {
  label: string;
  value: string;
};

export type StatThreshold = {
  label: string;
  rangeLabel: string;
  interpretation: string;
  tone: StatThresholdTone;
};

export type StatGlossaryEntry = {
  key: string;
  sport: StatSport;
  displayName: string;
  aliases: string[];
  shortDescription: string;
  plainEnglishExplanation: string;
  formulaText: string;
  formulaParts: StatFormulaPart[];
  betterDirection: StatBetterDirection;
  thresholds: StatThreshold[];
  leagueAverageLabel: string;
  impactTags: string[];
  advancedNote?: string;
};
