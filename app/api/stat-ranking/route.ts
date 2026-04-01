import { NextResponse } from "next/server";
import { getRankabilityRule } from "@/lib/stats/rankability";

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

// Minimum number of leaders needed before we consider the Qualified pool
// useful. Below this threshold we fall back to All to avoid an empty or
// near-empty leaderboard in early-season / thin qualification windows.
const QUALIFIED_THRESHOLD = 15;

type LeaderEntry = {
  rank: number;
  name: string;
  entityId: string;
  value: string;
  isCurrentSubject: boolean;
};

type RankingPayload = {
  rankable: true;
  rank: number | null;
  total: number;
  scopeLabel: string;
  qualifierText: string;
  leaderboard: LeaderEntry[];
  /** The stat value the current subject holds, sourced from the leaders array. */
  subjectValue?: string;
};

type NotRankable = { rankable: false };

type MlbLeaderEntry = {
  rank: number;
  value: string;
  person: { id: number; fullName: string };
};

type MlbLeadersResponse = {
  leagueLeaders?: Array<{
    leaders?: MlbLeaderEntry[];
  }>;
};

type MlbStandingsRecord = {
  team: { id: number; name: string; abbreviation?: string };
  wins: number;
  losses: number;
  runDifferential: number;
};

type MlbStandingsResponse = {
  records?: Array<{
    teamRecords?: MlbStandingsRecord[];
  }>;
};

/**
 * Fetch MLB leaders for a stat category.
 *
 * Strategy:
 *   1. Try playerPool=Qualified — MLB's own qualification filter. Produces a
 *      clean leaderboard with no trivial ties or "-.--" sentinel rows.
 *   2. If the Qualified pool has fewer than QUALIFIED_THRESHOLD entries (early
 *      season / thin qualification window), fall back to playerPool=All and
 *      strip the "-.--" sentinel value that MLB returns for players with zero
 *      innings or plate appearances recorded.
 *
 * Returns null if both requests fail (treat as rankable: false upstream).
 */
async function fetchMlbLeaders(
  category: string,
  season: number,
): Promise<{ leaders: MlbLeaderEntry[]; qualifiedPool: boolean } | null> {
  // 1. Qualified pool
  try {
    const qualUrl = `${MLB_API_BASE}/stats/leaders?leaderCategories=${category}&season=${season}&sportId=1&limit=500&playerPool=Qualified`;
    const qualRes = await fetch(qualUrl, { next: { revalidate: 300 } });
    if (qualRes.ok) {
      const qualJson = (await qualRes.json()) as MlbLeadersResponse;
      const qualLeaders = qualJson.leagueLeaders?.[0]?.leaders ?? [];
      if (qualLeaders.length >= QUALIFIED_THRESHOLD) {
        return { leaders: qualLeaders, qualifiedPool: true };
      }
    }
  } catch {
    // fall through to All
  }

  // 2. All pool — filter "-.--" sentinel (player has zero IP/PA recorded)
  const allUrl = `${MLB_API_BASE}/stats/leaders?leaderCategories=${category}&season=${season}&sportId=1&limit=500&playerPool=All`;
  const allRes = await fetch(allUrl, { next: { revalidate: 300 } });
  if (!allRes.ok) return null;

  const allJson = (await allRes.json()) as MlbLeadersResponse;
  const allLeaders = (allJson.leagueLeaders?.[0]?.leaders ?? []).filter(
    (l) => l.value !== "-.--",
  );
  return { leaders: allLeaders, qualifiedPool: false };
}

