import { resolvePlayerInsights, resolvePlayerProfile, resolvePlayersSearch, resolveTeamsSearch } from "@/lib/providers";
import { getTodaysSlate, getStandingsSnapshot } from "@/lib/providers/espn/nba";
import { getScoreboard } from "@/lib/providers/espn/nfl";
import { getTeamStatus, getTeamStatusBatch } from "@/lib/providers/espn/teamStatus";
import type { Mode } from "@/lib/providers/types";
import type { TeamStatus as LegacyTeamStatus } from "@/lib/types/teamStatus";
import {
  normalizeGameFromEspn,
  normalizePlayerFromApiSports,
  normalizePlayerFromEspn,
  normalizeStandingsRowFromEspn,
  normalizeTeamFromApiSports,
  normalizeTeamFromEspn,
} from "@/lib/sports/adapters";
import type { Game, Player, PlayerInsight, StandingsRow, Team, TeamStatus, WidgetPayload } from "@/lib/sports/models";
import { resolveCanonicalTeam } from "@/lib/sports/mappings/teamMap";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";

type LeagueKey = "NFL" | "NBA" | "MLB";
type SportKey = "nfl" | "nba" | "mlb";
type DataMode = "auto" | "live" | "fixture";

function toLeagueKey(input: string): LeagueKey {
  const upper = input.trim().toUpperCase();
  if (upper === "NBA" || upper === "MLB" || upper === "NFL") {
    return upper;
  }
  return "NFL";
}

function toSportKey(league: LeagueKey): SportKey {
  if (league === "NBA") return "nba";
  if (league === "MLB") return "mlb";
  return "nfl";
}

export function toCanonicalTeamStatus(status: LegacyTeamStatus, provider: "apiSports" | "espn" | "mlb"): TeamStatus {
  const league = toLeagueKey(status.sport);
  const team = resolveCanonicalTeam({
    league,
    abbreviation: status.teamKey,
    name: status.teamKey,
  });
  const opponent = status.opponent
    ? resolveCanonicalTeam({
      league,
      abbreviation: status.opponent,
      name: status.opponent,
    })
    : null;
  const todayGame = status.hasGameToday
    ? {
      id: `${league.toLowerCase()}-${status.eventId ?? `${team.abbreviation}-${opponent?.abbreviation ?? "opp"}`}`,
      league,
      startTime: new Date().toISOString(),
      status: status.state ?? "scheduled",
      displayStatus: status.displayClock,
      homeTeamId: status.homeAway === "home" ? team.id : (opponent?.id ?? `${league.toLowerCase()}-opp`),
      awayTeamId: status.homeAway === "away" ? team.id : (opponent?.id ?? `${league.toLowerCase()}-opp`),
      homeScore: status.homeAway === "home" ? status.score?.team : status.score?.opp,
      awayScore: status.homeAway === "away" ? status.score?.team : status.score?.opp,
      sourceMeta: {
        provider,
        providerGameId: status.eventId,
      },
    }
    : undefined;

  return {
    teamId: team.id,
    league,
    todayGame,
    sourceMeta: {
      provider,
      fetchedAt: new Date().toISOString(),
    },
  };
}

function gameFromSlate(league: LeagueKey, game: {
  id: string;
  date: string;
  status: string;
  homeTeam: { key: string; name: string };
  awayTeam: { key: string; name: string };
}): Game {
  const home = resolveCanonicalTeam({ league, abbreviation: game.homeTeam.key, name: game.homeTeam.name });
  const away = resolveCanonicalTeam({ league, abbreviation: game.awayTeam.key, name: game.awayTeam.name });
  return {
    id: `${league.toLowerCase()}-${game.id}`,
    league,
    startTime: game.date,
    status: game.status.toLowerCase(),
    displayStatus: game.status,
    homeTeamId: home.id,
    awayTeamId: away.id,
    sourceMeta: {
      provider: "espn",
      providerGameId: game.id,
    },
  };
}

