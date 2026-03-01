"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type StandingRow = {
  rank: number;
  team: string;
  wins: number;
  losses: number;
  pct: string;
  key?: string;
};

type StandingsResponse = {
  data?: {
    east: StandingRow[];
    west: StandingRow[];
  };
  meta?: WidgetMeta;
  error?: string | null;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function ConferenceTable({
  title,
  rows,
  showTeamKey,
}: {
  title: string;
  rows: StandingRow[];
  showTeamKey: boolean;
}) {
  return (
    <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
      <p className="mb-1 font-medium">{title}</p>
      {rows.length === 0 ? <p className="text-neutral-400">No rows.</p> : null}
      {rows.map((row) => (
        <div key={`${title}-${row.rank}-${row.team}`} className="flex items-center justify-between border-b border-neutral-800 py-1 last:border-b-0">
          <span>
            {row.rank}. {row.team}
            {showTeamKey && row.key ? ` (${row.key})` : ""}
          </span>
          <span>{row.wins}-{row.losses} ({row.pct})</span>
        </div>
      ))}
    </div>
  );
}

export default function NbaStandingsWidget(props: WidgetCommonProps) {
  const [data, setData] = useState<StandingsResponse["data"] | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  const load = useCallback(async () => {
    const mode = props.mode.toLowerCase();
    const url = `/api/widgets/nba-standings?mode=${mode}&dataMode=${props.dataMode}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as StandingsResponse;
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load NBA standings");
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
        <span className="font-medium">NBA Standings Snapshot</span>
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

      {loading ? <p className="text-neutral-300">Loading standings...</p> : null}
      {error ? <p className="text-amber-300">{error}</p> : null}

      {data ? (
        <div className="space-y-2">
          <ConferenceTable title="East" rows={data.east} showTeamKey={props.mode === "ADVANCED"} />
          <ConferenceTable title="West" rows={data.west} showTeamKey={props.mode === "ADVANCED"} />
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
        })}
      >
        Report a bug
      </button>
    </div>
  );
}