export async function GET(
  req: Request,
): Promise<NextResponse<RankingPayload | NotRankable>> {
  const { searchParams } = new URL(req.url);
  const statKey = searchParams.get("statKey") ?? "";
  const sport = searchParams.get("sport") ?? "";
  const entityType = searchParams.get("entityType") as "player" | "team" | null;
  const entityId = searchParams.get("entityId") ?? "";
  const teamKey = searchParams.get("teamKey") ?? "";
  const seasonParam = searchParams.get("season");
  const season = seasonParam ? parseInt(seasonParam, 10) : new Date().getFullYear();

  const rule = getRankabilityRule(statKey, sport);
  if (!rule) {
    return NextResponse.json({ rankable: false });
  }

  // Guard: entity type mismatch (e.g. team widget asking for player leaderboard)
  if (entityType && rule.entityType !== entityType) {
    return NextResponse.json({ rankable: false });
  }

  try {
    // ── MLB player leaderboard via stats/leaders endpoint ──────────────────
    if (rule.entityType === "player" && rule.mlbLeaderCategory && sport === "MLB") {
      const result = await fetchMlbLeaders(rule.mlbLeaderCategory, season);
      if (!result) return NextResponse.json({ rankable: false });

      const { leaders, qualifiedPool } = result;
      const total = leaders.length;

      // Locate the current subject and capture their value from the leaders list
      let subjectRank: number | null = null;
      let subjectValue: string | undefined;
      if (entityId) {
        const match = leaders.find((l) => String(l.person.id) === entityId);
        if (match) {
          subjectRank = match.rank;
          subjectValue = match.value;
        }
      }

      // Build top-10 leaderboard entries
      const leaderboard: LeaderEntry[] = leaders.slice(0, 10).map((l) => ({
        rank: l.rank,
        name: l.person.fullName,
        entityId: String(l.person.id),
        value: l.value,
        isCurrentSubject: Boolean(entityId && String(l.person.id) === entityId),
      }));

      // Honest qualifier label: reflect which pool was actually used
      const qualifierText = qualifiedPool
        ? rule.qualifierText
        : "Early season — all players with ≥1 appearance";

      return NextResponse.json({
        rankable: true,
        rank: subjectRank,
        total,
        scopeLabel: rule.scopeLabel,
        qualifierText,
        leaderboard,
        subjectValue,
      });
    }

    // ── MLB team stats via standings endpoint ─────────────────────────────
    if (rule.entityType === "team" && sport === "MLB") {
      const url = `${MLB_API_BASE}/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) return NextResponse.json({ rankable: false });

      const json = (await res.json()) as MlbStandingsResponse;
      const allTeams: MlbStandingsRecord[] =
        json.records?.flatMap((r) => r.teamRecords ?? []) ?? [];

      function matchesTeamKey(record: MlbStandingsRecord): boolean {
        if (!teamKey) return false;
        return (
          record.team.abbreviation === teamKey ||
          record.team.name.toLowerCase().includes(teamKey.toLowerCase())
        );
      }

      if (statKey === "run_differential") {
        const sorted = [...allTeams].sort(
          (a, b) => b.runDifferential - a.runDifferential,
        );
        const total = sorted.length;
        const subjectIdx = sorted.findIndex(matchesTeamKey);
        const subjectRank = subjectIdx >= 0 ? subjectIdx + 1 : null;
        const subjectRecord = subjectIdx >= 0 ? sorted[subjectIdx] : null;
        const subjectValue = subjectRecord
          ? subjectRecord.runDifferential >= 0
            ? `+${subjectRecord.runDifferential}`
            : String(subjectRecord.runDifferential)
          : undefined;

        const leaderboard: LeaderEntry[] = sorted.slice(0, 10).map((t, i) => ({
          rank: i + 1,
          name: t.team.name,
          entityId: String(t.team.id),
          value:
            t.runDifferential >= 0
              ? `+${t.runDifferential}`
              : String(t.runDifferential),
          isCurrentSubject: matchesTeamKey(t),
        }));

        return NextResponse.json({
          rankable: true,
          rank: subjectRank,
          total,
          scopeLabel: rule.scopeLabel,
          qualifierText: rule.qualifierText,
          leaderboard,
          subjectValue,
        });
      }

      if (statKey === "w_l_record") {
        const sorted = [...allTeams].sort((a, b) => {
          const pctA = a.wins / (a.wins + a.losses || 1);
          const pctB = b.wins / (b.wins + b.losses || 1);
          return pctB - pctA;
        });
        const total = sorted.length;
        const subjectIdx = sorted.findIndex(matchesTeamKey);
        const subjectRank = subjectIdx >= 0 ? subjectIdx + 1 : null;
        const subjectRecord = subjectIdx >= 0 ? sorted[subjectIdx] : null;
        const subjectValue = subjectRecord
          ? `${subjectRecord.wins}-${subjectRecord.losses}`
          : undefined;

        const leaderboard: LeaderEntry[] = sorted.slice(0, 10).map((t, i) => ({
          rank: i + 1,
          name: t.team.name,
          entityId: String(t.team.id),
          value: `${t.wins}-${t.losses}`,
          isCurrentSubject: matchesTeamKey(t),
        }));

        return NextResponse.json({
          rankable: true,
          rank: subjectRank,
          total,
          scopeLabel: rule.scopeLabel,
          qualifierText: rule.qualifierText,
          leaderboard,
          subjectValue,
        });
      }
    }

    return NextResponse.json({ rankable: false });
  } catch {
    return NextResponse.json({ rankable: false });
  }
}
