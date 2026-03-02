import { fetchEspnJson, getDataMode } from "@/lib/providers/espn/client";
import type { Meta, Mode, SlateGame } from "@/lib/providers/types";

type ModeArg = "auto" | "live" | "fixture";
type CacheBustArg = string | number | null | undefined;

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

function toCompactDate(dateISO: string): string {
  return dateISO.replaceAll("-", "");
}

function gameTypeFromSeasonType(type?: number): string | undefined {
  if (type === 1) return "preseason";
  if (type === 2) return "regular";
  if (type === 3) return "postseason";
  return undefined;
}

function parseRecord(summary?: string): { wins: number; losses: number } | undefined {
  if (!summary) {
    return undefined;
  }

  const [wins, losses] = summary.split("-").map((value) => Number(value.trim()));
  if (!Number.isFinite(wins) || !Number.isFinite(losses)) {
    return undefined;
  }

  return { wins, losses };
}

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

export async function getTodaysSlate(mode: Mode, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ games: SlateGame[]; meta: Meta; dateUsed: string }> {
  const resolved = getDataMode(dataMode);
  const dateUsed = new Date().toISOString().slice(0, 10);

  const response = await fetchEspnJson<EspnScoreboard>({
    endpoint: SCOREBOARD_ENDPOINT,
    params: { dates: toCompactDate(dateUsed) },
    fixtureFile: "scoreboard.json",
    fixtureSubdir: "nba",
    ttlSeconds: 90,
    dataMode: resolved,
    cacheBust,
  });

  return {
    games: normalizeScoreboardGames(response.data),
    meta: response.meta,
    dateUsed,
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
