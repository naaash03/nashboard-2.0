import { randomUUID } from "node:crypto";
import { getApiSportsConfig } from "@/lib/providers/apiSports/config";
import { fetchApiSportsJson } from "@/lib/providers/apiSports/client";
import { buildDateRange, formatDateInTimeZone } from "@/lib/providers/scheduleWindow";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, SportKey, TeamProviderRef } from "@/lib/types/players";
import type { TeamAdvanced } from "@/lib/types/playerInsights";

type ModeArg = "live" | "fixture";
type ViewMode = "beginner" | "advanced";
type CacheBustArg = string | number | null | undefined;

type TeamIdentity = {
  teamKey: string;
  teamName?: string;
  apiSportsTeamId?: string;
  espnTeamId?: string;
};

type NormalizedGame = {
  eventId?: string;
  date?: string;
  dateMs: number;
  dateKey?: string;
  state: "pre" | "in" | "post";
  detail?: string;
  opponent?: string;
  homeAway?: "home" | "away";
  score?: { team: number; opp: number };
  result?: "W" | "L" | "T";
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

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

function normalizeTeamKey(teamKey: string): string {
  return teamKey.trim().toUpperCase();
}

function fallbackMeta(mode: ModeArg, warning: string, notes?: string[]): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : "apiSports",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    warnings: warning ? [warning] : undefined,
    notes,
    dataMode: mode,
    dataModeEffective: mode,
  };
}

function normalizeTeamRefs(teamRefsOrKeys: TeamProviderRef[] | string[]): TeamProviderRef[] {
  const refs: TeamProviderRef[] = [];
  for (const item of teamRefsOrKeys) {
    if (typeof item === "string") {
      const key = normalizeTeamKey(item);
      if (key) {
        refs.push({ teamKey: key });
      }
      continue;
    }

    const key = normalizeTeamKey(item.teamKey);
    if (!key) {
      continue;
    }
    refs.push({
      teamKey: key,
      teamName: item.teamName?.trim() || undefined,
      apiSportsTeamId: item.apiSportsTeamId?.trim() || undefined,
      espnTeamId: item.espnTeamId?.trim() || undefined,
    });
  }
  const unique = new Map<string, TeamProviderRef>();
  for (const ref of refs) {
    const existing = unique.get(ref.teamKey);
    if (!existing) {
      unique.set(ref.teamKey, ref);
      continue;
    }
    unique.set(ref.teamKey, {
      teamKey: ref.teamKey,
      teamName: existing.teamName ?? ref.teamName,
      apiSportsTeamId: existing.apiSportsTeamId ?? ref.apiSportsTeamId,
      espnTeamId: existing.espnTeamId ?? ref.espnTeamId,
    });
  }
  return Array.from(unique.values());
}

function mapStatusState(value: string | undefined): "pre" | "in" | "post" {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("in play") || normalized.includes("live") || normalized.includes("progress")) {
    return "in";
  }
  if (
    normalized.includes("final")
    || normalized.includes("finished")
    || normalized.includes("ft")
    || normalized.includes("post")
    || normalized.includes("full time")
  ) {
    return "post";
  }
  return "pre";
}

