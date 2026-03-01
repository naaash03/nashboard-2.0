"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type SearchResult = {
  playerId: string;
  fullName: string;
  teamName?: string;
  position?: string;
  jersey?: string;
  headshotUrl?: string;
  teamLogoUrl?: string;
};

type CardData = {
  playerId: string;
  fullName: string;
  team?: string;
  position?: string;
  jersey?: string;
  headshotUrl?: string;
  teamLogoUrl?: string;
  weightLbs?: number;
  whyItMatters?: string;
  tooltip?: string;
  stats?: Record<string, string | number | null>;
  learnMore?: string;
};

type SearchDiagnostics = {
  provider?: string;
  requestId?: string;
  finalUrl?: string | null;
  attemptedUrls?: string[];
  endpointAttempts?: Array<Record<string, unknown>>;
  userFacingMessage?: string;
};

type SearchResponse = {
  results?: SearchResult[];
  userFacingMessage?: string | null;
  diagnostics?: SearchDiagnostics;
  meta?: WidgetMeta;
  error?: string;
};
type PlayerCardResponse = { data?: CardData | null; meta?: WidgetMeta; error?: string };

const isDev = process.env.NODE_ENV !== "production";

export function buildPlayerSearchUrl(query: string, dataMode: "live" | "fixture", limit = 8): string {
  const params = new URLSearchParams();
  params.set("sport", "NFL");
  params.set("q", query);
  params.set("limit", String(limit));
  params.set("dataMode", dataMode);
  return `/api/search/players?${params.toString()}`;
}

