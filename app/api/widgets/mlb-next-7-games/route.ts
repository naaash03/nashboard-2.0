import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";
import { resolveCanonicalTeam } from "@/lib/sports/mappings/teamMap";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { shapeMlbNext7Games } from "@/lib/templates/mlbNext7Games";
import type { Game } from "@/lib/sports/models";
import type { Meta } from "@/lib/providers/types";

function fallbackMeta(mode: "auto" | "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : "mlb",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: mode,
  };
}

function canonicalGames(teamKey: string, games: Array<{ date: string; opponent: string; homeAway: "home" | "away"; gamePk?: number }>): Game[] {
  const team = resolveCanonicalTeam({ league: "MLB", abbreviation: teamKey, name: teamKey });
  return games.map((game) => {
    const opponent = resolveCanonicalTeam({ league: "MLB", abbreviation: game.opponent, name: game.opponent });
    return {
      id: `mlb-${game.gamePk ?? `${team.abbreviation}-${opponent.abbreviation}-${game.date}`}`,
      league: "MLB",
      startTime: new Date(game.date).toISOString(),
      status: "scheduled",
      displayStatus: "Scheduled",
      homeTeamId: game.homeAway === "home" ? team.id : opponent.id,
      awayTeamId: game.homeAway === "away" ? team.id : opponent.id,
      sourceMeta: {
        provider: "mlb",
        providerGameId: game.gamePk,
      },
    };
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamKey = (searchParams.get("teamKey") ?? "NYM").trim().toUpperCase();
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  try {
    const providerResult = await mlbProvider.getNextSevenGames(teamKey, mode, resolvedDataMode, cacheBust);
    const shaped = providerResult.data ? shapeMlbNext7Games(providerResult.data, mode) : null;
    const contract = toWidgetPayload({
      data: providerResult.data ? canonicalGames(teamKey, providerResult.data.games) : [],
      error: null,
      meta: providerResult.meta,
      primaryProvider: "mlb",
    });

    return NextResponse.json({
      data: shaped,
      meta: providerResult.meta,
      contract,
      error: null,
    });
  } catch (error) {
    const message = "Failed to load MLB next 7 games";
    const meta = fallbackMeta(resolvedDataMode, `MLB next 7 games upstream failure: ${String(error)}`);
    return NextResponse.json({
      data: null,
      meta,
      contract: toWidgetPayload({
        data: [],
        error: message,
        meta,
        primaryProvider: "mlb",
      }),
      error: message,
    }, { status: 502 });
  }
}
