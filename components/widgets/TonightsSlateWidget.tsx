"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type SlateState = "today" | "next_slate" | "schedule_not_posted";

type SlateItem = {
  id: string;
  date: string;
  matchup?: string;
  awayTeam?: string;
  homeTeam?: string;
  status: string;
  gameType?: string;
  broadcaster?: string;
  records?: string;
  whyItMatters?: string;
  learnMore?: string;
};

type SlateResponse = {
  error?: string;
  data?: {
    state: SlateState;
    dateUsed: string;
    nextDate?: string | null;
    games: SlateItem[];
    historical?: { date: string; games: SlateItem[] } | null;
    userFacingMessage: string;
  };
  meta?: WidgetMeta;
  diagnostics?: {
    endpointUrl?: string | null;
    upstreamStatus?: number | null;
    upstreamMessage?: string | null;
    lastErrorMessage?: string | null;
    provider?: string;
    requestId?: string;
    dataMode?: string;
  };
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time TBD";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function TonightsSlateWidget(props: WidgetCommonProps) {
  const [items, setItems] = useState<SlateItem[]>([]);
  const [state, setState] = useState<SlateState>("today");
  const [dateUsed, setDateUsed] = useState<string>(new Date().toISOString().slice(0, 10));
  const [nextDate, setNextDate] = useState<string | null>(null);
  const [historical, setHistorical] = useState<{ date: string; games: SlateItem[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [diagnostics, setDiagnostics] = useState<SlateResponse["diagnostics"] | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<SlateResponse> => {
    const mode = props.mode.toLowerCase();
    const endpointUrl = `/api/widgets/tonights-slate?sport=NFL&mode=${mode}&dataMode=${props.dataMode}`;
    setEndpoint(endpointUrl);
    const res = await fetch(endpointUrl, { cache: "no-store" });
    const json = (await res.json()) as SlateResponse;
    if (!res.ok && !json.data) {
      throw new Error(json.error ?? "Failed to load slate");
    }
    return json;
  }, [props.mode, props.dataMode]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await load();
        if (cancelled) return;
        setItems(result.data?.games ?? []);
        setState(result.data?.state ?? "schedule_not_posted");
        setDateUsed(result.data?.dateUsed ?? new Date().toISOString().slice(0, 10));
        setNextDate(result.data?.nextDate ?? null);
        setHistorical(result.data?.historical ?? null);
        setMessage(result.data?.userFacingMessage ?? result.error ?? null);
        setMeta(result.meta ?? null);
        setDiagnostics(result.diagnostics ?? null);
        setLastError(result.error ?? null);
      } catch (error) {
        if (!cancelled) {
          const nextError = String(error);
          setMessage(nextError);
          setLastError(nextError);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load, props.refreshTick]);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Tonight&apos;s Slate</span>
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

      {message ? <p className="text-amber-300">{message}</p> : null}
      {state === "next_slate" && nextDate ? (
        <p className="text-neutral-300">Next slate date: {nextDate}</p>
      ) : null}
      {state === "schedule_not_posted" && historical?.date ? (
        <p className="text-neutral-300">Most recent slate date: {historical.date}</p>
      ) : null}

      {items.length === 0 && state !== "schedule_not_posted" ? <p className="text-neutral-300">No games scheduled on {dateUsed}.</p> : null}

      {items.map((game) => (
        <div key={game.id} className="rounded border border-neutral-700 bg-neutral-950 p-2">
          <p className="font-medium">{game.matchup ?? `${game.awayTeam} at ${game.homeTeam}`}</p>
          <p>{to12h(game.date)} · {game.gameType ?? "unknown"} · {game.broadcaster ?? "TBD"}</p>
          {game.records ? <p>{game.records}</p> : null}
          <p className="text-neutral-400">{game.status}</p>
          <p className="text-neutral-400">{game.whyItMatters}</p>
          {props.mode === "ADVANCED" && game.learnMore ? (
            <a className="text-blue-300 underline" href={game.learnMore} target="_blank" rel="noreferrer">Learn more</a>
          ) : null}
        </div>
      ))}

      {state === "schedule_not_posted" && historical ? (
        <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
          <p className="font-medium">Historical context</p>
          <p className="text-neutral-400">{historical.date}</p>
          <p>{historical.games.length} game(s) found.</p>
        </div>
      ) : null}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>

      <details className="rounded border border-neutral-700 bg-black/20 p-2">
        <summary className="cursor-pointer text-[11px] text-neutral-300">Debug</summary>
        <p>Endpoint: {endpoint}</p>
        <p>Provider: {diagnostics?.provider ?? "-"}</p>
        <p>Upstream status: {diagnostics?.upstreamStatus ?? "-"}</p>
        <p>Upstream message: {diagnostics?.upstreamMessage ?? "-"}</p>
        <p>Last error: {diagnostics?.lastErrorMessage ?? lastError ?? "none"}</p>
        <p>Request ID: {diagnostics?.requestId ?? meta?.requestId ?? "-"}</p>
        <p>Data mode: {diagnostics?.dataMode ?? meta?.sourceUsed ?? "-"}</p>
        <pre className="overflow-auto text-[10px]">{JSON.stringify({ meta, diagnostics }, null, 2)}</pre>
      </details>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, diagnostics, state, message, endpoint, lastError })}
      >
        Report a bug
      </button>
    </div>
  );
}
