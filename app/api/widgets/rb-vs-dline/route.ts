import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { fetchEspnJson } from "@/lib/providers/espn/client";
import { getTeamNextGame, getTeamRecentRbLeader } from "@/lib/providers/espn/nfl";
import { shapeRbVsDline } from "@/lib/templates/rbVsDline";
import type { RbVsDlineStats } from "@/lib/providers/types";

type RosterFixture = {
  teamKey: string;
  teamName: string;
  runningBacks?: Array<{
    playerId?: string;
    fullName: string;
    attempts?: number;
    yards?: number;
    ypc?: number;
    tds?: number;
    explosiveRuns?: number;
  }>;
};

type DefenseFixture = {
  teamKey: string;
  rushYardsAllowed?: number;
  ypcAllowed?: number;
  rushTdsAllowed?: number;
  explosiveRunsAllowed?: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamKey = (searchParams.get("teamKey") ?? "").trim().toUpperCase();
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);
  const providerMode = resolvedDataMode === "auto" ? "live" : resolvedDataMode;

  if (!teamKey) {
    return NextResponse.json({ error: "teamKey is required" }, { status: 400 });
  }

  try {
    const nextGameResult = await getTeamNextGame(teamKey, todayIso(), providerMode, cacheBust);
    const nextGame = nextGameResult.game;

    if (!nextGame) {
      const leader = await getTeamRecentRbLeader(teamKey, providerMode, cacheBust);
      return NextResponse.json({
        data: {
          emptyState: true,
          title: "No upcoming games; offseason",
          explanation: "There are no upcoming games for this team right now. This is expected during offseason windows.",
          recentLeader: leader.playerName,
          whyItMatters: "Use historical context now, then switch to matchup mode when schedules are posted.",
        },
        meta: {
          ...nextGameResult.meta,
          warning: leader.playerName
            ? `No upcoming game. Most recent RB leader: ${leader.playerName}`
            : "No upcoming game and no recent RB leader was available from ESPN.",
        },
      });
    }

    const opponent = nextGame.homeTeam.key === teamKey ? nextGame.awayTeam : nextGame.homeTeam;

    const rosterResponse = await fetchEspnJson<RosterFixture>({
      endpoint: `/rb-roster/${teamKey}`,
      fixtureFile: "rb_roster_or_depth.json",
      ttlSeconds: 300,
      dataMode: providerMode,
      cacheBust,
    });

    const defenseResponse = await fetchEspnJson<DefenseFixture>({
      endpoint: `/run-defense/${opponent.key}`,
      fixtureFile: "opponent_run_defense_stats.json",
      ttlSeconds: 300,
      dataMode: providerMode,
      cacheBust,
    });

    const rb = rosterResponse.data.runningBacks?.[0];
    const missingDepthChartDisclaimer = rb
      ? "Expected RB chosen using available depth chart/roster ordering and recent usage signals."
      : "Depth chart was unavailable; expected RB fallback selected from available roster context and may change before kickoff.";

    const stats: RbVsDlineStats = {
      teamKey,
      teamName: nextGame.homeTeam.key === teamKey ? nextGame.homeTeam.name : nextGame.awayTeam.name,
      opponentKey: opponent.key,
      opponentName: opponent.name,
      rb: {
        playerId: rb?.playerId,
        fullName: rb?.fullName ?? "Expected RB TBD",
        attempts: rb?.attempts,
        yards: rb?.yards,
        ypc: rb?.ypc,
        tds: rb?.tds,
        explosiveRuns: rb?.explosiveRuns,
      },
      defense: {
        rushYardsAllowed: defenseResponse.data.rushYardsAllowed,
        ypcAllowed: defenseResponse.data.ypcAllowed,
        rushTdsAllowed: defenseResponse.data.rushTdsAllowed,
        explosiveRunsAllowed: defenseResponse.data.explosiveRunsAllowed,
      },
      disclaimer: missingDepthChartDisclaimer,
    };

    return NextResponse.json({
      data: shapeRbVsDline(stats, mode),
      meta: rosterResponse.meta,
    });
  } catch (error) {
    return NextResponse.json({ error: `Failed to load RB vs D-Line: ${String(error)}` }, { status: 502 });
  }
}
