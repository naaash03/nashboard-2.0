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

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatPct(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

export default function MlbPitcherArsenalWidget(props: WidgetCommonProps) {
  const [inputPlayerId, setInputPlayerId] = useState<string>(String(props.config.playerId ?? ""));
  const [activePlayerId, setActivePlayerId] = useState<string>(String(props.config.playerId ?? ""));
  const [data, setData] = useState<ArsenalResponse["data"]>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    const next = String(props.config.playerId ?? "");
    if (next !== activePlayerId) {
      setActivePlayerId(next);
      setInputPlayerId(next);
    }
  }, [props.config.playerId, activePlayerId]);

  const load = useCallback(async (playerId: string) => {
    if (!playerId.trim()) {
      setData(null);
      setMeta(null);
      setError("Enter an MLB playerId to load pitch arsenal.");
      return;
    }

    const mode = props.mode.toLowerCase();
    const url = `/api/widgets/mlb-pitcher-arsenal?playerId=${encodeURIComponent(playerId)}&mode=${mode}&dataMode=${props.dataMode}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as ArsenalResponse;
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load pitcher arsenal");
      }
      setData(json.data ?? null);
      setMeta(json.meta ?? null);
      setError(json.error ?? null);
    } catch (loadError) {
      setError(String(loadError));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [props.mode, props.dataMode]);

  useEffect(() => {
    if (!activePlayerId) {
      return;
    }
    void load(activePlayerId);
  }, [activePlayerId, load, props.refreshTick]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = inputPlayerId.trim();
    setActivePlayerId(normalized);
    await props.onPersist({ config: { ...props.config, playerId: normalized } });
    if (normalized) {
      await load(normalized);
    }
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
          value={inputPlayerId}
          onChange={(event) => setInputPlayerId(event.target.value)}
          placeholder="MLB playerId (example: 669203)"
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

      {meta?.warning ? <p className="text-amber-300">{meta.warning}</p> : null}
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