export function selectTopPlayerResult(results: SearchResult[]): SearchResult | null {
  return results[0] ?? null;
}

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function PlayerCardWidget(props: WidgetCommonProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>((props.config.playerId as string) ?? "");
  const [data, setData] = useState<CardData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSearchRaw, setLastSearchRaw] = useState<SearchResponse | null>(null);
  const [searchDiagnostics, setSearchDiagnostics] = useState<SearchDiagnostics | null>(null);
  const [showRawSearch, setShowRawSearch] = useState(false);

  const trimmed = useMemo(() => query.trim(), [query]);

  const runSearch = useCallback(async (value: string): Promise<SearchResult[]> => {
    if (value.length < 3) {
      setLastSearchRaw(null);
      setSearchDiagnostics(null);
      return [];
    }
    const endpointUrl = buildPlayerSearchUrl(value, props.dataMode, 8);
    setEndpoint(endpointUrl);
    const response = await fetch(endpointUrl, { cache: "no-store" });
    const json = (await response.json()) as SearchResponse;
    setLastSearchRaw(json);
    setSearchDiagnostics(json.diagnostics ?? null);
    setMeta(json.meta ?? null);

    const message = json.userFacingMessage ?? json.meta?.warning ?? null;
    if (!response.ok) {
      setWarning(message ?? json.error ?? "Search is temporarily unavailable.");
      return [];
    }

    if ((json.results ?? []).length === 0) {
      setWarning(message ?? "No results from ESPN. Try full first and last name.");
    } else {
      setWarning(null);
    }
    return json.results ?? [];
  }, [props.dataMode]);

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      void (async () => {
        try {
          const nextResults = await runSearch(trimmed);
          if (!cancelled) {
            setResults(nextResults);
            setLastError(null);
          }
        } catch (error) {
          if (!cancelled) {
            setWarning("Player search temporarily unavailable. Try again in a minute.");
            setLastError(String(error));
            setResults([]);
          }
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [trimmed, runSearch]);

  const loadPlayer = useCallback(async (playerId: string): Promise<{ data: CardData | null; meta: WidgetMeta | null }> => {
    const mode = props.mode.toLowerCase();
    const endpointUrl = `/api/widgets/player-card?sport=NFL&playerId=${encodeURIComponent(playerId)}&mode=${mode}&dataMode=${props.dataMode}`;
    setEndpoint(endpointUrl);
    const response = await fetch(endpointUrl, { cache: "no-store" });
    const json = (await response.json()) as PlayerCardResponse;
    if (!response.ok) {
      throw new Error(json.error ?? "Failed to load player card");
    }
    return {
      data: json.data ?? null,
      meta: json.meta ?? null,
    };
  }, [props.mode, props.dataMode]);

  useEffect(() => {
    if (!selectedPlayerId) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await loadPlayer(selectedPlayerId);
        if (cancelled) return;
        setData(result.data);
        setMeta(result.meta);
        setLastError(null);
      } catch (error) {
        if (!cancelled) {
          setWarning(String(error));
          setLastError(String(error));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPlayerId, loadPlayer, props.refreshTick]);

  const onSelect = async (player: SearchResult) => {
    setSelectedPlayerId(player.playerId);
    setQuery(player.fullName);
    setResults([]);
    await props.onPersist({ config: { ...props.config, playerId: player.playerId }, playerId: player.playerId });
  };

  const onEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const selected = selectTopPlayerResult(results);
    if (selected) {
      void onSelect(selected);
    }
  };

  const addFavorite = async () => {
    if (!data) return;
    await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: data.playerId, playerName: data.fullName }),
    });
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
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

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onEnter}
        placeholder="Search NFL player (3+ chars)"
        className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
      />

      {trimmed.length < 3 ? <p className="text-neutral-400">Type 3+ chars to search.</p> : null}

      {results.length > 0 ? (
        <div className="max-h-44 space-y-1 overflow-auto rounded border border-neutral-700 bg-neutral-950 p-1">
          {results.map((result) => (
            <button key={result.playerId} type="button" onClick={() => void onSelect(result)} className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-neutral-800">
              <img src={result.headshotUrl || result.teamLogoUrl || "/globe.svg"} alt="player" className="h-8 w-8 rounded object-cover" />
              <span>
                {result.fullName} · {result.teamName ?? "-"} · {result.position ?? "-"} #{result.jersey ?? "-"}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {data ? (
        <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
          <div className="flex items-center gap-2">
            <img src={data.headshotUrl || data.teamLogoUrl || "/globe.svg"} alt="headshot" className="h-10 w-10 rounded object-cover" />
            <div>
              <p className="font-medium">{data.fullName}</p>
              <p>{data.team} · {data.position} #{data.jersey} · {data.weightLbs ? `${data.weightLbs} lbs` : "-"}</p>
            </div>
          </div>
          <p className="mt-1 text-neutral-400" title={data.tooltip}>{data.whyItMatters}</p>
          {props.mode === "ADVANCED" && data.stats ? (
            <pre className="mt-1 overflow-auto rounded bg-black/40 p-1 text-[10px]">{JSON.stringify(data.stats, null, 2)}</pre>
          ) : null}
          {props.mode === "ADVANCED" && data.learnMore ? <a href={data.learnMore} target="_blank" rel="noreferrer" className="text-blue-300 underline">Learn more</a> : null}
          <div className="mt-1">
            <button type="button" onClick={() => void addFavorite()} className="text-[11px] underline text-neutral-300">Favorite Player</button>
          </div>
        </div>
      ) : (
        <p className="text-neutral-400">No player selected.</p>
      )}

      {warning ? <p className="text-amber-300">{warning}</p> : null}
      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>

      <details className="rounded border border-neutral-700 bg-black/20 p-2">
        <summary className="cursor-pointer text-[11px] text-neutral-300">Debug</summary>
        <p>Local API URL: {endpoint}</p>
        <p>Provider: {searchDiagnostics?.provider ?? "-"}</p>
        <p>Request ID: {searchDiagnostics?.requestId ?? meta?.requestId ?? "-"}</p>
        <p>Final upstream URL: {searchDiagnostics?.finalUrl ?? "-"}</p>
        <p>Last error: {lastError ?? "none"}</p>
        {isDev ? (
          <label className="mt-1 flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={showRawSearch}
              onChange={(event) => setShowRawSearch(event.target.checked)}
            />
            Show raw /api/search/players JSON
          </label>
        ) : null}
        {isDev && showRawSearch ? (
          <pre className="overflow-auto text-[10px]">{JSON.stringify(lastSearchRaw, null, 2)}</pre>
        ) : null}
        <pre className="overflow-auto text-[10px]">{JSON.stringify({ meta, searchDiagnostics }, null, 2)}</pre>
      </details>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, warning, playerId: selectedPlayerId, endpoint, lastError })}
      >
        Report a bug
      </button>
    </div>
  );
}

