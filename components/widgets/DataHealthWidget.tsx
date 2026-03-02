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
  providerMode?: string;
  status?: { db?: string; espn?: string; fixture?: string };
  cache?: { hit?: boolean; miss?: boolean; lastCacheAgeSeconds?: number | null };
  endpoints?: Record<string, EndpointHealth>;
  lastFetchTimestamps?: Record<string, { fetchedAt: string; ageSeconds: number; sourceUsed: string; warning?: string }>;
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

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-medium">Data Health</p>
      </div>

      {data ? (
        <>
          <p>Preference mode: {props.preferenceDataMode}</p>
          <p>Effective mode: {data.effectiveDataMode ?? data.resolvedDataMode ?? props.dataMode}</p>
          <p>Effective source: {data.effectiveSource ?? data.resolutionSource ?? props.dataModeSource}</p>
          <p>Hydration used: {data.hydrationOccurred ? "yes" : "no"}</p>
          <p>Query mode: {data.queryDataMode ?? "-"}</p>
          <p>Preference mode (resolver): {data.preferenceDataMode ?? "-"}</p>
          <p>Fallback mode: {data.fallbackDataMode ?? "auto"}</p>
          <p>Provider mode: {data.providerMode}</p>
          <p>DB status: {data.status?.db}</p>
          <p>ESPN status: {data.status?.espn}</p>
          <p>Fixture status: {data.status?.fixture}</p>
          <p>Cache hit: {String(data.cache?.hit)} · miss: {String(data.cache?.miss)}</p>
          <p>Last cache age: {Math.max(0, Number(data.cache?.lastCacheAgeSeconds ?? 0))}s</p>

          <button className="rounded border border-neutral-700 px-2 py-1" type="button" onClick={() => void load(true)}>Test ESPN now</button>

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
            <pre className="overflow-auto text-[10px]">{JSON.stringify(data.endpoints ?? {}, null, 2)}</pre>
          </details>
        </>
      ) : (
        <p>Unable to load data health.</p>
      )}
      {lastError ? <p className="text-amber-300">{lastError}</p> : null}
      <button className="text-[10px] underline text-neutral-400" type="button" onClick={() => props.onReportBug({ widgetId: props.widgetId, data, lastError })}>Report a bug</button>
    </div>
  );
}
