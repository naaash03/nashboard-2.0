import type { SportKey as BaseSportKey } from "@/lib/types/players";
import type { TeamStatus } from "@/lib/types/teamStatus";

export type SportKey = BaseSportKey;

export type PlayerInsights = {
  sport: SportKey;
  playerId: string;
  fullName?: string;
  teamAbbrev?: string;
  teamName?: string;
  injury?: { status?: string; detail?: string } | null;
  live?: TeamStatus | null;
  season?: {
    headline: string;
    metrics: { key: string; label: string; value: string }[];
    source: "upstream" | "derived";
    sampleSize?: number;
  } | null;
  recent?: {
    headline: string;
    games: { date?: string; opponent?: string; result?: string; line: string }[];
    source: "upstream" | "derived";
  } | null;
  metaNotes?: string[];
};

export type TeamAdvanced = {
  teamKey: string;
  teamName?: string;
  status: TeamStatus;
  nextGame?: { when?: string; vs?: string; homeAway?: "home" | "away" } | null;
  record?: { wins: number; losses: number; pct?: string; streak?: string; last10?: string } | null;
  standings?: { rank?: string; division?: string; conference?: string } | null;
  lastGame?: { when?: string; vs?: string; result?: string; score?: string } | null;
  metaNotes?: string[];
};
