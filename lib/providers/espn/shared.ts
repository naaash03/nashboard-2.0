import type { TeamRecord } from "@/lib/providers/types";

/** Convert an ISO date (YYYY-MM-DD) to the compact form ESPN expects (YYYYMMDD). */
export function toCompactDate(dateISO: string): string {
  return dateISO.replaceAll("-", "");
}

/** Map an ESPN season.type code to a human-readable game type. */
export function gameTypeFromSeasonType(type?: number): string | undefined {
  if (type === 1) return "preseason";
  if (type === 2) return "regular";
  if (type === 3) return "postseason";
  return undefined;
}

/** Parse an ESPN record summary string ("12-4") into wins/losses. */
export function parseRecord(summary?: string): TeamRecord | undefined {
  if (!summary) {
    return undefined;
  }
  const [wins, losses] = summary.split("-").map((value) => Number(value.trim()));
  if (!Number.isFinite(wins) || !Number.isFinite(losses)) {
    return undefined;
  }
  return { wins, losses };
}
