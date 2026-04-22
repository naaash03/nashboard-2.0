import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbGetRecentGameLog, type TeamGameLogEntry } from "@/lib/providers/mlb/teamStats";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import type { Meta } from "@/lib/providers/types";

type Summary = {
  wins: number;
  losses: number;
  avgRunsScored: string;
  avgRunsAllowed: string;
  streak: string;
};

type BeginnerSummary = Omit<Summary, "streak"> & { streakLabel: string };
type AdvancedSummary = Summary;

type ShapedGameBeginner = Omit<TeamGameLogEntry, "homeAway">;
type ShapedGameAdvanced = TeamGameLogEntry & { isHome: boolean };

function computeSummary(games: TeamGameLogEntry[]): Summary {
  if (games.length === 0) {
    return { wins: 0, losses: 0, avgRunsScored: "0.0", avgRunsAllowed: "0.0", streak: "" };
  }

  let wins = 0;
  let losses = 0;
  let totalScored = 0;
  let totalAllowed = 0;

  for (const g of games) {
    if (g.result === "W") wins++; else losses++;
    totalScored += g.runsScored;
    totalAllowed += g.runsAllowed;
  }

  const n = games.length;
  const avgRunsScored = (totalScored / n).toFixed(1);
  const avgRunsAllowed = (totalAllowed / n).toFixed(1);

  const sorted = [...games].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  const streakResult = sorted[0].result;
  let streakCount = 0;
  for (const g of sorted) {
    if (g.result === streakResult) streakCount++;
    else break;
  }
  const streak = `${streakResult}${streakCount}`;

  return { wins, losses, avgRunsScored, avgRunsAllowed, streak };
}

function shapeSummary(summary: Summary, mode: string): BeginnerSummary | AdvancedSummary {
  if (mode === "advanced") {
    return summary;
  }
  const n = parseInt(summary.streak.slice(1), 10);
  const verb = summary.streak.startsWith("W") ? "Won" : "Lost";
  const streakLabel = summary.streak ? `${verb} last ${n}` : "";
  const { streak: _streak, ...rest } = summary;
  void _streak;
  return { ...rest, streakLabel };
}

function shapeGames(games: TeamGameLogEntry[], mode: string): ShapedGameBeginner[] | ShapedGameAdvanced[] {
  if (mode === "advanced") {
    return games.map((g) => ({ ...g, isHome: g.homeAway === "home" }));
  }
  return games.map(({ homeAway: _homeAway, ...rest }) => {
    void _homeAway;
    return rest;
  });
}

function fallbackMeta(warning: string): Meta {
  return {
    sourceUsed: "mlb",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamKey = (searchParams.get("teamKey") ?? "").trim().toUpperCase();
  const mode = searchParams.get("mode") === "advanced" ? "advanced" : "beginner";
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!teamKey) {
    return NextResponse.json({ error: "teamKey is required" }, { status: 400 });
  }

  try {
    const { data, meta } = await mlbGetRecentGameLog(teamKey, 15, resolvedDataMode);

    if (!data) {
      return NextResponse.json({ error: `Unknown team: ${teamKey}` }, { status: 400 });
    }

    const summary = computeSummary(data.games);
    const shapedGames = shapeGames(data.games, mode);
    const shapedSummary = shapeSummary(summary, mode);

    const contract = toWidgetPayload({
      data: data.games,
      error: null,
      meta,
      primaryProvider: "mlb",
    });

    return NextResponse.json({
      data: {
        teamKey: data.teamKey,
        teamName: data.teamName,
        games: shapedGames,
        summary: shapedSummary,
        isPartial: data.isPartial,
        gamesShown: data.games.length,
      },
      meta,
      contract,
      error: null,
    });
  } catch (err) {
    const message = `Failed to load MLB game log: ${String(err)}`;
    const meta = fallbackMeta(message);
    const contract = toWidgetPayload({ data: [], error: message, meta, primaryProvider: "mlb" });

    return NextResponse.json(
      { data: null, meta, contract, error: message },
      { status: 502 },
    );
  }
}
