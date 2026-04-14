"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import type { NbaTeamMatchupProfileUi } from "@/lib/templates/nbaTeamMatchupProfile";

type TeamMatchupProfileResponse = {
  data?: NbaTeamMatchupProfileUi;
  meta?: WidgetMeta;
  error?: string | null;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function EdgeBadge({ edge }: { edge: "away" | "home" | "even" }) {
  const label = edge === "away" ? "Away edge" : edge === "home" ? "Home edge" : "Even";
  const cls = edge === "away"
    ? "border-blue-700 bg-blue-950 text-blue-300"
    : edge === "home"
      ? "border-emerald-700 bg-emerald-950 text-emerald-300"
      : "border-neutral-700 bg-neutral-900 text-neutral-400";
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
}

export default function NbaTeamMatchupProfileWidget(props: WidgetCommonProps) {
  const configuredScenario = typeof props.config.scenarioId === "string" ? props.config.scenarioId : "";
  const [scenarioId, setScenarioId] = useState(configuredScenario);
  const [data, setData] = useState<NbaTeamMatchupProfileUi | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const advanced = props.mode === "ADVANCED";

  useEffect(() => {
    setScenarioId(configuredScenario);
  }, [configuredScenario]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      mode: props.mode.toLowerCase(),
      dataMode: props.dataMode,
      cacheBust: String(props.refreshTick),
    });
    if (scenarioId) {
      params.set("scenario", scenarioId);
    }
    const url = `/api/widgets/nba-team-matchup-profile?${params.toString()}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as TeamMatchupProfileResponse;
      if (!response.ok) throw new Error(json.error ?? "Failed to load matchup profile");
      setData(json.data ?? null);
      setMeta(json.meta ?? null);
      setError(json.error ?? null);
    } catch (loadError) {
      setData(null);
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }, [props.dataMode, props.mode, props.refreshTick, scenarioId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentScenario = scenarioId || data?.selectedScenarioId || "";

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">NBA Team Matchup Profile</span>
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
        <label className="text-[10px] uppercase tracking-wide text-neutral-500" htmlFor={`${props.widgetId}-matchup-scenario`}>
          Matchup scenario
        </label>
        <select
          id={`${props.widgetId}-matchup-scenario`}
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={currentScenario}
          onChange={(event) => {
            const next = event.target.value;
            setScenarioId(next);
            void props.onPersist({ config: { ...props.config, scenarioId: next } });
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

      {loading ? <p className="text-neutral-400">Loading matchup profile...</p> : null}
      {error ? <p className="text-amber-300">{error}</p> : null}
      {meta?.warning ? <p className="text-amber-300">{meta.warning}</p> : null}

      {data ? (
        <div className="space-y-2">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-neutral-100">{data.matchup}</p>
                <p className="mt-1 text-neutral-400">{data.context}</p>
              </div>
              <span className="rounded border border-amber-700 bg-amber-950 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-300">
                {data.sourceLabel}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded border border-neutral-800 bg-neutral-900/70 p-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">{data.away.key}</p>
                <p className="font-medium text-neutral-100">{data.away.name}</p>
                <p className="text-neutral-400">{data.away.record}</p>
                <p className="mt-1 text-[11px] text-neutral-500">{data.away.identity}</p>
              </div>
              <div className="rounded border border-neutral-800 bg-neutral-900/70 p-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">{data.home.key}</p>
                <p className="font-medium text-neutral-100">{data.home.name}</p>
                <p className="text-neutral-400">{data.home.record}</p>
                <p className="mt-1 text-[11px] text-neutral-500">{data.home.identity}</p>
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
            {data.pillars.map((pillar) => (
              <div key={pillar.id} className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-neutral-100">{pillar.label}</p>
                  <EdgeBadge edge={pillar.edge} />
                </div>
                <p className="mt-1 text-neutral-300">{pillar.takeaway}</p>
                {advanced ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded border border-neutral-800 bg-neutral-900/60 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{data.away.key}</p>
                      <p className="mt-1 text-neutral-300">{pillar.awayValue}</p>
                    </div>
                    <div className="rounded border border-neutral-800 bg-neutral-900/60 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{data.home.key}</p>
                      <p className="mt-1 text-neutral-300">{pillar.homeValue}</p>
                    </div>
                  </div>
                ) : null}
                <p className="mt-2 text-[11px] text-neutral-500">{pillar.whyItMatters}</p>
              </div>
            ))}
          </div>

          <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Swing factor</p>
            <p className="mt-1 font-medium text-neutral-100">{data.swingFactor.title}</p>
            <p className="mt-1 text-neutral-400">{data.swingFactor.summary}</p>
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
          })
        }
      >
        Report a bug
      </button>
    </div>
  );
}