export async function resolveSearchResults(args: {
  entity: "players" | "teams";
  league: string;
  query: string;
  limit: number;
  dataMode: DataMode;
  cacheBust?: string;
}): Promise<WidgetPayload<Player[] | Team[]>> {
  const league = toLeagueKey(args.league);
  const sport = toSportKey(league);
  if (args.entity === "players") {
    const envelope = await resolvePlayersSearch(sport, args.query, args.limit, { dataMode: args.dataMode, cacheBust: args.cacheBust });
    const provider = envelope.meta.sourceUsed === "apiSports" ? "apiSports" : "espn";
    const rows = (envelope.data ?? []).map((row) => (
      provider === "apiSports"
        ? normalizePlayerFromApiSports(row, league)
        : normalizePlayerFromEspn(row, league)
    ));
    return toWidgetPayload({
      data: rows,
      error: envelope.error?.message ?? null,
      meta: envelope.meta,
      primaryProvider: "apiSports",
    });
  }

  const envelope = await resolveTeamsSearch(sport, args.query, args.limit, { dataMode: args.dataMode, cacheBust: args.cacheBust });
  const provider = envelope.meta.sourceUsed === "apiSports" ? "apiSports" : "espn";
  const rows = (envelope.data ?? []).map((row) => (
    provider === "apiSports"
      ? normalizeTeamFromApiSports(row, league)
      : normalizeTeamFromEspn(row, league)
  ));
  return toWidgetPayload({
    data: rows,
    error: envelope.error?.message ?? null,
    meta: envelope.meta,
    primaryProvider: "apiSports",
  });
}

export async function resolveTeamStatus(args: {
  league: string;
  teamKey: string;
  dataMode: DataMode;
  cacheBust?: string;
}): Promise<WidgetPayload<TeamStatus>> {
  const league = toLeagueKey(args.league);
  const envelope = await getTeamStatus(toSportKey(league), args.teamKey, args.dataMode, args.cacheBust);
  const data = envelope.data ? toCanonicalTeamStatus(envelope.data, "espn") : null;
  return toWidgetPayload({
    data,
    error: envelope.error?.message ?? null,
    meta: envelope.meta,
    primaryProvider: "apiSports",
  });
}

export async function resolveTeamStatusBatch(args: {
  league: string;
  teamKeys: string[];
  dataMode: DataMode;
  cacheBust?: string;
}): Promise<WidgetPayload<TeamStatus[]>> {
  const league = toLeagueKey(args.league);
  const envelope = await getTeamStatusBatch(toSportKey(league), args.teamKeys, args.dataMode, args.cacheBust);
  const data = envelope.data?.statuses?.map((status) => toCanonicalTeamStatus(status, "espn")) ?? [];
  return toWidgetPayload({
    data,
    error: envelope.error?.message ?? null,
    meta: envelope.meta,
    primaryProvider: "apiSports",
  });
}

export async function resolvePlayerCardData(args: {
  league: string;
  playerId: string;
  mode: Mode;
  dataMode: DataMode;
  cacheBust?: string;
}): Promise<WidgetPayload<{ player: Player; insight?: PlayerInsight }>> {
  const league = toLeagueKey(args.league);
  const sport = toSportKey(league);
  const profile = await resolvePlayerProfile(sport, args.playerId, { dataMode: args.dataMode, cacheBust: args.cacheBust });
  const insights = await resolvePlayerInsights(sport, args.playerId, args.mode, { dataMode: args.dataMode, cacheBust: args.cacheBust });
  const provider = profile.meta.sourceUsed === "apiSports" ? "apiSports" : "espn";
  const player = profile.data
    ? (provider === "apiSports"
      ? normalizePlayerFromApiSports(profile.data, league)
      : normalizePlayerFromEspn(profile.data, league))
    : null;
  const payload = player ? {
    player,
    insight: insights.data
      ? {
        playerId: player.id,
        league,
        stats: insights.data as unknown as Record<string, unknown>,
        advanced: args.mode === "advanced" ? (insights.data as unknown as Record<string, unknown>) : undefined,
        sourceMeta: {
          provider: insights.meta.sourceUsed,
          fetchedAt: insights.meta.updatedAt,
          stale: insights.meta.sourceUsed === "cache",
        },
      }
      : undefined,
  } : null;

  return toWidgetPayload({
    data: payload,
    error: profile.error?.message ?? insights.error?.message ?? null,
    meta: profile.meta,
    primaryProvider: "apiSports",
  });
}

