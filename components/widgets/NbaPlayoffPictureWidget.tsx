"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type SeedRow = {
  rank: number;
  seedLabel: "Playoffs" | "Play-In" | "Lottery";
  team: string;
  key: string;
  wins: number;
  losses: number;
  pct: number;
};

type PlayoffPicture = {
  east: SeedRow[];
  west: SeedRow[];
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function seedClasses(label: SeedRow["seedLabel"]): string {
  if (label === "Playoffs") return "text-emerald-400";
  if (label === "Play-In") return "text-amber-400";
  return "text-neutral-500";
}

function Conference({ title, rows, advanced }: { title: string; rows: SeedRow[]; advanced: boolean }) {
  const visible = advanced ? rows : rows.slice(0, 10);
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase text-neutral-400">{title}</p>
      {visible.map((row) => (
        <div key={row.key} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 py-1">
          <span className={`font-bold ${seedClasses(row.seedLabel)}`}>{row.rank}</span>
          <span className="text-neutral-200">{row.team}</span>
          <span className="text-neutral-500">{row.wins}-{row.losses}</span>
        </div>
      ))}
      {rows[0] && (
        <p className="text-[10px] text-neutral-500">
          <span className="text-emerald-400">1–6 Playoffs</span> · <span className="text-amber-400">7–10 Play-In</span>
        </p>
      )}
    </div>
  );
}

export default function NbaPlayoffPictureWidget(props: WidgetCommonProps) {
  const [data, setData] = useState<PlayoffPicture | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const advanced = props.mode === "ADVANCED";

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/widgets/nba-playoff-picture?dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`, { cache: "no-store" });
    const json = (await res.json()) as { data?: PlayoffPicture | null; meta?: WidgetMeta; error?: string };
    setLoading(false);
    if (!res.ok) throw new Error(json.error ?? "Failed to load NBA playoff picture");
    return { data: json.data ?? null, meta: json.meta ?? null };
  }, [props.dataMode, props.refreshTick]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await load();
        if (cancelled) return;
        setData(result.data);
        setMeta(result.meta);
        setWarning(result.meta?.warning ?? null);
      } catch (error) {
        if (cancelled) return;
        setData(null);
        setWarning(String(error));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [load, props.refreshTick]);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">NBA Playoff Picture</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={props.mode}
          onChange={(e) => void props.onPersist({ mode: e.target.value as "BEGINNER" | "ADVANCED" })}
          disabled={props.locked}
        >
          <option value="BEGINNER">Beginner</option>
          <option value="ADVANCED">Advanced</option>
        </select>
      </div>

      {loading && <p className="text-neutral-400">Loading playoff picture...</p>}
      {warning && <p className="text-amber-300">{warning}</p>}

      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Conference title="East" rows={data.east} advanced={advanced} />
          <Conference title="West" rows={data.west} advanced={advanced} />
        </div>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>
      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, warning })}
      >
        Report a bug
      </button>
    </div>
  );
}
