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

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatPct(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function isNumericPlayerId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]|_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeMessage(message?: string | null): string | null {
  if (!message) return null;
  if (message.toLowerCase().includes("invalid")) return "Could not load pitcher arsenal for this pitcher id.";
  if (message.toLowerCase().includes("failed")) return "Failed to load pitcher arsenal.";
  return message;
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
  const [data, setData] = useState<ArsenalResponse["data"]>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  const resolveToNumericPlayerId = useCallback(async (raw: string): Promise<string | null> => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    if (isNumericPlayerId(trimmed)) {
      return trimmed;
    }
    if (trimmed.length < 3) {
      return null;
    }
    const url = `/api/players/search?sport=MLB&q=${encodeURIComponent(trimmed)}&limit=8&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
    const response = await fetch(url, { cache: "no-store" });
    const json = (await response.json()) as PlayerSearchResponse;
    const rows = Array.isArray(json.data) ? json.data : [];
    if (rows.length === 0) {
      return null;
    }
    const normalizedQuery = normalizeName(trimmed);
    const exact = rows.find((row) => normalizeName(row.fullName) === normalizedQuery && isNumericPlayerId(row.playerId));
    if (exact) {
      return exact.playerId;
    }
    const prefix = rows.find((row) => normalizeName(row.fullName).startsWith(normalizedQuery) && isNumericPlayerId(row.playerId));
    if (prefix) {
      return prefix.playerId;
    }
    const firstNumeric = rows.find((row) => isNumericPlayerId(row.playerId));
    return firstNumeric?.playerId ?? null;
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
      return;
    }

    let cancelled = false;
    void (async () => {
      const resolved = await resolveToNumericPlayerId(configured);
      if (cancelled) {
        return;
      }
      if (resolved) {
        setActivePlayerId(resolved);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.config.playerId, inputPlayerRef, resolveToNumericPlayerId]);

  useEffect(() => {
    if (!activePlayerId) {
      return;
    }
    void load(activePlayerId);
  }, [activePlayerId, load, props.refreshTick]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = inputPlayerRef.trim();
    const resolved = await resolveToNumericPlayerId(normalized);
    if (!resolved) {
      setError("Could not resolve a valid numeric MLB pitcher id from that input.");
      setData(null);
      return;
    }
    setActivePlayerId(resolved);
    setInputPlayerRef(resolved);
    await props.onPersist({ config: { ...props.config, playerId: resolved } });
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">MLB Pitcher Arsenal</span>
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
      >
        Report a bug
      </button>
    </div>
  );
}