export function resolveWatchlistData(args: {
  league: string;
  items: Array<{
    teamKey: string;
    teamName?: string;
    apiSportsTeamId?: string | null;
    espnTeamId?: string | null;
  }>;
}): WidgetPayload<Team[]> {
  const league = toLeagueKey(args.league);
  const data = args.items.map((item) => resolveCanonicalTeam({
    league,
    abbreviation: item.teamKey,
    name: item.teamName,
    apiSportsTeamId: item.apiSportsTeamId ?? undefined,
    espnTeamId: item.espnTeamId ?? undefined,
  }));
  return {
    ok: true,
    data,
    error: null,
    source: {
      provider: "internal",
      mode: "live",
      fallbackUsed: false,
      fetchedAt: new Date().toISOString(),
    },
  };
}

export async function resolveStandings(args: {
  league: string;
  mode: Mode;
  dataMode: DataMode;
  cacheBust?: string;
}): Promise<WidgetPayload<StandingsRow[]>> {
  const league = toLeagueKey(args.league);
  if (league !== "NBA") {
    return {
      ok: false,
      data: [],
      error: `Standings resolver is currently available for NBA only (received ${league}).`,
      source: {
        provider: "espn",
        mode: "fallback",
        fallbackUsed: true,
      },
    };
  }

  const standings = await getStandingsSnapshot(args.mode, args.dataMode, args.cacheBust);
  const rows: StandingsRow[] = [];
  for (const [conference, values] of Object.entries({
    east: standings.data.east,
    west: standings.data.west,
  })) {
    values.forEach((row, index) => {
      rows.push(normalizeStandingsRowFromEspn({
        team: { abbreviation: row.key, displayName: row.team },
        stats: [
          { name: "wins", value: row.wins },
          { name: "losses", value: row.losses },
          { name: "winPercent", value: row.pct },
          { name: "rank", value: index + 1 },
        ],
      }, league));
      rows[rows.length - 1].conference = conference.toUpperCase();
    });
  }

  return toWidgetPayload({
    data: rows,
    meta: standings.meta,
    primaryProvider: "espn",
  });
}

export async function resolveSlate(args: {
  league: string;
  mode: Mode;
  dataMode: DataMode;
  date?: string;
  cacheBust?: string;
}): Promise<WidgetPayload<Game[]>> {
  const league = toLeagueKey(args.league);
  if (league === "NBA") {
    const slate = await getTodaysSlate(args.mode, args.dataMode, args.cacheBust);
    const games = slate.games.map((game) => gameFromSlate(league, game));
    return toWidgetPayload({
      data: games,
      meta: slate.meta,
      primaryProvider: "espn",
    });
  }

  const date = args.date ?? new Date().toISOString().slice(0, 10);
  const scoreboard = await getScoreboard(date, args.dataMode, args.cacheBust);
  const games = scoreboard.games.map((game) => normalizeGameFromEspn({
    id: game.id,
    date: game.date,
    status: { type: { description: game.status, state: game.status } },
    competitions: [{
      competitors: [
        { homeAway: "home", team: { abbreviation: game.homeTeam.key, displayName: game.homeTeam.name } },
        { homeAway: "away", team: { abbreviation: game.awayTeam.key, displayName: game.awayTeam.name } },
      ],
    }],
  }, league));
  return toWidgetPayload({
    data: games,
    meta: scoreboard.meta,
    primaryProvider: "espn",
  });
}
