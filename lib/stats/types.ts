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

export type StatLeader = {
  rank: number;
  playerName: string;
  team: string;
  value: string;
};

export type StatLeaderSourceUsed = "mlb" | "cache" | "fixture" | "fallback";

export type StatLeadersResponse = {
  statKey: string;
  sport: StatSport;
  season: number;
  leaders: StatLeader[];
  sourceUsed: StatLeaderSourceUsed;
  usedFallback: boolean;
  updatedAt: string;
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
