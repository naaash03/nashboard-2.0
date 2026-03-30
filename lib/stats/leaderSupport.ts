import { findStatGlossaryEntry } from "@/lib/stats/glossary";
import type { StatSport } from "@/lib/stats/types";

const SUPPORTED_STAT_LEADER_KEYS = new Set([
  "MLB:ERA",
  "MLB:WHIP",
  "MLB:AVG",
  "MLB:OBP",
  "MLB:SLG",
  "MLB:OPS",
  "MLB:K/9",
  "MLB:BB/9",
  "NBA:PPG",
  "NBA:RPG",
  "NBA:APG",
  "NBA:SPG",
  "NBA:BPG",
  "NBA:Win %",
  "NFL:YPC",
  "NFL:Yards per Attempt",
  "NFL:Completion %",
  "NFL:Passer Rating",
  "NFL:QBR",
]);

export function hasStatLeaderSupport(statKey: string, sport?: StatSport): boolean {
  const entry = findStatGlossaryEntry(statKey, sport);
  if (!entry) {
    return false;
  }

  return SUPPORTED_STAT_LEADER_KEYS.has(`${entry.sport}:${entry.key}`);
}
