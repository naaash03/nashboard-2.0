"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type FormPeriod = {
  days: number;
  wins: number;
  losses: number;
  runsScored: number;
  runsAllowed: number;
  runDiff: number;
  winPct: number;
};

type RecentForm = {
  teamKey: string;
  teamName: string;
  rating: "hot" | "warm" | "cool" | "cold";
  ratingScore: number;
  weightedWinPct: number;
  last7: FormPeriod;
  last14: FormPeriod;
  last30: FormPeriod;
  explanation: string;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function RatingBadge({ rating }: { rating: RecentForm["rating"] }) {
  const styles = {
    hot: "border-red-500 bg-red-950 text-red-300",
    warm: "border-orange-500 bg-orange-950 text-orange-300",
    cool: "border-blue-500 bg-blue-950 text-blue-300",
    cold: "border-cyan-700 bg-cyan-950 text-cyan-300",
  };
  const labels = { hot: "HOT", warm: "WARM", cool: "COOL", cold: "COLD" };
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${styles[rating]}`}>
      {labels[rating]}
    </span>
  );
}

function trendArrow(period7WinPct: number, period30WinPct: number): string {
  const diff = period7WinPct - period30WinPct;
  if (diff > 0.05) return "↑";
  if (diff < -0.05) return "↓";
  return "→";
}

export default function MlbRecentFormWidget(props: WidgetCommonProps) {
  const [teamKey, setTeamKey] = useState<string>((props.config.teamKey as string) ?? "");
  const [data, setData] = useState<RecentForm | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(
    async (key: string) => {
      const res = await fetch(
        `/api/widgets/mlb-recent-form?teamKey=${encodeURIComponent(key)}&dataMode=${props.dataMode}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        data?: RecentForm | null;
        meta?: WidgetMeta;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load form data");
      return { data: json.data ?? null, meta: json.meta ?? null };
    },
    [props.dataMode],
  );

  useEffect(() => {
    if (!teamKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await load(teamKey);
        if (!cancelled) {
          setData(result.data);
          setMeta(result.meta);
          setWarning(null);
        }
      } catch (error) {
        if (!cancelled) setWarning(String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamKey, load, props.refreshTick]);

  async function applyTeam() {
    await props.onPersist({ config: { ...props.config, teamKey } });
  }

  const advanced = props.mode === "ADVANCED";

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Recent Form</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={props.mode}
          onChange={(e) =>
            void props.onPersist({ mode: e.target.value as "BEGINNER" | "ADVANCED" })
          }
          disabled={props.locked}
        >
          <option value="BEGINNER">Beginner</option>
          <option value="ADVANCED">Advanced</option>
        </select>
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          placeholder="Team (e.g. NYM)"
          value={teamKey}
          onChange={(e) => setTeamKey(e.target.value.toUpperCase())}
        />
        <button
          className="rounded border border-neutral-700 px-2 py-1"
          type="button"
          onClick={() => void applyTeam()}
          disabled={props.locked}
        >
          Set
        </button>
      </div>

      {!teamKey && <p className="text-neutral-400">Enter a team abbreviation to start.</p>}
      {warning && <p className="text-amber-300">{warning}</p>}

      {data && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{data.teamName}</span>
            <RatingBadge rating={data.rating} />
          </div>

          <p className="text-neutral-300">{data.explanation}</p>

          {/* Beginner: last 7 W-L */}
          {!advanced && (
            <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
              <p className="text-neutral-500 text-[10px] uppercase mb-1">Last 7 Days</p>
              <p className="font-medium">
                {data.last7.wins}W - {data.last7.losses}L
              </p>
              <p className="text-neutral-400">
                Run Diff: {data.last7.runDiff >= 0 ? "+" : ""}{data.last7.runDiff}
              </p>
            </div>
          )}

          {/* Advanced: all three periods */}
          {advanced && (
            <div className="space-y-1">
              <div className="grid grid-cols-5 gap-1 text-[10px] text-neutral-500">
                <span>Period</span>
                <span className="text-right">W-L</span>
                <span className="text-right">R-Diff</span>
                <span className="text-right">Win%</span>
                <span className="text-right">Trend</span>
              </div>
              {[data.last7, data.last14, data.last30].map((p) => (
                <div
                  key={p.days}
                  className="grid grid-cols-5 gap-1 rounded border border-neutral-800 bg-neutral-950 p-1.5"
                >
                  <span className="text-neutral-400">L{p.days}</span>
                  <span className="text-right">
                    {p.wins}-{p.losses}
                  </span>
                  <span className={`text-right ${p.runDiff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {p.runDiff >= 0 ? "+" : ""}{p.runDiff}
                  </span>
                  <span className="text-right text-neutral-300">
                    {(p.winPct * 100).toFixed(1)}%
                  </span>
                  <span className="text-right">
                    {p.days === 7 ? trendArrow(data.last7.winPct, data.last30.winPct) : ""}
                  </span>
                </div>
              ))}
              <p className="text-[10px] text-neutral-600">
                Weighted win%: {(data.weightedWinPct * 100).toFixed(1)}% (50% L7 + 30% L14 + 20% L30)
              </p>
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source{" "}
        {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>
      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, warning, teamKey })}
      >
        Report a bug
      </button>
    </div>
  );
}
