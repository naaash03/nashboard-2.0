"use client";

import { useCallback, useEffect, useState } from "react";
import StatLabel from "@/components/stats/StatLabel";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type FormPeriod = {
  days: number;
  wins: number;
  losses: number;
  runsScored: number;
  runsAllowed: number;
  runDiff: number;
  winPct: number;
  games: number;
  runDiffPerGame: number;
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
  sampleContext: string;
  primaryGameType: "R" | "S" | "mixed" | "unknown";
  primaryGameTypeLabel: string;
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

function trendLabel(periodWinPct: number, baselineWinPct: number): string {
  const diff = periodWinPct - baselineWinPct;
  if (diff > 0.05) return "^ Up";
  if (diff < -0.05) return "v Down";
  return "= Flat";
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
      if (!res.ok) throw new Error(json.error ?? "Failed to load recent form data");
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

          {!advanced && (
            <div className="space-y-1 rounded border border-neutral-800 bg-neutral-950 p-2">
              <p className="text-neutral-300">Recent form looks at wins, losses, and run differential over the last 7, 14, and 30 days of games.</p>
              <p className="text-neutral-100">{data.explanation}</p>
              <p className="text-neutral-500">{data.sampleContext}</p>
            </div>
          )}

          {advanced && (
            <div className="space-y-2 rounded border border-neutral-800 bg-neutral-950 p-2">
              <p className="text-neutral-300">Recent form based on the last 7, 14, and 30 days of games.</p>
              <p className="text-neutral-500">{data.sampleContext}</p>
              <div className="grid grid-cols-5 gap-1 text-[10px] text-neutral-500">
                <span>Period</span>
                <span className="text-right"><StatLabel label="W-L" statKey="w_l_record" sport="MLB" mode={props.mode} /></span>
                <span className="text-right"><StatLabel label="R/G Diff" statKey="run_diff_per_game" sport="MLB" mode={props.mode} /></span>
                <span className="text-right"><StatLabel label="Win%" statKey="win_pct" sport="MLB" mode={props.mode} /></span>
                <span className="text-right">Trend</span>
              </div>
              {[data.last7, data.last14, data.last30].map((period) => (
                <div key={period.days} className="grid grid-cols-5 gap-1 rounded border border-neutral-800 p-1.5">
                  <span className="text-neutral-400">L{period.days}</span>
                  <span className="text-right">{period.wins}-{period.losses}</span>
                  <span className={`text-right ${period.runDiffPerGame >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {period.runDiffPerGame >= 0 ? "+" : ""}{period.runDiffPerGame.toFixed(1)}
                  </span>
                  <span className="text-right text-neutral-300">{(period.winPct * 100).toFixed(1)}%</span>
                  <span className="text-right text-neutral-300">{trendLabel(period.winPct, data.last30.winPct)}</span>
                </div>
              ))}
              <p className="text-[10px] text-neutral-500">
                Trend compares each window to the 30-day baseline: `^ Up` means better than the 30-day sample, `v Down` means worse, and `= Flat` means roughly unchanged.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
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
