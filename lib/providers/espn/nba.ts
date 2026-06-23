import { randomUUID } from "node:crypto";
import { fetchEspnJson, getDataMode } from "@/lib/providers/espn/client";
import { espnTeamIdForKey } from "@/lib/providers/espn/nbaTeams";
import { gameTypeFromSeasonType, parseRecord, toCompactDate } from "@/lib/providers/espn/shared";
import type { Meta, Mode, SlateGame } from "@/lib/providers/types";

type ModeArg = "auto" | "live" | "fixture";
type CacheBustArg = string | number | null | undefined;

const TEAMS_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams";

export type NbaScheduleGame = {
  id: string;
  date: string;
  opponentKey: string;
  opponentName: string;
  homeAway: "home" | "away";
  completed: boolean;
  result?: "W" | "L";
  teamScore?: number;
  opponentScore?: number;
};

type EspnTeamSchedule = {
  events?: Array<{
    id?: string;
    date?: string;
    competitions?: Array<{
      status?: { type?: { completed?: boolean; description?: string } };
      competitors?: Array<{
        id?: string;
        homeAway?: "home" | "away";
        winner?: boolean;
        score?: { value?: number; displayValue?: string } | string | number;
        team?: { id?: string; abbreviation?: string; displayName?: string };
      }>;
    }>;
  }>;
};

type EspnTeamStatistics = {
  results?: {
    stats?: {
      categories?: Array<{
        name?: string;
        stats?: Array<{ name?: string; displayName?: string; value?: number; displayValue?: string }>;
      }>;
    };
  };
};

type EspnScoreboard = {
  events?: Array<{
    id?: string;
    date?: string;
    status?: { type?: { description?: string; detail?: string } };
    season?: { type?: number };
    competitions?: Array<{
      broadcasts?: Array<{ names?: string[] }>;
      competitors?: Array<{
        homeAway?: "home" | "away";
        team?: { abbreviation?: string; displayName?: string };
        records?: Array<{ summary?: string }>;
      }>;
    }>;
  }>;
};

type EspnStandingsStat = {
  name?: string;
  type?: string;
  abbreviation?: string;
  value?: number;
  displayValue?: string;
};

type EspnStandingsResponse = {
  children?: Array<{
    name?: string;
    abbreviation?: string;
    standings?: {
      entries?: Array<{
        team?: {
          abbreviation?: string;
          displayName?: string;
          name?: string;
        };
        stats?: EspnStandingsStat[];
      }>;
    };
  }>;
};

type EspnConference = NonNullable<EspnStandingsResponse["children"]>[number];
type EspnConferenceEntry = NonNullable<NonNullable<EspnConference["standings"]>["entries"]>[number];

export type NbaStandingsTeam = {
  team: string;
  key: string;
  wins: number;
  losses: number;
  pct: number;
};

export type NbaStandingsSnapshot = {
  east: NbaStandingsTeam[];
  west: NbaStandingsTeam[];
};

const SCOREBOARD_ENDPOINT = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
const STANDINGS_ENDPOINT = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings";

function normalizeScoreboardGames(payload: EspnScoreboard): SlateGame[] {
  return (payload.events ?? []).map((event) => {
    const competition = event.competitions?.[0];
    const away = competition?.competitors?.find((competitor) => competitor.homeAway === "away");
    const home = competition?.competitors?.find((competitor) => competitor.homeAway === "home");

    return {
      id: event.id ?? `${event.date ?? "unknown"}-${away?.team?.abbreviation ?? "AWY"}-${home?.team?.abbreviation ?? "HME"}`,
      date: event.date ?? new Date().toISOString(),
      status: event.status?.type?.detail ?? event.status?.type?.description ?? "Scheduled",
      gameType: gameTypeFromSeasonType(event.season?.type),
      broadcaster: competition?.broadcasts?.[0]?.names?.[0],
      awayTeam: {
        key: away?.team?.abbreviation ?? "AWY",
        name: away?.team?.displayName ?? "Away",
        record: parseRecord(away?.records?.[0]?.summary),
      },
      homeTeam: {
        key: home?.team?.abbreviation ?? "HME",
        name: home?.team?.displayName ?? "Home",
        record: parseRecord(home?.records?.[0]?.summary),
      },
    };
  });
}

