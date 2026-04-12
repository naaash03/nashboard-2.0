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
  const diagnosticsEnabled = props.mode === "ADVANCED";
  const scheduleWindowLabel = data?.schedule
    ? `${data.schedule.windowStart ?? "-"} to ${data.schedule.windowEnd ?? "-"}`
    : "-";

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-medium">Data Health</p>
        {data ? (
          <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${
            data.hydrationOccurred
              ? "border-amber-600 bg-amber-950 text-amber-300"
              : "border-emerald-700 bg-emerald-950 text-emerald-400"
          }`}>
            {data.hydrationOccurred ? "FALLBACK" : "PRIMARY"}
          </span>
        ) : null}
      </div>

      {data ? (
        <>
          <div className="space-y-1.5 rounded border border-neutral-800 bg-neutral-950 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Mode</span>
              <span className="font-medium text-neutral-100">{effectiveMode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Source</span>
              <span className="font-medium text-neutral-100">{effectiveSource}</span>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-800 pt-1.5">
              <span className="text-neutral-400">Cache</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                cacheState === "hit"
                  ? "bg-emerald-950 text-emerald-400"
                  : cacheState === "miss"
                    ? "bg-neutral-800 text-neutral-400"
                    : "bg-neutral-800 text-neutral-500"
              }`}>
                {cacheState === "hit" ? "HIT" : cacheState === "miss" ? "MISS" : "N/A"}
                {data.cache?.lastCacheAgeSeconds != null
                  ? ` · ${Math.max(0, Number(data.cache.lastCacheAgeSeconds))}s`
                  : ""}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Fallback</span>
              <span className={`text-[10px] ${data.hydrationOccurred ? "text-amber-300" : "text-neutral-400"}`}>
                {fallbackState}
              </span>
            </div>
            {data.schedule ? (
              <div className="flex items-center justify-between border-t border-neutral-800 pt-1.5">
                <span className="text-neutral-400">Window</span>
                <span className="text-neutral-300">{scheduleWindowLabel}</span>
              </div>
            ) : null}
          </div>

          {!diagnosticsEnabled ? (
            <p className="text-[10px] text-neutral-500">Switch to Advanced mode for diagnostics and provider probes.</p>
          ) : null}

          {diagnosticsEnabled ? (
            <>
              <button
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
                type="button"
                onClick={() => void load(true)}
              >
                Probe providers now
              </button>

              <details className="rounded border border-neutral-700 bg-black/20 p-2">
                <summary className="cursor-pointer text-[11px] text-neutral-300">Provider status</summary>
                <div className="mt-2 space-y-1.5 text-neutral-400">
                  <div className="flex justify-between gap-2">
                    <span>Preference mode</span><span>{props.preferenceDataMode}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Query mode</span><span>{data.queryDataMode ?? "-"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Resolver source</span><span>{data.resolutionSource ?? props.dataModeSource}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-neutral-800 pt-1.5">
                    <span>DB</span>
                    <span className={data.status?.db === "ok" ? "text-emerald-400" : ""}>{data.status?.db ?? "-"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>API-Sports</span>
                    <span className={data.status?.apiSports === "ok" ? "text-emerald-400" : data.status?.apiSports === "error" ? "text-red-400" : ""}>{data.status?.apiSports ?? "empty"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>ESPN</span>
                    <span className={data.status?.espn === "ok" ? "text-emerald-400" : data.status?.espn === "error" ? "text-red-400" : ""}>{data.status?.espn ?? "empty"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Fixture</span><span>{data.status?.fixture ?? "-"}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-neutral-800 pt-1.5">
                    <span>Schedule strategy</span><span>{data.schedule?.strategy ?? "-"}</span>
                  </div>
                  {data.schedule?.note ? <p className="text-neutral-500">{data.schedule.note}</p> : null}
                </div>
              </details>

              {data.hydrationNotes && data.hydrationNotes.length > 0 ? (
                <details className="rounded border border-neutral-700 bg-black/20 p-2">
                  <summary className="cursor-pointer text-[11px] text-neutral-300">
                    Hydration notes ({data.hydrationNotes.length})
                  </summary>
                  <ul className="mt-1.5 space-y-1 text-neutral-400">
                    {data.hydrationNotes.map((note, index) => (
                      <li key={`${index}-${note}`} className="flex gap-1.5"><span className="shrink-0 text-neutral-600">–</span>{note}</li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <details className="rounded border border-neutral-700 bg-black/20 p-2">
                <summary className="cursor-pointer text-[11px] text-neutral-300">Endpoint diagnostics</summary>
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] text-neutral-400">API-Sports</p>
                  <pre className="max-h-48 overflow-auto text-[10px]">{JSON.stringify(data.endpoints?.apiSports ?? {}, null, 2)}</pre>
                  <p className="text-[11px] text-neutral-400">ESPN</p>
                  <pre className="max-h-48 overflow-auto text-[10px]">{JSON.stringify(data.endpoints?.espn ?? {}, null, 2)}</pre>
                </div>
              </details>
            </>
          ) : null}
        </>
      ) : (
        <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
          <p className="text-neutral-400">Unable to load data health.</p>
        </div>
      )}
      {lastError ? <p className="text-amber-300">{lastError}</p> : null}
      <button className="text-[10px] text-neutral-400 underline" type="button" onClick={() => props.onReportBug({ widgetId: props.widgetId, data, lastError })}>Report a bug</button>
    </div>
  );
}
