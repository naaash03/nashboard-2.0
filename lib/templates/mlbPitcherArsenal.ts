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

function sortArsenalPitches(pitches: PitcherArsenal["pitches"]): PitcherArsenal["pitches"] {
  return [...pitches].sort((left, right) => {
    const usageDelta = (right.usagePct ?? -1) - (left.usagePct ?? -1);
    if (usageDelta !== 0) {
      return usageDelta;
    }

    const velocityDelta = (right.velocityMph ?? -1) - (left.velocityMph ?? -1);
    if (velocityDelta !== 0) {
      return velocityDelta;
    }

    return left.type.localeCompare(right.type);
  });
}

export function shapeMlbPitcherArsenal(data: PitcherArsenal, mode: Mode): MlbPitcherArsenalUi {
  const pitches = sortArsenalPitches(data.pitches);

  return {
    playerId: data.playerId,
    playerName: data.playerName,
    pitches: pitches.map((pitch) => {
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
