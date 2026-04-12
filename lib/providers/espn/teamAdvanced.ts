import { randomUUID } from "node:crypto";
import { fetchEspnJson, getDataMode } from "@/lib/providers/espn/client";
import { getTeamStatusBatch } from "@/lib/providers/espn/teamStatus";
import type { Meta } from "@/lib/providers/types";
import type { Envelope } from "@/lib/types/players";
import type { SportKey, TeamAdvanced } from "@/lib/types/playerInsights";

type ModeArg = "auto" | "live" | "fixture";
type ViewMode = "beginner" | "advanced";
type CacheBustArg = string | number | null | undefined;

type ScoreboardPayload = {
  events?: Array<{
    id?: string;
    date?: string;
    competitions?: Array<{
      status?: {
        type?: {
          state?: string;
          detail?: string;
          shortDetail?: string;
        };
      };
      competitors?: Array<{
        homeAway?: "home" | "away";
        score?: string | number;
        team?: {
          abbreviation?: string;
          displayName?: string;
        };
      }>;
    }>;
  }>;
};

type StandingsEntry = {
  team?: { abbreviation?: string };
  stats?: Array<{
    name?: string;
    type?: string;
    abbreviation?: string;
    value?: number;
    displayValue?: string;
  }>;
};

type StandingsPayload = {
  children?: Array<{
    name?: string;
    abbreviation?: string;
    // MLB/NFL: conference → division children, each with standings.entries
    children?: Array<{
      name?: string;
      standings?: { entries?: StandingsEntry[] };
    }>;
    // NBA: entries directly on the conference child
    standings?: { entries?: StandingsEntry[] };
  }>;
};

type StandingsStat = {
  name?: string;
  type?: string;
  abbreviation?: string;
  value?: number;
  displayValue?: string;
};

type TeamStandingInfo = {
  record: TeamAdvanced["record"];
  standings: TeamAdvanced["standings"];
};

const SCOREBOARD_ENDPOINTS: Record<SportKey, string> = {
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
};

const SCOREBOARD_FIXTURES: Record<SportKey, { file: string; subdir: string }> = {
  nfl: { file: "scoreboard_with_games.json", subdir: "nfl" },
  mlb: { file: "mlb_scoreboard_sample.json", subdir: "scoreboard" },
  nba: { file: "nba_scoreboard_sample.json", subdir: "scoreboard" },
};

const STANDINGS_ENDPOINTS: Record<SportKey, string> = {
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings",
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/standings",
  nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/standings",
};

const STANDINGS_FIXTURE_BY_SPORT: Partial<Record<SportKey, { file: string; subdir: string }>> = {
  nba: { file: "standings.json", subdir: "nba" },
};

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function toGameState(value: string | undefined): "pre" | "in" | "post" {
  const key = (value ?? "").toLowerCase();
  if (key === "pre" || key.includes("pre")) return "pre";
  if (key === "in" || key.includes("in")) return "in";
  return "post";
}

function toScore(value: string | number | undefined): number {
  const parsed = readNumber(value);
  return typeof parsed === "number" ? parsed : 0;
}

function scoreSummary(teamScore: number, oppScore: number): string {
  return `${teamScore}-${oppScore}`;
}

function parseTeamEvents(payload: ScoreboardPayload, teamKey: string): Array<{
  date?: string;
  state: "pre" | "in" | "post";
  opponent?: string;
  homeAway?: "home" | "away";
  detail?: string;
  result?: string;
  score?: string;
}> {
  const normalizedKey = teamKey.toUpperCase();
  const events: Array<{
    date?: string;
    state: "pre" | "in" | "post";
    opponent?: string;
    homeAway?: "home" | "away";
    detail?: string;
    result?: string;
    score?: string;
  }> = [];

  for (const event of payload.events ?? []) {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors ?? [];
    const team = competitors.find((row) => row.team?.abbreviation?.toUpperCase() === normalizedKey);
    if (!team) {
      continue;
    }

    const opponent = competitors.find((row) => row !== team);
    const state = toGameState(competition?.status?.type?.state);
    const teamScore = toScore(team.score);
    const oppScore = toScore(opponent?.score);

    events.push({
      date: event.date,
      state,
      opponent: opponent?.team?.abbreviation ?? opponent?.team?.displayName,
      homeAway: team.homeAway,
      detail: competition?.status?.type?.detail ?? competition?.status?.type?.shortDetail,
      result: state === "post"
        ? (teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "T")
        : undefined,
      score: scoreSummary(teamScore, oppScore),
    });
  }

  return events.sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0;
    const bTime = b.date ? new Date(b.date).getTime() : 0;
    return aTime - bTime;
  });
}

