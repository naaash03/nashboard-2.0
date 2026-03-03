"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@/components/hooks/useDebouncedValue";
import TabsRow from "@/components/widgets/shared/TabsRow";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import { getGuestWatchlist, type GuestWatchlistItem } from "@/lib/guest/watchlist";
import type { Envelope, PlayerProfile, PlayerSearchResult, SportKey, TeamSearchResult } from "@/lib/types/players";
import type { PlayerInsights, TeamAdvanced } from "@/lib/types/playerInsights";
import type { TeamStatus } from "@/lib/types/teamStatus";
import { stableKey } from "@/lib/utils/stableKey";

type WatchItem = GuestWatchlistItem;

type WatchlistResponse = {
  items?: WatchItem[];
  error?: string;
};

type PlayerSearchResultMin = {
  playerId: string;
  fullName: string;
  teamName?: string;
  position?: string;
  headshot?: string;
};

type PlayerWatchlistBySport = Record<SportKey, PlayerSearchResultMin[]>;

type TeamWatchlistBySport = Record<SportKey, string[]>;

type TeamWatchlistNamesBySport = Record<SportKey, Record<string, string>>;
type TeamProviderIds = {
  apiSportsTeamId?: string;
  espnTeamId?: string;
};
type TeamProviderIdsBySport = Record<SportKey, Record<string, TeamProviderIds>>;

type ViewMode = "teams" | "players";
type TeamsAdvancedEnvelope = Envelope<{ sport: SportKey; teams: TeamAdvanced[] }>;
type PlayerInsightsBatchEnvelope = Envelope<{ sport: SportKey; players: PlayerInsights[] }>;
type TeamSearchEnvelope = Envelope<TeamSearchResult[]>;

const TEAM_LIMIT = 10;
const PLAYER_LIMIT = 10;
const TEAM_STATUS_REFRESH_MS = 30_000;
const PLAYER_INSIGHTS_REFRESH_MS = 60_000;

const MODE_TABS = [
  { key: "teams", label: "Teams" },
  { key: "players", label: "Players" },
] as const;

const SPORT_TABS = [
  { key: "nfl", label: "NFL" },
  { key: "mlb", label: "MLB" },
  { key: "nba", label: "NBA" },
] as const;

export function addTeamToSportWatchlist(
  current: Record<SportKey, string[]>,
  sport: SportKey,
  teamKey: string,
): Record<SportKey, string[]> {
  const normalized = teamKey.trim().toUpperCase();
  if (!normalized) {
    return current;
  }
  const sportTeams = current[sport] ?? [];
  if (sportTeams.includes(normalized)) {
    return current;
  }
  return {
    ...current,
    [sport]: [...sportTeams, normalized],
  };
}

export function upsertTeamProviderIds(
  current: Record<SportKey, Record<string, { apiSportsTeamId?: string; espnTeamId?: string }>>,
  sport: SportKey,
  teamKey: string,
  nextIds: { apiSportsTeamId?: string; espnTeamId?: string },
): Record<SportKey, Record<string, { apiSportsTeamId?: string; espnTeamId?: string }>> {
  const normalizedKey = teamKey.trim().toUpperCase();
  if (!normalizedKey) {
    return current;
  }
  const existing = current[sport]?.[normalizedKey] ?? {};
  const merged = {
    apiSportsTeamId: nextIds.apiSportsTeamId ?? existing.apiSportsTeamId,
    espnTeamId: nextIds.espnTeamId ?? existing.espnTeamId,
  };
  return {
    ...current,
    [sport]: {
      ...current[sport],
      [normalizedKey]: merged,
    },
  };
}

export function shouldUseServerWatchlist(props: Pick<WidgetCommonProps, "viewerMode" | "authConfigured" | "dbConfigured">): boolean {
  return props.viewerMode === "signed_in" && props.authConfigured && props.dbConfigured;
}

function normalizeSportKey(input: unknown): SportKey {
  if (input === "mlb" || input === "nba" || input === "nfl") {
    return input;
  }
  return "nfl";
}

function normalizeViewMode(input: unknown): ViewMode {
  return input === "players" ? "players" : "teams";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim().toUpperCase() : ""))
    .filter(Boolean);
}

function normalizeTeamWatchlist(input: unknown): TeamWatchlistBySport {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    nfl: normalizeStringArray(source.nfl),
    mlb: normalizeStringArray(source.mlb),
    nba: normalizeStringArray(source.nba),
  };
}

function normalizeTeamWatchlistNames(input: unknown): TeamWatchlistNamesBySport {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const out: TeamWatchlistNamesBySport = {
    nfl: {},
    mlb: {},
    nba: {},
  };

  for (const sport of ["nfl", "mlb", "nba"] as const) {
    const item = source[sport];
    if (!item || typeof item !== "object") {
      continue;
    }

    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      if (typeof value === "string" && key.trim()) {
        out[sport][key.trim().toUpperCase()] = value.trim();
      }
    }
  }

  return out;
}

function normalizeProviderId(input: unknown): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTeamProviderIds(input: unknown): TeamProviderIdsBySport {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const out: TeamProviderIdsBySport = {
    nfl: {},
    mlb: {},
    nba: {},
  };

  for (const sport of ["nfl", "mlb", "nba"] as const) {
    const byTeam = source[sport];
    if (!byTeam || typeof byTeam !== "object") {
      continue;
    }

    for (const [teamKey, rawIds] of Object.entries(byTeam as Record<string, unknown>)) {
      if (!teamKey || !rawIds || typeof rawIds !== "object") {
        continue;
      }
      const typed = rawIds as Record<string, unknown>;
      const apiSportsTeamId = normalizeProviderId(typed.apiSportsTeamId);
      const espnTeamId = normalizeProviderId(typed.espnTeamId);
      if (!apiSportsTeamId && !espnTeamId) {
        continue;
      }
      out[sport][teamKey.trim().toUpperCase()] = {
        apiSportsTeamId,
        espnTeamId,
      };
    }
  }

  return out;
}

