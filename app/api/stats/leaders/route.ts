import { NextResponse } from "next/server";
import { fetchMlbJson } from "@/lib/providers/mlb/client";
import { findStatGlossaryEntry } from "@/lib/stats/glossary";
import {
  getStatLeaderDefinition,
  resolveFallbackLeaders,
  resolveStatLeaderSeason,
} from "@/lib/stats/leaders";
import type {
  StatLeader,
  StatLeadersResponse,
  StatSport,
} from "@/lib/stats/types";

type MlbLeadersApiResponse = {
  leagueLeaders?: Array<{
    leaders?: Array<{
      rank?: number;
      value?: string;
      person?: {
        fullName?: string;
      };
      team?: {
        name?: string;
      };
    }>;
  }>;
};

function isStatSport(value: string | null): value is StatSport {
  return value === "MLB" || value === "NBA" || value === "NFL";
}

function parseSeason(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const season = Number.parseInt(value, 10);
  return Number.isFinite(season) ? season : undefined;
}

function normalizeLiveLeaders(data: MlbLeadersApiResponse): StatLeader[] {
  return (data.leagueLeaders?.[0]?.leaders ?? [])
    .map((leader, index) => ({
      rank: typeof leader.rank === "number" ? leader.rank : index + 1,
      playerName: leader.person?.fullName?.trim() ?? "",
      team: leader.team?.name?.trim() ?? "",
      value: String(leader.value ?? "").trim(),
    }))
    .filter((leader) => leader.playerName && leader.team && leader.value)
    .slice(0, 5);
}

function fallbackResponse(
  statKey: string,
  sport: StatSport,
  season: number,
  leaders: StatLeader[],
  updatedAt: string,
): StatLeadersResponse {
  return {
    statKey,
    sport,
    season,
    leaders,
    sourceUsed: "fallback",
    usedFallback: true,
    updatedAt,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const statKey = searchParams.get("statKey")?.trim();
  const sportParam = searchParams.get("sport");

  if (!statKey) {
    return NextResponse.json({ error: "statKey is required" }, { status: 400 });
  }

  if (!isStatSport(sportParam)) {
    return NextResponse.json({ error: "sport must be MLB, NBA, or NFL" }, { status: 400 });
  }

  const entry = findStatGlossaryEntry(statKey, sportParam);
  if (!entry) {
    return NextResponse.json({ error: "Unknown stat key for sport" }, { status: 404 });
  }

  const definition = getStatLeaderDefinition(entry.key, entry.sport);
  if (!definition) {
    return NextResponse.json({ error: "No leader mapping for that stat yet" }, { status: 404 });
  }

  const season = resolveStatLeaderSeason(entry.sport, parseSeason(searchParams.get("season")));

  if ("live" in definition) {
    try {
      const { data, meta } = await fetchMlbJson<MlbLeadersApiResponse>({
        endpoint: "/stats/leaders",
        params: {
          leaderCategories: definition.live.category,
          statGroup: definition.live.statGroup,
          statType: "season",
          season,
          limit: 5,
        },
        ttlSeconds: 300,
      });

      const leaders = normalizeLiveLeaders(data);
      if (leaders.length > 0) {
        return NextResponse.json<StatLeadersResponse>({
          statKey: entry.key,
          sport: entry.sport,
          season,
          leaders,
          sourceUsed: meta.sourceUsed === "cache" || meta.sourceUsed === "fixture" ? meta.sourceUsed : "mlb",
          usedFallback: false,
          updatedAt: meta.updatedAt,
        });
      }
    } catch {
      // Fall through to the structured snapshot below.
    }
  }

  const fallback = resolveFallbackLeaders(definition, season);
  if (!fallback) {
    return NextResponse.json({ error: "No fallback leaders available" }, { status: 500 });
  }

  return NextResponse.json<StatLeadersResponse>(
    fallbackResponse(entry.key, entry.sport, season, fallback.leaders, fallback.updatedAt),
  );
}
