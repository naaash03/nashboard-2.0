"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type RbData = {
  team?: string;
  opponent?: string;
  rbName?: string;
  rbAttempts?: number;
  rbYards?: number;
  rbYpc?: number;
  rbTds?: number;
  rbExplosiveRuns?: number;
  defRushYardsAllowed?: number;
  defYpcAllowed?: number;
  defRushTdsAllowed?: number;
  defExplosiveRunsAllowed?: number;
  disclaimer?: string;
  whyItMatters?: string;
  learnMore?: string;
  emptyState?: boolean;
  title?: string;
  explanation?: string;
  recentLeader?: string | null;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function RbVsDlineWidget(props: WidgetCommonProps) {
  const [teamKey, setTeamKey] = useState<string>((props.config.teamKey as string) ?? "");
  const [data, setData] = useState<RbData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);

  const load = useCallback(async (key: string): Promise<{ data: RbData | null; meta: WidgetMeta | null }> => {
    const mode = props.mode.toLowerCase();
    const endpointUrl = `/api/widgets/rb-vs-dline?teamKey=${encodeURIComponent(key)}&mode=${mode}&dataMode=${props.dataMode}`;
    setEndpoint(endpointUrl);
    const res = await fetch(endpointUrl, { cache: "no-store" });
    const json = (await res.json()) as { data?: RbData | null; meta?: WidgetMeta; error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? "Failed to load RB vs D-Line");
    }
    return {
      data: json.data ?? null,
      meta: json.meta ?? null,
    };
  }, [props.mode, props.dataMode]);

  useEffect(() => {
    if (!teamKey) return;
    let cancelled = false;

    void (async () => {
      try {
        const result = await load(teamKey);
        if (!cancelled) {
          setData(result.data);
          setMeta(result.meta);
          setLastError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setWarning(String(error));
          setLastError(String(error));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teamKey, load, props.refreshTick]);

  async function applyTeam() {
    await props.onPersist({ config: { ...props.config, teamKey } });
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">RB vs D-Line</span>
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
      <div className="flex gap-2">
        <input className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1" placeholder="Team key (e.g. PHI)" value={teamKey} onChange={(e) => setTeamKey(e.target.value.toUpperCase())} />
        <button className="rounded border border-neutral-700 px-2 py-1" type="button" onClick={() => void applyTeam()} disabled={props.locked}>Set</button>
      </div>

      {!teamKey ? <p className="text-neutral-400">Set a team key to start.</p> : null}
      {warning ? <p className="text-amber-300">{warning}</p> : null}

      {data?.emptyState ? (
        <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
          <p className="font-medium">{data.title}</p>
          <p>{data.explanation}</p>
          {data.recentLeader ? <p>Most recent RB leader: {data.recentLeader}</p> : null}
          <p className="text-neutral-400">{data.whyItMatters}</p>
        </div>
      ) : data ? (
        <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
          <p className="font-medium">{data.rbName} vs {data.opponent}</p>
          <p>{data.team} rushing context</p>
          <p>RB: Att {data.rbAttempts ?? "-"} · Yds {data.rbYards ?? "-"} · YPC {data.rbYpc ?? "-"} · TD {data.rbTds ?? "-"} · Explosive {data.rbExplosiveRuns ?? "-"}</p>
          <p>DEF: Yds Allowed {data.defRushYardsAllowed ?? "-"} · YPC Allowed {data.defYpcAllowed ?? "-"} · TD Allowed {data.defRushTdsAllowed ?? "-"} · Explosive Allowed {data.defExplosiveRunsAllowed ?? "-"}</p>
          <p className="text-neutral-400">{data.whyItMatters}</p>
          <p className="text-neutral-500">{data.disclaimer}</p>
          {props.mode === "ADVANCED" && data.learnMore ? <a className="text-blue-300 underline" href={data.learnMore} target="_blank" rel="noreferrer">Learn more</a> : null}
        </div>
      ) : <p className="text-neutral-500">No matchup data yet.</p>}

      <div className="text-[10px] text-neutral-500">Updated {meta ? to12h(meta.updatedAt) : "-"} · Source {meta ? meta.sourceUsed.toUpperCase() : "-"}</div>

      <details className="rounded border border-neutral-700 bg-black/20 p-2">
        <summary className="cursor-pointer text-[11px] text-neutral-300">Debug</summary>
        <p>Endpoint: {endpoint}</p>
        <p>Last error: {lastError ?? "none"}</p>
        <pre className="overflow-auto text-[10px]">{JSON.stringify(meta, null, 2)}</pre>
      </details>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, warning, teamKey, endpoint, lastError })}
      >
        Report a bug
      </button>
    </div>
  );
}

