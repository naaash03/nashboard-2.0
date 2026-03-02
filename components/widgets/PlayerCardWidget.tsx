"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@/components/hooks/useDebouncedValue";
import TabsRow from "@/components/widgets/shared/TabsRow";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import type { Envelope, PlayerProfile, PlayerSearchResult, SportKey } from "@/lib/types/players";
import type { PlayerInsights } from "@/lib/types/playerInsights";
import { stableKey } from "@/lib/utils/stableKey";

type PlayerBySportConfig = Partial<Record<SportKey, { playerId: string; playerName?: string }>>;

type SearchResponse = Envelope<PlayerSearchResult[]>;
type PlayerProfileResponse = Envelope<PlayerProfile>;
type PlayerInsightsResponse = Envelope<PlayerInsights>;

const isDev = process.env.NODE_ENV !== "production";

const SPORT_TABS = [
  { key: "nfl", label: "NFL" },
  { key: "mlb", label: "MLB" },
  { key: "nba", label: "NBA" },
] as const;

function normalizeSportKey(input: unknown): SportKey {
  if (input === "mlb" || input === "nba" || input === "nfl") {
    return input;
  }
  return "nfl";
}

function sportLabel(sportKey: SportKey): string {
  return sportKey.toUpperCase();
}

function normalizePlayerBySport(raw: unknown): PlayerBySportConfig {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const output: PlayerBySportConfig = {};

  for (const sport of ["nfl", "mlb", "nba"] as const) {
    const entry = source[sport];
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const typedEntry = entry as Record<string, unknown>;
    const playerId = typeof typedEntry.playerId === "string" ? typedEntry.playerId : "";
    const playerName = typeof typedEntry.playerName === "string" ? typedEntry.playerName : undefined;
    if (!playerId) {
      continue;
    }

    output[sport] = {
      playerId,
      playerName,
    };
  }

  return output;
}

function selectedPlayerIdFromConfig(config: Record<string, unknown>, sportKey: SportKey): string {
  const playerBySport = normalizePlayerBySport(config.playerBySport);
  const fromSport = playerBySport[sportKey]?.playerId;
  if (fromSport) {
    return fromSport;
  }

  const configSport = normalizeSportKey(config.sportKey);
  if (configSport === sportKey && typeof config.playerId === "string") {
    return config.playerId;
  }

  return "";
}

function selectedPlayerNameFromConfig(config: Record<string, unknown>, sportKey: SportKey): string {
  const playerBySport = normalizePlayerBySport(config.playerBySport);
  const fromSport = playerBySport[sportKey]?.playerName;
  if (fromSport) {
    return fromSport;
  }

  const configSport = normalizeSportKey(config.sportKey);
  if (configSport === sportKey && typeof config.playerName === "string") {
    return config.playerName;
  }

  return "";
}

export function buildPlayerSearchUrl(
  query: string,
  dataMode: "live" | "fixture",
  limit = 8,
  sport: SportKey = "nfl",
): string {
  const params = new URLSearchParams();
  params.set("sport", sport);
  params.set("q", query);
  params.set("limit", String(limit));
  params.set("dataMode", dataMode);
  return `/api/players/search?${params.toString()}`;
}

export function selectTopPlayerResult(results: PlayerSearchResult[]): PlayerSearchResult | null {
  return results[0] ?? null;
}

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function compactLine(parts: Array<string | undefined>): string {
  const filtered = parts.map((value) => value?.trim()).filter(Boolean) as string[];
  return filtered.length > 0 ? filtered.join(" · ") : "-";
}

function profilePhysicalLine(profile: PlayerProfile): string | null {
  const age = typeof profile.age === "number" ? `Age ${profile.age}` : undefined;
  const line = compactLine([profile.height, profile.weight, age]);
  return line === "-" ? null : line;
}

function sportExtraRows(profile: PlayerProfile, sport: SportKey): Array<{ label: string; value: string }> {
  if (sport === "mlb") {
    const batsThrows = compactLine([
      profile.bats ? `Bats ${profile.bats}` : undefined,
      profile.throws ? `Throws ${profile.throws}` : undefined,
    ]);
    if (batsThrows !== "-") {
      return [{ label: "Handedness", value: batsThrows }];
    }

    if (profile.jersey) {
      return [{ label: "Jersey", value: `#${profile.jersey}` }];
    }
    return [];
  }

  if (sport === "nba") {
    return [
      profile.jersey ? { label: "Jersey", value: `#${profile.jersey}` } : null,
      profile.position ? { label: "Position", value: profile.position } : null,
      profile.teamName ? { label: "Team", value: profile.teamName } : null,
    ].filter((row): row is { label: string; value: string } => row !== null);
  }

  return [
    profile.jersey ? { label: "Jersey", value: `#${profile.jersey}` } : null,
    profile.position ? { label: "Position", value: profile.position } : null,
    profile.teamName ? { label: "Team", value: profile.teamName } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);
}

