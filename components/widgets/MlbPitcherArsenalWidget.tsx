<<<<<<< HEAD
﻿"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type SearchResult = {
  playerId: string;
  fullName: string;
  teamKey?: string;
  position?: string;
};

type PitchEntry = {
  type: string;
  usagePct?: number;
  velocityMph?: number;
  spinRpm?: number;
};

type SeasonStats = {
  era?: string;
  whip?: string;
  inningsPitched?: string;
  strikeOuts?: number;
  wins?: number;
  losses?: number;
  gamesStarted?: number;
};

type ArsenalData = {
  playerId: string;
  playerName?: string;
  season: number;
  seasonLabel?: string;
  fallbackSeason?: number;
  status: "current" | "fallback" | "unavailable";
  message?: string;
  pitches: PitchEntry[];
  seasonStats?: SeasonStats;
=======
"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type ArsenalPitch = {
  type: string;
  usagePct?: number;
  velocityMph?: number;
};

type ArsenalResponse = {
  data: {
    playerId: string;
    playerName?: string;
    pitches: ArsenalPitch[];
  } | null;
  meta?: WidgetMeta;
  error?: string | null;
};

type PlayerSearchResponse = {
  data?: Array<{
    playerId: string;
    fullName: string;
  }>;
  error?: {
    message?: string;
  };
};

