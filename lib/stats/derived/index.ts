type RecentFormGame = {
  won: boolean;
  margin: number;
};

type MatchupTeam = {
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Returns a 0-100 recent-form score from an ordered game list, with later games
 * treated as more recent and therefore weighted more heavily.
 *
 * Applies to:
 * - NFL
 * - NBA
 * - MLB
 *
 * Output range:
 * - `0` to `100`
 * - returns `50` when no games are provided
 */
export function recentFormScore(games: RecentFormGame[]): number {
  if (games.length === 0) {
    return 50;
  }

  let weightedScoreSum = 0;
  let totalWeight = 0;

  for (let index = 0; index < games.length; index += 1) {
    const game = games[index];
    const recencyWeight = index + 1;
    const resultScore = game.won ? 1 : 0;
    const marginScore = (clamp(game.margin, -28, 28) + 28) / 56;
    const gameScore = (resultScore * 0.75) + (marginScore * 0.25);

    weightedScoreSum += gameScore * recencyWeight;
    totalWeight += recencyWeight;
  }

  return Math.round((weightedScoreSum / totalWeight) * 100);
}

/**
 * Returns a matchup edge score for team A versus team B. Positive means team A
 * is favored, negative means team B is favored, and values near zero imply a
 * roughly even matchup.
 *
 * Applies to:
 * - NFL
 * - NBA
 * - MLB
 *
 * Output range:
 * - `-100` to `100`
 */
export function matchupDelta(teamA: MatchupTeam, teamB: MatchupTeam): number {
  const teamANet = teamA.pointsFor - teamA.pointsAgainst;
  const teamBNet = teamB.pointsFor - teamB.pointsAgainst;
  const winPctEdge = (teamA.winPct - teamB.winPct) * 100;
  const netEdge = (teamANet - teamBNet) * 2.5;

  return clamp(winPctEdge + netEdge, -100, 100);
}

/**
 * Returns a pace-normalized rate using the standard possession adjustment:
 * `raw * (leaguePace / pace)`.
 *
 * Applies to:
 * - NBA
 * - any sport/model where a rate should be normalized to league-average pace
 *
 * Output range:
 * - unbounded finite number when `pace > 0`
 * - returns `raw` unchanged when `pace <= 0`
 */
export function paceAdjustedRate(raw: number, pace: number, leaguePace: number): number {
  if (pace <= 0) {
    return raw;
  }

  return raw * (leaguePace / pace);
}
