"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

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

export default function NbaTonightsSlateWidget(props: WidgetCommonProps) {
  const [data, setData] = useState<NbaSlateResponse["data"] | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  const load = useCallback(async () => {
    const mode = props.mode.toLowerCase();
    const url = `/api/widgets/nba-tonights-slate?mode=${mode}&dataMode=${props.dataMode}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as NbaSlateResponse;
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load NBA slate");
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
    void load();
  }, [load, props.refreshTick]);

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

      {loading ? <p className="text-neutral-300">Loading NBA slate...</p> : null}
      {error ? <p className="text-amber-300">{error}</p> : null}
      {data?.userFacingMessage ? <p className="text-neutral-300">{data.userFacingMessage}</p> : null}

      {(data?.games ?? []).map((game) => (
        <div key={game.id} className="rounded border border-neutral-700 bg-neutral-950 p-2">
          <p className="font-medium">{game.matchup ?? `${game.awayTeam} at ${game.homeTeam}`}</p>
          <p>{to12h(game.date)} - {game.gameType ?? "regular"} - {game.broadcaster ?? "TBD"}</p>
          {game.records ? <p>{game.records}</p> : null}
          <p className="text-neutral-400">{game.status}</p>
        </div>
      ))}

      {!loading && !error && (data?.games?.length ?? 0) === 0 ? (
        <p className="text-neutral-400">No games returned for this slate.</p>
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
        })}
      >
        Report a bug
      </button>
    </div>
  );
}
