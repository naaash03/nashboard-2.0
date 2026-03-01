import type { Mode, Player } from "@/lib/providers/types";

export function shapePlayerCard(player: Player, mode: Mode) {
  const beginner = {
    playerId: player.playerId,
    fullName: player.fullName,
    team: player.teamName,
    position: player.position,
    jersey: player.jersey,
    headshotUrl: player.headshotUrl,
    teamLogoUrl: player.teamLogoUrl,
    weightLbs: player.weightLbs,
    whyItMatters:
      "Track role, matchup relevance, and recent production before making lineup or watch decisions.",
    tooltip: "Use this profile as your fast baseline before diving into advanced context.",
  };

  if (mode === "advanced") {
    return {
      ...beginner,
      stats: player.stats ?? {},
      heightIn: player.heightIn,
      learnMore: `https://www.espn.com/nfl/player/_/id/${player.playerId}`,
    };
  }

  return beginner;
}

