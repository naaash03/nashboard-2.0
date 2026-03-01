export type SportKey = "nfl" | "mlb" | "nba";

export type PlayerSearchResult = {
  playerId: string;
  fullName: string;
  teamName?: string;
  position?: string;
  headshot?: string;
};

export type PlayerProfile = {
  playerId: string;
  fullName: string;
  teamName?: string;
  position?: string;
  headshot?: string;
  jersey?: string;
  age?: number;
  height?: string;
  weight?: string;
  whyItMatters?: string;
  tooltip?: string;
  stats?: Record<string, string | number | null>;
  learnMore?: string;
};

export type ApiError = {
  message: string;
  code: string;
};

export type Envelope<T> = {
  data: T | null;
  meta: import("@/lib/providers/types").Meta;
  error?: ApiError;
};
