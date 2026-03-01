import type { SportKey } from "@/lib/types/players";

export type TeamStatus = {
  sport: SportKey;
  teamKey: string;
  hasGameToday: boolean;
  state?: "pre" | "in" | "post";
  opponent?: string;
  homeAway?: "home" | "away";
  displayClock?: string;
  score?: { team: number; opp: number };
  eventId?: string;
};

export type TeamStatusBatch = {
  sport: SportKey;
  statuses: TeamStatus[];
};
