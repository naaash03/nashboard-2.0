import { mlbProvider as baseMlbProvider } from "@/lib/providers/mlb/provider";
import {
  mlbSearchPlayers,
  mlbGetRecentForm,
  mlbGetBullpenFatigue,
  mlbGetPlatoonAdvantage,
} from "@/lib/providers/mlb/teamStats";
import type { MlbProvider } from "@/lib/providers/mlb/provider";
import type {
  MlbRecentForm,
  MlbRecentFormPeriod,
  MlbPlayerSearchResult,
  MlbBullpenFatigue,
  MlbPitcherAvailability,
  MlbStarterRow,
  PitcherRecentAppearance,
  MlbPlatoonAdvantage,
  MlbPlatoonPitcher,
  MlbHandednessAnalysis,
  MlbPitcherSplitsData,
} from "@/lib/providers/mlb/teamStats";
import type { Meta } from "@/lib/providers/types";

type ModeArg = "auto" | "live" | "fixture";

// Extended provider type that includes all methods used by route handlers
type ExtendedMlbProvider = MlbProvider & {
  getRecentForm(teamKey: string, dataMode?: ModeArg): Promise<{ data: MlbRecentForm | null; meta: Meta }>;
  getBullpenFatigue(teamKey: string, dataMode?: ModeArg): Promise<{ data: MlbBullpenFatigue | null; meta: Meta }>;
  getPlatoonAdvantage(teamKey: string, dataMode?: ModeArg): Promise<{ data: MlbPlatoonAdvantage | null; meta: Meta }>;
  searchPlayers(q: string, limit: number, dataMode?: ModeArg): Promise<{ data: MlbPlayerSearchResult[] | null; meta: Meta }>;
};

export const mlbProvider: ExtendedMlbProvider = {
  ...baseMlbProvider,
  getRecentForm: mlbGetRecentForm,
  getBullpenFatigue: mlbGetBullpenFatigue,
  getPlatoonAdvantage: mlbGetPlatoonAdvantage,
  searchPlayers: mlbSearchPlayers,
};

export { getMlbTeamSeasonScheduleWithProbables, getMlbUpcomingScheduleWithProbables } from "@/lib/providers/mlb/provider";
export { resolveMlbPitcherComparisonStats } from "@/lib/providers/mlb/pitcherComparison";

export type {
  MlbProvider,
  MlbNextGame,
  MlbNextGames,
  MlbScheduledGame,
  MlbScheduledProbableStarter,
  MlbScheduledTeam,
  MlbArsenalPitch,
  PitcherArsenal,
} from "@/lib/providers/mlb/provider";

export type {
  MlbPitcherComparisonCard,
  MlbPitcherLastStart,
  MlbPitcherStatBasis,
  ResolveMlbPitcherComparisonStatsArgs,
  ResolveMlbPitcherComparisonStatsResult,
} from "@/lib/providers/mlb/pitcherComparison";

// Team stats types
export type {
  MlbRecentForm,
  MlbRecentFormPeriod,
  MlbPlayerSearchResult,
  MlbBullpenFatigue,
  MlbPitcherAvailability,
  MlbStarterRow,
  PitcherRecentAppearance,
  MlbPlatoonAdvantage,
  MlbPlatoonPitcher,
  MlbHandednessAnalysis,
  MlbPitcherSplitsData,
};
