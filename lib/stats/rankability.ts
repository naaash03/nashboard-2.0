/**
 * Rankability registry — determines which stats support live leaderboard ranking
 * inside the shared stat explainer modal.
 *
 * Architecture note: this file is pure data + helpers (no server-only imports)
 * so it can be imported safely from both client components and API routes.
 */

export type RankingEntityType = "player" | "team";

/** Subject context passed from a widget through StatLabel → StatExplainerProvider → modal. */
export type RankingContext = {
  entityType: RankingEntityType;
  /** MLB statsapi.mlb.com player ID, e.g. "592450" */
  entityId?: string;
  /** 3-letter team key used throughout NashBoard, e.g. "NYM" */
  teamKey?: string;
  /** Display name shown in the leaderboard if subject is not in top 10 */
  entityName?: string;
  /** The stat value the subject currently holds (shown next to their name) */
  statValue?: string | number;
  season?: number;
  /**
   * Sport override for multi-sport glossary terms (e.g. w_l_record has sport "ALL"
   * in the glossary but the rankability registry entry is "w_l_record:MLB").
   * Widgets should pass their concrete sport here so isRankable resolves correctly.
   */
  sport?: string;
};

type StatRankabilityRule = {
  sport: "MLB" | "NBA" | "NFL";
  entityType: RankingEntityType;
  /**
   * The leaderCategories value for the MLB Stats API leaders endpoint.
   * Omit for team-level stats that are resolved from standings instead.
   */
  mlbLeaderCategory?: string;
  /** Short label shown next to the section heading, e.g. "MLB qualified starters" */
  scopeLabel: string;
  /** Qualifier/filter description, e.g. "Min. 1 IP per team game" */
  qualifierText: string;
};

type RankabilityKey = string; // `${statKey}:${sport}`

const REGISTRY: Record<RankabilityKey, StatRankabilityRule> = {
  // ── MLB pitcher rate stats (per-9 leaderboards) ──────────────────────────
  "era:MLB": {
    sport: "MLB",
    entityType: "player",
    mlbLeaderCategory: "earnedRunAverage",
    scopeLabel: "MLB qualified starters",
    qualifierText: "Min. 1 IP per team game",
  },
  "whip:MLB": {
    sport: "MLB",
    entityType: "player",
    mlbLeaderCategory: "walksAndHitsPerInningPitched",
    scopeLabel: "MLB qualified starters",
    qualifierText: "Min. 1 IP per team game",
  },
  "k_per_9:MLB": {
    sport: "MLB",
    entityType: "player",
    mlbLeaderCategory: "strikeoutsPer9Inn",
    scopeLabel: "MLB qualified starters",
    qualifierText: "Min. 1 IP per team game",
  },
  "bb_per_9:MLB": {
    sport: "MLB",
    entityType: "player",
    mlbLeaderCategory: "walksPer9Inn",
    scopeLabel: "MLB qualified starters",
    qualifierText: "Min. 1 IP per team game",
  },
  "hr_per_9:MLB": {
    sport: "MLB",
    entityType: "player",
    mlbLeaderCategory: "homeRunsPer9Inn",
    scopeLabel: "MLB qualified starters",
    qualifierText: "Min. 1 IP per team game",
  },
  "innings_pitched:MLB": {
    sport: "MLB",
    entityType: "player",
    mlbLeaderCategory: "inningsPitched",
    scopeLabel: "MLB pitchers (all appearances)",
    qualifierText: "All pitchers with ≥1 appearance",
  },
  // ── MLB hitter rate stats ─────────────────────────────────────────────────
  "avg:MLB": {
    sport: "MLB",
    entityType: "player",
    mlbLeaderCategory: "battingAverage",
    scopeLabel: "MLB qualified hitters",
    qualifierText: "Min. 3.1 PA per team game",
  },
  "obp:MLB": {
    sport: "MLB",
    entityType: "player",
    mlbLeaderCategory: "onBasePercentage",
    scopeLabel: "MLB qualified hitters",
    qualifierText: "Min. 3.1 PA per team game",
  },
  "slg:MLB": {
    sport: "MLB",
    entityType: "player",
    mlbLeaderCategory: "sluggingPercentage",
    scopeLabel: "MLB qualified hitters",
    qualifierText: "Min. 3.1 PA per team game",
  },
  "ops:MLB": {
    sport: "MLB",
    entityType: "player",
    mlbLeaderCategory: "onBasePlusSlugging",
    scopeLabel: "MLB qualified hitters",
    qualifierText: "Min. 3.1 PA per team game",
  },
  // ── MLB team stats (resolved from standings) ─────────────────────────────
  "run_differential:MLB": {
    sport: "MLB",
    entityType: "team",
    scopeLabel: "All 30 MLB teams",
    qualifierText: "Current season standings",
  },
  "w_l_record:MLB": {
    sport: "MLB",
    entityType: "team",
    scopeLabel: "All 30 MLB teams",
    qualifierText: "Current season standings (win pct)",
  },
};

/** Returns the rankability rule for a given stat key + sport, or null if not rankable. */
export function getRankabilityRule(statKey: string, sport: string): StatRankabilityRule | null {
  return REGISTRY[`${statKey}:${sport}`] ?? null;
}

export type RankableStat = {
  statKey: string;
  sport: "MLB" | "NBA" | "NFL";
  entityType: RankingEntityType;
  scopeLabel: string;
};

/**
 * Enumerate every stat that supports a live leaderboard for a sport. Used to
 * populate the standalone Leaderboards widget's category picker.
 */
export function listRankableStats(sport: string): RankableStat[] {
  const upper = sport.trim().toUpperCase();
  return Object.entries(REGISTRY)
    .filter(([, rule]) => rule.sport === upper)
    .map(([key, rule]) => ({
      statKey: key.split(":")[0],
      sport: rule.sport,
      entityType: rule.entityType,
      scopeLabel: rule.scopeLabel,
    }));
}

/**
 * Returns true when a stat supports live ranking data.
 * Optionally filters by entityType so that, e.g., "avg" is only rankable
 * for players (not teams), preventing a team widget from requesting a
 * player leaderboard.
 */
export function isRankable(
  statKey: string,
  sport: string,
  entityType?: RankingEntityType,
): boolean {
  const rule = getRankabilityRule(statKey, sport);
  if (!rule) return false;
  if (entityType !== undefined && rule.entityType !== entityType) return false;
  return true;
}
