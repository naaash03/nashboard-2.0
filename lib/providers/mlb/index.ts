import type { Meta } from "@/lib/providers/types";

export type MlbNextGames = {
  teamKey: string;
  games: Array<{ date: string; opponent: string; homeAway: "home" | "away" }>;
};

export type PitcherArsenal = {
  playerId?: string;
  playerName?: string;
  pitches: Array<{ type: string; usagePct?: number; velocityMph?: number }>;
};

export interface MlbProvider {
  getNextSevenGames(teamKey: string): Promise<{ data: MlbNextGames | null; meta: Meta }>;
  getPitcherArsenal(playerId: string): Promise<{ data: PitcherArsenal | null; meta: Meta }>;
}

export const mlbProviderStub: MlbProvider = {
  async getNextSevenGames() {
    return {
      data: null,
      meta: {
        sourceUsed: "demo",
        updatedAt: new Date().toISOString(),
        requestId: "mlb-next-7-stub",
        warning: "Data source to be added",
      },
    };
  },
  async getPitcherArsenal() {
    return {
      data: null,
      meta: {
        sourceUsed: "demo",
        updatedAt: new Date().toISOString(),
        requestId: "mlb-arsenal-stub",
        warning: "Data source to be added",
      },
    };
  },
};

