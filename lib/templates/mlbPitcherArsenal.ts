import type { PitcherArsenal } from "@/lib/providers/mlb";
import type { Mode } from "@/lib/providers/types";

export type MlbPitcherArsenalUi = {
  playerId: string;
  playerName?: string;
  pitches: Array<{
    type: string;
    usagePct?: number;
    velocityMph?: number;
  }>;
};

export function shapeMlbPitcherArsenal(data: PitcherArsenal, mode: Mode): MlbPitcherArsenalUi {
  return {
    playerId: data.playerId,
    playerName: data.playerName,
    pitches: data.pitches.map((pitch) => {
      if (mode === "advanced") {
        return {
          type: pitch.type,
          usagePct: pitch.usagePct,
          velocityMph: pitch.velocityMph,
        };
      }

      return {
        type: pitch.type,
        usagePct: pitch.usagePct,
      };
    }),
  };
}
