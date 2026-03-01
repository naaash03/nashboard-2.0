import type { Mode, RbVsDlineStats } from "@/lib/providers/types";

export function shapeRbVsDline(stats: RbVsDlineStats, mode: Mode) {
  const beginner = {
    team: stats.teamName,
    opponent: stats.opponentName,
    rbName: stats.rb.fullName,
    rbAttempts: stats.rb.attempts,
    rbYards: stats.rb.yards,
    rbYpc: stats.rb.ypc,
    rbTds: stats.rb.tds,
    rbExplosiveRuns: stats.rb.explosiveRuns,
    defRushYardsAllowed: stats.defense.rushYardsAllowed,
    defYpcAllowed: stats.defense.ypcAllowed,
    defRushTdsAllowed: stats.defense.rushTdsAllowed,
    defExplosiveRunsAllowed: stats.defense.explosiveRunsAllowed,
    disclaimer: stats.disclaimer,
    whyItMatters:
      "RB volume and efficiency only matter if the matchup allows rushing success.",
    tooltip: "Compare RB efficiency against opponent run defense to estimate floor and ceiling.",
  };

  if (mode === "advanced") {
    return {
      ...beginner,
      learnMore: "https://www.espn.com/nfl/stats/team/_/stat/rushing",
      matchupDelta:
        typeof stats.rb.ypc === "number" && typeof stats.defense.ypcAllowed === "number"
          ? Number((stats.rb.ypc - stats.defense.ypcAllowed).toFixed(2))
          : null,
    };
  }

  return beginner;
}