function formatLiveLine(insights: PlayerInsights | null): string {
  if (!insights?.live || !insights.live.hasGameToday) {
    return "No game today";
  }

  const opponent = insights.live.opponent
    ? insights.live.homeAway === "home"
      ? `vs ${insights.live.opponent}`
      : `at ${insights.live.opponent}`
    : "vs TBD";
  const score = insights.live.score ? `${insights.live.score.team}-${insights.live.score.opp}` : undefined;

  if (insights.live.state === "in") {
    return ["LIVE", opponent, score, insights.live.displayClock].filter(Boolean).join(" · ");
  }
  if (insights.live.state === "post") {
    return ["Final", opponent, score].filter(Boolean).join(" · ");
  }
  return ["Today", opponent, insights.live.displayClock].filter(Boolean).join(" · ");
}

export default function PlayerCardWidget(props: WidgetCommonProps) {
  const initialSport = normalizeSportKey(props.config.sportKey);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [sportKey, setSportKey] = useState<SportKey>(initialSport);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(selectedPlayerIdFromConfig(props.config, initialSport));
  const [data, setData] = useState<PlayerProfile | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSearchRaw, setLastSearchRaw] = useState<SearchResponse | null>(null);
  const [showRawSearch, setShowRawSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [insights, setInsights] = useState<PlayerInsights | null>(null);
  const [insightsMeta, setInsightsMeta] = useState<WidgetMeta | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);

  const lastExecutedSearchKeyRef = useRef("");
  const lastFetchedProfileKeyRef = useRef("");
  const lastFetchedInsightsKeyRef = useRef("");

  const configSportKey = normalizeSportKey(props.config.sportKey);
  const configPlayerId = selectedPlayerIdFromConfig(props.config, configSportKey);
  const configPlayerName = selectedPlayerNameFromConfig(props.config, configSportKey);

  const trimmed = useMemo(() => query.trim(), [query]);
  const debouncedQuery = useDebouncedValue(trimmed, 300);

  useEffect(() => {
    if (configSportKey !== sportKey) {
      setSportKey(configSportKey);
      setResults([]);
      setWarning(null);
    }
  }, [configSportKey, sportKey]);

  useEffect(() => {
    if (configPlayerId !== selectedPlayerId) {
      setSelectedPlayerId(configPlayerId);
    }
  }, [configPlayerId, selectedPlayerId]);

  useEffect(() => {
    if (configPlayerId && configPlayerName && query.trim().length === 0) {
      setQuery(configPlayerName);
    }
  }, [configPlayerId, configPlayerName, query]);

  const searchRequestKey = useMemo(
    () => stableKey({ sportKey, query: debouncedQuery.toLowerCase(), dataMode: props.dataMode }),
    [debouncedQuery, props.dataMode, sportKey],
  );

  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setIsSearching(false);
      setResults([]);
      setLastSearchRaw(null);
      return;
    }

    if (searchRequestKey === lastExecutedSearchKeyRef.current) {
      return;
    }
    lastExecutedSearchKeyRef.current = searchRequestKey;

    const controller = new AbortController();
    setIsSearching(true);

    void (async () => {
      try {
        const endpointUrl = buildPlayerSearchUrl(debouncedQuery, props.dataMode, 8, sportKey);
        setEndpoint(endpointUrl);

        const response = await fetch(endpointUrl, { cache: "no-store", signal: controller.signal });
        const json = (await response.json()) as SearchResponse;
        if (controller.signal.aborted) {
          return;
        }
        setLastSearchRaw(json);

        if (!response.ok || json.error) {
          setWarning(json.error?.message ?? "Search is temporarily unavailable.");
          setResults([]);
          return;
        }

        setWarning(json.meta.warning ?? null);
        setResults(json.data ?? []);
        setLastError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setWarning("Player search temporarily unavailable. Try again in a minute.");
        setLastError(String(error));
        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, props.dataMode, searchRequestKey, sportKey]);

  const loadPlayer = useCallback(async (
    playerId: string,
    signal: AbortSignal,
  ): Promise<{ data: PlayerProfile | null; meta: WidgetMeta | null }> => {
    const endpointUrl = `/api/players/profile?sport=${sportKey}&playerId=${encodeURIComponent(playerId)}&dataMode=${props.dataMode}`;
    setEndpoint(endpointUrl);
    const response = await fetch(endpointUrl, { cache: "no-store", signal });
    const json = (await response.json()) as PlayerProfileResponse;

    if (!response.ok || json.error) {
      throw new Error(json.error?.message ?? "Failed to load player card");
    }

    return {
      data: json.data ?? null,
      meta: json.meta ?? null,
    };
  }, [props.dataMode, sportKey]);

  const profileRequestKey = useMemo(
    () => selectedPlayerId
      ? stableKey({ sportKey, playerId: selectedPlayerId, dataMode: props.dataMode })
      : "",
    [props.dataMode, selectedPlayerId, sportKey],
  );

  const insightsRequestKey = useMemo(
    () => props.mode === "ADVANCED" && selectedPlayerId
      ? stableKey({ sportKey, playerId: selectedPlayerId, dataMode: props.dataMode, mode: "advanced" })
      : "",
    [props.dataMode, props.mode, selectedPlayerId, sportKey],
  );

  useEffect(() => {
    if (!selectedPlayerId) {
      setData(null);
      setMeta(null);
      setIsProfileLoading(false);
      lastFetchedProfileKeyRef.current = "";
      return;
    }

    if (profileRequestKey === lastFetchedProfileKeyRef.current) {
      return;
    }
    lastFetchedProfileKeyRef.current = profileRequestKey;

    const controller = new AbortController();
    setIsProfileLoading(true);

    void (async () => {
      try {
        const result = await loadPlayer(selectedPlayerId, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setData(result.data);
        setMeta(result.meta);
        setWarning(result.meta?.warning ?? null);
        setLastError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setWarning(String(error));
        setLastError(String(error));
        setData(null);
        setMeta(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsProfileLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [loadPlayer, profileRequestKey, selectedPlayerId]);

  useEffect(() => {
    if (props.mode !== "ADVANCED" || !selectedPlayerId) {
      setInsights(null);
      setInsightsMeta(null);
      setIsInsightsLoading(false);
      lastFetchedInsightsKeyRef.current = "";
      return;
    }

    if (insightsRequestKey === lastFetchedInsightsKeyRef.current) {
      return;
    }
    lastFetchedInsightsKeyRef.current = insightsRequestKey;

    const controller = new AbortController();
    setIsInsightsLoading(true);

    void (async () => {
      try {
        const endpointUrl = `/api/players/insights?sport=${sportKey}&playerId=${encodeURIComponent(selectedPlayerId)}&mode=advanced&dataMode=${props.dataMode}`;
        setEndpoint(endpointUrl);
        const response = await fetch(endpointUrl, { cache: "no-store", signal: controller.signal });
        const json = (await response.json()) as PlayerInsightsResponse;
        if (controller.signal.aborted) {
          return;
        }
        if (!response.ok || json.error) {
          throw new Error(json.error?.message ?? "Failed to load player insights");
        }

        setInsights(json.data ?? null);
        setInsightsMeta(json.meta ?? null);
        if (json.meta?.warning) {
          setWarning(json.meta.warning);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setWarning(String(error));
      } finally {
        if (!controller.signal.aborted) {
          setIsInsightsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [insightsRequestKey, props.dataMode, props.mode, selectedPlayerId, sportKey]);

  const onSelect = async (player: PlayerSearchResult) => {
    setSelectedPlayerId(player.playerId);
    setQuery(player.fullName);
    setResults([]);
    setLastSearchRaw(null);
    setWarning(null);
    setInsights(null);
    setInsightsMeta(null);
    lastFetchedInsightsKeyRef.current = "";

    const playerBySport = normalizePlayerBySport(props.config.playerBySport);
    playerBySport[sportKey] = {
      playerId: player.playerId,
      playerName: player.fullName,
    };

    await props.onPersist({
      config: {
        ...props.config,
        sportKey,
        playerId: player.playerId,
        playerName: player.fullName,
        playerBySport,
      },
      playerId: player.playerId,
    });
  };

  const onEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const selected = selectTopPlayerResult(results);
    if (selected) {
      void onSelect(selected);
    }
  };

  const onSportChange = async (nextSportKey: SportKey) => {
    if (nextSportKey === sportKey) {
      return;
    }

    const playerBySport = normalizePlayerBySport(props.config.playerBySport);
    const nextSelectedPlayerId = playerBySport[nextSportKey]?.playerId ?? "";
    const nextSelectedName = playerBySport[nextSportKey]?.playerName ?? "";

    setSportKey(nextSportKey);
    setSelectedPlayerId(nextSelectedPlayerId);
    setQuery(nextSelectedName);
    setResults([]);
    setLastSearchRaw(null);
    setWarning(null);
    setInsights(null);
    setInsightsMeta(null);
    lastFetchedInsightsKeyRef.current = "";
    if (!nextSelectedPlayerId) {
      setData(null);
      setMeta(null);
      lastFetchedProfileKeyRef.current = "";
    }

    await props.onPersist({
      config: {
        ...props.config,
        sportKey: nextSportKey,
        playerId: nextSelectedPlayerId,
        playerName: nextSelectedName,
        playerBySport,
      },
      playerId: nextSelectedPlayerId || undefined,
    });
  };

  const addFavorite = async () => {
    if (!data || sportKey !== "nfl") return;
    await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: data.playerId, playerName: data.fullName }),
    });
  };

  const extraRows = data ? sportExtraRows(data, sportKey) : [];
  const physicalLine = data ? profilePhysicalLine(data) : null;
  const activeMeta = props.mode === "ADVANCED" ? (insightsMeta ?? meta) : meta;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">Player Card</span>
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
          items={SPORT_TABS.map((item) => ({ key: item.key, label: item.label }))}
          value={sportKey}
          onChange={(next) => void onSportChange(next as SportKey)}
          disabled={props.locked}
          size="sm"
        />

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onEnter}
          placeholder={`Search ${sportLabel(sportKey)} player (3+ chars)`}
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
        />
      </div>

      {trimmed.length < 3 ? <p className="text-neutral-400">Type 3+ chars to search.</p> : null}
      {isSearching ? <p className="text-neutral-400">Searching...</p> : null}

      {results.length > 0 ? (
        <div className="max-h-44 space-y-1 overflow-auto rounded border border-neutral-700 bg-neutral-950 p-1">
          {results.map((result) => (
            <button
              key={`${sportKey}-${result.playerId}`}
              type="button"
              onClick={() => void onSelect(result)}
              className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-neutral-800"
            >
              <img src={result.headshot || "/globe.svg"} alt="player" className="h-8 w-8 rounded object-cover" />
              <span>
                {result.fullName} · {result.teamName ?? "-"} · {result.position ?? "-"}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {isProfileLoading ? (
        <p className="text-neutral-400">Loading player profile...</p>
      ) : data ? (
        <div className="space-y-2 rounded border border-neutral-700 bg-neutral-950 p-2">
          <div className="flex items-center gap-2">
            <img src={data.headshot || "/globe.svg"} alt="headshot" className="h-11 w-11 rounded object-cover" />
            <div>
              <p className="font-medium">{data.fullName}</p>
              <p>{compactLine([data.teamName, data.position])}</p>
              {physicalLine ? <p className="text-neutral-300">{physicalLine}</p> : null}
            </div>
          </div>

          {extraRows.length > 0 ? (
            <div className="rounded border border-neutral-800 bg-black/20 p-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-neutral-400">{sportLabel(sportKey)} Details</p>
              <div className="space-y-1">
                {extraRows.map((row) => (
                  <p key={row.label}><span className="text-neutral-400">{row.label}:</span> {row.value}</p>
                ))}
              </div>
            </div>
          ) : null}

          {data.whyItMatters ? <p className="text-neutral-400" title={data.tooltip}>{data.whyItMatters}</p> : null}
          {props.mode === "ADVANCED" && data.stats ? (
            <pre className="overflow-auto rounded bg-black/40 p-1 text-[10px]">{JSON.stringify(data.stats, null, 2)}</pre>
          ) : null}
          {props.mode === "ADVANCED" && data.learnMore ? (
            <a href={data.learnMore} target="_blank" rel="noreferrer" className="text-blue-300 underline">Learn more</a>
          ) : null}
          {sportKey === "nfl" ? (
            <div>
              <button type="button" onClick={() => void addFavorite()} className="text-[11px] underline text-neutral-300">Favorite Player</button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-neutral-400">No player selected.</p>
      )}

      {props.mode === "ADVANCED" && selectedPlayerId ? (
        <div className="space-y-2 rounded border border-neutral-700 bg-neutral-950 p-2">
          {isInsightsLoading ? <p className="text-neutral-400">Loading advanced insights...</p> : null}

          <details className="rounded border border-neutral-800 bg-black/20 p-2">
            <summary className="cursor-pointer font-medium">Live Context</summary>
            <p className="mt-1 text-neutral-300">{formatLiveLine(insights)}</p>
          </details>

          <details className="rounded border border-neutral-800 bg-black/20 p-2">
            <summary className="cursor-pointer font-medium">Season Highlights</summary>
            {insights?.season ? (
              <div className="mt-2 space-y-2">
                <p className="text-neutral-300">{insights.season.headline}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {insights.season.metrics.slice(0, 6).map((metric) => (
                    <div key={metric.key} className="rounded border border-neutral-700 bg-neutral-900/80 px-2 py-1">
                      <p className="text-[10px] uppercase tracking-wide text-neutral-400">{metric.label}</p>
                      <p className="text-sm font-semibold text-neutral-100">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-1 text-neutral-400">Not available.</p>
            )}
          </details>

          <details className="rounded border border-neutral-800 bg-black/20 p-2">
            <summary className="cursor-pointer font-medium">Recent Games</summary>
            {insights?.recent?.games && insights.recent.games.length > 0 ? (
              <div className="mt-2 max-h-52 space-y-1 overflow-auto">
                <p className="text-neutral-300">{insights.recent.headline}</p>
                {insights.recent.games.map((game, index) => (
                  <div key={`${game.date ?? "na"}-${index}`} className="rounded border border-neutral-700 bg-neutral-900/70 px-2 py-1">
                    <p className="text-[11px] text-neutral-200">
                      {(game.date ?? "-")} · {(game.opponent ?? "TBD")} · {(game.result ?? "-")}
                    </p>
                    <p className="text-neutral-400">{game.line}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-neutral-400">Not available.</p>
            )}
          </details>

          <details className="rounded border border-neutral-800 bg-black/20 p-2">
            <summary className="cursor-pointer font-medium">Status / Injury</summary>
            {insights?.injury ? (
              <div className="mt-1">
                <p className="text-neutral-300">{insights.injury.status ?? "Status unavailable"}</p>
                {insights.injury.detail ? <p className="text-neutral-400">{insights.injury.detail}</p> : null}
              </div>
            ) : (
              <p className="mt-1 text-neutral-400">Not available.</p>
            )}
          </details>

          {insights?.metaNotes && insights.metaNotes.length > 0 ? (
            <details className="rounded border border-neutral-800 bg-black/20 p-2">
              <summary className="cursor-pointer font-medium">Notes</summary>
              <ul className="mt-1 space-y-1 text-neutral-400">
                {insights.metaNotes.map((note, index) => (
                  <li key={`${index}-${note}`}>- {note}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {warning ? <p className="text-amber-300">{warning}</p> : null}
      {activeMeta && data ? (
        <div className="text-[10px] text-neutral-500">
          Updated {to12h(activeMeta.updatedAt)} · Source {activeMeta.sourceUsed.toUpperCase()}
        </div>
      ) : null}

      <details className="rounded border border-neutral-700 bg-black/20 p-2">
        <summary className="cursor-pointer text-[11px] text-neutral-300">Debug</summary>
        <p>Local API URL: {endpoint}</p>
        <p>Sport: {sportKey.toUpperCase()}</p>
        <p>Request ID: {activeMeta?.requestId ?? "-"}</p>
        <p>Final upstream URL: {activeMeta?.endpointUrl ?? "-"}</p>
        <p>Last error: {lastError ?? "none"}</p>
        {isDev ? (
          <label className="mt-1 flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={showRawSearch}
              onChange={(event) => setShowRawSearch(event.target.checked)}
            />
            Show raw /api/players/search JSON
          </label>
        ) : null}
        {isDev && showRawSearch ? (
          <pre className="overflow-auto text-[10px]">{JSON.stringify(lastSearchRaw, null, 2)}</pre>
        ) : null}
        <pre className="overflow-auto text-[10px]">{JSON.stringify({ profileMeta: meta, insightsMeta, insights }, null, 2)}</pre>
      </details>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({
          widgetId: props.widgetId,
          sportKey,
          meta: activeMeta,
          warning,
          playerId: selectedPlayerId,
          endpoint,
          lastError,
        })}
      >
        Report a bug
      </button>
    </div>
  );
}

