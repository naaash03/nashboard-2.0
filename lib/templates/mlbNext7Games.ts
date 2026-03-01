import type { MlbNextGames } from "@/lib/providers/mlb";
import type { Mode } from "@/lib/providers/types";

export type MlbNextSevenUiGame = {
  date: string;
  opponent: string;
  homeAway: "home" | "away";
  matchup: string;
  gamePk?: number;
  probablePitcherName?: string;
};

export type MlbNextSevenUi = {
  teamKey: string;
  games: MlbNextSevenUiGame[];
};

export function shapeMlbNext7Games(data: MlbNextGames, mode: Mode): MlbNextSevenUi {
  return {
    teamKey: data.teamKey,
    games: data.games.map((game) => {
      const matchup = game.homeAway === "home" ? `${data.teamKey} vs ${game.opponent}` : `${data.teamKey} at ${game.opponent}`;
      if (mode === "advanced") {
        return {
          date: game.date,
          opponent: game.opponent,
          homeAway: game.homeAway,
          matchup,
          gamePk: game.gamePk,
          probablePitcherName: game.probablePitcherName,
        };
      }

      return {
        date: game.date,
        opponent: game.opponent,
        homeAway: game.homeAway,
        matchup,
      };
    }),
  };
}
