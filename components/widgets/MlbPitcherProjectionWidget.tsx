"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import { MLB_TEAM_OPTIONS } from "@/lib/providers/mlb/teamMap";
import type { PredictionPayload } from "@/lib/types/prediction";

type ProjectionResponse = {
  data: PredictionPayload | null;
  meta?: (WidgetMeta & {
    isFallback?: boolean;
    fallbackReason?: string;
    pitcherName?: string;
    venue?: string;
    generatedAt?: string;
  }) | null;
  error?: string | null;
};

function readConfigString(config: WidgetCommonProps["config"], key: string): string {
  const value = config[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function parseTeamKey(query: string): string | null {
  const upper = query.trim().toUpperCase();
  if (!upper) return null;
  const byKey = MLB_TEAM_OPTIONS.find((t) => t.key === upper);
  if (byKey) return byKey.key;
  const byName = MLB_TEAM_OPTIONS.find((t) => t.name.toUpperCase() === upper);
  if (byName) return byName.key;
  const suffix = query.match(/\(([A-Za-z]{2,4})\)\s*$/)?.[1]?.toUpperCase();
  if (suffix && MLB_TEAM_OPTIONS.find((t) => t.key === suffix)) return suffix;
  return null;
}

function ConfidenceBadge({ label }: { label: PredictionPayload["confidenceLabel"] }) {
  const styles: Record<string, string> = {
    high: "bg-emerald-900/60 text-emerald-300 border border-emerald-700",
    medium: "bg-yellow-900/60 text-yellow-300 border border-yellow-700",
    low: "bg-red-900/60 text-red-300 border border-red-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${styles[label] ?? styles.low}`}>
      {label} confidence
    </span>
  );
}

function WeatherImpactChip({ impact }: { impact: string }) {
  const styles: Record<string, string> = {
    none: "bg-zinc-800 text-zinc-400",
    low: "bg-zinc-800 text-zinc-400",
    moderate: "bg-yellow-900/60 text-yellow-300",
    high: "bg-red-900/60 text-red-300",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${styles[impact] ?? styles.none}`}>
      weather: {impact}
    </span>
  );
}

function SourceChip({ source }: { source: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700">
      {source}
    </span>
  );
}

function FallbackBanner({ reason }: { reason?: string }) {
  return (
    <div className="rounded bg-yellow-900/30 border border-yellow-700/50 px-3 py-2 text-[11px] text-yellow-300">
      <span className="font-semibold">Partial data — </span>
      {reason ?? "One or more data sources are unavailable. Projection may be less accurate."}
    </div>
  );
}

function ProjectionDisplay({ data, advanced }: { data: PredictionPayload; advanced: boolean }) {
  const weatherImpact = typeof data.inputs.weatherImpact === "string" ? data.inputs.weatherImpact : "none";

  return (
    <div className="flex flex-col gap-3">
      {/* Point estimate */}
      <div className="flex items-end gap-3">
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-0.5">Projected Ks</div>
          <div className="text-3xl font-bold text-white leading-none">
            {data.pointEstimate.toFixed(1)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            range {data.rangeLow.toFixed(1)}–{data.rangeHigh.toFixed(1)}
          </div>
        </div>
        <div className="mb-1">
          <ConfidenceBadge label={data.confidenceLabel} />
        </div>
      </div>

      {/* Explanation */}
      <p className="text-[11px] text-zinc-300 leading-snug">{data.explanation}</p>

      {/* Fallback banner */}
      {data.isFallback && <FallbackBanner reason={data.fallbackReason} />}

      {/* Advanced extras */}
      {advanced && (
        <>
          {/* Key factors */}
          {data.keyFactors.length > 0 && (
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Key Factors</div>
              <ul className="flex flex-col gap-0.5">
                {data.keyFactors.map((factor) => (
                  <li key={factor} className="text-[11px] text-zinc-300 flex gap-1.5">
                    <span className="text-zinc-600">·</span>
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Inputs breakdown */}
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Inputs</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {(
                [
                  ["Season K/9", data.inputs.seasonKPer9],
                  ["Recent K/9", data.inputs.recentKPer9],
                  ["Blended K/9", data.inputs.blendedKPer9],
                  ["Assumed IP", data.inputs.assumedInnings],
                  ["Base proj. K", data.inputs.baseProjectedK],
                  ["Weather adj.", data.inputs.weatherAdj],
                  ["O/U line", data.inputs.overUnder],
                  ["O/U adj.", data.inputs.ouAdj],
                ] as [string, unknown][]
              ).filter(([, v]) => v !== null && v !== undefined).map(([label, value]) => (
                <div key={label} className="flex justify-between text-[10px]">
                  <span className="text-zinc-500">{label}</span>
                  <span className="text-zinc-300 font-mono">
                    {typeof value === "number" ? value.toFixed(1) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Weather + sources row */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <WeatherImpactChip impact={weatherImpact} />
            {data.sources.map((src) => (
              <SourceChip key={src} source={src} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="h-9 w-24 rounded bg-zinc-800" />
      <div className="h-3 w-full rounded bg-zinc-800" />
      <div className="h-3 w-3/4 rounded bg-zinc-800" />
    </div>
  );
}

export default function MlbPitcherProjectionWidget(props: WidgetCommonProps) {
  const initialTeamKey = readConfigString(props.config, "pitcherTeamKey")
    || readConfigString(props.config, "teamKey");

  const [teamQuery, setTeamQuery] = useState(initialTeamKey);
  const [activeTeamKey, setActiveTeamKey] = useState(initialTeamKey);
  const [data, setData] = useState<PredictionPayload | null>(null);
  const [meta, setMeta] = useState<ProjectionResponse["meta"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdvanced = props.mode === "ADVANCED";

  const fetchProjection = useCallback(async (teamKey: string) => {
    if (!teamKey) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        pitcherTeamKey: teamKey,
        mode: props.mode,
        dataMode: props.dataMode,
      });
      const res = await fetch(`/api/widgets/mlb-pitcher-projection?${params}`);
      const body: ProjectionResponse = await res.json();
      setData(body.data ?? null);
      setMeta(body.meta ?? null);
      setError(body.error ?? (body.data ? null : "No projection data returned."));
    } catch {
      setError("Failed to load pitcher projection.");
    } finally {
      setLoading(false);
    }
  }, [props.mode, props.dataMode]);

  useEffect(() => {
    if (activeTeamKey) {
      void fetchProjection(activeTeamKey);
    }
  }, [activeTeamKey, fetchProjection, props.refreshTick]);

  function handleTeamSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolved = parseTeamKey(teamQuery) ?? teamQuery.trim().toUpperCase();
    if (!resolved) return;
    setActiveTeamKey(resolved);
    void props.onPersist({ config: { ...props.config, pitcherTeamKey: resolved } });
  }

  const pitcherName = meta?.pitcherName;
  const venue = meta?.venue;

  return (
    <div className="flex flex-col gap-3 p-3 h-full text-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold text-zinc-200 leading-none">
            Pitcher Projection
            {pitcherName && <span className="text-zinc-400 font-normal"> · {pitcherName}</span>}
          </div>
          {venue && isAdvanced && (
            <div className="text-[10px] text-zinc-500 mt-0.5">{venue}</div>
          )}
        </div>
        <span className="text-[9px] text-zinc-600 uppercase tracking-wide font-medium">MLB</span>
      </div>

      {/* Team input */}
      <form onSubmit={handleTeamSubmit} className="flex gap-1.5">
        <input
          className="flex-1 rounded bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          placeholder="Team (e.g. NYM)"
          value={teamQuery}
          onChange={(e) => setTeamQuery(e.target.value)}
          list="mlb-team-projection-options"
        />
        <datalist id="mlb-team-projection-options">
          {MLB_TEAM_OPTIONS.map((t) => (
            <option key={t.key} value={`${t.name} (${t.key})`} />
          ))}
        </datalist>
        <button
          type="submit"
          className="rounded bg-zinc-700 hover:bg-zinc-600 text-[11px] text-zinc-200 px-2 py-1 transition-colors"
        >
          Go
        </button>
      </form>

      {/* Body */}
      {loading && <Skeleton />}

      {!loading && error && !data && (
        <div className="rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-[11px] text-zinc-400">
          {error}
        </div>
      )}

      {!loading && !activeTeamKey && !error && (
        <div className="text-[11px] text-zinc-500">Enter a team abbreviation to see the projected strikeout total for their starting pitcher.</div>
      )}

      {!loading && data && (
        <ProjectionDisplay data={data} advanced={isAdvanced} />
      )}

      {/* Generated timestamp in advanced */}
      {isAdvanced && meta?.generatedAt && (
        <div className="text-[9px] text-zinc-700 mt-auto">
          Generated {new Date(meta.generatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
