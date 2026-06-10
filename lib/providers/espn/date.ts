export const ESPN_SCOREBOARD_TIME_ZONE = "America/New_York";

export function getEspnScoreboardLocalDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ESPN_SCOREBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format ESPN scoreboard date");
  }

  return `${year}-${month}-${day}`;
}

export function toEspnScoreboardDateParam(dateISO: string): string {
  return dateISO.replaceAll("-", "");
}
