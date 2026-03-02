"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type RbResponse = {
  data?: RbData | null;
  meta?: WidgetMeta;
  error?: string | { message?: string };
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function normalizeTeamKey(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }
  return input.trim().toUpperCase();
}

function isValidTeamKey(input: string): boolean {
  return /^[A-Z]{2,4}$/.test(input);
}

function parseErrorMessage(value: unknown): string {
  if (!value) {
    return "Failed to load RB vs D-Line";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && typeof (value as { message?: unknown }).message === "string") {
    return (value as { message: string }).message;
  }
  return "Failed to load RB vs D-Line";
}

export default function RbVsDlineWidget(props: WidgetCommonProps) {
  const configTeamKey = useMemo(() => normalizeTeamKey(props.config.teamKey), [props.config.teamKey]);

  const [inputTeamKey, setInputTeamKey] = useState<string>(configTeamKey);
  const [appliedTeamKey, setAppliedTeamKey] = useState<string>(configTeamKey);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [data, setData] = useState<RbData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setInputTeamKey(configTeamKey);
      setAppliedTeamKey(configTeamKey);
      setValidationError(null);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [configTeamKey]);

  useEffect(() => {
    if (appliedTeamKey) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setData(null);
      setMeta(null);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [appliedTeamKey]);

  const load = useCallback(async (
    key: string,
    signal: AbortSignal,
  ): Promise<{ data: RbData | null; meta: WidgetMeta | null }> => {
    const mode = props.mode.toLowerCase();
    const endpointUrl = `/api/widgets/rb-vs-dline?teamKey=${encodeURIComponent(key)}&mode=${mode}&dataMode=${props.dataMode}`;
    setEndpoint(endpointUrl);

    const res = await fetch(endpointUrl, { cache: "no-store", signal });
    const json = (await res.json()) as RbResponse;
    if (!res.ok) {
      throw new Error(parseErrorMessage(json.error));
    }

    return {
      data: json.data ?? null,
      meta: json.meta ?? null,
    };
  }, [props.dataMode, props.mode]);

  useEffect(() => {
    if (!appliedTeamKey) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const result = await load(appliedTeamKey, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setData(result.data);
        setMeta(result.meta);
        setWarning(result.meta?.warning ?? null);
        setLastError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setWarning(String(error));
        setLastError(String(error));
      }
    })();

    return () => {
      controller.abort();
    };
  }, [appliedTeamKey, load]);

  async function applyTeam() {
    const normalized = inputTeamKey.trim().toUpperCase();
    setInputTeamKey(normalized);

    if (!isValidTeamKey(normalized)) {
      setValidationError("Enter a valid team key (2-4 letters).");
      return;
    }

    setValidationError(null);
    setWarning(null);
    setAppliedTeamKey(normalized);

    await props.onPersist({ config: { ...props.config, teamKey: normalized } });
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
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void applyTeam();
        }}
      >
        <input
          className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          placeholder="Team key (e.g. PHI)"
          value={inputTeamKey}
          onChange={(event) => setInputTeamKey(event.target.value.toUpperCase())}
          disabled={props.locked}
        />
        <button className="rounded border border-neutral-700 px-2 py-1" type="submit" disabled={props.locked}>Set</button>
      </form>

      {!appliedTeamKey ? <p className="text-neutral-400">Set a team key to start.</p> : null}
      {validationError ? <p className="text-amber-300">{validationError}</p> : null}
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
        <p>Applied team: {appliedTeamKey || "-"}</p>
        <p>Last error: {lastError ?? "none"}</p>
        <pre className="overflow-auto text-[10px]">{JSON.stringify(meta, null, 2)}</pre>
      </details>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, warning, inputTeamKey, appliedTeamKey, endpoint, lastError })}
      >
        Report a bug
      </button>
    </div>
  );
}

