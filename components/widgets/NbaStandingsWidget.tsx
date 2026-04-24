"use client";

import { useCallback, useEffect, useState } from "react";
import StatLabel from "@/components/stats/StatLabel";
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

// NBA: top 6 per conference = playoffs, ranks 7-10 = play-in
const PLAYOFF_CUTOFF = 6;

function ConferenceTable({
  title,
  rows,
  mode,
}: {
  title: string;
  rows: StandingRow[];
  mode: "BEGINNER" | "ADVANCED";
}) {
  const advanced = mode === "ADVANCED";

  return (
    <div>
      <p className="mb-1.5 text-[10px] uppercase tracking-wide text-neutral-500">{title}</p>
      <div className="rounded border border-neutral-800 bg-neutral-950">
        {rows.length === 0 ? (
          <p className="p-2.5 text-neutral-400">No standings data.</p>
        ) : (
          rows.map((row, index) => (
            <div key={`${title}-${row.rank}-${row.team}`}>
              {advanced && row.rank === PLAYOFF_CUTOFF + 1 ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1">
                  <div className="h-px flex-1 bg-neutral-800" />
                  <span className="text-[9px] uppercase tracking-wider text-neutral-600">
                    Play-In
                  </span>
                  <div className="h-px flex-1 bg-neutral-800" />
                </div>
              ) : null}
              <div
                className={`flex items-center justify-between px-2.5 py-1.5 ${
                  index < rows.length - 1 ? "border-b border-neutral-800/60" : ""
                }`}
              >
                <span className="text-neutral-300">
                  <span className="mr-1.5 tabular-nums text-neutral-600">{row.rank}.</span>
                  {row.team}
                  {advanced && row.key ? (
                    <span className="ml-1.5 text-[10px] text-neutral-600">{row.key}</span>
                  ) : null}
                </span>
                <span className="text-neutral-400">
                  <StatLabel label={`${row.wins}-${row.losses}`} statKey="w_l_record" sport="NBA" mode={mode} />
                  {advanced ? (
                    <StatLabel label={row.pct} statKey="win_pct" sport="NBA" mode={mode} className="ml-1.5 text-[10px] text-neutral-600" />
                  ) : null}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function NbaStandingsWidget(props: WidgetCommonProps) {
  const [data, setData] = useState<StandingsResponse["data"] | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const advanced = props.mode === "ADVANCED";

  const load = useCallback(async () => {
    const mode = props.mode.toLowerCase();
    const url = `/api/widgets/nba-standings?mode=${mode}&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
    setEndpoint(url);
    setLoading(true);
    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as StandingsResponse;
      if (!response.ok) throw new Error(json.error ?? "Failed to load NBA standings");
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

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">NBA Standings</span>
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

      {!advanced && data ? (
        <p className="text-neutral-500">
          Top 5 teams per conference. The top 6 in each make the playoffs.
        </p>
      ) : null}

      {loading ? <p className="text-neutral-400">Loading standings...</p> : null}
      {error ? <p className="text-amber-300">{error}</p> : null}

      {data ? (
        <div className="space-y-3">
          <ConferenceTable title="Eastern Conference" rows={data.east} mode={props.mode} />
          <ConferenceTable title="Western Conference" rows={data.west} mode={props.mode} />
        </div>
      ) : null}

      {meta?.warning ? <p className="text-amber-300">{meta.warning}</p> : null}
      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} - Source{" "}
        {meta ? meta.sourceUsed.toUpperCase() : "-"}
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
