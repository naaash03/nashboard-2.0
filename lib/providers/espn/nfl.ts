import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchEspnJson, getDataMode } from "@/lib/providers/espn/client";
import { gameTypeFromSeasonType, parseRecord, toCompactDate } from "@/lib/providers/espn/shared";
import type { Meta, Player, PlayerSearchResult, SlateGame } from "@/lib/providers/types";

type ModeArg = "auto" | "live" | "fixture";
type CacheBustArg = string | number | null | undefined;

type EspnScoreboard = {
  events?: Array<{
    id?: string;
    date?: string;
    status?: { type?: { description?: string } };
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

type EspnAthletesIndexResponse = {
  items?: Array<{
    id?: string | number;
    uid?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    shortName?: string;
    team?: {
      abbreviation?: string;
      displayName?: string;
      name?: string;
    };
    position?: {
      abbreviation?: string;
      displayName?: string;
      name?: string;
    };
    $ref?: string;
  }>;
};

type EspnAthleteDetails = {
  athlete?: {
    id?: string;
    displayName?: string;
    jersey?: string;
    team?: { abbreviation?: string; displayName?: string; logos?: Array<{ href?: string }> };
    position?: { abbreviation?: string };
    headshot?: { href?: string };
    displayHeight?: string;
    displayWeight?: string;
  };
};

type EspnRoster = {
  athletes?: Array<{ id?: string; displayName?: string; position?: { abbreviation?: string } }>;
};

export type NflAthleteIndexEntry = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  shortName?: string;
  team?: {
    abbreviation?: string;
    displayName?: string;
  };
  position?: {
    abbreviation?: string;
    displayName?: string;
  };
};

export type AthleteSearchDiagnostics = {
  provider: "espn-athlete-index";
  cacheHit: boolean;
  indexAgeSeconds: number;
  source: "network" | "disk";
  requestId: string;
  finalUrl: string | null;
  attemptedUrls: string[];
  endpointAttempts: Array<{
    url: string;
    status: number | null;
    message: string;
  }>;
  userFacingMessage?: string;
};

type AthleteIndexFetchResult = {
  athletes: NflAthleteIndexEntry[];
  meta: Meta;
  diagnostics: AthleteSearchDiagnostics;
  unavailable?: boolean;
};

type AthleteIndexDiskCache = {
  fetchedAt: string;
  athletes: NflAthleteIndexEntry[];
};

type AthleteIndexMemoryCache = {
  fetchedAtMs: number;
  source: "network" | "disk";
  athletes: NflAthleteIndexEntry[];
};

const ATHLETE_INDEX_KEY = "nfl-athletes-index";
const ATHLETE_INDEX_TTL_MS = 24 * 60 * 60 * 1000;
const athleteIndexMemoryCache = new Map<string, AthleteIndexMemoryCache>();
const ATHLETE_INDEX_ENDPOINTS = [
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes?limit=20000",
  "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes?limit=20000",
  "https://sports.core.api.espn.com/v3/sports/football/nfl/athletes?limit=20000",
] as const;

function normalizeGames(data: EspnScoreboard): SlateGame[] {
  const events = data.events ?? [];
  return events.map((event) => {
    const comp = event.competitions?.[0];
    const away = comp?.competitors?.find((c) => c.homeAway === "away");
    const home = comp?.competitors?.find((c) => c.homeAway === "home");
    return {
      id: event.id ?? randomUUID(),
      date: event.date ?? new Date().toISOString(),
      status: event.status?.type?.description ?? "scheduled",
      gameType: gameTypeFromSeasonType(event.season?.type),
      broadcaster: comp?.broadcasts?.[0]?.names?.[0],
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

function getAthleteIndexCacheFilePath(): string {
  const baseDir = process.env.NASHBOARD_CACHE_DIR?.trim() || path.join(process.cwd(), "data", "cache");
  return path.join(baseDir, "athletes_nfl.json");
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenizeNormalized(input: string): string[] {
  return normalizeText(input).split(" ").filter(Boolean);
}

function extractIdFromRef(ref?: string): string | undefined {
  if (!ref) return undefined;
  const match = ref.match(/\/athletes\/(\d+)/);
  return match?.[1];
}

function normalizeAthleteIndex(data: EspnAthletesIndexResponse): NflAthleteIndexEntry[] {
  const rows = data.items ?? [];
  const athletes: NflAthleteIndexEntry[] = [];

  for (const row of rows) {
    const id = String(row.id ?? extractIdFromRef(row.$ref) ?? "").trim();
    const fullName = String(row.fullName ?? row.displayName ?? row.shortName ?? "").trim();
    if (!id || !fullName) {
      continue;
    }

    const firstName = String(row.firstName ?? "").trim();
    const lastName = String(row.lastName ?? "").trim();
    athletes.push({
      id,
      fullName,
      firstName: firstName || fullName.split(" ")[0] || fullName,
      lastName: lastName || fullName.split(" ").slice(1).join(" ") || fullName,
      displayName: row.displayName,
      shortName: row.shortName,
      team: row.team
        ? {
            abbreviation: row.team.abbreviation,
            displayName: row.team.displayName ?? row.team.name,
          }
        : undefined,
      position: row.position
        ? {
            abbreviation: row.position.abbreviation,
            displayName: row.position.displayName ?? row.position.name,
          }
        : undefined,
    });
  }

  return athletes;
}

function athleteIndexFileWarning(error: unknown): string {
  return `Unable to refresh local NFL athletes index cache file: ${String(error)}`;
}

async function writeAthleteIndexToDisk(athletes: NflAthleteIndexEntry[]): Promise<void> {
  const filePath = getAthleteIndexCacheFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const payload: AthleteIndexDiskCache = {
    fetchedAt: new Date().toISOString(),
    athletes,
  };
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function readAthleteIndexFromDisk(): Promise<AthleteIndexDiskCache | null> {
  try {
    const filePath = getAthleteIndexCacheFilePath();
    const payload = JSON.parse(await readFile(filePath, "utf8")) as AthleteIndexDiskCache;
    if (!Array.isArray(payload.athletes) || typeof payload.fetchedAt !== "string") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function sanitizeUrl(url: string): string {
  return url.trim().replace(/\s+/g, "");
}

function normalizeAthleteIndexPayload(payload: unknown): EspnAthletesIndexResponse {
  const raw = payload as { items?: unknown; athletes?: unknown };
  if (Array.isArray(raw?.items)) {
    return { items: raw.items as EspnAthletesIndexResponse["items"] };
  }

  if (Array.isArray(raw?.athletes)) {
    return {
      items: (raw.athletes as Array<{
        id?: string | number;
        displayName?: string;
        firstName?: string;
        lastName?: string;
        team?: { abbreviation?: string; displayName?: string; name?: string };
        position?: { abbreviation?: string; displayName?: string; name?: string };
      }>).map((athlete) => ({
        id: athlete.id,
        fullName: athlete.displayName,
        displayName: athlete.displayName,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        team: athlete.team,
        position: athlete.position,
      })),
    };
  }

  return { items: [] };
}

type FetchFallbackAttempt = {
  url: string;
  status: number | null;
  message: string;
};

type FetchFallbackResult = {
  payload: EspnAthletesIndexResponse | null;
  finalUrl: string | null;
  attempts: FetchFallbackAttempt[];
};

async function fetchJSONWithFallbacks(urls: readonly string[]): Promise<FetchFallbackResult> {
  const attempts: FetchFallbackAttempt[] = [];

  for (const rawUrl of urls) {
    const url = sanitizeUrl(rawUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "NashBoard/1.0 (+player-search-index)",
        },
      });
      clearTimeout(timeout);
      if (!response.ok) {
        const text = (await response.text()).slice(0, 300);
        attempts.push({
          url,
          status: response.status,
          message: text || `HTTP ${response.status}`,
        });
        continue;
      }

      const json = (await response.json()) as unknown;
      attempts.push({
        url,
        status: response.status,
        message: "ok",
      });
      return {
        payload: normalizeAthleteIndexPayload(json),
        finalUrl: url,
        attempts,
      };
    } catch (error) {
      clearTimeout(timeout);
      attempts.push({
        url,
        status: null,
        message: String(error),
      });
    }
  }

  return {
    payload: null,
    finalUrl: null,
    attempts,
  };
}

function toPlayerSearchResult(athlete: NflAthleteIndexEntry): PlayerSearchResult {
  return {
    playerId: athlete.id,
    fullName: athlete.fullName,
    teamKey: athlete.team?.abbreviation,
    teamName: athlete.team?.displayName,
    position: athlete.position?.abbreviation ?? athlete.position?.displayName,
  };
}

export function scoreAthleteMatch(queryTokens: string[], athlete: NflAthleteIndexEntry): number {
  if (queryTokens.length === 0) return 0;

  const fullName = normalizeText(athlete.fullName);
  const firstName = normalizeText(athlete.firstName);
  const lastName = normalizeText(athlete.lastName);
  const fullTokens = tokenizeNormalized(athlete.fullName);
  let score = 0;
  let matchedTokens = 0;

  for (const token of queryTokens) {
    let tokenScore = 0;

    if (lastName === token) tokenScore = Math.max(tokenScore, 150);
    else if (lastName.startsWith(token)) tokenScore = Math.max(tokenScore, 130);

    if (firstName === token) tokenScore = Math.max(tokenScore, 95);
    else if (firstName.startsWith(token)) tokenScore = Math.max(tokenScore, 75);

    if (fullTokens.includes(token)) tokenScore = Math.max(tokenScore, 55);
    else if (fullName.includes(token)) tokenScore = Math.max(tokenScore, 35);

    if (tokenScore > 0) {
      matchedTokens += 1;
      score += tokenScore;
    }
  }

  if (matchedTokens === queryTokens.length) {
    score += 120;
  }

  if (queryTokens.length >= 2) {
    const first = queryTokens[0];
    const last = queryTokens[queryTokens.length - 1];
    if (firstName.startsWith(first) && lastName.startsWith(last)) {
      score += 140;
    }
  }

  if (fullName === queryTokens.join(" ")) {
    score += 180;
  }

  return score;
}

export function searchNflAthleteIndex(index: NflAthleteIndexEntry[], query: string, limit = 8): PlayerSearchResult[] {
  const tokens = tokenizeNormalized(query);
  if (tokens.length === 0) {
    return [];
  }

  const max = Math.max(1, Math.min(8, limit));
  return index
    .map((athlete) => ({
      athlete,
      score: scoreAthleteMatch(tokens, athlete),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.athlete.fullName.localeCompare(b.athlete.fullName);
    })
    .slice(0, max)
    .map((row) => toPlayerSearchResult(row.athlete));
}

export async function fetchAllNflAthletesIndex(dataMode?: ModeArg): Promise<AthleteIndexFetchResult> {
  const mode = getDataMode(dataMode);
  const requestId = randomUUID();
  const now = Date.now();
  const mem = athleteIndexMemoryCache.get(ATHLETE_INDEX_KEY);

  if (mem && now - mem.fetchedAtMs < ATHLETE_INDEX_TTL_MS) {
    const ageSeconds = Math.max(0, Math.floor((now - mem.fetchedAtMs) / 1000));
    return {
      athletes: mem.athletes,
      meta: {
        sourceUsed: "cache",
        updatedAt: new Date(mem.fetchedAtMs).toISOString(),
        requestId,
        cacheHit: true,
        cacheAgeSeconds: ageSeconds,
        dataMode: mode,
      },
      diagnostics: {
        provider: "espn-athlete-index",
        cacheHit: true,
        indexAgeSeconds: ageSeconds,
        source: mem.source,
        requestId,
        finalUrl: null,
        attemptedUrls: [],
        endpointAttempts: [],
      },
    };
  }

  if (mode === "fixture") {
    const fixture = await fetchEspnJson<EspnAthletesIndexResponse>({
      endpoint: "/athletes/index",
      fixtureFile: "athletes_nfl_index.json",
      ttlSeconds: 60,
      dataMode: mode,
    });
    const athletes = normalizeAthleteIndex(fixture.data);
    athleteIndexMemoryCache.set(ATHLETE_INDEX_KEY, {
      athletes,
      fetchedAtMs: now,
      source: "disk",
    });

    return {
      athletes,
      meta: fixture.meta,
      diagnostics: {
        provider: "espn-athlete-index",
        cacheHit: false,
        indexAgeSeconds: 0,
        source: "disk",
        requestId: fixture.meta.requestId,
        finalUrl: fixture.meta.endpointUrl ?? null,
        attemptedUrls: fixture.meta.endpointUrl ? [fixture.meta.endpointUrl] : [],
        endpointAttempts: fixture.meta.endpointUrl
          ? [{ url: fixture.meta.endpointUrl, status: fixture.meta.upstreamStatus ?? 200, message: "fixture" }]
          : [],
      },
    };
  }

  const network = await fetchJSONWithFallbacks(ATHLETE_INDEX_ENDPOINTS);
  if (network.payload) {
    const athletes = normalizeAthleteIndex(network.payload);
    athleteIndexMemoryCache.set(ATHLETE_INDEX_KEY, {
      athletes,
      fetchedAtMs: now,
      source: "network",
    });

    let warning: string | undefined;
    try {
      await writeAthleteIndexToDisk(athletes);
    } catch (error) {
      warning = athleteIndexFileWarning(error);
    }

    return {
      athletes,
      meta: {
        sourceUsed: "espn",
        updatedAt: new Date(now).toISOString(),
        requestId,
        warning,
        endpointUrl: network.finalUrl ?? undefined,
        upstreamStatus: network.attempts[network.attempts.length - 1]?.status ?? undefined,
        dataMode: mode,
      },
      diagnostics: {
        provider: "espn-athlete-index",
        cacheHit: false,
        indexAgeSeconds: 0,
        source: "network",
        requestId,
        finalUrl: network.finalUrl,
        attemptedUrls: network.attempts.map((attempt) => attempt.url),
        endpointAttempts: network.attempts,
      },
    };
  }

  const fromDisk = await readAthleteIndexFromDisk();
  if (fromDisk) {
    const parsedMs = new Date(fromDisk.fetchedAt).getTime();
    const fetchedAtMs = Number.isFinite(parsedMs) ? parsedMs : now;
    athleteIndexMemoryCache.set(ATHLETE_INDEX_KEY, {
      athletes: fromDisk.athletes,
      fetchedAtMs,
      source: "disk",
    });
    const ageSeconds = Math.max(0, Math.floor((now - fetchedAtMs) / 1000));

    return {
      athletes: fromDisk.athletes,
      meta: {
        sourceUsed: "cache",
        updatedAt: new Date(fetchedAtMs).toISOString(),
        requestId,
        cacheHit: true,
        cacheAgeSeconds: ageSeconds,
        warning: "Using disk-cached NFL athletes index because ESPN was unavailable.",
        dataMode: mode,
      },
      diagnostics: {
        provider: "espn-athlete-index",
        cacheHit: true,
        indexAgeSeconds: ageSeconds,
        source: "disk",
        requestId,
        finalUrl: network.finalUrl,
        attemptedUrls: network.attempts.map((attempt) => attempt.url),
        endpointAttempts: network.attempts,
      },
    };
  }

  const userFacingMessage = "Player index not available right now; try again in a minute.";
  return {
    athletes: [],
    meta: {
      sourceUsed: "espn",
      updatedAt: new Date(now).toISOString(),
      requestId,
      warning: userFacingMessage,
      dataMode: mode,
    },
    diagnostics: {
      provider: "espn-athlete-index",
      cacheHit: false,
      indexAgeSeconds: 0,
      source: "network",
      requestId,
      finalUrl: network.finalUrl,
      attemptedUrls: network.attempts.map((attempt) => attempt.url),
      endpointAttempts: network.attempts,
      userFacingMessage,
    },
    unavailable: true,
  };
}

function normalizePlayer(details: EspnAthleteDetails): Player | null {
  const athlete = details.athlete;
  if (!athlete?.id || !athlete.displayName) {
    return null;
  }

  const weightMatch = athlete.displayWeight?.match(/\d+/);
  const weightLbs = weightMatch ? Number(weightMatch[0]) : undefined;
  const heightIn = (() => {
    const m = athlete.displayHeight?.match(/(\d+)'\s?(\d+)/);
    if (!m) return undefined;
    return Number(m[1]) * 12 + Number(m[2]);
  })();

  return {
    playerId: athlete.id,
    fullName: athlete.displayName,
    teamKey: athlete.team?.abbreviation,
    teamName: athlete.team?.displayName,
    position: athlete.position?.abbreviation,
    jersey: athlete.jersey,
    headshotUrl: athlete.headshot?.href,
    teamLogoUrl: athlete.team?.logos?.[0]?.href,
    weightLbs,
    heightIn,
    stats: {},
  };
}

function fixtureScenario(): string {
  return (process.env.NASHBOARD_FIXTURE_SCENARIO ?? "default").toLowerCase();
}

export async function getScoreboard(dateISO: string, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ games: SlateGame[]; meta: Meta }> {
  const mode = getDataMode(dataMode);
  const scenario = fixtureScenario();
  const fixtureFile = mode === "fixture"
    ? scenario === "slate_empty_today" || scenario === "next_season_not_posted"
      ? "scoreboard_empty.json"
      : "scoreboard_with_games.json"
    : undefined;

  const response = await fetchEspnJson<EspnScoreboard>({
    endpoint: "/scoreboard",
    params: { dates: toCompactDate(dateISO) },
    fixtureFile,
    ttlSeconds: 60,
    dataMode: mode,
    cacheBust,
  });

  return { games: normalizeGames(response.data), meta: response.meta };
}

export async function getMostRecentSlateBefore(
  dateISO: string,
  dataMode?: ModeArg,
  maxDays = 60,
  cacheBust?: CacheBustArg,
): Promise<{ dateISO: string | null; games: SlateGame[]; meta: Meta }> {
  const mode = getDataMode(dataMode);
  const scenario = fixtureScenario();

  if (mode === "fixture" && scenario === "next_season_not_posted") {
    const response = await fetchEspnJson<EspnScoreboard>({
      endpoint: "/historical-slate",
      fixtureFile: "scoreboard_with_games.json",
      ttlSeconds: 60,
      dataMode: mode,
      cacheBust,
    });
    const games = normalizeGames(response.data);
    const historicalDate = games[0]?.date?.slice(0, 10) ?? null;
    return {
      dateISO: historicalDate,
      games,
      meta: response.meta,
    };
  }

  const start = new Date(dateISO);
  for (let i = 1; i <= maxDays; i += 1) {
    const probe = new Date(start);
    probe.setUTCDate(probe.getUTCDate() - i);
    const probeIso = probe.toISOString().slice(0, 10);
    const slate = await getScoreboard(probeIso, dataMode, cacheBust);
    if (slate.games.length > 0) {
      return { dateISO: probeIso, games: slate.games, meta: slate.meta };
    }
  }

  return {
    dateISO: null,
    games: [],
    meta: {
      sourceUsed: getDataMode(dataMode) === "fixture" ? "fixture" : "espn",
      updatedAt: new Date().toISOString(),
      requestId: randomUUID(),
      warning: "No recent historical slate found.",
      dataMode: mode,
    },
  };
}

export async function getNextLeagueSlateAfter(
  dateISO: string,
  dataMode?: ModeArg,
  maxDays = 21,
  cacheBust?: CacheBustArg,
): Promise<{ nextDateISO: string | null; games: SlateGame[]; schedulePosted: boolean; meta: Meta }> {
  const mode = getDataMode(dataMode);
  const scenario = fixtureScenario();

  if (mode === "fixture") {
    const fixtureFile = scenario === "next_season_not_posted" ? "next_season_not_posted.json" : "next_slate_available.json";
    const response = await fetchEspnJson<{ nextDateISO: string | null; schedulePosted: boolean; games?: EspnScoreboard["events"]; events?: EspnScoreboard["events"] }>({
      endpoint: "/next-slate",
      fixtureFile,
      ttlSeconds: 60,
      dataMode: mode,
      cacheBust,
    });

    const events = response.data.games ?? response.data.events ?? [];
    return {
      nextDateISO: response.data.nextDateISO,
      schedulePosted: response.data.schedulePosted,
      games: normalizeGames({ events }),
      meta: response.meta,
    };
  }

  const start = new Date(dateISO);
  for (let i = 1; i <= maxDays; i += 1) {
    const probe = new Date(start);
    probe.setUTCDate(probe.getUTCDate() + i);
    const probeIso = probe.toISOString().slice(0, 10);
    const slate = await getScoreboard(probeIso, mode, cacheBust);
    if (slate.games.length > 0) {
      return {
        nextDateISO: probeIso,
        games: slate.games,
        schedulePosted: true,
        meta: slate.meta,
      };
    }
  }

  return {
    nextDateISO: null,
    games: [],
    schedulePosted: false,
    meta: {
      sourceUsed: "espn",
      updatedAt: new Date().toISOString(),
      requestId: randomUUID(),
      warning: "Next season schedule has not been posted by the league yet.",
      dataMode: mode,
    },
  };
}

export async function searchPlayers(query: string, limit = 8, dataMode?: ModeArg): Promise<{ results: PlayerSearchResult[]; meta: Meta; diagnostics: AthleteSearchDiagnostics }> {
  const mode = getDataMode(dataMode);

  if (query.trim().length < 3) {
    const requestId = randomUUID();
    return {
      results: [],
      meta: {
        sourceUsed: mode === "fixture" ? "fixture" : "espn",
        updatedAt: new Date().toISOString(),
        requestId,
        warning: "Type at least 3 characters to search.",
        dataMode: mode,
      },
      diagnostics: {
        provider: "espn-athlete-index",
        cacheHit: false,
        indexAgeSeconds: 0,
        source: mode === "fixture" ? "disk" : "network",
        requestId,
        finalUrl: null,
        attemptedUrls: [],
        endpointAttempts: [],
      },
    };
  }

  const index = await fetchAllNflAthletesIndex(mode);
  if (index.unavailable) {
    return {
      results: [],
      meta: {
        ...index.meta,
        warning: index.diagnostics.userFacingMessage ?? index.meta.warning,
      },
      diagnostics: index.diagnostics,
    };
  }

  const results = searchNflAthleteIndex(index.athletes, query, limit);
  const warning = results.length === 0
    ? mode === "fixture"
      ? "No results from fixture data for this query."
      : "No results from ESPN NFL athletes index for this query."
    : index.meta.warning;
  return {
    results,
    meta: {
      ...index.meta,
      warning,
    },
    diagnostics: index.diagnostics,
  };
}

export async function getPlayer(playerId: string, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ player: Player | null; meta: Meta }> {
  const mode = getDataMode(dataMode);

  if (!playerId) {
    return {
      player: null,
      meta: {
        sourceUsed: mode === "fixture" ? "fixture" : "espn",
        updatedAt: new Date().toISOString(),
        requestId: randomUUID(),
        warning: "playerId is required",
        dataMode: mode,
      },
    };
  }

  if (mode === "fixture") {
    const response = await fetchEspnJson<EspnAthleteDetails>({
      endpoint: `/player/${playerId}`,
      fixtureFile: "player_details.json",
      ttlSeconds: 60,
      dataMode: mode,
      cacheBust,
    });
    return { player: normalizePlayer(response.data), meta: response.meta };
  }

  const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${encodeURIComponent(playerId)}`;
  const response = await fetchEspnJson<EspnAthleteDetails>({ endpoint: url, ttlSeconds: 60, dataMode: mode, cacheBust });
  return { player: normalizePlayer(response.data), meta: response.meta };
}

export async function getTeamNextGame(teamKey: string, fromDateISO: string, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ game: SlateGame | null; meta: Meta }> {
  const mode = getDataMode(dataMode);

  if (mode === "fixture") {
    const response = await fetchEspnJson<EspnScoreboard>({
      endpoint: `/team-next/${teamKey}`,
      fixtureFile: "team_next_game.json",
      ttlSeconds: 60,
      dataMode: mode,
      cacheBust,
    });
    const games = normalizeGames(response.data);
    const match = games.find((game) => game.homeTeam.key === teamKey || game.awayTeam.key === teamKey) ?? null;
    return { game: match, meta: response.meta };
  }

  const next = await getNextLeagueSlateAfter(fromDateISO, mode, 21, cacheBust);
  const game = next.games.find((candidate) => candidate.homeTeam.key === teamKey || candidate.awayTeam.key === teamKey) ?? null;
  return { game, meta: next.meta };
}

export async function getTeamRecentRbLeader(teamKey: string, dataMode?: ModeArg, cacheBust?: CacheBustArg): Promise<{ playerName: string | null; meta: Meta }> {
  const mode = getDataMode(dataMode);
  if (mode === "fixture") {
    const response = await fetchEspnJson<{ runningBacks?: Array<{ fullName?: string }> }>({
      endpoint: `/rb-roster/${teamKey}`,
      fixtureFile: "rb_roster_or_depth.json",
      ttlSeconds: 60,
      dataMode: mode,
      cacheBust,
    });
    return {
      playerName: response.data.runningBacks?.[0]?.fullName ?? null,
      meta: response.meta,
    };
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamKey}/roster`;
    const response = await fetchEspnJson<EspnRoster>({ endpoint: url, ttlSeconds: 60, dataMode: mode, cacheBust });
    const rb = response.data.athletes?.find((athlete) => athlete.position?.abbreviation === "RB");
    return {
      playerName: rb?.displayName ?? null,
      meta: response.meta,
    };
  } catch (error) {
    return {
      playerName: null,
      meta: {
        sourceUsed: "espn",
        updatedAt: new Date().toISOString(),
        requestId: randomUUID(),
        warning: `Unable to fetch recent RB leader: ${String(error)}`,
        dataMode: mode,
      },
    };
  }
}

export function __resetAthleteIndexCacheForTests(): void {
  athleteIndexMemoryCache.clear();
}
