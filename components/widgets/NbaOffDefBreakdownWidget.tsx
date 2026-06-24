"use client";

import { useCallback, useEffect, useState } from "react";
import StatLabel from "@/components/stats/StatLabel";
import type { WidgetCommonProps, WidgetMeta, WidgetMode } from "@/components/widgets/types";

type StatProfile = {
  teamKey: string;
  pointsFor?: number;
  pointsAgainst?: number;
  netRating?: number;
  reboundsPerGame?: number;
  assistsPerGame?: number;
  fieldGoalPct?: number;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function Row({
  label,
  value,
  suffix,
  statKey,
  mode,
}: {
  label: string;
  value?: number;
  suffix?: string;
  statKey?: string;
  mode: WidgetMode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">
        {statKey ? <StatLabel label={label} statKey={statKey} sport="NBA" mode={mode} /> : label}
      </span>
      <span className="text-neutral-200">{typeof value === "number" ? `${value}${suffix ?? ""}` : "—"}</span>
    </div>
  );
}

export default function NbaOffDefBreakdownWidget(props: WidgetCommonProps) {
  const initialTeamKey = ((props.config.teamKey as string) ?? "").toUpperCase();
  const [teamKey, setTeamKey] = useState(initialTeamKey);
  const [teamInput, setTeamInput] = useState(initialTeamKey);
  const [data, setData] = useState<StatProfile | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const advanced = props.mode === "ADVANCED";

  const load = useCallback(async (key: string) => {
    setLoading(true);
    const res = await fetch(`/api/widgets/nba-offensive-defensive-breakdown?teamKey=${encodeURIComponent(key)}&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`, { cache: "no-store" });
    const json = (await res.json()) as { data?: StatProfile | null; meta?: WidgetMeta; error?: string };
    setLoading(false);
    if (!res.ok) throw new Error(json.error ?? "Failed to load NBA team stats");
    return { data: json.data ?? null, meta: json.meta ?? null };
  }, [props.dataMode, props.refreshTick]);

  useEffect(() => {
    if (!teamKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await load(teamKey);
        if (cancelled) return;
        setData(result.data);
        setMeta(result.meta);
        setWarning(result.meta?.warning ?? null);
      } catch (error) {
        if (cancelled) return;
        setData(null);
        setMeta(null);
        setWarning(String(error));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teamKey, load, props.refreshTick]);

  async function applyTeam() {
    const next = teamInput.trim().toUpperCase();
    setTeamInput(next);
    setTeamKey(next);
    setData(null);
    await props.onPersist({ config: { ...props.config, teamKey: next } });
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">NBA Off/Def Breakdown</span>
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

      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          placeholder="Team (e.g. NYK)"
          value={teamInput}
          onChange={(e) => setTeamInput(e.target.value.toUpperCase())}
        />
        <button className="rounded border border-neutral-700 px-2 py-1" type="button" onClick={() => void applyTeam()} disabled={props.locked}>
          Set
        </button>
      </div>

      {!teamKey && <p className="text-neutral-400">Enter a team abbreviation and press Set.</p>}
      {loading && <p className="text-neutral-400">Loading team stats...</p>}
      {warning && <p className="text-amber-300">{warning}</p>}

      {data && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-emerald-900 bg-emerald-950/30 p-2">
              <p className="mb-1 text-[10px] font-bold uppercase text-emerald-400">Offense</p>
              <Row label="Points/G" statKey="ppg" mode={props.mode} value={data.pointsFor} />
              {advanced && <Row label="Assists/G" statKey="apg" mode={props.mode} value={data.assistsPerGame} />}
              {advanced && <Row label="FG%" statKey="fg_pct" mode={props.mode} value={data.fieldGoalPct} suffix="%" />}
            </div>
            <div className="rounded border border-red-900 bg-red-950/30 p-2">
              <p className="mb-1 text-[10px] font-bold uppercase text-red-400">Defense</p>
              <Row label="Opp Pts/G" statKey="opp_ppg" mode={props.mode} value={data.pointsAgainst} />
              {advanced && <Row label="Rebounds/G" statKey="rpg" mode={props.mode} value={data.reboundsPerGame} />}
            </div>
          </div>
          <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
            <Row label="Net rating (Pts − Opp Pts)" statKey="net_rating" mode={props.mode} value={data.netRating} />
            {!advanced && (
              <p className="mt-1 text-[10px] text-neutral-500">
                A positive net rating means this team outscores opponents on average.
              </p>
            )}
          </div>
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
