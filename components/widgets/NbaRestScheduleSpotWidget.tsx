"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import type { NbaRestScheduleSpotUi } from "@/lib/templates/nbaRestScheduleSpot";

type RestScheduleResponse = {
  data?: NbaRestScheduleSpotUi;
  meta?: WidgetMeta;
  error?: string | null;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function sourceBadge(
  sourceState: "live" | "partial" | "hybrid" | "demo",
  sourceUsed?: WidgetMeta["sourceUsed"],
): { label: string; className: string } {
  if (sourceState === "demo" || sourceUsed === "demo" || sourceUsed === "fixture") {
    return { label: "Demo fallback", className: "border-amber-700 bg-amber-950 text-amber-300" };
  }
  if (sourceState === "partial") {
    return {
      label: sourceUsed === "cache" ? "Cached partial live" : "Partial live",
      className: "border-yellow-700 bg-yellow-950 text-yellow-300",
    };
  }
  if (sourceState === "hybrid") {
    return {
      label: sourceUsed === "cache" ? "Cached hybrid" : "Hybrid",
      className: "border-sky-700 bg-sky-950 text-sky-300",
    };
  }
  return {
    label: sourceUsed === "cache" ? "Cached live" : "Live",
    className: "border-emerald-700 bg-emerald-950 text-emerald-300",
  };
}

function SignalBadge({ signal }: { signal: "positive" | "warning" | "neutral" }) {
  const label = signal === "positive" ? "Rest edge" : signal === "warning" ? "Stress spot" : "Neutral";
  const cls = signal === "positive"
    ? "border-emerald-700 bg-emerald-950 text-emerald-300"
    : signal === "warning"
      ? "border-amber-700 bg-amber-950 text-amber-300"
      : "border-neutral-700 bg-neutral-900 text-neutral-400";
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
}

function FactorBadge({ edge }: { edge: "team" | "opponent" | "even" }) {
  const label = edge === "team" ? "Team" : edge === "opponent" ? "Opponent" : "Even";
  const cls = edge === "team"
    ? "border-emerald-700 bg-emerald-950 text-emerald-300"
    : edge === "opponent"
      ? "border-red-800 bg-red-950 text-red-300"
      : "border-neutral-700 bg-neutral-900 text-neutral-400";
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
}

export default function NbaRestScheduleSpotWidget(props: WidgetCommonProps) {
  const configuredScenario = typeof props.config.scenarioId === "string" ? props.config.scenarioId : "";
  const configuredTeamKey = typeof props.config.teamKey === "string" ? props.config.teamKey.toUpperCase() : "";
  const [scenarioId, setScenarioId] = useState(configuredScenario);
  const [teamInput, setTeamInput] = useState(configuredTeamKey);
  const [activeTeamKey, setActiveTeamKey] = useState(configuredTeamKey);
  const [data, setData] = useState<NbaRestScheduleSpotUi | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const advanced = props.mode === "ADVANCED";

  useEffect(() => {
    setScenarioId(configuredScenario);
  }, [configuredScenario]);

  useEffect(() => {
    setTeamInput(configuredTeamKey);
    setActiveTeamKey(configuredTeamKey);
  }, [configuredTeamKey]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      mode: props.mode.toLowerCase(),
      dataMode: props.dataMode,
    });
    if (props.refreshTick > 0) {
      params.set("cacheBust", String(props.refreshTick));
    }
    if (activeTeamKey) {
      params.set("teamKey", activeTeamKey);
    } else if (scenarioId) {
      params.set("scenario", scenarioId);
    }
    const url = `/api/widgets/nba-rest-schedule-spot?${params.toString()}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as RestScheduleResponse;
      if (!response.ok) throw new Error(json.error ?? "Failed to load rest / schedule spot");
      setData(json.data ?? null);
      setMeta(json.meta ?? null);
      setError(json.error ?? null);
    } catch (loadError) {
      setData(null);
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }, [activeTeamKey, props.dataMode, props.mode, props.refreshTick, scenarioId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentScenario = scenarioId || data?.selectedScenarioId || "";
  const currentTeamKey = activeTeamKey || data?.team.key || "";
  const trustBadge = sourceBadge(data?.sourceState ?? "demo", meta?.sourceUsed);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">NBA Rest / Schedule Spot</span>
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

      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-neutral-500" htmlFor={`${props.widgetId}-rest-team-key`}>
          Live team key
        </label>
        <div className="flex gap-2">
          <input
            id={`${props.widgetId}-rest-team-key`}
            value={teamInput}
            onChange={(event) => setTeamInput(event.target.value.toUpperCase())}
            placeholder="e.g. MIN"
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            maxLength={8}
            disabled={props.locked}
          />
          <button
            type="button"
            className="rounded border border-neutral-700 px-2 py-1 text-neutral-200 disabled:text-neutral-500"
            disabled={props.locked || teamInput.trim().length === 0}
            onClick={() => {
              const nextTeamKey = teamInput.trim().toUpperCase();
              setTeamInput(nextTeamKey);
              setActiveTeamKey(nextTeamKey);
              void props.onPersist({ config: { ...props.config, teamKey: nextTeamKey } });
            }}
          >
            Set
          </button>
          <button
            type="button"
            className="rounded border border-neutral-700 px-2 py-1 text-neutral-400 disabled:text-neutral-600"
            disabled={props.locked || (!activeTeamKey && teamInput.trim().length === 0)}
            onClick={() => {
              setTeamInput("");
              setActiveTeamKey("");
              void props.onPersist({ config: { ...props.config, teamKey: "" } });
            }}
          >
            Clear
          </button>
        </div>
        {teamInput && teamInput !== activeTeamKey ? <p className="text-[10px] text-neutral-500">Press Set to load {teamInput}.</p> : null}
        {activeTeamKey ? <p className="text-[10px] text-neutral-500">Live mode will try BALLDONTLIE for {activeTeamKey}; the saved scenario remains the fallback.</p> : null}
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-neutral-500" htmlFor={`${props.widgetId}-rest-scenario`}>
          Demo fallback scenario
        </label>
        <select
          id={`${props.widgetId}-rest-scenario`}
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={currentScenario}
          onChange={(event) => {
            const next = event.target.value;
            setScenarioId(next);
            setTeamInput("");
            setActiveTeamKey("");
            void props.onPersist({ config: { ...props.config, scenarioId: next, teamKey: "" } });
          }}
          disabled={props.locked}
        >
          {(data?.availableScenarios ?? []).map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? <p className="text-neutral-400">Loading rest / schedule spot...</p> : null}
      {error ? <p className="text-amber-300">{error}</p> : null}
      {meta?.warning ? <p className="text-amber-300">{meta.warning}</p> : null}

      {data ? (
        <div className="space-y-2">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-neutral-100">
                  {data.team.name} vs {data.opponent.name}
                </p>
                <p className="mt-1 text-neutral-400">{data.context}</p>
                <p className="mt-2 text-[11px] text-neutral-500">{data.sourceDetail}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <SignalBadge signal={data.signal} />
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${trustBadge.className}`}>
                  {trustBadge.label}
                </span>
                <span className="rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium uppercase text-neutral-300">
                  {data.sourceLabel}
                </span>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded border border-neutral-800 bg-neutral-900/70 p-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">{data.team.key}</p>
                <p className="font-medium text-neutral-100">{data.team.record}</p>
                <p className="mt-1 text-neutral-400">{data.spotLabel}</p>
              </div>
              <div className="rounded border border-neutral-800 bg-neutral-900/70 p-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">{data.opponent.key}</p>
                <p className="font-medium text-neutral-100">{data.opponent.record}</p>
                <p className="mt-1 text-neutral-400">{advanced ? "Comparison side" : "Opponent context"}</p>
              </div>
            </div>

            <div className="mt-2 rounded border border-neutral-800 bg-[#111827] p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                {advanced ? "Advanced read" : "Beginner read"}
              </p>
              <p className="mt-1 text-neutral-200">{data.summary}</p>
            </div>
          </div>

          <div className="space-y-2">
            {data.factors.map((factor) => (
              <div key={factor.label} className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-neutral-100">{factor.label}</p>
                  <FactorBadge edge={factor.edge} />
                </div>
                {advanced ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded border border-neutral-800 bg-neutral-900/60 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{data.team.key}</p>
                      <p className="mt-1 text-neutral-300">{factor.teamValue}</p>
                    </div>
                    <div className="rounded border border-neutral-800 bg-neutral-900/60 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{data.opponent.key}</p>
                      <p className="mt-1 text-neutral-300">{factor.opponentValue}</p>
                    </div>
                  </div>
                ) : null}
                <p className="mt-2 text-neutral-300">{factor.takeaway}</p>
                <p className="mt-1 text-[11px] text-neutral-500">{factor.whyItMatters}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">Recent stretch</p>
              <div className="mt-2 space-y-2">
                {data.recentWindow.map((game) => (
                  <div key={`${game.dateLabel}-${game.opponent}`} className="rounded border border-neutral-800 bg-neutral-900/60 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-neutral-200">
                        {game.dateLabel} {game.site} {game.opponent}
                      </p>
                      {game.result ? <span className="text-[10px] text-neutral-500">{game.result}</span> : null}
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500">{game.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">Next stretch</p>
              <div className="mt-2 space-y-2">
                {data.nextWindow.map((game) => (
                  <div key={`${game.dateLabel}-${game.opponent}`} className="rounded border border-neutral-800 bg-neutral-900/60 p-2">
                    <p className="font-medium text-neutral-200">
                      {game.dateLabel} {game.site} {game.opponent}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-500">{game.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-neutral-500">What this teaches</p>
            <div className="mt-2 space-y-1.5 text-neutral-400">
              {data.teachingPoints.map((point) => (
                <p key={point}>{point}</p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} - Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() =>
          props.onReportBug({
            widgetId: props.widgetId,
            endpoint,
            meta,
            scenarioId: currentScenario,
            teamKey: currentTeamKey,
          })
        }
      >
        Report a bug
      </button>
    </div>
  );
}
