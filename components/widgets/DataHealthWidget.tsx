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
  queryDataMode?: string | null;
  cookieDataMode?: string | null;
  envDefaultMode?: string;
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
    const res = await fetch(`/api/health/data?dataMode=${props.dataMode}${probe ? "&probe=1" : ""}`, { cache: "no-store" });
    const json = (await res.json()) as DataHealth;
    setData(json);
  }, [props.dataMode]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/health/data?dataMode=${props.dataMode}`, { cache: "no-store" });
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
  }, [props.refreshTick, props.dataMode]);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-medium">Data Health</p>
        <label className="flex items-center gap-2">
          <span>Dev Fixture Data</span>
          <input
            type="checkbox"
            checked={props.dataMode === "fixture"}
            onChange={(event) => void props.onDataModeChange(event.target.checked ? "fixture" : "live")}
          />
        </label>
      </div>

      {data ? (
        <>
          <p>Resolved mode: {data.resolvedDataMode}</p>
          <p>Query mode: {data.queryDataMode ?? "-"}</p>
          <p>Cookie mode: {data.cookieDataMode ?? "-"}</p>
          <p>Env default mode: {data.envDefaultMode}</p>
          <p>Provider mode: {data.providerMode}</p>
          <p>DB status: {data.status?.db}</p>
          <p>ESPN status: {data.status?.espn}</p>
          <p>Fixture status: {data.status?.fixture}</p>
          <p>Cache hit: {String(data.cache?.hit)} · miss: {String(data.cache?.miss)}</p>
          <p>Last cache age: {Math.max(0, Number(data.cache?.lastCacheAgeSeconds ?? 0))}s</p>

          <button className="rounded border border-neutral-700 px-2 py-1" type="button" onClick={() => void load(true)}>Test ESPN now</button>

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
