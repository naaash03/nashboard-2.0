import type { Mode, SlateGame } from "@/lib/providers/types";

function recordLabel(wins?: number, losses?: number): string | undefined {
  if (typeof wins !== "number" || typeof losses !== "number") {
    return undefined;
  }
  return `${wins}-${losses}`;
}

export function shapeTonightsSlate(games: SlateGame[], mode: Mode) {
  return games.map((game) => {
    const base = {
      id: game.id,
      date: game.date,
      status: game.status,
      awayTeam: game.awayTeam.name,
      homeTeam: game.homeTeam.name,
      whyItMatters:
        "Use slate timing and opponent context to prioritize which games and teams to follow first.",
      gameType: game.gameType ?? "unknown",
      broadcaster: game.broadcaster ?? "TBD",
      awayRecord: recordLabel(game.awayTeam.record?.wins, game.awayTeam.record?.losses),
      homeRecord: recordLabel(game.homeTeam.record?.wins, game.homeTeam.record?.losses),
    };

    if (mode === "advanced") {
      return {
        ...base,
        learnMore: "https://www.espn.com/nfl/schedule",
      };
    }

    return {
      id: base.id,
      date: base.date,
      status: base.status,
      matchup: `${base.awayTeam} at ${base.homeTeam}`,
      gameType: base.gameType,
      broadcaster: base.broadcaster,
      records:
        base.awayRecord && base.homeRecord
          ? `${base.awayTeam} (${base.awayRecord}) at ${base.homeTeam} (${base.homeRecord})`
          : undefined,
      whyItMatters: base.whyItMatters,
    };
  });
}