function statValue(stats: EspnStandingsStat[] | undefined, candidates: string[]): number | null {
  if (!stats) {
    return null;
  }

  const match = stats.find((stat) => {
    const name = (stat.name ?? "").toLowerCase();
    const type = (stat.type ?? "").toLowerCase();
    const abbreviation = (stat.abbreviation ?? "").toLowerCase();
    return candidates.some((candidate) => candidate === name || candidate === type || candidate === abbreviation);
  });

  if (!match) {
    return null;
  }

  if (typeof match.value === "number" && Number.isFinite(match.value)) {
    return match.value;
  }

  if (match.displayValue) {
    const parsed = Number(match.displayValue.replace(/^\./, "0."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeConferenceEntries(entries: EspnConferenceEntry[] | undefined, topCount: number): NbaStandingsTeam[] {
  const rows: NbaStandingsTeam[] = (entries ?? []).map((entry) => {
    const team = entry.team?.displayName ?? entry.team?.name ?? "Unknown";
    const key = entry.team?.abbreviation ?? "-";

    const wins = statValue(entry.stats, ["wins", "w"]);
    const losses = statValue(entry.stats, ["losses", "l"]);
    const pct = statValue(entry.stats, ["winpercent", "pct"]);

    const safeWins = typeof wins === "number" ? wins : 0;
    const safeLosses = typeof losses === "number" ? losses : 0;
    const calculatedPct = safeWins + safeLosses > 0 ? safeWins / (safeWins + safeLosses) : 0;

    return {
      team,
      key,
      wins: safeWins,
      losses: safeLosses,
      pct: typeof pct === "number" ? pct : calculatedPct,
    };
  });

  return rows
    .sort((a, b) => {
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.team.localeCompare(b.team);
    })
    .slice(0, topCount);
}

function normalizeStandings(payload: EspnStandingsResponse, mode: Mode): NbaStandingsSnapshot {
  const topCount = mode === "advanced" ? 10 : 5;
  const children = payload.children ?? [];

  const east = children.find((child) => (child.abbreviation ?? child.name ?? "").toLowerCase().includes("east"));
  const west = children.find((child) => (child.abbreviation ?? child.name ?? "").toLowerCase().includes("west"));

  return {
    east: normalizeConferenceEntries(east?.standings?.entries, topCount),
    west: normalizeConferenceEntries(west?.standings?.entries, topCount),
  };
}

function fixtureScenario(): string {
  return (process.env.NASHBOARD_FIXTURE_SCENARIO ?? "default").toLowerCase();
}

/**
 * Fetch the NBA scoreboard for a single date. In fixture mode, the
 * "offseason"/"slate_empty_today" scenarios return an empty slate so the
 * out-of-season fallback ladder can be exercised deterministically.
 */
export async function getScoreboardForDate(
  dateISO: string,
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<{ games: SlateGame[]; meta: Meta }> {
  const resolved = getDataMode(dataMode);
  const scenario = fixtureScenario();
  const fixtureFile = resolved === "fixture"
    ? scenario === "offseason" || scenario === "slate_empty_today"
      ? "scoreboard_empty.json"
      : "scoreboard.json"
    : undefined;

  const response = await fetchEspnJson<EspnScoreboard>({
    endpoint: SCOREBOARD_ENDPOINT,
    params: { dates: toCompactDate(dateISO) },
    fixtureFile,
    fixtureSubdir: "nba",
    ttlSeconds: 90,
    dataMode: resolved,
    cacheBust,
  });

  return { games: normalizeScoreboardGames(response.data), meta: response.meta };
}

export async function getTodaysSlate(mode: Mode, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ games: SlateGame[]; meta: Meta; dateUsed: string }> {
  const dateUsed = new Date().toISOString().slice(0, 10);
  const slate = await getScoreboardForDate(dateUsed, dataMode, cacheBust);
  return { games: slate.games, meta: slate.meta, dateUsed };
}

/**
 * Walk backwards up to maxDays to find the most recent date that had NBA
 * games — used to show the last real slate when the league is off-season.
 */
export async function getMostRecentSlateBefore(
  dateISO: string,
  dataMode?: ModeArg,
  maxDays = 120,
  cacheBust?: CacheBustArg,
): Promise<{ dateISO: string | null; games: SlateGame[]; meta: Meta }> {
  const mode = getDataMode(dataMode);

  if (mode === "fixture") {
    // In fixture mode the games fixture stands in for "the last real slate".
    const slate = await fetchEspnJson<EspnScoreboard>({
      endpoint: SCOREBOARD_ENDPOINT,
      params: { dates: toCompactDate(dateISO) },
      fixtureFile: "scoreboard.json",
      fixtureSubdir: "nba",
      ttlSeconds: 90,
      dataMode: mode,
      cacheBust,
    });
    const games = normalizeScoreboardGames(slate.data);
    return { dateISO: games[0]?.date?.slice(0, 10) ?? null, games, meta: slate.meta };
  }

  const start = new Date(dateISO);
  for (let i = 1; i <= maxDays; i += 1) {
    const probe = new Date(start);
    probe.setUTCDate(probe.getUTCDate() - i);
    const probeIso = probe.toISOString().slice(0, 10);
    const slate = await getScoreboardForDate(probeIso, mode, cacheBust);
    if (slate.games.length > 0) {
      return { dateISO: probeIso, games: slate.games, meta: slate.meta };
    }
  }

  return {
    dateISO: null,
    games: [],
    meta: {
      sourceUsed: mode === "fixture" ? "fixture" : "espn",
      updatedAt: new Date().toISOString(),
      requestId: randomUUID(),
      warning: "No recent NBA slate found in the lookback window.",
      dataMode: mode,
    },
  };
}

/**
 * Walk forwards up to maxDays to find the next date with NBA games — used to
 * show the next scheduled slate between game days.
 */
export async function getNextLeagueSlateAfter(
  dateISO: string,
  dataMode?: ModeArg,
  maxDays = 21,
  cacheBust?: CacheBustArg,
): Promise<{ nextDateISO: string | null; games: SlateGame[]; meta: Meta }> {
  const mode = getDataMode(dataMode);

  if (mode === "fixture") {
    // No "next slate" in fixture mode; callers fall through to historical.
    return {
      nextDateISO: null,
      games: [],
      meta: {
        sourceUsed: "fixture",
        updatedAt: new Date().toISOString(),
        requestId: randomUUID(),
        dataMode: mode,
      },
    };
  }

  const start = new Date(dateISO);
  for (let i = 1; i <= maxDays; i += 1) {
    const probe = new Date(start);
    probe.setUTCDate(probe.getUTCDate() + i);
    const probeIso = probe.toISOString().slice(0, 10);
    const slate = await getScoreboardForDate(probeIso, mode, cacheBust);
    if (slate.games.length > 0) {
      return { nextDateISO: probeIso, games: slate.games, meta: slate.meta };
    }
  }

  return {
    nextDateISO: null,
    games: [],
    meta: {
      sourceUsed: "espn",
      updatedAt: new Date().toISOString(),
      requestId: randomUUID(),
      warning: "No upcoming NBA slate found in the lookahead window.",
      dataMode: mode,
    },
  };
}

export async function getStandingsSnapshot(mode: Mode, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ data: NbaStandingsSnapshot; meta: Meta }> {
  const resolved = getDataMode(dataMode);

  const response = await fetchEspnJson<EspnStandingsResponse>({
    endpoint: STANDINGS_ENDPOINT,
    fixtureFile: "standings.json",
    fixtureSubdir: "nba",
    ttlSeconds: 120,
    dataMode: resolved,
    cacheBust,
  });

  return {
    data: normalizeStandings(response.data, mode),
    meta: response.meta,
  };
}

function competitorScore(score: unknown): number | undefined {
  if (typeof score === "number") return score;
  if (typeof score === "string") {
    const n = Number(score);
    return Number.isFinite(n) ? n : undefined;
  }
  if (score && typeof score === "object") {
    const obj = score as { value?: number; displayValue?: string };
    if (typeof obj.value === "number") return obj.value;
    if (obj.displayValue) {
      const n = Number(obj.displayValue);
      return Number.isFinite(n) ? n : undefined;
    }
  }
  return undefined;
}

function normalizeSchedule(payload: EspnTeamSchedule, teamKey: string): NbaScheduleGame[] {
  const key = teamKey.trim().toUpperCase();
  return (payload.events ?? []).flatMap((event) => {
    const comp = event.competitions?.[0];
    const competitors = comp?.competitors ?? [];
    const self = competitors.find((c) => (c.team?.abbreviation ?? "").toUpperCase() === key) ?? competitors[0];
    const opponent = competitors.find((c) => c !== self);
    if (!self || !opponent) {
      return [];
    }
    const completed = Boolean(comp?.status?.type?.completed);
    const teamScore = competitorScore(self.score);
    const opponentScore = competitorScore(opponent.score);
    let result: "W" | "L" | undefined;
    if (completed) {
      if (typeof self.winner === "boolean") {
        result = self.winner ? "W" : "L";
      } else if (typeof teamScore === "number" && typeof opponentScore === "number") {
        result = teamScore > opponentScore ? "W" : "L";
      }
    }
    return [{
      id: event.id ?? randomUUID(),
      date: event.date ?? new Date().toISOString(),
      opponentKey: opponent.team?.abbreviation ?? "OPP",
      opponentName: opponent.team?.displayName ?? "Opponent",
      homeAway: self.homeAway === "home" ? "home" : "away",
      completed,
      result,
      teamScore,
      opponentScore,
    }];
  });
}

export async function getTeamSchedule(
  teamKey: string,
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<{ games: NbaScheduleGame[]; meta: Meta }> {
  const resolved = getDataMode(dataMode);
  const teamId = espnTeamIdForKey(teamKey);
  if (resolved !== "fixture" && !teamId) {
    throw new Error(`Unknown NBA team key: ${teamKey}`);
  }

  const response = await fetchEspnJson<EspnTeamSchedule>({
    endpoint: `${TEAMS_BASE}/${teamId ?? 18}/schedule`,
    fixtureFile: "team_schedule.json",
    fixtureSubdir: "nba",
    ttlSeconds: 300,
    dataMode: resolved,
    cacheBust,
  });

  return { games: normalizeSchedule(response.data, teamKey), meta: response.meta };
}

export type NbaRecentForm = {
  teamKey: string;
  record: { wins: number; losses: number };
  winPct: number;
  streak: string;
  rating: "Hot" | "Warm" | "Cool" | "Cold";
  games: NbaScheduleGame[];
};

function ratingFor(winPct: number): NbaRecentForm["rating"] {
  if (winPct >= 0.7) return "Hot";
  if (winPct >= 0.5) return "Warm";
  if (winPct >= 0.3) return "Cool";
  return "Cold";
}

function computeStreak(games: NbaScheduleGame[]): string {
  let count = 0;
  let kind: "W" | "L" | null = null;
  for (const game of games) {
    if (!game.result) continue;
    if (kind === null) {
      kind = game.result;
      count = 1;
    } else if (game.result === kind) {
      count += 1;
    } else {
      break;
    }
  }
  return kind ? `${kind}${count}` : "—";
}

export async function getRecentForm(
  teamKey: string,
  lastN = 10,
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<{ data: NbaRecentForm; meta: Meta }> {
  const { games, meta } = await getTeamSchedule(teamKey, dataMode, cacheBust);
  const completed = games.filter((game) => game.completed && game.result);
  const recent = completed.slice(-lastN).reverse();
  const wins = recent.filter((game) => game.result === "W").length;
  const losses = recent.length - wins;
  const winPct = recent.length > 0 ? wins / recent.length : 0;

  return {
    data: {
      teamKey: teamKey.toUpperCase(),
      record: { wins, losses },
      winPct,
      streak: computeStreak(recent),
      rating: ratingFor(winPct),
      games: recent,
    },
    meta,
  };
}

export type NbaNextGames = {
  teamKey: string;
  inSeason: boolean;
  games: NbaScheduleGame[];
  recent: NbaScheduleGame[];
};

export async function getNextGames(
  teamKey: string,
  count = 7,
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<{ data: NbaNextGames; meta: Meta }> {
  const { games, meta } = await getTeamSchedule(teamKey, dataMode, cacheBust);
  const now = Date.now();
  const upcoming = games
    .filter((game) => !game.completed && new Date(game.date).getTime() >= now)
    .slice(0, count);
  const recent = games.filter((game) => game.completed && game.result).slice(-count).reverse();

  return {
    data: {
      teamKey: teamKey.toUpperCase(),
      inSeason: upcoming.length > 0,
      games: upcoming,
      recent,
    },
    meta,
  };
}

export type NbaSeedRow = NbaStandingsTeam & { rank: number; seedLabel: string };
export type NbaPlayoffPicture = {
  east: NbaSeedRow[];
  west: NbaSeedRow[];
};

function seedConference(rows: NbaStandingsTeam[]): NbaSeedRow[] {
  return rows.map((row, index) => {
    const rank = index + 1;
    const seedLabel = rank <= 6 ? "Playoffs" : rank <= 10 ? "Play-In" : "Lottery";
    return { ...row, rank, seedLabel };
  });
}

export async function getPlayoffPicture(
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<{ data: NbaPlayoffPicture; meta: Meta }> {
  const resolved = getDataMode(dataMode);
  const response = await fetchEspnJson<EspnStandingsResponse>({
    endpoint: STANDINGS_ENDPOINT,
    fixtureFile: "standings.json",
    fixtureSubdir: "nba",
    ttlSeconds: 120,
    dataMode: resolved,
    cacheBust,
  });

  const children = response.data.children ?? [];
  const east = children.find((child) => (child.abbreviation ?? child.name ?? "").toLowerCase().includes("east"));
  const west = children.find((child) => (child.abbreviation ?? child.name ?? "").toLowerCase().includes("west"));

  return {
    data: {
      east: seedConference(normalizeConferenceEntries(east?.standings?.entries, 15)),
      west: seedConference(normalizeConferenceEntries(west?.standings?.entries, 15)),
    },
    meta: response.meta,
  };
}

export type NbaTeamStatProfile = {
  teamKey: string;
  pointsFor?: number;
  pointsAgainst?: number;
  netRating?: number;
  reboundsPerGame?: number;
  assistsPerGame?: number;
  fieldGoalPct?: number;
};

function findStat(payload: EspnTeamStatistics, candidates: string[]): number | undefined {
  const categories = payload.results?.stats?.categories ?? [];
  for (const category of categories) {
    for (const stat of category.stats ?? []) {
      const name = (stat.name ?? "").toLowerCase();
      const display = (stat.displayName ?? "").toLowerCase();
      if (candidates.some((c) => c === name || c === display)) {
        if (typeof stat.value === "number" && Number.isFinite(stat.value)) {
          return stat.value;
        }
        if (stat.displayValue) {
          const n = Number(stat.displayValue.replace(/[^0-9.\-]/g, ""));
          if (Number.isFinite(n)) return n;
        }
      }
    }
  }
  return undefined;
}

export async function getTeamStatProfile(
  teamKey: string,
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<{ data: NbaTeamStatProfile; meta: Meta }> {
  const resolved = getDataMode(dataMode);
  const teamId = espnTeamIdForKey(teamKey);
  if (resolved !== "fixture" && !teamId) {
    throw new Error(`Unknown NBA team key: ${teamKey}`);
  }

  const response = await fetchEspnJson<EspnTeamStatistics>({
    endpoint: `${TEAMS_BASE}/${teamId ?? 18}/statistics`,
    fixtureFile: "team_statistics.json",
    fixtureSubdir: "nba",
    ttlSeconds: 600,
    dataMode: resolved,
    cacheBust,
  });

  const pointsFor = findStat(response.data, ["avgpoints", "points per game", "ppg"]);
  const pointsAgainst = findStat(response.data, ["avgpointsagainst", "opponent points per game", "oppg"]);

  return {
    data: {
      teamKey: teamKey.toUpperCase(),
      pointsFor,
      pointsAgainst,
      netRating: typeof pointsFor === "number" && typeof pointsAgainst === "number"
        ? Number((pointsFor - pointsAgainst).toFixed(1))
        : undefined,
      reboundsPerGame: findStat(response.data, ["avgrebounds", "rebounds per game", "rpg"]),
      assistsPerGame: findStat(response.data, ["avgassists", "assists per game", "apg"]),
      fieldGoalPct: findStat(response.data, ["fieldgoalpct", "field goal percentage", "fg%"]),
    },
    meta: response.meta,
  };
}
