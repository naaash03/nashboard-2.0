import type { PitcherArsenal } from "@/lib/providers/mlb";
import type { Mode } from "@/lib/providers/types";

export type MlbPitcherArsenalUi = {
  playerId: string;
  playerName?: string;
  season?: number;
  seasonLabel?: string;
  fallbackSeason?: number;
  status?: "current" | "fallback" | "unavailable";
  message?: string;
  seasonStats?: {
    era?: string;
    whip?: string;
    inningsPitched?: string;
    strikeOuts?: number;
    wins?: number;
    losses?: number;
    gamesStarted?: number;
  };
  pitches: Array<{
    type: string;
    usagePct?: number;
    velocityMph?: number;
    spinRpm?: number;
  }>;
};

export function shapeMlbPitcherArsenal(data: PitcherArsenal, mode: Mode): MlbPitcherArsenalUi {
  return {
    playerId: data.playerId,
    playerName: data.playerName,
    season: data.season,
    seasonLabel: data.seasonLabel,
    fallbackSeason: data.fallbackSeason,
    status: data.status,
    message: data.message,
    seasonStats: data.seasonStats,
    pitches: data.pitches.map((pitch) => {
      if (mode === "advanced") {
        return {
          type: pitch.type,
          usagePct: pitch.usagePct,
          velocityMph: pitch.velocityMph,
          spinRpm: pitch.spinRpm,
        };
      }

      return {
        type: pitch.type,
        usagePct: pitch.usagePct,
      };
    }),
  };
}