function pickStandingStat(
  stats: StandingsStat[] | undefined,
  keys: string[],
): { value?: number; displayValue?: string } {
  for (const stat of stats ?? []) {
    const candidates = [
      readString(stat.name)?.toLowerCase(),
      readString(stat.type)?.toLowerCase(),
      readString(stat.abbreviation)?.toLowerCase(),
    ].filter(Boolean) as string[];
    if (candidates.some((candidate) => keys.includes(candidate))) {
      return {
        value: readNumber(stat.value),
        displayValue: readString(stat.displayValue),
      };
    }
  }
  return {};
}

// ESPN standings endpoint returns shortened abbreviations for some teams.
// Map them to the standard 3-4 letter codes used throughout the app.
const ESPN_ABBREV_EXPAND: Record<string, string> = {
  // NBA
  NY: "NYK",   // New York Knicks
  GS: "GSW",   // Golden State Warriors
  NO: "NOP",   // New Orleans Pelicans
  SA: "SAS",   // San Antonio Spurs
  // MLB
  SD: "SDP",   // San Diego Padres
  SF: "SFG",   // San Francisco Giants
  KC: "KCR",   // Kansas City Royals
  TB: "TBR",   // Tampa Bay Rays
  CWS: "CHW",  // Chicago White Sox
  WSH: "WSN",  // Washington Nationals
};

function expandEspnAbbrev(raw: string): string {
  return ESPN_ABBREV_EXPAND[raw] ?? raw;
}

function parseStandingsEntries(
  entries: StandingsEntry[],
  conference: string | undefined,
  map: Record<string, TeamStandingInfo>,
  startIndex: number,
): void {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const rawKey = readString(entry.team?.abbreviation)?.toUpperCase();
    if (!rawKey) {
      continue;
    }
    const teamKey = expandEspnAbbrev(rawKey);

    const wins = pickStandingStat(entry.stats, ["wins", "w"]);
    const losses = pickStandingStat(entry.stats, ["losses", "l"]);
    const pct = pickStandingStat(entry.stats, ["winpercent", "pct", "wpct"]);
    const streak = pickStandingStat(entry.stats, ["streak", "strk"]);
    const last10 = pickStandingStat(entry.stats, ["lasttengames", "last10", "l10"]);
    const rank = pickStandingStat(entry.stats, ["rank", "playoffseed", "seed"]);

    map[teamKey] = {
      record: typeof wins.value === "number" && typeof losses.value === "number"
        ? {
          wins: wins.value,
          losses: losses.value,
          pct: pct.displayValue ?? (typeof pct.value === "number" ? pct.value.toFixed(3) : undefined),
          streak: streak.displayValue,
          last10: last10.displayValue,
        }
        : null,
      standings: {
        rank: rank.displayValue ?? (typeof rank.value === "number" ? String(rank.value) : String(startIndex + index + 1)),
        division: undefined,
        conference,
      },
    };
  }
}

function parseStandings(payload: StandingsPayload): Record<string, TeamStandingInfo> {
  const map: Record<string, TeamStandingInfo> = {};

  for (const child of payload.children ?? []) {
    const conference = readString(child.name);
    const directEntries = child.standings?.entries ?? [];

    if (directEntries.length > 0) {
      // Flat structure: conference → entries (NBA)
      parseStandingsEntries(directEntries, conference, map, 0);
    } else {
      // Nested structure: conference → division → entries (MLB, NFL)
      for (const division of child.children ?? []) {
        const divisionEntries = division.standings?.entries ?? [];
        parseStandingsEntries(divisionEntries, conference, map, 0);
      }
    }
  }

  return map;
}

