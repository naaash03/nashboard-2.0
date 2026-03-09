"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps } from "@/components/widgets/types";

type EndpointHealth = {
  endpoint: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;
  lastStatus?: number;
  cacheHit?: boolean;
  cacheAgeSeconds?: number;
  lastSourceUsed?: string;
  lastUrl?: string;
};

type ProviderStatus = "ok" | "error" | "timeout" | "blocked" | "empty";

type DataHealth = {
  resolvedDataMode?: string;
  resolutionSource?: string;
  effectiveDataMode?: string;
  effectiveSource?: string;
  hydrationOccurred?: boolean;
  hydrationNotes?: string[];
  queryDataMode?: string | null;
  preferenceDataMode?: string | null;
  fallbackDataMode?: string;
  status?: {
    db?: string;
    apiSports?: ProviderStatus;
    espn?: ProviderStatus;
    fixture?: string;
  };
  cache?: { hit?: boolean; miss?: boolean; lastCacheAgeSeconds?: number | null };
  schedule?: {
    timezone?: string;
    today?: string;
    windowStart?: string;
    windowEnd?: string;
    lookbackDays?: number;
    lookaheadDays?: number;
    strategy?: string;
    note?: string;
  };
  endpoints?: {
    apiSports?: Record<string, EndpointHealth>;
    espn?: Record<string, EndpointHealth>;
  };
  lastFetchTimestamps?: Record<string, Record<string, { fetchedAt: string; ageSeconds: number; sourceUsed: string; warning?: string }>>;
};

export default function DataHealthWidget(props: WidgetCommonProps) {
  const [data, setData] = useState<DataHealth | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const load = useCallback(async (probe = false) => {
    const params = new URLSearchParams();
    params.set("dataMode", props.dataMode);
    params.set("preferenceMode", props.preferenceDataMode);
    if (probe) {
      params.set("probe", "1");
    }
    params.set("cacheBust", String(props.refreshTick));
    const res = await fetch(`/api/health/data?${params.toString()}`, { cache: "no-store" });
    const json = (await res.json()) as DataHealth;
    setData(json);
  }, [props.dataMode, props.preferenceDataMode, props.refreshTick]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const params = new URLSearchParams();
        params.set("dataMode", props.dataMode);
        params.set("preferenceMode", props.preferenceDataMode);
        params.set("cacheBust", String(props.refreshTick));
        const res = await fetch(`/api/health/data?${params.toString()}`, { cache: "no-store" });
        const json = (await res.json()) as DataHealth;
        if (!cancelled) {
          setData(json);
          setLastError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLastError(String(error));
          setData(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.dataMode, props.preferenceDataMode, props.refreshTick]);

  const effectiveMode = data?.effectiveDataMode ?? data?.resolvedDataMode ?? props.dataMode;
  const effectiveSource = (data?.effectiveSource ?? "unknown").toUpperCase();
  const cacheState = data?.cache?.hit ? "hit" : (data?.cache?.miss ? "miss" : "n/a");
  const fallbackState = data?.hydrationOccurred ? "Fallback/enrichment used" : "Primary source response";
  const scheduleWindowLabel = data?.schedule
    ? `${data.schedule.windowStart ?? "-"} to ${data.schedule.windowEnd ?? "-"}`
    : "-";

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-medium">Data Health</p>
      </div>

      {data ? (
        <>
          <div className="space-y-1 rounded border border-neutral-700 bg-neutral-950 p-2">
            <p>Effective mode: {effectiveMode}</p>
            <p>Effective source: {effectiveSource}</p>
            <p>Fallback state: {fallbackState}</p>
            <p>Cache state: {cacheState}</p>
            <p>Last cache age: {Math.max(0, Number(data.cache?.lastCacheAgeSeconds ?? 0))}s</p>
            <p>Schedule timezone: {data.schedule?.timezone ?? "-"}</p>
            <p>Schedule window: {scheduleWindowLabel}</p>
          </div>

          <button className="rounded border border-neutral-700 px-2 py-1" type="button" onClick={() => void load(true)}>Probe providers now</button>

          <details className="rounded border border-neutral-700 bg-black/20 p-2">
            <summary className="cursor-pointer text-[11px] text-neutral-300">Provider status</summary>
            <div className="mt-1 space-y-1 text-neutral-400">
              <p>Preference mode: {props.preferenceDataMode}</p>
              <p>Query mode: {data.queryDataMode ?? "-"}</p>
              <p>Resolver source: {data.resolutionSource ?? props.dataModeSource}</p>
              <p>DB status: {data.status?.db}</p>
              <p>API-Sports status: {data.status?.apiSports ?? "empty"}</p>
              <p>ESPN status: {data.status?.espn ?? "empty"}</p>
              <p>Fixture status: {data.status?.fixture}</p>
              <p>Schedule strategy: {data.schedule?.strategy ?? "-"}</p>
              {data.schedule?.note ? <p>{data.schedule.note}</p> : null}
            </div>
          </details>

          {data.hydrationNotes && data.hydrationNotes.length > 0 ? (
            <details className="rounded border border-neutral-700 bg-black/20 p-2">
              <summary className="cursor-pointer text-[11px] text-neutral-300">Hydration notes</summary>
              <ul className="mt-1 space-y-1 text-neutral-400">
                {data.hydrationNotes.map((note, index) => (
                  <li key={`${index}-${note}`}>- {note}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <details className="rounded border border-neutral-700 bg-black/20 p-2">
            <summary className="cursor-pointer text-[11px] text-neutral-300">Endpoint diagnostics</summary>
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-neutral-300">API-Sports</p>
              <pre className="max-h-48 overflow-auto text-[10px]">{JSON.stringify(data.endpoints?.apiSports ?? {}, null, 2)}</pre>
              <p className="text-[11px] text-neutral-300">ESPN</p>
              <pre className="max-h-48 overflow-auto text-[10px]">{JSON.stringify(data.endpoints?.espn ?? {}, null, 2)}</pre>
            </div>
          </details>
        </>
      ) : (
        <p>Unable to load data health.</p>
      )}
      {lastError ? <p className="text-amber-300">{lastError}</p> : null}
      <button className="text-[10px] text-neutral-400 underline" type="button" onClick={() => props.onReportBug({ widgetId: props.widgetId, data, lastError })}>Report a bug</button>
    </div>
  );
}
