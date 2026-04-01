import { mlbProvider as baseMlbProvider } from "@/lib/providers/mlb/provider";
import {
  mlbSearchPlayers,
  mlbGetRecentResults,
  mlbGetRecentForm,
  mlbGetPlayerSeasonStats,
  mlbGetTeamSeasonStats,
  mlbGetBullpenFatigue,
  mlbGetPlatoonAdvantage,
} from "@/lib/providers/mlb/teamStats";
import type { MlbProvider } from "@/lib/providers/mlb/provider";
import type {
  MlbRecentResult,
  MlbRecentResults,
  MlbRecentForm,
  MlbRecentFormPeriod,
  MlbPlayerSearchResult,
  MlbPlayerYearStats,
  MlbPlayerSeasonStats,
  MlbTeamSeasonStatsData,
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
  getRecentResults(teamKey: string, limit?: number, dataMode?: ModeArg): Promise<{ data: MlbRecentResults | null; meta: Meta }>;
  getRecentForm(teamKey: string, dataMode?: ModeArg): Promise<{ data: MlbRecentForm | null; meta: Meta }>;
  getPlayerSeasonStats(playerId: string, dataMode?: ModeArg): Promise<{ data: MlbPlayerSeasonStats | null; meta: Meta }>;
  getTeamSeasonStats(teamKey: string, season: number, dataMode?: ModeArg): Promise<{ data: MlbTeamSeasonStatsData | null; meta: Meta }>;
  getBullpenFatigue(teamKey: string, dataMode?: ModeArg): Promise<{ data: MlbBullpenFatigue | null; meta: Meta }>;
  getPlatoonAdvantage(teamKey: string, dataMode?: ModeArg): Promise<{ data: MlbPlatoonAdvantage | null; meta: Meta }>;
  searchPlayers(q: string, limit: number, dataMode?: ModeArg): Promise<{ data: MlbPlayerSearchResult[] | null; meta: Meta }>;
};

export const mlbProvider: ExtendedMlbProvider = {
  ...baseMlbProvider,
  getRecentResults: mlbGetRecentResults,
  getRecentForm: mlbGetRecentForm,
  getPlayerSeasonStats: mlbGetPlayerSeasonStats,
  getTeamSeasonStats: mlbGetTeamSeasonStats,
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
  MlbRecentResult,
  MlbRecentResults,
  MlbRecentForm,
  MlbRecentFormPeriod,
  MlbPlayerSearchResult,
  MlbPlayerYearStats,
  MlbPlayerSeasonStats,
  MlbTeamSeasonStatsData,
  MlbBullpenFatigue,
  MlbPitcherAvailability,
  MlbStarterRow,
  PitcherRecentAppearance,
  MlbPlatoonAdvantage,
  MlbPlatoonPitcher,
  MlbHandednessAnalysis,
  MlbPitcherSplitsData,
};
