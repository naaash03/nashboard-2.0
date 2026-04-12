"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type SlateItem = {
  id: string;
  date: string;
  matchup?: string;
  awayTeam?: string;
  homeTeam?: string;
  awayRecord?: string;
  homeRecord?: string;
  status: string;
  gameType?: string;
  broadcaster?: string;
  records?: string;
};

type NbaSlateResponse = {
  data?: {
    dateUsed: string;
    games: SlateItem[];
    userFacingMessage: string;
  };
  meta?: WidgetMeta;
  error?: string | null;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function toShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const isLive =
    lower.includes("progress") ||
    lower.includes("halftime") ||
    lower.includes("quarter") ||
    lower.includes(" ot");
  const isFinal = lower.includes("final") || lower.includes("end of");
  const label = isLive ? status : isFinal ? "FINAL" : "UPCOMING";
  const cls = isLive
    ? "border-emerald-700 bg-emerald-950 text-emerald-400"
    : isFinal
      ? "border-neutral-600 bg-neutral-800 text-neutral-400"
      : "border-blue-700 bg-blue-950 text-blue-300";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${cls}`}>
      {label}
    </span>
  );
}

export default function NbaTonightsSlateWidget(props: WidgetCommonProps) {
  const [data, setData] = useState<NbaSlateResponse["data"] | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const advanced = props.mode === "ADVANCED";

  const load = useCallback(async () => {
    const mode = props.mode.toLowerCase();
    const url = `/api/widgets/nba-tonights-slate?mode=${mode}&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
    setEndpoint(url);
    setLoading(true);
    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as NbaSlateResponse;
      if (!response.ok) throw new Error(json.error ?? "Failed to load NBA slate");
      setData(json.data ?? null);
      setMeta(json.meta ?? null);
      setError(json.error ?? null);
    } catch (loadError) {
      setError(String(loadError));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [props.dataMode, props.mode, props.refreshTick]);

  useEffect(() => {
    void load();
  }, [load, props.refreshTick]);

  const games = data?.games ?? [];

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">NBA Tonight&apos;s Slate</span>
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

      {!advanced && games.length > 0 ? (
        <p className="text-neutral-500">
          Today&apos;s NBA games. Each card shows tip-off time, team records, and TV coverage.
        </p>
      ) : null}

      {loading ? <p className="text-neutral-400">Loading NBA slate...</p> : null}
      {error ? <p className="text-amber-300">{error}</p> : null}

      {games.map((game) => {
        const matchupLabel =
          game.matchup ??
          (game.awayTeam && game.homeTeam ? `${game.awayTeam} at ${game.homeTeam}` : "Game");

        return (
          <div key={game.id} className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-tight">{matchupLabel}</p>
              <p className="shrink-0 text-[11px] text-neutral-400">{toShortDate(game.date)}</p>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={game.status} />
              {game.gameType === "postseason" ? (
                <span className="rounded border border-amber-600 bg-amber-950 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                  PLAYOFFS
                </span>
              ) : null}
            </div>

            <div className="mt-2 space-y-1 border-t border-neutral-800 pt-2">
              {advanced ? (
                <>
                  {game.awayTeam ? (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-300">{game.awayTeam}</span>
                      <span className="text-neutral-500">
                        {game.awayRecord ?? "-"}{" "}
                        <span className="text-neutral-700">Away</span>
                      </span>
                    </div>
                  ) : null}
                  {game.homeTeam ? (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-300">{game.homeTeam}</span>
                      <span className="text-neutral-500">
                        {game.homeRecord ?? "-"}{" "}
                        <span className="text-neutral-700">Home</span>
                      </span>
                    </div>
                  ) : null}
                  <div className="border-t border-neutral-800 pt-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Tip-off</span>
                      <span className="text-neutral-300">{to12h(game.date)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">TV</span>
                      <span className="text-neutral-300">{game.broadcaster ?? "TBD"}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {game.records ? (
                    <p className="text-neutral-400">{game.records}</p>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Tip-off</span>
                    <span className="text-neutral-300">{to12h(game.date)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">TV</span>
                    <span className="text-neutral-300">{game.broadcaster ?? "TBD"}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

      {!loading && !error && games.length === 0 ? (
        <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
          <p className="text-neutral-400">No NBA games scheduled today.</p>
        </div>
      ) : null}

      {meta?.warning ? <p className="text-amber-300">{meta.warning}</p> : null}
      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() =>
          props.onReportBug({
            widgetId: props.widgetId,
            endpoint,
            meta,
            warnings: meta?.warning,
            endpointUrl: meta?.endpointUrl,
          })
        }
      >
        Report a bug
      </button>
    </div>
  );
}