function normalizePlayerWatchlist(input: unknown): PlayerWatchlistBySport {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const next: PlayerWatchlistBySport = {
    nfl: [],
    mlb: [],
    nba: [],
  };

  for (const sport of ["nfl", "mlb", "nba"] as const) {
    const rows = source[sport];
    if (!Array.isArray(rows)) {
      continue;
    }

    const parsedRows: PlayerSearchResultMin[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") {
        continue;
      }

      const typed = row as Record<string, unknown>;
      const playerId = typeof typed.playerId === "string" ? typed.playerId : "";
      const fullName = typeof typed.fullName === "string" ? typed.fullName : "";
      if (!playerId || !fullName) {
        continue;
      }

      const parsed: PlayerSearchResultMin = {
        playerId,
        fullName,
      };
      if (typeof typed.teamName === "string") {
        parsed.teamName = typed.teamName;
      }
      if (typeof typed.position === "string") {
        parsed.position = typed.position;
      }
      if (typeof typed.headshot === "string") {
        parsed.headshot = typed.headshot;
      }
      parsedRows.push(parsed);
    }

    next[sport] = parsedRows;
  }

  return next;
}

function legacyTeamsFromConfig(config: Record<string, unknown>): string[] {
  const watchlist = config.watchlist;
  if (!watchlist || typeof watchlist !== "object") {
    return [];
  }
  const teams = (watchlist as Record<string, unknown>).teams;
  return normalizeStringArray(teams);
}

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function sportLabel(sportKey: SportKey): string {
  return sportKey.toUpperCase();
}

function uniqueByPlayerId(items: PlayerSearchResultMin[]): PlayerSearchResultMin[] {
  return items.filter((item, index, all) => all.findIndex((row) => row.playerId === item.playerId) === index);
}

function compact(parts: Array<string | undefined>): string {
  const values = parts.filter(Boolean) as string[];
  return values.length > 0 ? values.join(" · ") : "—";
}

export function normalizeTeamSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]|_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function selectExactTeamResult(query: string, results: TeamSearchResult[]): TeamSearchResult | null {
  const normalizedQuery = normalizeTeamSearchText(query);
  if (!normalizedQuery) {
    return null;
  }

  return results.find((result) =>
    normalizeTeamSearchText(result.displayName) === normalizedQuery
    || result.teamKey.toLowerCase() === normalizedQuery,
  ) ?? null;
}

function teamStatusLabel(status: TeamStatus | undefined): string {
  if (!status || !status.hasGameToday) {
    return "No game today";
  }

  const opponent = status.opponent
    ? status.homeAway === "home"
      ? `vs ${status.opponent}`
      : `at ${status.opponent}`
    : "vs TBD";
  const score = status.score ? `${status.score.team}-${status.score.opp}` : undefined;

  if (status.state === "in") {
    return compact([`LIVE ${opponent}`, score, status.displayClock]);
  }
  if (status.state === "pre") {
    return compact([`Today ${opponent}`, status.displayClock]);
  }
  return compact([`Final ${opponent}`, score]);
}

function teamLiveDetail(status: TeamStatus | undefined): string {
  if (!status || !status.hasGameToday) {
    return "No live game state.";
  }
  const score = status.score ? `${status.score.team}-${status.score.opp}` : undefined;
  return compact([status.state?.toUpperCase(), score, status.displayClock]);
}

function lastGameLabel(team: TeamAdvanced | undefined): string {
  if (!team?.lastGame) {
    return "Last game not available";
  }
  return compact([
    team.lastGame.result,
    team.lastGame.vs ? `vs ${team.lastGame.vs}` : undefined,
    team.lastGame.score,
    team.lastGame.when,
  ]);
}

function nextGameLabel(team: TeamAdvanced | undefined): string {
  if (!team?.nextGame) {
    return "Next game not available";
  }
  const prefix = team.nextGame.homeAway === "home" ? "vs" : "at";
  return compact([team.nextGame.when, `${prefix} ${team.nextGame.vs ?? "TBD"}`]);
}

export function playerInsightsSummary(insight: PlayerInsights | undefined): string {
  if (!insight) {
    return "Insights not available";
  }
  return insight.season?.headline ?? insight.recent?.headline ?? "Insights not available";
}

function playerTeamLiveLabel(insight: PlayerInsights | undefined): string {
  if (!insight?.live || !insight.live.hasGameToday) {
    return "No game today";
  }
  const opponent = insight.live.opponent
    ? insight.live.homeAway === "home"
      ? `vs ${insight.live.opponent}`
      : `at ${insight.live.opponent}`
    : "vs TBD";
  const score = insight.live.score ? `${insight.live.score.team}-${insight.live.score.opp}` : undefined;
  return compact([insight.live.state?.toUpperCase(), opponent, score, insight.live.displayClock]);
}