function toIsoDate(value: unknown): string | undefined {
  if (typeof value === "string") {
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return direct.toISOString();
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const asMillis = value > 1_000_000_000_000 ? value : value * 1000;
    const parsed = new Date(asMillis);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return undefined;
}

function parseTeamId(value: unknown): string | undefined {
  return readString(value) ?? readNumber(value)?.toString();
}

function parseTeamCode(team: Record<string, unknown> | null): string | undefined {
  return readString(team?.code)?.toUpperCase()
    ?? readString(team?.abbreviation)?.toUpperCase()
    ?? readString(team?.short_name)?.toUpperCase();
}

function parseTeamName(team: Record<string, unknown> | null): string | undefined {
  return readString(team?.name)
    ?? readString(team?.display_name)
    ?? readString(team?.city);
}

function parseTeamRows(payload: unknown): Record<string, unknown>[] {
  const typed = asObject(payload);
  const rows = Array.isArray(typed?.response) ? typed.response : [];
  return rows
    .map((row) => asObject(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

function matchTeamRow(row: Record<string, unknown>, ref: TeamProviderRef): boolean {
  const team = asObject(row.team) ?? row;
  const rowId = parseTeamId(team.id ?? team.team_id);
  const rowCode = parseTeamCode(team);
  if (ref.apiSportsTeamId && rowId && ref.apiSportsTeamId === rowId) {
    return true;
  }
  if (rowCode && rowCode === ref.teamKey) {
    return true;
  }
  if (ref.teamName) {
    const rowName = parseTeamName(team)?.toLowerCase();
    if (rowName && rowName === ref.teamName.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function parseScore(value: unknown): number | undefined {
  const direct = readNumber(value);
  if (typeof direct === "number") {
    return direct;
  }
  const typed = asObject(value);
  return readNumber(typed?.total ?? typed?.points ?? typed?.runs ?? typed?.value);
}

function selectTodayStatus(games: NormalizedGame[]): NormalizedGame | undefined {
  const live = games.find((game) => game.state === "in");
  if (live) {
    return live;
  }
  const pre = games.find((game) => game.state === "pre");
  if (pre) {
    return pre;
  }
  return games[games.length - 1];
}

function mapStandings(
  payload: unknown,
  ref: TeamIdentity,
): { record: TeamAdvanced["record"]; standings: TeamAdvanced["standings"]; teamName?: string } {
  const rows = parseTeamRows(payload);
  const normalizedKey = normalizeTeamKey(ref.teamKey);

  for (const row of rows) {
    const team = asObject(row.team) ?? row;
    const rowCode = parseTeamCode(team);
    const rowId = parseTeamId(team.id ?? team.team_id);

    const matchById = ref.apiSportsTeamId && rowId && rowId === ref.apiSportsTeamId;
    const matchByKey = rowCode && rowCode === normalizedKey;
    if (!matchById && !matchByKey) {
      continue;
    }

    const all = asObject(row.all);
    const win = readNumber(all?.win);
    const lose = readNumber(all?.lose);
    const league = asObject(row.league);
    const standings = asObject(league?.standings) ?? asObject(row.position);

    return {
      teamName: parseTeamName(team),
      record: typeof win === "number" && typeof lose === "number"
        ? {
            wins: win,
            losses: lose,
            pct: readString(all?.percentage),
            streak: readString(all?.streak),
            last10: readString(all?.last_10) ?? readString(all?.last10),
          }
        : null,
      standings: {
        rank: readString(standings?.position) ?? readNumber(standings?.position)?.toString(),
        division: readString(standings?.group) ?? readString(standings?.division),
        conference: readString(standings?.conference),
      },
    };
  }

  return {
    record: null,
    standings: null,
  };
}

function parseGamesForTeam(
  payload: unknown,
  ref: TeamIdentity,
  timeZone: string,
): NormalizedGame[] {
  const rows = parseTeamRows(payload);
  const normalizedKey = normalizeTeamKey(ref.teamKey);
  const result: NormalizedGame[] = [];

  for (const row of rows) {
    const teams = asObject(row.teams);
    const homeTeam = asObject(teams?.home);
    const awayTeam = asObject(teams?.away) ?? asObject(teams?.visitors);
    const homeId = parseTeamId(homeTeam?.id ?? homeTeam?.team_id);
    const awayId = parseTeamId(awayTeam?.id ?? awayTeam?.team_id);
    const homeCode = parseTeamCode(homeTeam);
    const awayCode = parseTeamCode(awayTeam);

    let homeAway: "home" | "away" | null = null;
    if (ref.apiSportsTeamId && homeId === ref.apiSportsTeamId) {
      homeAway = "home";
    } else if (ref.apiSportsTeamId && awayId === ref.apiSportsTeamId) {
      homeAway = "away";
    } else if (homeCode === normalizedKey) {
      homeAway = "home";
    } else if (awayCode === normalizedKey) {
      homeAway = "away";
    }

    if (!homeAway) {
      continue;
    }

    const opponentTeam = homeAway === "home" ? awayTeam : homeTeam;
    const opponentCode = parseTeamCode(opponentTeam);
    const opponentName = parseTeamName(opponentTeam);

    const dateValue = asObject(row.date);
    const isoDate = toIsoDate(dateValue?.start) ?? toIsoDate(dateValue?.timestamp) ?? toIsoDate(row.date);
    const dateMs = isoDate ? new Date(isoDate).getTime() : Number.NaN;
    const status = asObject(row.status);
    const statusText = readString(status?.short) ?? readString(status?.long) ?? readString(status?.status);
    const detail = readString(status?.long) ?? readString(status?.timer) ?? readString(status?.short);
    const state = mapStatusState(statusText);

    const scores = asObject(row.scores);
    const homeScore = parseScore(scores?.home);
    const awayScore = parseScore(scores?.away) ?? parseScore(scores?.visitors);
    const teamScore = homeAway === "home" ? homeScore : awayScore;
    const oppScore = homeAway === "home" ? awayScore : homeScore;
    const score = typeof teamScore === "number" && typeof oppScore === "number"
      ? { team: teamScore, opp: oppScore }
      : undefined;

    const resultLabel = (() => {
      if (!score || state !== "post") {
        return undefined;
      }
      if (score.team > score.opp) return "W";
      if (score.team < score.opp) return "L";
      return "T";
    })();

    result.push({
      eventId: readString(row.id) ?? readNumber(row.id)?.toString(),
      date: isoDate,
      dateMs: Number.isFinite(dateMs) ? dateMs : 0,
      dateKey: isoDate ? formatDateInTimeZone(new Date(isoDate), timeZone) : undefined,
      state,
      detail,
      opponent: opponentCode ?? opponentName,
      homeAway,
      score,
      result: resultLabel,
    });
  }

  return result.sort((left, right) => left.dateMs - right.dateMs);
}

async function resolveTeamIdentity(
  sport: SportKey,
  ref: TeamProviderRef,
  dataMode: ModeArg,
  cacheBust: CacheBustArg,
): Promise<{ identity: TeamIdentity; warning?: string }> {
  const baseIdentity: TeamIdentity = {
    teamKey: normalizeTeamKey(ref.teamKey),
    teamName: ref.teamName,
    apiSportsTeamId: ref.apiSportsTeamId,
    espnTeamId: ref.espnTeamId,
  };

  if (baseIdentity.apiSportsTeamId) {
    return { identity: baseIdentity };
  }

  try {
    const teamSearch = await fetchApiSportsJson<unknown>({
      sport,
      endpoint: "teams",
      params: {
        search: ref.teamName || ref.teamKey,
      },
      dataMode,
      ttlSeconds: 300,
      cacheBust,
      fixtureFile: "teams_search_sample.json",
    });
    const rows = parseTeamRows(teamSearch.data);
    const matched = rows.find((row) => matchTeamRow(row, ref));
    if (!matched) {
      return {
        identity: baseIdentity,
        warning: `API-Sports team id not found for ${baseIdentity.teamKey}; using key-based fallback.`,
      };
    }

    const team = asObject(matched.team) ?? matched;
    return {
      identity: {
        ...baseIdentity,
        teamName: baseIdentity.teamName ?? parseTeamName(team),
        apiSportsTeamId: parseTeamId(team.id ?? team.team_id),
      },
    };
  } catch (error) {
    return {
      identity: baseIdentity,
      warning: `Team identity lookup failed for ${baseIdentity.teamKey}: ${String(error)}`,
    };
  }
}

function pickPrimaryMeta(metas: Meta[], mode: ModeArg): Meta {
  const first = metas[0];
  return {
    sourceUsed: first?.sourceUsed ?? (mode === "fixture" ? "fixture" : "apiSports"),
    updatedAt: first?.updatedAt ?? new Date().toISOString(),
    requestId: first?.requestId ?? randomUUID(),
    endpointUrl: first?.endpointUrl,
    upstreamStatus: first?.upstreamStatus,
    cacheHit: first?.cacheHit,
    cacheAgeSeconds: first?.cacheAgeSeconds,
    dataMode: mode,
    dataModeEffective: mode,
  };
}

export async function getTeamsAdvanced(
  sport: SportKey,
  teamRefsOrKeys: TeamProviderRef[] | string[],
  _mode: ViewMode,
  dataMode: ModeArg = "live",
  cacheBust?: CacheBustArg,
): Promise<Envelope<{ sport: SportKey; teams: TeamAdvanced[] }>> {
  const normalizedRefs = normalizeTeamRefs(teamRefsOrKeys);
  if (normalizedRefs.length === 0) {
    return {
      data: null,
      meta: fallbackMeta(dataMode, "teamKeys is required"),
      error: {
        message: "teamKeys is required",
        code: "MISSING_TEAM_KEYS",
      },
    };
  }

  const config = getApiSportsConfig(sport);
  const scheduleWindow = buildDateRange();
  const warnings: string[] = [];
  const baseMetas: Meta[] = [];
  const teams: TeamAdvanced[] = [];

  for (const ref of normalizedRefs) {
    const identityResult = await resolveTeamIdentity(sport, ref, dataMode, cacheBust);
    const identity = identityResult.identity;
    const teamWarnings: string[] = [];
    if (identityResult.warning) {
      teamWarnings.push(identityResult.warning);
    }

    let record: TeamAdvanced["record"] = null;
    let standings: TeamAdvanced["standings"] = null;
    let teamName = identity.teamName ?? identity.teamKey;

    try {
      const standingsResponse = await fetchApiSportsJson<unknown>({
        sport,
        endpoint: "standings",
        params: {
          team: identity.apiSportsTeamId ?? identity.teamKey,
          league: config.league,
          season: config.season,
        },
        dataMode,
        ttlSeconds: 240,
        cacheBust,
        fixtureFile: "team_advanced_sample.json",
      });
      baseMetas.push(standingsResponse.meta);
      const mapped = mapStandings(standingsResponse.data, identity);
      record = mapped.record;
      standings = mapped.standings;
      teamName = mapped.teamName ?? teamName;
    } catch (error) {
      teamWarnings.push(`Standings lookup failed for ${identity.teamKey}: ${String(error)}`);
    }

    let games: NormalizedGame[] = [];
    try {
      const gamesResponse = await fetchApiSportsJson<unknown>({
        sport,
        endpoint: "games",
        params: {
          league: config.league,
          season: config.season,
          timezone: scheduleWindow.timeZone,
          from: scheduleWindow.startDate,
          to: scheduleWindow.endDate,
          team: identity.apiSportsTeamId ?? undefined,
        },
        dataMode,
        ttlSeconds: 90,
        cacheBust,
        fixtureFile: "team_schedule_window_sample.json",
      });
      baseMetas.push(gamesResponse.meta);
      games = parseGamesForTeam(gamesResponse.data, identity, scheduleWindow.timeZone);
      if (games.length === 0) {
        teamWarnings.push(
          `No schedule rows found for ${identity.teamKey} in ${scheduleWindow.startDate}..${scheduleWindow.endDate} (${scheduleWindow.timeZone}).`,
        );
      }
    } catch (error) {
      teamWarnings.push(`Schedule lookup failed for ${identity.teamKey}: ${String(error)}`);
    }

    const nowMs = Date.now();
    const todayGames = games.filter((game) => game.dateKey === scheduleWindow.today);
    const today = selectTodayStatus(todayGames);
    const recentFinal = [...games]
      .filter((game) => game.state === "post" && game.dateMs <= nowMs + 10 * 60 * 1000)
      .sort((left, right) => right.dateMs - left.dateMs)[0];
    const nextScheduled = [...games]
      .filter((game) => game.state === "pre" && game.dateMs >= nowMs - 15 * 60 * 1000)
      .sort((left, right) => left.dateMs - right.dateMs)[0];

    const status = today
      ? {
          sport,
          teamKey: identity.teamKey,
          hasGameToday: true,
          state: today.state,
          opponent: today.opponent,
          homeAway: today.homeAway,
          displayClock: today.detail,
          score: today.score,
          eventId: today.eventId,
        }
      : {
          sport,
          teamKey: identity.teamKey,
          hasGameToday: false,
        };

    if (!today && !recentFinal && !nextScheduled) {
      teamWarnings.push(`No games found in ${scheduleWindow.startDate}..${scheduleWindow.endDate} (${scheduleWindow.timeZone}).`);
    }

    teams.push({
      teamKey: identity.teamKey,
      teamName,
      apiSportsTeamId: identity.apiSportsTeamId,
      espnTeamId: identity.espnTeamId,
      status,
      nextGame: nextScheduled
        ? {
            when: nextScheduled.date,
            vs: nextScheduled.opponent,
            homeAway: nextScheduled.homeAway,
          }
        : null,
      record,
      standings,
      lastGame: recentFinal
        ? {
            when: recentFinal.date,
            vs: recentFinal.opponent,
            result: recentFinal.result,
            score: recentFinal.score ? `${recentFinal.score.team}-${recentFinal.score.opp}` : undefined,
          }
        : null,
      metaNotes: teamWarnings.length > 0 ? teamWarnings : undefined,
    });

    warnings.push(...teamWarnings);
  }

  const baseMeta = pickPrimaryMeta(baseMetas, dataMode);
  const uniqueWarnings = Array.from(new Set(warnings));
  const notes = [
    `Schedule window uses ${scheduleWindow.timeZone} (${scheduleWindow.startDate}..${scheduleWindow.endDate}).`,
    "Today-only schedule lookup was replaced with a buffered window (yesterday/today/next support).",
  ];
  return {
    data: {
      sport,
      teams,
    },
    meta: {
      ...baseMeta,
      warning: uniqueWarnings.length > 0 ? uniqueWarnings.join(" ") : undefined,
      warnings: uniqueWarnings.length > 0 ? uniqueWarnings : undefined,
      notes,
      dataMode: dataMode,
      dataModeEffective: dataMode,
    },
  };
}
