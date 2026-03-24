export const SCHEDULE_TIMEZONE = "America/New_York";
export const SCHEDULE_LOOKBACK_DAYS = 3;
export const SCHEDULE_LOOKAHEAD_DAYS = 7;

type DateParts = { year: number; month: number; day: number };

function parseDateParts(dateText: string): DateParts | null {
  const matched = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return null;
  }
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return { year, month, day };
}

function shiftIsoDate(baseDate: string, offsetDays: number): string {
  const parsed = parseDateParts(baseDate);
  if (!parsed) {
    return baseDate;
  }
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function formatDateInTimeZone(value: Date, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
  return formatted;
}

export function getNowInTZ(timeZone = SCHEDULE_TIMEZONE): { now: Date; today: string; timeZone: string } {
  const now = new Date();
  return {
    now,
    today: formatDateInTimeZone(now, timeZone),
    timeZone,
  };
}

export function buildScheduleWindow(args?: {
  timeZone?: string;
  lookbackDays?: number;
  lookaheadDays?: number;
  now?: Date;
}): {
  timeZone: string;
  today: string;
  startDate: string;
  endDate: string;
  lookbackDays: number;
  lookaheadDays: number;
} {
  const timeZone = args?.timeZone ?? SCHEDULE_TIMEZONE;
  const lookbackDays = args?.lookbackDays ?? SCHEDULE_LOOKBACK_DAYS;
  const lookaheadDays = args?.lookaheadDays ?? SCHEDULE_LOOKAHEAD_DAYS;
  const now = args?.now ?? new Date();
  const today = formatDateInTimeZone(now, timeZone);
  return {
    timeZone,
    today,
    startDate: shiftIsoDate(today, -lookbackDays),
    endDate: shiftIsoDate(today, lookaheadDays),
    lookbackDays,
    lookaheadDays,
  };
}

export function buildDateRange(args?: {
  timeZone?: string;
  lookbackDays?: number;
  lookaheadDays?: number;
  now?: Date;
}): {
  timeZone: string;
  today: string;
  startDate: string;
  endDate: string;
  lookbackDays: number;
  lookaheadDays: number;
} {
  return buildScheduleWindow(args);
}