function combineMeta(dataMode: ModeArg, candidates: Array<Meta | null>, notes: string[]): Meta {
  const valid = candidates.filter((meta): meta is Meta => Boolean(meta));
  const primary = valid[0];
  const warnings = [
    ...valid.map((meta) => meta.warning).filter((warning): warning is string => Boolean(warning)),
    ...notes,
  ];

  return {
    sourceUsed: primary?.sourceUsed ?? (dataMode === "fixture" ? "fixture" : "espn"),
    updatedAt: primary?.updatedAt ?? new Date().toISOString(),
    requestId: primary?.requestId ?? randomUUID(),
    endpointUrl: primary?.endpointUrl,
    upstreamStatus: primary?.upstreamStatus,
    upstreamMessage: primary?.upstreamMessage,
    cacheHit: primary?.cacheHit,
    cacheAgeSeconds: primary?.cacheAgeSeconds,
    dataMode,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}

function appendMetaWarning(meta: Meta, warning?: string): Meta {
  if (!warning) {
    return meta;
  }
  return {
    ...meta,
    warning: meta.warning ? `${meta.warning} ${warning}` : warning,
  };
}

function appendMetaNotes(meta: Meta, notes: string[]): Meta {
  if (notes.length === 0) {
    return meta;
  }
  return {
    ...meta,
    notes: [...(meta.notes ?? []), ...notes],
  };
}

function isTeamAdvancedComplete(team: TeamAdvanced): boolean {
  const hasIdentity = Boolean(team.teamKey);
  const hasDetail = Boolean(
    team.status?.hasGameToday
      || team.nextGame
      || team.record
      || team.standings
      || team.lastGame,
  );
  return hasIdentity && hasDetail;
}

function mergeTeamAdvanced(liveTeam: TeamAdvanced | undefined, fixtureTeam: TeamAdvanced | undefined): TeamAdvanced | null {
  if (!liveTeam && !fixtureTeam) {
    return null;
  }
  if (!liveTeam) {
    return fixtureTeam ?? null;
  }
  if (!fixtureTeam) {
    return liveTeam;
  }

  const liveStatusHasSignal = liveTeam.status.hasGameToday || Boolean(liveTeam.status.state || liveTeam.status.displayClock || liveTeam.status.opponent);
  return {
    teamKey: liveTeam.teamKey || fixtureTeam.teamKey,
    status: liveStatusHasSignal ? liveTeam.status : fixtureTeam.status,
    nextGame: liveTeam.nextGame ?? fixtureTeam.nextGame ?? null,
    record: liveTeam.record ?? fixtureTeam.record ?? null,
    standings: liveTeam.standings ?? fixtureTeam.standings ?? null,
    lastGame: liveTeam.lastGame ?? fixtureTeam.lastGame ?? null,
    metaNotes: [...(liveTeam.metaNotes ?? []), ...(fixtureTeam.metaNotes ?? [])],
  };
}

async function getTeamsAdvancedForMode(
  sport: SportKey,
  teamKeys: string[],
  mode: ViewMode,
  dataMode: "live" | "fixture",
  cacheBust?: CacheBustArg,
): Promise<Envelope<{ sport: SportKey; teams: TeamAdvanced[] }>> {
  const resolvedMode = getDataMode(dataMode);
  const normalizedKeys = Array.from(new Set(teamKeys.map((key) => key.trim().toUpperCase()).filter(Boolean)));

  if (normalizedKeys.length === 0) {
    return {
      data: null,
      meta: {
        sourceUsed: resolvedMode === "fixture" ? "fixture" : "espn",
        updatedAt: new Date().toISOString(),
        requestId: randomUUID(),
        warning: "teamKeys is required",
        dataMode: resolvedMode,
      },
      error: {
        message: "teamKeys is required",
        code: "MISSING_TEAM_KEYS",
      },
    };
  }

  const notes: string[] = [];
  const statusEnvelope = await getTeamStatusBatch(sport, normalizedKeys, resolvedMode, cacheBust);
  if (statusEnvelope.error || !statusEnvelope.data) {
    return {
      data: null,
      meta: combineMeta(resolvedMode, [statusEnvelope.meta], [statusEnvelope.error?.message ?? "Failed to fetch team status batch"]),
      error: {
        message: statusEnvelope.error?.message ?? "Failed to fetch team status batch",
        code: statusEnvelope.error?.code ?? "UPSTREAM_ERROR",
      },
    };
  }

  let scoreboardMeta: Meta | null = null;
  let scoreboardPayload: ScoreboardPayload | null = null;
  try {
    const fixture = SCOREBOARD_FIXTURES[sport];
    const scoreboard = await fetchEspnJson<ScoreboardPayload>({
      endpoint: SCOREBOARD_ENDPOINTS[sport],
      fixtureFile: fixture.file,
      fixtureSubdir: fixture.subdir,
      ttlSeconds: 60,
      dataMode: resolvedMode,
      cacheBust,
    });
    scoreboardMeta = scoreboard.meta;
    scoreboardPayload = scoreboard.data;
  } catch (error) {
    notes.push(`Scoreboard detail unavailable: ${String(error)}`);
  }

  let standingsMeta: Meta | null = null;
  let standingsByTeam: Record<string, TeamStandingInfo> = {};
  try {
    const standingsFixture = STANDINGS_FIXTURE_BY_SPORT[sport];
    const standingsResponse = await fetchEspnJson<StandingsPayload>({
      endpoint: STANDINGS_ENDPOINTS[sport],
      fixtureFile: standingsFixture?.file,
      fixtureSubdir: standingsFixture?.subdir,
      ttlSeconds: 180,
      dataMode: resolvedMode,
      cacheBust,
    });
    standingsMeta = standingsResponse.meta;
    standingsByTeam = parseStandings(standingsResponse.data);
  } catch (error) {
    notes.push(`Standings unavailable for ${sport.toUpperCase()}: ${String(error)}`);
  }

  const statusMap = statusEnvelope.data.statuses.reduce<Record<string, typeof statusEnvelope.data.statuses[number]>>((acc, status) => {
    acc[status.teamKey.toUpperCase()] = status;
    return acc;
  }, {});

  const teams: TeamAdvanced[] = normalizedKeys.map((teamKey) => {
    const status = statusMap[teamKey] ?? {
      sport,
      teamKey,
      hasGameToday: false,
    };

    const events = scoreboardPayload ? parseTeamEvents(scoreboardPayload, teamKey) : [];
    const now = Date.now();
    const nextEvent = events.find((event) => {
      const eventTime = event.date ? new Date(event.date).getTime() : 0;
      return event.state === "pre" && eventTime >= now - 30 * 60 * 1000;
    }) ?? events.find((event) => event.state === "pre");
    const lastEvent = [...events].reverse().find((event) => event.state === "post");

    const standing = standingsByTeam[teamKey];
    const teamNotes: string[] = [];
    if (!standing?.record) {
      teamNotes.push("Record unavailable.");
    }
    if (!standing?.standings) {
      teamNotes.push("Standings rank unavailable.");
    }

    return {
      teamKey,
      status,
      nextGame: nextEvent
        ? {
          when: nextEvent.date,
          vs: nextEvent.opponent,
          homeAway: nextEvent.homeAway,
        }
        : null,
      record: standing?.record ?? null,
      standings: standing?.standings ?? null,
      lastGame: lastEvent
        ? {
          when: lastEvent.date,
          vs: lastEvent.opponent,
          result: lastEvent.result,
          score: lastEvent.score,
        }
        : null,
      metaNotes: mode === "advanced" && teamNotes.length > 0 ? teamNotes : undefined,
    };
  });

  return {
    data: {
      sport,
      teams,
    },
    meta: combineMeta(resolvedMode, [statusEnvelope.meta, scoreboardMeta, standingsMeta], notes),
  };
}

export async function getTeamsAdvanced(
  sport: SportKey,
  teamKeys: string[],
  mode: ViewMode,
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<Envelope<{ sport: SportKey; teams: TeamAdvanced[] }>> {
  const requestedMode = dataMode ?? "auto";
  if (requestedMode !== "auto") {
    return getTeamsAdvancedForMode(sport, teamKeys, mode, getDataMode(requestedMode), cacheBust);
  }

  const liveEnvelope = await getTeamsAdvancedForMode(sport, teamKeys, mode, "live", cacheBust);
  const liveTeams = liveEnvelope.data?.teams ?? [];
  const liveComplete = !liveEnvelope.error && liveTeams.length > 0 && liveTeams.every((team) => isTeamAdvancedComplete(team));
  if (liveComplete) {
    return {
      ...liveEnvelope,
      meta: appendMetaNotes(liveEnvelope.meta, ["AUTO mode selected live team advanced response."]),
    };
  }

  const fixtureEnvelope = await getTeamsAdvancedForMode(sport, teamKeys, mode, "fixture", cacheBust);
  if (!fixtureEnvelope.error && fixtureEnvelope.data?.teams) {
    const fixtureByKey = fixtureEnvelope.data.teams.reduce<Record<string, TeamAdvanced>>((acc, team) => {
      acc[team.teamKey.toUpperCase()] = team;
      return acc;
    }, {});
    const liveByKey = liveTeams.reduce<Record<string, TeamAdvanced>>((acc, team) => {
      acc[team.teamKey.toUpperCase()] = team;
      return acc;
    }, {});
    const normalizedKeys = Array.from(new Set(teamKeys.map((key) => key.trim().toUpperCase()).filter(Boolean)));
    const teams = normalizedKeys
      .map((key) => mergeTeamAdvanced(liveByKey[key], fixtureByKey[key]))
      .filter((team): team is TeamAdvanced => team !== null);
    const allComplete = teams.length > 0 && teams.every((team) => isTeamAdvancedComplete(team));
    const hydrationWarning = allComplete
      ? "AUTO mode hydrated incomplete live team rows with fixture fields."
      : "AUTO mode used fixture team rows because live team details were incomplete.";
    return {
      data: {
        sport,
        teams: allComplete ? teams : fixtureEnvelope.data.teams,
      },
      meta: appendMetaNotes(
        appendMetaWarning(
          allComplete ? { ...liveEnvelope.meta, dataMode: "live" } : { ...fixtureEnvelope.meta, dataMode: "fixture" },
          hydrationWarning,
        ),
        [hydrationWarning],
      ),
    };
  }

  return {
    ...liveEnvelope,
    meta: appendMetaNotes(
      appendMetaWarning(liveEnvelope.meta, "AUTO mode could not improve teams advanced response with fixture."),
      ["AUTO mode tried live and fixture team advanced sources; returning best available response."],
    ),
    error: liveEnvelope.error ?? fixtureEnvelope.error,
  };
}