export default function WatchlistWidget(props: WidgetCommonProps) {
  const [legacyItems, setLegacyItems] = useState<WatchItem[]>([]);
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [legacyLoaded, setLegacyLoaded] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>(normalizeViewMode(props.config.watchlistMode));
  const [sportKey, setSportKey] = useState<SportKey>(normalizeSportKey(props.config.watchlistSportKey));

  const [playerWatchlist, setPlayerWatchlist] = useState<PlayerWatchlistBySport>(normalizePlayerWatchlist(props.config.playerWatchlist));
  const [teamWatchlist, setTeamWatchlist] = useState<TeamWatchlistBySport>(normalizeTeamWatchlist(props.config.teamWatchlist));
  const [teamWatchlistNames, setTeamWatchlistNames] = useState<TeamWatchlistNamesBySport>(normalizeTeamWatchlistNames(props.config.teamWatchlistNames));
  const [teamProviderIds, setTeamProviderIds] = useState<TeamProviderIdsBySport>(normalizeTeamProviderIds(props.config.teamProviderIds));

  const [teamQuery, setTeamQuery] = useState("");
  const [teamResults, setTeamResults] = useState<TeamSearchResult[]>([]);
  const [isTeamSearching, setIsTeamSearching] = useState(false);
  const [teamActiveIndex, setTeamActiveIndex] = useState(-1);
  const [teamSearchHint, setTeamSearchHint] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);

  const [playerQuery, setPlayerQuery] = useState("");
  const [playerResults, setPlayerResults] = useState<PlayerSearchResultMin[]>([]);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const [lastProfile, setLastProfile] = useState<PlayerProfile | null>(null);
  const [lastCallMeta, setLastCallMeta] = useState<WidgetMeta | null>(null);
  const [teamStatusMeta, setTeamStatusMeta] = useState<WidgetMeta | null>(null);
  const [statusByTeam, setStatusByTeam] = useState<Record<string, TeamStatus>>({});
  const [teamAdvancedByKey, setTeamAdvancedByKey] = useState<Record<string, TeamAdvanced>>({});
  const [playerInsightsById, setPlayerInsightsById] = useState<Record<string, PlayerInsights>>({});
  const [playerInsightsMeta, setPlayerInsightsMeta] = useState<WidgetMeta | null>(null);
  const [lastEndpoint, setLastEndpoint] = useState("");

  const useServer = shouldUseServerWatchlist(props);
  const migratedRef = useRef(false);
  const lastTeamSearchReqKeyRef = useRef("");
  const teamSearchAbortRef = useRef<AbortController | null>(null);
  const lastStatusReqKeyRef = useRef("");
  const lastStatusFetchAtRef = useRef(0);
  const statusAbortRef = useRef<AbortController | null>(null);
  const teamProviderBackfillReqKeyRef = useRef("");
  const lastQuickProfileKeyRef = useRef("");
  const lastPlayerInsightsReqKeyRef = useRef("");
  const lastPlayerInsightsFetchAtRef = useRef(0);
  const playerInsightsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setViewMode(normalizeViewMode(props.config.watchlistMode));
    setSportKey(normalizeSportKey(props.config.watchlistSportKey));
    setPlayerWatchlist(normalizePlayerWatchlist(props.config.playerWatchlist));
    setTeamWatchlist(normalizeTeamWatchlist(props.config.teamWatchlist));
    setTeamWatchlistNames(normalizeTeamWatchlistNames(props.config.teamWatchlistNames));
    setTeamProviderIds(normalizeTeamProviderIds(props.config.teamProviderIds));
  }, [props.config]);

  const loadLegacy = useCallback(async (): Promise<WatchItem[]> => {
    if (!useServer) {
      return getGuestWatchlist().items;
    }

    const res = await fetch("/api/watchlist", { cache: "no-store" });
    const json = (await res.json()) as WatchlistResponse;
    if (!res.ok) {
      throw new Error(json.error ?? "Failed to load watchlist");
    }
    return json.items ?? [];
  }, [useServer]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const items = await loadLegacy();
        if (!cancelled) {
          setLegacyItems(items);
          setLegacyError(null);
          setLegacyLoaded(true);
        }
      } catch (error) {
        if (!cancelled) {
          setLegacyError(String(error));
          setLegacyLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadLegacy, props.refreshTick]);

  useEffect(() => {
    if (migratedRef.current) {
      return;
    }
    if (!legacyLoaded) {
      return;
    }

    const hasNewShape = Array.isArray((props.config.teamWatchlist as Record<string, unknown> | undefined)?.nfl)
      || Array.isArray((props.config.teamWatchlist as Record<string, unknown> | undefined)?.mlb)
      || Array.isArray((props.config.teamWatchlist as Record<string, unknown> | undefined)?.nba);

    if (hasNewShape) {
      migratedRef.current = true;
      return;
    }

    const legacyConfig = legacyTeamsFromConfig(props.config);
    const legacyServer = legacyItems.map((item) => item.teamKey.trim().toUpperCase());
    const nflKeys = Array.from(new Set([...legacyConfig, ...legacyServer])).filter(Boolean);

    const nflNames: Record<string, string> = {};
    for (const item of legacyItems) {
      nflNames[item.teamKey.trim().toUpperCase()] = item.teamName;
    }

    const nextTeams: TeamWatchlistBySport = {
      nfl: nflKeys,
      mlb: [],
      nba: [],
    };
    const nextNames: TeamWatchlistNamesBySport = {
      nfl: nflNames,
      mlb: {},
      nba: {},
    };
    const nextProviderIds: TeamProviderIdsBySport = {
      nfl: {},
      mlb: {},
      nba: {},
    };

    setTeamWatchlist(nextTeams);
    setTeamWatchlistNames(nextNames);
    setTeamProviderIds(nextProviderIds);
    migratedRef.current = true;

    void props.onPersist({
      config: {
        ...props.config,
        watchlistSportKey: "nfl",
        teamWatchlist: nextTeams,
        teamWatchlistNames: nextNames,
        teamProviderIds: nextProviderIds,
      },
    });
  }, [legacyItems, legacyLoaded, props]);

  const persistConfig = useCallback(async (next: {
    viewMode?: ViewMode;
    sportKey?: SportKey;
    playerWatchlist?: PlayerWatchlistBySport;
    teamWatchlist?: TeamWatchlistBySport;
    teamWatchlistNames?: TeamWatchlistNamesBySport;
    teamProviderIds?: TeamProviderIdsBySport;
  }) => {
    const nextConfig = {
      ...props.config,
      watchlistMode: next.viewMode ?? viewMode,
      watchlistSportKey: next.sportKey ?? sportKey,
      playerWatchlist: next.playerWatchlist ?? playerWatchlist,
      teamWatchlist: next.teamWatchlist ?? teamWatchlist,
      teamWatchlistNames: next.teamWatchlistNames ?? teamWatchlistNames,
      teamProviderIds: next.teamProviderIds ?? teamProviderIds,
    };

    await props.onPersist({ config: nextConfig });
  }, [playerWatchlist, props, sportKey, teamProviderIds, teamWatchlist, teamWatchlistNames, viewMode]);

  const teamsForSport = useMemo(() => teamWatchlist[sportKey] ?? [], [sportKey, teamWatchlist]);
  const playersForSport = useMemo(() => playerWatchlist[sportKey] ?? [], [playerWatchlist, sportKey]);
  const trimmedTeamQuery = useMemo(() => teamQuery.trim(), [teamQuery]);
  const debouncedTeamQuery = useDebouncedValue(trimmedTeamQuery, 300);
  const trimmedPlayerQuery = useMemo(() => playerQuery.trim(), [playerQuery]);
  const debouncedPlayerQuery = useDebouncedValue(trimmedPlayerQuery, 250);
  const currentPlayerIds = useMemo(
    () => Array.from(new Set(playersForSport.map((player) => player.playerId.trim()).filter(Boolean))).sort(),
    [playersForSport],
  );
  const currentTeamKeys = useMemo(
    () => Array.from(new Set(teamsForSport.map((key) => key.trim().toUpperCase()).filter(Boolean))).sort(),
    [teamsForSport],
  );
  const currentTeamRefs = useMemo(
    () => currentTeamKeys.map((teamKey) => ({
      teamKey,
      teamName: teamWatchlistNames[sportKey][teamKey],
      apiSportsTeamId: teamProviderIds[sportKey][teamKey]?.apiSportsTeamId,
      espnTeamId: teamProviderIds[sportKey][teamKey]?.espnTeamId,
    })),
    [currentTeamKeys, sportKey, teamProviderIds, teamWatchlistNames],
  );
  const statusReqKey = useMemo(
    () => stableKey({
      sportKey,
      teamRefs: currentTeamRefs,
      mode: props.mode,
      dataMode: props.dataMode,
      refreshTick: props.refreshTick,
    }),
    [currentTeamRefs, props.dataMode, props.mode, props.refreshTick, sportKey],
  );
  const teamsModeActive = viewMode === "teams";
  const playersModeActive = viewMode === "players";
  const playerInsightsReqKey = useMemo(
    () => stableKey({
      sportKey,
      playerIds: currentPlayerIds,
      mode: props.mode,
      dataMode: props.dataMode,
      refreshTick: props.refreshTick,
    }),
    [currentPlayerIds, props.dataMode, props.mode, props.refreshTick, sportKey],
  );
  const teamSearchReqKey = useMemo(
    () => stableKey({
      sportKey,
      q: debouncedTeamQuery.toLowerCase(),
      dataMode: props.dataMode,
      refreshTick: props.refreshTick,
    }),
    [debouncedTeamQuery, props.dataMode, props.refreshTick, sportKey],
  );

  const refreshTeamStatuses = useCallback(async (): Promise<void> => {
    if (!teamsModeActive) {
      return;
    }

    if (currentTeamKeys.length === 0) {
      setStatusByTeam({});
      setTeamStatusMeta(null);
      setTeamAdvancedByKey({});
      lastStatusReqKeyRef.current = "";
      lastStatusFetchAtRef.current = 0;
      return;
    }

    const now = Date.now();
    const keyChanged = statusReqKey !== lastStatusReqKeyRef.current;
    const stale = now - lastStatusFetchAtRef.current >= TEAM_STATUS_REFRESH_MS;
    if (!keyChanged && !stale) {
      return;
    }

    statusAbortRef.current?.abort();
    const controller = new AbortController();
    statusAbortRef.current = controller;

    try {
      const modeParam = props.mode.toLowerCase();
      const teamRefsParam = encodeURIComponent(JSON.stringify(currentTeamRefs));
      const endpoint = `/api/teams/advanced?sport=${sportKey}&teamKeys=${encodeURIComponent(currentTeamKeys.join(","))}&teamRefs=${teamRefsParam}&mode=${modeParam}&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
      setLastEndpoint(endpoint);

      const res = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
      const json = (await res.json()) as TeamsAdvancedEnvelope;
      if (controller.signal.aborted) {
        return;
      }
      if (!res.ok || json.error || !json.data) {
        throw new Error(json.error?.message ?? "Failed to load team statuses");
      }

      const statusMap = json.data.teams.reduce<Record<string, TeamStatus>>((acc, team) => {
        acc[team.teamKey.toUpperCase()] = team.status;
        return acc;
      }, {});
      const advancedMap = json.data.teams.reduce<Record<string, TeamAdvanced>>((acc, team) => {
        acc[team.teamKey.toUpperCase()] = team;
        return acc;
      }, {});

      lastStatusReqKeyRef.current = statusReqKey;
      lastStatusFetchAtRef.current = Date.now();
      setStatusByTeam(statusMap);
      setTeamAdvancedByKey(advancedMap);
      setTeamStatusMeta(json.meta);
      setLastCallMeta(json.meta);
      setTeamError(json.meta.warning ?? null);
    } catch (error) {
      if (!controller.signal.aborted) {
        setTeamError(String(error));
        setStatusByTeam({});
        setTeamAdvancedByKey({});
      }
    }
  }, [currentTeamKeys, currentTeamRefs, props.dataMode, props.mode, props.refreshTick, sportKey, statusReqKey, teamsModeActive]);

  useEffect(() => {
    if (!teamsModeActive) {
      statusAbortRef.current?.abort();
      return;
    }

    void refreshTeamStatuses();

    return () => {
      statusAbortRef.current?.abort();
    };
  }, [refreshTeamStatuses, statusReqKey, teamsModeActive]);

  useEffect(() => {
    if (!teamsModeActive || currentTeamKeys.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (Date.now() - lastStatusFetchAtRef.current >= TEAM_STATUS_REFRESH_MS - 2000) {
        void refreshTeamStatuses();
      }
    }, TEAM_STATUS_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentTeamKeys.length, refreshTeamStatuses, statusReqKey, teamsModeActive]);

  const refreshPlayerInsights = useCallback(async (): Promise<void> => {
    if (!playersModeActive || props.mode !== "ADVANCED") {
      return;
    }

    if (currentPlayerIds.length === 0) {
      setPlayerInsightsById({});
      setPlayerInsightsMeta(null);
      lastPlayerInsightsReqKeyRef.current = "";
      lastPlayerInsightsFetchAtRef.current = 0;
      return;
    }

    const now = Date.now();
    const keyChanged = playerInsightsReqKey !== lastPlayerInsightsReqKeyRef.current;
    const stale = now - lastPlayerInsightsFetchAtRef.current >= PLAYER_INSIGHTS_REFRESH_MS;
    if (!keyChanged && !stale) {
      return;
    }

    playerInsightsAbortRef.current?.abort();
    const controller = new AbortController();
    playerInsightsAbortRef.current = controller;

    try {
      const endpoint = `/api/players/insights/batch?sport=${sportKey}&playerIds=${encodeURIComponent(currentPlayerIds.join(","))}&mode=advanced&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
      setLastEndpoint(endpoint);
      const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
      const json = (await response.json()) as PlayerInsightsBatchEnvelope;
      if (controller.signal.aborted) {
        return;
      }
      if (!response.ok || json.error || !json.data) {
        throw new Error(json.error?.message ?? "Failed to load player insights");
      }

      const map = json.data.players.reduce<Record<string, PlayerInsights>>((acc, insight) => {
        acc[insight.playerId] = insight;
        return acc;
      }, {});

      lastPlayerInsightsReqKeyRef.current = playerInsightsReqKey;
      lastPlayerInsightsFetchAtRef.current = Date.now();
      setPlayerInsightsById(map);
      setPlayerInsightsMeta(json.meta);
      setLastCallMeta(json.meta);
    } catch (error) {
      if (!controller.signal.aborted) {
        setPlayerError(String(error));
      }
    }
  }, [currentPlayerIds, playerInsightsReqKey, playersModeActive, props.dataMode, props.mode, props.refreshTick, sportKey]);

  useEffect(() => {
    if (!playersModeActive || props.mode !== "ADVANCED") {
      playerInsightsAbortRef.current?.abort();
      setPlayerInsightsById({});
      setPlayerInsightsMeta(null);
      return;
    }

    void refreshPlayerInsights();
    return () => {
      playerInsightsAbortRef.current?.abort();
    };
  }, [playerInsightsReqKey, playersModeActive, props.mode, refreshPlayerInsights]);

  useEffect(() => {
    if (!playersModeActive || props.mode !== "ADVANCED" || currentPlayerIds.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (Date.now() - lastPlayerInsightsFetchAtRef.current >= PLAYER_INSIGHTS_REFRESH_MS - 2000) {
        void refreshPlayerInsights();
      }
    }, PLAYER_INSIGHTS_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentPlayerIds.length, playersModeActive, props.mode, refreshPlayerInsights]);

  const runPlayerSearch = useCallback(async (value: string, signal: AbortSignal): Promise<PlayerSearchResultMin[]> => {
    if (value.trim().length < 3) {
      return [];
    }

    const endpointUrl = `/api/players/search?sport=${sportKey}&q=${encodeURIComponent(value.trim())}&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
    setLastEndpoint(endpointUrl);

    const response = await fetch(endpointUrl, { cache: "no-store", signal });
    const json = (await response.json()) as Envelope<PlayerSearchResult[]>;

    if (!response.ok || json.error) {
      throw new Error(json.error?.message ?? "Player search failed.");
    }

    setLastCallMeta(json.meta);
    setPlayerError(json.meta.warning ?? null);

    return (json.data ?? []).map((row) => ({
      playerId: row.playerId,
      fullName: row.fullName,
      teamName: row.teamName,
      position: row.position,
      headshot: row.headshot,
    }));
  }, [props.dataMode, props.refreshTick, sportKey]);

  const runTeamSearch = useCallback(async (value: string, signal: AbortSignal): Promise<TeamSearchResult[]> => {
    if (value.trim().length < 2) {
      return [];
    }

    const endpointUrl = `/api/teams/search?sport=${sportKey}&q=${encodeURIComponent(value.trim())}&limit=8&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
    setLastEndpoint(endpointUrl);

    const response = await fetch(endpointUrl, { cache: "no-store", signal });
    const json = (await response.json()) as TeamSearchEnvelope;

    if (!response.ok || json.error) {
      throw new Error(json.error?.message ?? "Team search failed.");
    }

    setLastCallMeta(json.meta);
    setTeamError(json.meta.warning ?? null);
    return json.data ?? [];
  }, [props.dataMode, props.refreshTick, sportKey]);

  useEffect(() => {
    if (!playersModeActive) {
      setPlayerResults([]);
      return;
    }

    if (debouncedPlayerQuery.length < 3) {
      setPlayerResults([]);
      return;
    }

    const controller = new AbortController();
    void (async () => {
      try {
        const results = await runPlayerSearch(debouncedPlayerQuery, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setPlayerResults(results);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPlayerError(String(error));
          setPlayerResults([]);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [debouncedPlayerQuery, playersModeActive, runPlayerSearch]);

  useEffect(() => {
    if (!teamsModeActive) {
      teamSearchAbortRef.current?.abort();
      lastTeamSearchReqKeyRef.current = "";
      setTeamResults([]);
      setTeamActiveIndex(-1);
      setIsTeamSearching(false);
      setTeamSearchHint(null);
      return;
    }

    if (debouncedTeamQuery.length < 2) {
      teamSearchAbortRef.current?.abort();
      setTeamResults([]);
      setTeamActiveIndex(-1);
      setIsTeamSearching(false);
      setTeamSearchHint(null);
      return;
    }

    if (teamSearchReqKey === lastTeamSearchReqKeyRef.current) {
      return;
    }

    lastTeamSearchReqKeyRef.current = teamSearchReqKey;
    teamSearchAbortRef.current?.abort();
    const controller = new AbortController();
    teamSearchAbortRef.current = controller;
    setIsTeamSearching(true);

    void (async () => {
      try {
        const results = await runTeamSearch(debouncedTeamQuery, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setTeamResults(results);
        setTeamActiveIndex(-1);
      } catch (error) {
        if (!controller.signal.aborted) {
          setTeamError(String(error));
          setTeamResults([]);
          setTeamActiveIndex(-1);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsTeamSearching(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [debouncedTeamQuery, runTeamSearch, teamSearchReqKey, teamsModeActive]);

  useEffect(() => {
    const missingTeamKeys = currentTeamKeys.filter((teamKey) => {
      const ids = teamProviderIds[sportKey][teamKey];
      return !ids?.apiSportsTeamId && !ids?.espnTeamId;
    });

    if (missingTeamKeys.length === 0) {
      teamProviderBackfillReqKeyRef.current = "";
      return;
    }

    const reqKey = stableKey({
      sportKey,
      missingTeamKeys,
      labels: missingTeamKeys.map((teamKey) => teamWatchlistNames[sportKey][teamKey] ?? teamKey),
      dataMode: props.dataMode,
      refreshTick: props.refreshTick,
    });
    if (reqKey === teamProviderBackfillReqKeyRef.current) {
      return;
    }
    teamProviderBackfillReqKeyRef.current = reqKey;

    let cancelled = false;

    void (async () => {
      const nextBySport: TeamProviderIdsBySport = {
        ...teamProviderIds,
        [sportKey]: {
          ...teamProviderIds[sportKey],
        },
      };
      let changed = false;

      for (const teamKey of missingTeamKeys) {
        const query = (teamWatchlistNames[sportKey][teamKey] ?? teamKey).trim();
        if (query.length < 2) {
          continue;
        }
        try {
          const endpointUrl = `/api/teams/search?sport=${sportKey}&q=${encodeURIComponent(query)}&limit=8&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
          const response = await fetch(endpointUrl, { cache: "no-store" });
          const json = (await response.json()) as TeamSearchEnvelope;
          if (!response.ok || json.error) {
            continue;
          }
          const rows = json.data ?? [];
          const selected = rows.find((row) => row.teamKey.trim().toUpperCase() === teamKey)
            ?? selectExactTeamResult(query, rows);
          if (!selected) {
            continue;
          }
          const existing = nextBySport[sportKey][teamKey] ?? {};
          const apiSportsTeamId = selected.apiSportsTeamId ?? existing.apiSportsTeamId;
          const espnTeamId = selected.espnTeamId ?? existing.espnTeamId;
          if (apiSportsTeamId === existing.apiSportsTeamId && espnTeamId === existing.espnTeamId) {
            continue;
          }
          nextBySport[sportKey][teamKey] = {
            apiSportsTeamId,
            espnTeamId,
          };
          changed = true;
        } catch {
          // best-effort backfill; keep existing values
        }
      }

      if (!cancelled && changed) {
        setTeamProviderIds(nextBySport);
        await persistConfig({ teamProviderIds: nextBySport });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    currentTeamKeys,
    persistConfig,
    props.dataMode,
    props.refreshTick,
    sportKey,
    teamProviderIds,
    teamWatchlistNames,
  ]);

  const addTeamFromResult = useCallback(async (result: TeamSearchResult) => {
    setTeamError(null);
    setTeamSearchHint(null);

    const key = result.teamKey.trim().toUpperCase();
    if (!key) {
      setTeamError("Selected team is missing a team key.");
      return;
    }

    if (currentTeamKeys.includes(key)) {
      setTeamError("Team is already in this sport watchlist.");
      return;
    }

    if (currentTeamKeys.length >= TEAM_LIMIT) {
      setTeamError(`Limit reached: ${TEAM_LIMIT} teams per sport.`);
      return;
    }

    const nextTeams = addTeamToSportWatchlist(teamWatchlist, sportKey, key);
    const nextNames: TeamWatchlistNamesBySport = {
      ...teamWatchlistNames,
      [sportKey]: {
        ...teamWatchlistNames[sportKey],
        [key]: result.displayName || teamWatchlistNames[sportKey][key] || key,
      },
    };
    const nextProviderIds = upsertTeamProviderIds(teamProviderIds, sportKey, key, {
      apiSportsTeamId: result.apiSportsTeamId,
      espnTeamId: result.espnTeamId,
    });

    setTeamWatchlist(nextTeams);
    setTeamWatchlistNames(nextNames);
    setTeamProviderIds(nextProviderIds);
    setTeamQuery("");
    setTeamResults([]);
    setTeamActiveIndex(-1);
    setIsTeamSearching(false);

    await persistConfig({
      teamWatchlist: nextTeams,
      teamWatchlistNames: nextNames,
      teamProviderIds: nextProviderIds,
    });
  }, [currentTeamKeys, persistConfig, sportKey, teamProviderIds, teamWatchlist, teamWatchlistNames]);

  const removeTeam = async (teamKey: string) => {
    const key = teamKey.trim().toUpperCase();

    const nextTeams: TeamWatchlistBySport = {
      ...teamWatchlist,
      [sportKey]: teamsForSport.filter((item) => item !== key),
    };
    const nextNames: TeamWatchlistNamesBySport = {
      ...teamWatchlistNames,
      [sportKey]: { ...teamWatchlistNames[sportKey] },
    };
    const nextProviderIds: TeamProviderIdsBySport = {
      ...teamProviderIds,
      [sportKey]: { ...teamProviderIds[sportKey] },
    };
    delete nextNames[sportKey][key];
    delete nextProviderIds[sportKey][key];

    setTeamWatchlist(nextTeams);
    setTeamWatchlistNames(nextNames);
    setTeamProviderIds(nextProviderIds);
    await persistConfig({
      teamWatchlist: nextTeams,
      teamWatchlistNames: nextNames,
      teamProviderIds: nextProviderIds,
    });
  };

  const onTeamSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (teamResults.length === 0) {
        return;
      }
      setTeamActiveIndex((current) => {
        const next = current + 1;
        return next >= teamResults.length ? 0 : next;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (teamResults.length === 0) {
        return;
      }
      setTeamActiveIndex((current) => {
        if (current <= 0) {
          return teamResults.length - 1;
        }
        return current - 1;
      });
      return;
    }

    if (event.key === "Escape") {
      setTeamResults([]);
      setTeamActiveIndex(-1);
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    const active = teamActiveIndex >= 0 && teamActiveIndex < teamResults.length
      ? teamResults[teamActiveIndex]
      : null;
    const exact = selectExactTeamResult(teamQuery, teamResults);
    const chosen = exact ?? active;

    if (chosen) {
      void addTeamFromResult(chosen);
      return;
    }

    if (teamQuery.trim().length >= 2 && teamResults.length > 0) {
      setTeamSearchHint("Select a team from the list.");
    }
  };

  const addPlayer = async (player: PlayerSearchResultMin) => {
    setPlayerError(null);

    if (playersForSport.some((existing) => existing.playerId === player.playerId)) {
      setPlayerError("Player is already in this sport watchlist.");
      return;
    }

    if (playersForSport.length >= PLAYER_LIMIT) {
      setPlayerError(`Limit reached: ${PLAYER_LIMIT} players per sport.`);
      return;
    }

    const nextWatchlist: PlayerWatchlistBySport = {
      ...playerWatchlist,
      [sportKey]: uniqueByPlayerId([...playersForSport, player]),
    };

    setPlayerWatchlist(nextWatchlist);
    setPlayerResults([]);
    setPlayerQuery("");

    await persistConfig({ playerWatchlist: nextWatchlist });
  };

  const removePlayer = async (playerId: string) => {
    const nextWatchlist: PlayerWatchlistBySport = {
      ...playerWatchlist,
      [sportKey]: playersForSport.filter((row) => row.playerId !== playerId),
    };

    setPlayerWatchlist(nextWatchlist);
    if (lastProfile?.playerId === playerId) {
      setLastProfile(null);
      lastQuickProfileKeyRef.current = "";
    }

    await persistConfig({ playerWatchlist: nextWatchlist });
  };

  const loadPlayerProfile = async (playerId: string) => {
    const profileKey = `${sportKey}:${playerId}:${props.dataMode}`;
    if (profileKey === lastQuickProfileKeyRef.current) {
      return;
    }
    lastQuickProfileKeyRef.current = profileKey;

    const endpointUrl = `/api/players/profile?sport=${sportKey}&playerId=${encodeURIComponent(playerId)}&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
    setLastEndpoint(endpointUrl);

    const response = await fetch(endpointUrl, { cache: "no-store" });
    const json = (await response.json()) as Envelope<PlayerProfile>;
    if (!response.ok || json.error) {
      setPlayerError(json.error?.message ?? "Failed to load player profile.");
      return;
    }

    setLastCallMeta(json.meta);
    setPlayerError(json.meta.warning ?? null);
    setLastProfile(json.data ?? null);
  };

  const onViewModeChange = async (next: ViewMode) => {
    setViewMode(next);
    setTeamError(null);
    setPlayerError(null);
    if (next === "teams") {
      setPlayerInsightsById({});
      setPlayerInsightsMeta(null);
      lastPlayerInsightsReqKeyRef.current = "";
    } else {
      setTeamResults([]);
      setTeamQuery("");
      setTeamActiveIndex(-1);
      setTeamSearchHint(null);
      setIsTeamSearching(false);
      lastTeamSearchReqKeyRef.current = "";
    }
    await persistConfig({ viewMode: next });
  };

  const onSportChange = async (nextSportKey: SportKey) => {
    setSportKey(nextSportKey);
    setPlayerResults([]);
    setPlayerQuery("");
    setTeamError(null);
    setPlayerError(null);
    setLastProfile(null);
    setTeamQuery("");
    setTeamResults([]);
    setTeamActiveIndex(-1);
    setTeamSearchHint(null);
    setIsTeamSearching(false);
    lastTeamSearchReqKeyRef.current = "";
    lastQuickProfileKeyRef.current = "";
    setPlayerInsightsById({});
    setPlayerInsightsMeta(null);
    setTeamAdvancedByKey({});
    lastPlayerInsightsReqKeyRef.current = "";
    lastStatusReqKeyRef.current = "";
    teamProviderBackfillReqKeyRef.current = "";
    await persistConfig({ sportKey: nextSportKey });
  };

  const headerMeta = viewMode === "teams"
    ? teamStatusMeta
    : (props.mode === "ADVANCED" ? (playerInsightsMeta ?? lastCallMeta) : lastCallMeta);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">Watchlist</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={props.mode}
          onChange={(event) => props.onPersist({ mode: event.target.value as "BEGINNER" | "ADVANCED" })}
          disabled={props.locked}
        >
          <option value="BEGINNER">Beginner</option>
          <option value="ADVANCED">Advanced</option>
        </select>
      </div>

      <div className="space-y-2">
        <TabsRow
          items={MODE_TABS.map((item) => ({ key: item.key, label: item.label }))}
          value={viewMode}
          onChange={(key) => void onViewModeChange(key as ViewMode)}
          disabled={props.locked}
          size="sm"
        />

        <TabsRow
          items={SPORT_TABS.map((item) => ({ key: item.key, label: item.label }))}
          value={sportKey}
          onChange={(key) => void onSportChange(key as SportKey)}
          disabled={props.locked}
          size="sm"
        />
      </div>

      {viewMode === "teams" ? (
        <>
          <div className="space-y-2">
            <input
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
              placeholder={`Search ${sportLabel(sportKey)} teams (2+ chars)`}
              value={teamQuery}
              onKeyDown={onTeamSearchKeyDown}
              onChange={(event) => {
                setTeamQuery(event.target.value);
                setTeamSearchHint(null);
              }}
              disabled={props.locked}
            />

            {trimmedTeamQuery.length < 2 ? <p className="text-neutral-400">Type 2+ chars to search teams.</p> : null}
            {isTeamSearching ? <p className="text-neutral-400">Searching teams...</p> : null}
            {teamSearchHint ? <p className="text-amber-300">{teamSearchHint}</p> : null}

            {teamResults.length > 0 ? (
              <div className="max-h-40 space-y-1 overflow-auto rounded border border-neutral-700 bg-neutral-950 p-1">
                {teamResults.map((result, index) => {
                  const isActive = index === teamActiveIndex;
                  return (
                    <button
                      key={`${sportKey}-team-search-${result.teamKey}-${result.displayName}`}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${isActive ? "bg-neutral-700 text-white" : "hover:bg-neutral-800"}`}
                      onMouseEnter={() => setTeamActiveIndex(index)}
                      onClick={() => void addTeamFromResult(result)}
                      disabled={props.locked}
                    >
                      {result.logo ? <img src={result.logo} alt={result.displayName} className="h-5 w-5 rounded object-contain" /> : null}
                      <span className="min-w-0 truncate">
                        {result.displayName}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <p className="text-neutral-400">{currentTeamKeys.length}/{TEAM_LIMIT} teams in {sportLabel(sportKey)} watchlist.</p>

          {currentTeamKeys.map((key) => {
            const normalizedKey = key.toUpperCase();
            const label = teamWatchlistNames[sportKey][normalizedKey] ?? normalizedKey;
            const status = statusByTeam[normalizedKey];
            const advanced = teamAdvancedByKey[normalizedKey];
            const recordLabel = advanced?.record
              ? `${advanced.record.wins}-${advanced.record.losses}${advanced.record.pct ? ` (${advanced.record.pct})` : ""}${advanced.record.streak ? ` · ${advanced.record.streak}` : ""}${advanced.record.last10 ? ` · L10 ${advanced.record.last10}` : ""}`
              : null;
            const standingsLabel = advanced?.standings
              ? `${advanced.standings.conference ?? "Conference"} rank ${advanced.standings.rank ?? "-"}`
              : null;
            const nextLabel = advanced?.nextGame ? nextGameLabel(advanced) : (!status?.hasGameToday ? "No game today" : null);
            const hasAdvancedDetails = Boolean(nextLabel || recordLabel || standingsLabel || status?.hasGameToday);
            return (
              <div key={`${sportKey}-team-${normalizedKey}`} className="flex items-start justify-between rounded border border-neutral-700 bg-neutral-950 p-2">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-medium">
                    {label} <span className="rounded bg-neutral-800 px-1 py-0.5 text-[10px] text-neutral-300">{sportLabel(sportKey)}</span>
                  </p>
                  <p className="text-neutral-400">{teamStatusLabel(status)}</p>
                  {props.mode === "BEGINNER" ? (
                    <p className="text-neutral-500">Last: {lastGameLabel(advanced)}</p>
                  ) : (
                    <details className="mt-1 rounded border border-neutral-800 bg-black/20 p-2">
                      <summary className="cursor-pointer text-neutral-300">Details</summary>
                      <div className="mt-1 space-y-1 text-neutral-400">
                        {nextLabel ? <p>Next: {nextLabel}</p> : null}
                        {recordLabel ? <p>Record: {recordLabel}</p> : null}
                        {standingsLabel ? <p>Standings: {standingsLabel}</p> : null}
                        {status?.hasGameToday ? <p>Live detail: {teamLiveDetail(status)}</p> : null}
                        {advanced?.metaNotes?.[0] ? <p>Note: {advanced.metaNotes[0]}</p> : null}
                        {!hasAdvancedDetails ? <p>No additional details available.</p> : null}
                      </div>
                    </details>
                  )}
                </div>
                <button type="button" onClick={() => void removeTeam(normalizedKey)} disabled={props.locked}>Remove</button>
              </div>
            );
          })}

          {currentTeamKeys.length === 0 ? <p className="text-neutral-500">No teams added for this sport yet.</p> : null}
          {teamError ? <p className="text-amber-300">{teamError}</p> : null}
          {legacyError ? <p className="text-amber-300">{legacyError}</p> : null}
        </>
      ) : (
        <>
          <input
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            value={playerQuery}
            onChange={(event) => setPlayerQuery(event.target.value)}
            placeholder={`Search ${sportLabel(sportKey)} players (3+ chars)`}
            disabled={props.locked}
          />

          {trimmedPlayerQuery.length < 3 ? <p className="text-neutral-400">Type 3+ chars to search players.</p> : null}

          {playerResults.length > 0 ? (
            <div className="max-h-40 space-y-1 overflow-auto rounded border border-neutral-700 bg-neutral-950 p-1">
              {playerResults.map((result) => (
                <div key={`${sportKey}-search-${result.playerId}`} className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-neutral-800">
                  <div className="flex min-w-0 items-center gap-2">
                    <img src={result.headshot || "/globe.svg"} alt="player" className="h-7 w-7 rounded object-cover" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{result.fullName}</p>
                      <p className="truncate text-neutral-400">{compact([result.position, result.teamName, sportLabel(sportKey)])}</p>
                    </div>
                  </div>
                  <button type="button" className="rounded border border-neutral-700 px-2 py-0.5" onClick={() => void addPlayer(result)} disabled={props.locked}>Add</button>
                </div>
              ))}
            </div>
          ) : null}

          <p className="text-neutral-400">{playersForSport.length}/{PLAYER_LIMIT} players in {sportLabel(sportKey)} watchlist.</p>
          {props.mode === "ADVANCED" && playersForSport.length > 0 && Object.keys(playerInsightsById).length === 0 ? (
            <p className="text-neutral-400">Loading advanced player insights...</p>
          ) : null}

          {playersForSport.length > 0 ? (
            <div className="space-y-1 rounded border border-neutral-700 bg-neutral-950 p-2">
              {playersForSport.map((player) => {
                const insight = playerInsightsById[player.playerId];
                return (
                  <div key={`${sportKey}-watch-${player.playerId}`} className="border-b border-neutral-800 py-1 last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void loadPlayerProfile(player.playerId)}>
                        <div className="flex items-center gap-2">
                          <img src={player.headshot || "/globe.svg"} alt="player" className="h-7 w-7 rounded object-cover" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{player.fullName}</p>
                            <p className="truncate text-neutral-400">{compact([player.position, player.teamName, sportLabel(sportKey)])}</p>
                            {props.mode === "ADVANCED" ? (
                              <>
                                <p className="truncate text-neutral-300">{playerInsightsSummary(insight)}</p>
                                <p className="truncate text-neutral-500">
                                  Last: {insight?.recent?.games?.[0]?.line ?? "Not available"} · {playerTeamLiveLabel(insight)}
                                </p>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </button>
                      <button type="button" onClick={() => void removePlayer(player.playerId)} disabled={props.locked}>Remove</button>
                    </div>

                    {props.mode === "ADVANCED" ? (
                      <details className="mt-1 rounded border border-neutral-800 bg-black/20 p-2">
                        <summary className="cursor-pointer text-neutral-300">Details</summary>
                        <div className="mt-1 space-y-1 text-neutral-400">
                          {insight?.season?.metrics && insight.season.metrics.length > 0 ? (
                            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                              {insight.season.metrics.slice(0, 4).map((metric) => (
                                <p key={`${player.playerId}-${metric.key}`} className="truncate">
                                  <span className="text-neutral-500">{metric.label}:</span> {metric.value}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p>Season highlights not available.</p>
                          )}

                          {insight?.recent?.games && insight.recent.games.length > 0 ? (
                            <div className="space-y-1">
                              {insight.recent.games.slice(0, 2).map((game, index) => (
                                <p key={`${player.playerId}-recent-${index}`} className="truncate">
                                  {game.date ?? "-"} · {game.opponent ?? "TBD"} · {game.line}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p>Recent game line not available.</p>
                          )}

                          {insight?.metaNotes?.[0] ? <p>Note: {insight.metaNotes[0]}</p> : null}
                        </div>
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-neutral-500">No players added for this sport yet.</p>
          )}

          {lastProfile ? (
            <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
              <p className="font-medium">{lastProfile.fullName}</p>
              <p>{compact([lastProfile.teamName, lastProfile.position, lastProfile.jersey ? `#${lastProfile.jersey}` : undefined])}</p>
              <p>{compact([lastProfile.height, lastProfile.weight, typeof lastProfile.age === "number" ? `Age ${lastProfile.age}` : undefined])}</p>
              <p className="text-[10px] text-neutral-500">
                Updated {lastCallMeta ? to12h(lastCallMeta.updatedAt) : "-"} · Source {lastCallMeta ? lastCallMeta.sourceUsed.toUpperCase() : "-"}
              </p>
            </div>
          ) : null}

          {playerError ? <p className="text-amber-300">{playerError}</p> : null}
        </>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {headerMeta ? to12h(headerMeta.updatedAt) : "-"} · Source {headerMeta ? headerMeta.sourceUsed.toUpperCase() : "-"}
      </div>

      <details className="rounded border border-neutral-700 bg-black/20 p-2">
        <summary className="cursor-pointer text-[11px] text-neutral-300">Debug</summary>
        <p>View mode: {viewMode}</p>
        <p>Sport: {sportKey.toUpperCase()}</p>
        <p>Endpoint: {lastEndpoint || "-"}</p>
        <p>Request ID: {headerMeta?.requestId ?? "-"}</p>
        <pre className="overflow-auto text-[10px]">{JSON.stringify({
          teamWatchlist,
          teamWatchlistNames,
          teamProviderIds,
          playerWatchlist,
          teamAdvancedByKey,
          playerInsightsById,
          lastProfile,
          headerMeta,
        }, null, 2)}</pre>
      </details>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({
          widgetId: props.widgetId,
          mode: viewMode,
          sportKey,
          legacyError,
          teamError,
          playerError,
          lastEndpoint,
          headerMeta,
          teamWatchlist,
          teamProviderIds,
          playerWatchlist,
        })}
      >
        Report a bug
      </button>
    </div>
  );
}
