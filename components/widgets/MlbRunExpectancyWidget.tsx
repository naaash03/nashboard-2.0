"use client";

import { useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type RE24State = {
  bases: string;
  outs0: number;
  outs1: number;
  outs2: number;
  scorePct0: number;
  scorePct1: number;
  scorePct2: number;
};

type RunExpectancyData = {
  states: RE24State[];
  source: string;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

// Baseline: Empty bases, 0 outs = 0.544
const BASELINE_RE = 0.544;

export default function MlbRunExpectancyWidget(props: WidgetCommonProps) {
  const [reData, setReData] = useState<RunExpectancyData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [selectedBases, setSelectedBases] = useState<string | null>(null);
  const [selectedOuts, setSelectedOuts] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/widgets/mlb-run-expectancy", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: RunExpectancyData;
          meta?: WidgetMeta;
        };
        setReData(json.data ?? null);
        setMeta(json.meta ?? null);
      } catch {
        setWarning("Failed to load run expectancy data.");
      }
    })();
  }, []);

  const advanced = props.mode === "ADVANCED";

  const selectedState = reData?.states.find((s) => s.bases === selectedBases) ?? null;
  const expectedRuns =
    selectedState && selectedOuts !== null
      ? selectedOuts === 0
        ? selectedState.outs0
        : selectedOuts === 1
        ? selectedState.outs1
        : selectedState.outs2
      : null;
  const scorePct =
    selectedState && selectedOuts !== null
      ? selectedOuts === 0
        ? selectedState.scorePct0
        : selectedOuts === 1
        ? selectedState.scorePct1
        : selectedState.scorePct2
      : null;

  function cellClass(bases: string, outs: number): string {
    const isSelected = bases === selectedBases && outs === selectedOuts;
    return `cursor-pointer rounded p-1.5 text-center transition-colors ${
      isSelected
        ? "bg-blue-700 text-white"
        : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
    }`;
  }

  function getReValue(state: RE24State, outs: number): number {
    return outs === 0 ? state.outs0 : outs === 1 ? state.outs1 : state.outs2;
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Run Expectancy (RE24)</span>
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

      {warning && <p className="text-amber-300">{warning}</p>}

      {reData && (
        <div className="space-y-2">
          <p className="text-neutral-500">Click a cell to select the current situation.</p>

          {/* Grid header */}
          <div className="grid grid-cols-4 gap-1">
            <div className="text-neutral-500 py-1 font-medium">Bases</div>
            {[0, 1, 2].map((outs) => (
              <div key={outs} className="text-center text-neutral-500 py-1 font-medium">
                {outs} Out{outs !== 1 ? "s" : ""}
              </div>
            ))}
          </div>

          {reData.states.map((state) => (
            <div key={state.bases} className="grid grid-cols-4 gap-1">
              <div className="flex items-center text-neutral-400 font-medium py-1">
                {state.bases}
              </div>
              {[0, 1, 2].map((outs) => (
                <button
                  key={outs}
                  type="button"
                  className={cellClass(state.bases, outs)}
                  onClick={() => {
                    setSelectedBases(state.bases);
                    setSelectedOuts(outs);
                  }}
                >
                  <span className="block text-[11px] font-medium">
                    {getReValue(state, outs).toFixed(3)}
                  </span>
                </button>
              ))}
            </div>
          ))}

          {/* Selected state summary */}
          {selectedState && selectedOuts !== null && expectedRuns !== null && scorePct !== null && (
            <div className="rounded border border-blue-800 bg-blue-950 p-2 space-y-1">
              {!advanced && (
                <p className="text-blue-100">
                  With <strong>{selectedBases}</strong>, {selectedOuts} out{selectedOuts !== 1 ? "s" : ""}{" "}
                  — teams score{" "}
                  <strong>{expectedRuns.toFixed(3)} runs on average</strong>, and score at least 1
                  run{" "}
                  <strong>{(scorePct * 100).toFixed(1)}%</strong> of the time.
                </p>
              )}
              {advanced && (
                <div className="space-y-0.5 text-blue-200">
                  <p>
                    <span className="text-blue-400">RE</span> = {expectedRuns.toFixed(3)}
                  </p>
                  <p>
                    <span className="text-blue-400">P(score)</span> = {(scorePct * 100).toFixed(1)}%
                  </p>
                  <p>
                    <span className="text-blue-400">vs Baseline</span> (Empty, 0 out ={" "}
                    {BASELINE_RE}){" "}
                    {expectedRuns >= BASELINE_RE ? "+" : ""}
                    {(expectedRuns - BASELINE_RE).toFixed(3)} RE
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-neutral-600">{reData.source}</p>
        </div>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source{" "}
        {meta ? meta.sourceUsed.toUpperCase() : "-"}
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