type ResolvedPitcherSelection = {
  playerId: string;
  fullName?: string;
>>>>>>> 5518813dbf8beb460abbc3bf1376ae9c65caee03
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

<<<<<<< HEAD
export default function MlbPitcherArsenalWidget(props: WidgetCommonProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string>((props.config.playerId as string) ?? "");
  const [selectedName, setSelectedName] = useState<string>((props.config.playerName as string) ?? "");
  const [data, setData] = useState<ArsenalData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetch(`/api/search/mlb-players?q=${encodeURIComponent(query)}&dataMode=${props.dataMode}`, {
        cache: "no-store",
      })
        .then((res) => res.json())
        .then((json) => setResults((json as { data?: SearchResult[] }).data ?? []));
    }, 250);
  }, [query, props.dataMode]);

  const loadArsenal = useCallback(
    async (playerId: string) => {
      const res = await fetch(
        `/api/widgets/mlb-pitcher-arsenal?playerId=${encodeURIComponent(playerId)}&dataMode=${props.dataMode}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        data?: ArsenalData | null;
        meta?: WidgetMeta;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load arsenal");
      return { data: json.data ?? null, meta: json.meta ?? null };
    },
    [props.dataMode],
  );

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await loadArsenal(selectedId);
        if (!cancelled) {
          setData(result.data);
          setMeta(result.meta);
          setWarning(null);
        }
      } catch (error) {
        if (!cancelled) setWarning(String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, loadArsenal, props.refreshTick]);

  function selectPlayer(result: SearchResult) {
    setSelectedId(result.playerId);
    setSelectedName(result.fullName);
    setQuery("");
    setResults([]);
    void props.onPersist({
      config: { ...props.config, playerId: result.playerId, playerName: result.fullName },
    });
  }
=======
function formatPct(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function isNumericPlayerId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function normalizePitcherSearchName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]|_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolvePitcherSelectionFromSearch(
  query: string,
  rows: Array<{ playerId: string; fullName: string }>,
): ResolvedPitcherSelection | null {
  if (rows.length === 0) {
    return null;
  }
  const normalizedQuery = normalizePitcherSearchName(query);
  const exact = rows.find((row) => normalizePitcherSearchName(row.fullName) === normalizedQuery && isNumericPlayerId(row.playerId));
  if (exact) {
    return { playerId: exact.playerId, fullName: exact.fullName };
  }
  const prefix = rows.find((row) => normalizePitcherSearchName(row.fullName).startsWith(normalizedQuery) && isNumericPlayerId(row.playerId));
  if (prefix) {
    return { playerId: prefix.playerId, fullName: prefix.fullName };
  }
  const firstNumeric = rows.find((row) => isNumericPlayerId(row.playerId));
  return firstNumeric ? { playerId: firstNumeric.playerId, fullName: firstNumeric.fullName } : null;
}

function safeMessage(message?: string | null): string | null {
  if (!message) return null;
  const lowered = message.toLowerCase();
  if (lowered.includes("pitch arsenal not available")) return "Pitch arsenal not available from upstream for this pitcher yet.";
  if (lowered.includes("invalid")) return "Could not load pitcher arsenal for this pitcher id.";
  if (lowered.includes("failed")) return "Failed to load pitcher arsenal.";
  return "Failed to load pitcher arsenal.";
}

function safeWarning(message?: string): string | null {
  if (!message) return null;
  const lowered = message.toLowerCase();
  if (lowered.includes("pitch arsenal not available")) {
    return "Pitch arsenal not available from upstream for this pitcher yet.";
  }
  if (lowered.includes("upstream failure")) {
    return "MLB data warning. Use Report a bug for diagnostics.";
  }
  return message;
}

export default function MlbPitcherArsenalWidget(props: WidgetCommonProps) {
  const [inputPlayerRef, setInputPlayerRef] = useState<string>(String(props.config.playerId ?? ""));
  const [activePlayerId, setActivePlayerId] = useState<string>(isNumericPlayerId(String(props.config.playerId ?? "")) ? String(props.config.playerId ?? "") : "");
  const [selectedPitcher, setSelectedPitcher] = useState<ResolvedPitcherSelection | null>(
    isNumericPlayerId(String(props.config.playerId ?? "")) ? { playerId: String(props.config.playerId ?? "") } : null,
  );
  const [data, setData] = useState<ArsenalResponse["data"]>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  const resolvePitcherSelection = useCallback(async (raw: string): Promise<ResolvedPitcherSelection | null> => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    if (isNumericPlayerId(trimmed)) {
      return { playerId: trimmed };
    }
    if (trimmed.length < 3) {
      return null;
    }
    const url = `/api/players/search?sport=MLB&q=${encodeURIComponent(trimmed)}&limit=8&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
    const response = await fetch(url, { cache: "no-store" });
    const json = (await response.json()) as PlayerSearchResponse;
    const rows = Array.isArray(json.data) ? json.data : [];
    return resolvePitcherSelectionFromSearch(trimmed, rows);
  }, [props.dataMode, props.refreshTick]);

  const load = useCallback(async (playerId: string) => {
    if (!isNumericPlayerId(playerId)) {
      setData(null);
      setMeta(null);
      setError("Enter an MLB pitcher name or numeric playerId.");
      return;
    }

    const mode = props.mode.toLowerCase();
    const url = `/api/widgets/mlb-pitcher-arsenal?playerId=${encodeURIComponent(playerId)}&mode=${mode}&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as ArsenalResponse;
      if (!response.ok) {
        throw new Error(safeMessage(json.error) ?? "Failed to load pitcher arsenal.");
      }
      setData(json.data ?? null);
      setMeta(json.meta ?? null);
      setError(safeMessage(json.error) ?? null);
      if (json.data?.playerId) {
        setSelectedPitcher((previous) => ({
          playerId: json.data?.playerId ?? previous?.playerId ?? playerId,
          fullName: json.data?.playerName ?? previous?.fullName,
        }));
      }
    } catch {
      setError("Failed to load pitcher arsenal.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [props.dataMode, props.mode, props.refreshTick]);

  useEffect(() => {
    const configured = String(props.config.playerId ?? "");
    if (configured !== inputPlayerRef) {
      setInputPlayerRef(configured);
    }

    if (!configured) {
      setActivePlayerId("");
      setSelectedPitcher(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const resolved = await resolvePitcherSelection(configured);
      if (cancelled) {
        return;
      }
      if (resolved) {
        setActivePlayerId(resolved.playerId);
        setSelectedPitcher(resolved);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.config.playerId, resolvePitcherSelection]);

  useEffect(() => {
    if (!activePlayerId) {
      return;
    }
    void load(activePlayerId);
  }, [activePlayerId, load, props.refreshTick]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = inputPlayerRef.trim();
    const resolved = await resolvePitcherSelection(normalized);
    if (!resolved) {
      setError("Could not resolve a valid numeric MLB pitcher id from that input.");
      setData(null);
      return;
    }
    setActivePlayerId(resolved.playerId);
    setSelectedPitcher(resolved);
    setError(null);
    setInputPlayerRef(resolved.fullName ?? normalized);
    await props.onPersist({ config: { ...props.config, playerId: resolved.playerId } });
  };
>>>>>>> 5518813dbf8beb460abbc3bf1376ae9c65caee03

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
<<<<<<< HEAD
        <span className="font-medium">Pitcher Arsenal</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={props.mode}
          onChange={(e) =>
            void props.onPersist({ mode: e.target.value as "BEGINNER" | "ADVANCED" })
          }
=======
        <span className="font-medium">MLB Pitcher Arsenal</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={props.mode}
          onChange={(event) => props.onPersist({ mode: event.target.value as "BEGINNER" | "ADVANCED" })}
>>>>>>> 5518813dbf8beb460abbc3bf1376ae9c65caee03
          disabled={props.locked}
        >
          <option value="BEGINNER">Beginner</option>
          <option value="ADVANCED">Advanced</option>
        </select>
      </div>

<<<<<<< HEAD
      <div className="relative">
        <input
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          placeholder="Search pitcher name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-10 rounded border border-neutral-700 bg-neutral-900">
            {results.map((result) => (
              <button
                key={result.playerId}
                type="button"
                className="block w-full px-2 py-1 text-left hover:bg-neutral-800"
                onClick={() => selectPlayer(result)}
              >
                {result.fullName}
                {result.teamKey ? ` (${result.teamKey})` : ""}
                {result.position ? ` · ${result.position}` : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedName && !data && <p className="text-neutral-400">Selected: {selectedName}</p>}
      {warning && <p className="text-amber-300">{warning}</p>}

      {data && (
        <div className="space-y-2">
          <div>
            <p className="font-medium">{selectedName || data.playerName || data.playerId}</p>
            <p className="text-neutral-400">{data.seasonLabel ?? `${data.season} arsenal`}</p>
            {data.message && <p className="text-neutral-500">{data.message}</p>}
            {data.seasonStats && (
              <p className="text-neutral-400">
                {data.seasonStats.wins ?? "-"}W-{data.seasonStats.losses ?? "-"}L · {data.seasonStats.era ?? "-"} ERA · {data.seasonStats.strikeOuts ?? "-"} K · {data.seasonStats.inningsPitched ?? "-"} IP
              </p>
            )}
          </div>

          {data.pitches.length === 0 ? (
            <div className="rounded border border-neutral-800 bg-neutral-950 p-2 text-neutral-300">
              {data.message ?? "Arsenal data not yet available for this pitcher."}
            </div>
          ) : (
            <div className="space-y-1">
              {data.pitches.map((pitch) => (
                <div key={pitch.type} className="rounded border border-neutral-700 bg-neutral-950 p-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{pitch.type}</span>
                    <span>{pitch.usagePct !== undefined ? `${pitch.usagePct}%` : "-"}</span>
                  </div>
                  {props.mode === "ADVANCED" && (
                    <div className="flex gap-3 text-neutral-400">
                      <span>{pitch.velocityMph !== undefined ? `${pitch.velocityMph} mph` : "Velocity -"}</span>
                      <span>{pitch.spinRpm !== undefined ? `${pitch.spinRpm} rpm` : "Spin -"}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>
      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, warning, selectedId })}
=======
      <form className="flex gap-2" onSubmit={(event) => void onSubmit(event)}>
        <input
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={inputPlayerRef}
          onChange={(event) => setInputPlayerRef(event.target.value)}
          placeholder="MLB pitcher name or playerId (example: 669203)"
          disabled={props.locked}
        />
        <button type="submit" className="rounded border border-neutral-700 px-2 py-1" disabled={props.locked}>Load</button>
      </form>

      {selectedPitcher ? (
        <p className="text-[11px] text-neutral-400">
          Selected pitcher: {selectedPitcher.fullName ?? "Player"} ({selectedPitcher.playerId})
        </p>
      ) : null}

      {loading ? <p className="text-neutral-300">Loading pitcher arsenal...</p> : null}
      {error ? <p className="text-amber-300">{error}</p> : null}

      {!loading && !error && data === null ? (
        <p className="text-neutral-400">Pitch arsenal not available yet for this player.</p>
      ) : null}

      {data ? (
        <div className="space-y-1 rounded border border-neutral-700 bg-neutral-950 p-2">
          <p className="font-medium">{data.playerName ?? "Unknown player"} ({data.playerId})</p>
          {data.pitches.map((pitch) => (
            <div key={pitch.type} className="flex items-center justify-between border-b border-neutral-800 py-1 last:border-b-0">
              <span>{pitch.type}</span>
              <span>
                Usage {formatPct(pitch.usagePct)}
                {props.mode === "ADVANCED" ? ` - Velo ${typeof pitch.velocityMph === "number" ? `${pitch.velocityMph.toFixed(1)} mph` : "-"}` : ""}
              </span>
            </div>
          ))}
          {data.pitches.length === 0 ? <p className="text-neutral-400">No pitch data available.</p> : null}
        </div>
      ) : null}

      {safeWarning(meta?.warning) ? <p className="text-amber-300">{safeWarning(meta?.warning)}</p> : null}
      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} - Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({
          widgetId: props.widgetId,
          endpoint,
          meta,
          warnings: meta?.warning,
          endpointUrl: meta?.endpointUrl,
          playerId: activePlayerId,
        })}
>>>>>>> 5518813dbf8beb460abbc3bf1376ae9c65caee03
      >
        Report a bug
      </button>
    </div>
  );
}
