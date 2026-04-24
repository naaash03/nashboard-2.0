import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getScoreboard } from "@/lib/providers/espn/nfl";
import { fetchGameOdds, fetchLineMovement, type MlbGameOdds, type LineMovement } from "@/lib/providers/odds/client";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import type { Meta } from "@/lib/providers/types";

const PUBLIC_BETTING_FALLBACK = {
  isFallback: true as const,
  fallbackReason: "Public betting data requires a paid Odds API plan.",
};

type EnrichedGame = {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  status: string;
  odds: MlbGameOdds;
  lineMovement: LineMovement;
};

type GamePayload = {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  status: string;
  odds: {
    moneyline: {
      away: number | null;
      home: number | null;
      isFallback: boolean;
      fallbackReason?: string;
    };
    overUnder: {
      line: number | null;
      isFallback: boolean;
      fallbackReason?: string;
    };
    lineMovement: {
      awayOpen: number | null;
      homeOpen: number | null;
      awayVigShift: string | null;
      homeVigShift: string | null;
      isFallback: boolean;
      fallbackReason?: string;
    };
    publicBetting: typeof PUBLIC_BETTING_FALLBACK;
  };
  marketSummary: string;
};

type BeginnerGame = {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  status: string;
  favoredSide: "home" | "away" | "even" | "unavailable";
  lineMovementDirection: "toward_home" | "toward_away" | "stable" | "unavailable";
  overUnderLine: number | null;
  publicBetting: typeof PUBLIC_BETTING_FALLBACK;
  marketSummary: string;
};

function buildMarketSummary(game: EnrichedGame): string {
  const { odds, lineMovement } = game;

  if (odds.isFallback) return "Odds unavailable";

  const home = odds.homeMoneyline;
  const away = odds.awayMoneyline;

  let favorText = "Pick em game";
  if (home !== null && away !== null) {
    const spread = Math.abs(home - away);
    if (spread > 10) {
      favorText = home < away
        ? `Home team favored at ${home}`
        : `Away team favored at ${away}`;
    }
  }

  const ouText = odds.overUnder !== null ? `, O/U ${odds.overUnder}` : "";

  let movementText = "";
  if (!lineMovement.isFallback && lineMovement.homeVigShift !== null) {
    const homeShift = parseInt(lineMovement.homeVigShift, 10);
    if (homeShift > 5) movementText = ", line moving toward home";
    else if (homeShift < -5) movementText = ", line moving toward away";
    else movementText = ", line stable";
  }

  return `${favorText}${ouText}${movementText}`;
}

function shapeGame(game: EnrichedGame, mode: string): GamePayload | BeginnerGame {
  const marketSummary = buildMarketSummary(game);

  if (mode === "advanced") {
    return {
      gameId: game.gameId,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      gameTime: game.gameTime,
      status: game.status,
      odds: {
        moneyline: {
          away: game.odds.awayMoneyline,
          home: game.odds.homeMoneyline,
          isFallback: game.odds.isFallback,
          fallbackReason: game.odds.fallbackReason,
        },
        overUnder: {
          line: game.odds.overUnder,
          isFallback: game.odds.isFallback,
          fallbackReason: game.odds.isFallback ? game.odds.fallbackReason : undefined,
        },
        lineMovement: {
          awayOpen: game.lineMovement.awayOpen,
          homeOpen: game.lineMovement.homeOpen,
          awayVigShift: game.lineMovement.awayVigShift,
          homeVigShift: game.lineMovement.homeVigShift,
          isFallback: game.lineMovement.isFallback,
          fallbackReason: game.lineMovement.fallbackReason,
        },
        publicBetting: PUBLIC_BETTING_FALLBACK,
      },
      marketSummary,
    };
  }

  // Beginner: no raw numbers — direction labels only
  let favoredSide: BeginnerGame["favoredSide"] = "unavailable";
  if (!game.odds.isFallback && game.odds.homeMoneyline !== null && game.odds.awayMoneyline !== null) {
    const spread = Math.abs(game.odds.homeMoneyline - game.odds.awayMoneyline);
    favoredSide = spread <= 10 ? "even"
      : game.odds.homeMoneyline < game.odds.awayMoneyline ? "home" : "away";
  }

  let lineMovementDirection: BeginnerGame["lineMovementDirection"] = "unavailable";
  if (!game.lineMovement.isFallback && game.lineMovement.homeVigShift !== null) {
    const shift = parseInt(game.lineMovement.homeVigShift, 10);
    lineMovementDirection = shift > 5 ? "toward_home" : shift < -5 ? "toward_away" : "stable";
  }

  return {
    gameId: game.gameId,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    gameTime: game.gameTime,
    status: game.status,
    favoredSide,
    lineMovementDirection,
    overUnderLine: game.odds.overUnder,
    publicBetting: PUBLIC_BETTING_FALLBACK,
    marketSummary,
  };
}

function fallbackMeta(warning: string): Meta {
  return {
    sourceUsed: "espn",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  const todayISO = new Date().toISOString().slice(0, 10);

  try {
    const { games, meta } = await getScoreboard(todayISO, resolvedDataMode, cacheBust);

    const enriched: EnrichedGame[] = await Promise.all(
      games.map(async (game): Promise<EnrichedGame> => {
        const odds = await fetchGameOdds("americanfootball_nfl", game.homeTeam.name, game.awayTeam.name);
        const lineMovement = await fetchLineMovement(
          "americanfootball_nfl",
          game.homeTeam.name,
          game.awayTeam.name,
          odds.homeMoneyline,
          odds.awayMoneyline,
        );
        return {
          gameId: game.id,
          awayTeam: game.awayTeam.name,
          homeTeam: game.homeTeam.name,
          gameTime: game.date,
          status: game.status,
          odds,
          lineMovement,
        };
      }),
    );

    const shaped = enriched.map((game) => shapeGame(game, mode));
    const oddsUnavailable = enriched.length > 0 && enriched.every((g) => g.odds.isFallback);

    const contract = toWidgetPayload({
      data: shaped,
      error: null,
      meta,
      primaryProvider: "espn",
      notes: [
        "Games from ESPN NFL scoreboard.",
        "Moneyline and O/U from The Odds API (isFallback when key absent).",
        "Line movement compares midnight-UTC snapshot vs current line (isFallback when history unavailable).",
        "Public betting data not available on free tier — always isFallback.",
      ],
    });

    return NextResponse.json({
      data: {
        dateUsed: todayISO,
        games: shaped,
        userFacingMessage: games.length > 0
          ? `Showing market data for ${games.length} NFL game${games.length > 1 ? "s" : ""} today.`
          : "No NFL games scheduled today.",
        oddsUnavailable,
      },
      meta,
      contract,
      error: null,
    });
  } catch (error) {
    const message = `Failed to load NFL market insights: ${String(error)}`;
    const meta = fallbackMeta(message);
    const contract = toWidgetPayload({ data: [], error: message, meta, primaryProvider: "espn" });

    return NextResponse.json(
      { data: null, meta, contract, error: message },
      { status: 502 },
    );
  }
}
