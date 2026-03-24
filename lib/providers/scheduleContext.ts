import type { SportKey } from "@/lib/types/players";
import { buildScheduleWindow } from "@/lib/providers/scheduleWindow";

type ScheduleWindow = ReturnType<typeof buildScheduleWindow>;

type SeasonResolution = {
  season: string | undefined;
  inferredSeason: string;
  configuredSeason: string | undefined;
  usedConfiguredSeason: boolean;
  hadConfiguredMismatch: boolean;
  notes: string[];
};

type ScheduleQueryContext = {
  window: ScheduleWindow;
  season: string | undefined;
  seasonResolution: SeasonResolution;
  notes: string[];
};

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return null;
  }
  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
    day: Number(matched[3]),
  };
}

function inferSeasonForDate(sport: SportKey, dateIso: string): number {
  const parsed = parseIsoDate(dateIso);
  if (!parsed) {
    return new Date().getUTCFullYear();
  }

  if (sport === "mlb") {
    return parsed.year;
  }

  if (sport === "nba") {
    return parsed.month >= 10 ? parsed.year : parsed.year - 1;
  }

  return parsed.month <= 2 ? parsed.year - 1 : parsed.year;
}

export function resolveLeagueSeasonContext(args: {
  sport: SportKey;
  configuredSeason?: string;
  dateIso: string;
}): SeasonResolution {
  const inferred = String(inferSeasonForDate(args.sport, args.dateIso));
  const configuredSeason = args.configuredSeason?.trim() || undefined;

  if (!configuredSeason) {
    return {
      season: inferred,
      inferredSeason: inferred,
      configuredSeason: undefined,
      usedConfiguredSeason: false,
      hadConfiguredMismatch: false,
      notes: [`No configured season found; using inferred ${inferred}.`],
    };
  }

  if (configuredSeason === inferred) {
    return {
      season: configuredSeason,
      inferredSeason: inferred,
      configuredSeason,
      usedConfiguredSeason: true,
      hadConfiguredMismatch: false,
      notes: [`Configured season ${configuredSeason} matches inferred ${inferred}.`],
    };
  }

  return {
    season: inferred,
    inferredSeason: inferred,
    configuredSeason,
    usedConfiguredSeason: false,
    hadConfiguredMismatch: true,
    notes: [`Configured season ${configuredSeason} mismatched date context; using inferred ${inferred}.`],
  };
}

export function resolveScheduleQueryContext(args: {
  sport: SportKey;
  configuredSeason?: string;
  now?: Date;
  timeZone?: string;
  lookbackDays?: number;
  lookaheadDays?: number;
}): ScheduleQueryContext {
  const window = buildScheduleWindow({
    now: args.now,
    timeZone: args.timeZone,
    lookbackDays: args.lookbackDays,
    lookaheadDays: args.lookaheadDays,
  });
  const seasonResolution = resolveLeagueSeasonContext({
    sport: args.sport,
    configuredSeason: args.configuredSeason,
    dateIso: window.today,
  });

  return {
    window,
    season: seasonResolution.season,
    seasonResolution,
    notes: [
      `Schedule window ${window.startDate}..${window.endDate} (${window.timeZone}) with season ${seasonResolution.season ?? "unset"}.`,
      ...seasonResolution.notes,
    ],
  };
}
