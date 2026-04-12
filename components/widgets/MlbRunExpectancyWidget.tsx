"use client";

import { useEffect, useState } from "react";
import StatLabel from "@/components/stats/StatLabel";
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

const BASELINE_RE = 0.544;

function explainSituation(bases: string, outs: number): string {
  const outLabel = `${outs} out${outs === 1 ? "" : "s"}`;
  switch (bases) {
    case "Loaded":
      return `Bases loaded with ${outLabel} is one of the highest-pressure spots in the inning because almost any ball in play can score a run.`;
    case "2nd+3rd":
      return `Runners on second and third with ${outLabel} puts two men in scoring position, so even a routine single or productive out can cash in runs quickly.`;
    case "1st+3rd":
      return `First and third with ${outLabel} matters because the offense has both an immediate run at third and another runner already in motion behind him.`;
    case "3rd":
      return `A runner on third with ${outLabel} matters because a sacrifice fly, ground ball, or simple single can score without needing extra-base contact.`;
    case "2nd":
      return `A runner on second with ${outLabel} is already in scoring position, so a clean single often turns into a run.`;
    case "1st+2nd":
      return `First and second with ${outLabel} gives the offense two baserunners and multiple ways to score with one well-placed hit.`;
    case "1st":
      return `A runner on first with ${outLabel} is a modest scoring setup because the offense still needs at least one more advance to create a real scoring chance.`;
    default:
      return `Empty bases with ${outLabel} is the inning baseline: the offense still has room to build, but nothing is threatening yet.`;
  }
}

export default function MlbRunExpectancyWidget(props: WidgetCommonProps) {
  const [reData, setReData] = useState<RunExpectancyData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [selectedBases, setSelectedBases] = useState<string | null>(null);
  const [selectedOuts, setSelectedOuts] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/widgets/mlb-run-expectancy", { cache: "no-store" });
        if (!res.ok) {
          setWarning("Failed to load run expectancy data.");
          setLoading(false);
          return;
        }
        const json = (await res.json()) as {
          data?: RunExpectancyData;
          meta?: WidgetMeta;
        };
        setReData(json.data ?? null);
        setMeta(json.meta ?? null);
        setWarning(json.data ? null : "Run expectancy data is unavailable right now.");
        const firstState = json.data?.states[0];
        if (firstState) {
          setSelectedBases((current) => current ?? firstState.bases);
          setSelectedOuts((current) => current ?? 0);
        }
      } catch {
        setWarning("Failed to load run expectancy data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const advanced = props.mode === "ADVANCED";
  const selectedState = reData?.states.find((state) => state.bases === selectedBases) ?? null;
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
        : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
    }`;
  }

  function getReValue(state: RE24State, outs: number): number {
    return outs === 0 ? state.outs0 : outs === 1 ? state.outs1 : state.outs2;
  }

  function getReColor(value: number): string {
    if (value >= 1.5) return "text-emerald-300 font-semibold";
    if (value >= 0.9) return "text-emerald-500";
    if (value >= BASELINE_RE) return "text-neutral-200";
    if (value >= 0.3) return "text-orange-400";
    return "text-red-400";
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Run Expectancy (<StatLabel label="RE24" statKey="re24" sport="MLB" mode={props.mode} />)</span>
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
      {loading && <p className="text-neutral-400">Loading run expectancy matrix...</p>}

      {reData && (
        <div className="space-y-2">
          <p className="text-neutral-500">Click a cell to select the current base/out situation.</p>
          <p className="text-[10px] text-neutral-500">This is a static teaching matrix, not a live team-strength feed.</p>

          <div className="grid grid-cols-4 gap-1">
            <div className="py-1 font-medium text-neutral-500">Bases</div>
            {[0, 1, 2].map((outs) => (
              <div key={outs} className="py-1 text-center font-medium text-neutral-500">
                {outs} Out{outs !== 1 ? "s" : ""}
              </div>
            ))}
          </div>

          {reData.states.map((state) => (
            <div key={state.bases} className="grid grid-cols-4 gap-1">
              <div className="flex items-center py-1 font-medium text-neutral-400">{state.bases}</div>
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
                  <span
                    className={`block text-[11px] ${
                      state.bases === selectedBases && outs === selectedOuts
                        ? "font-semibold"
                        : getReColor(getReValue(state, outs))
                    }`}
                  >
                    {getReValue(state, outs).toFixed(3)}
                  </span>
                </button>
              ))}
            </div>
          ))}

          {selectedState && selectedOuts !== null && expectedRuns !== null && scorePct !== null && (
            <div className="space-y-1 rounded border border-blue-800 bg-blue-950 p-2">
              <p className="text-blue-100">
                With <strong>{selectedState.bases}</strong>, {selectedOuts} out{selectedOuts !== 1 ? "s" : ""} - teams score <strong>{expectedRuns.toFixed(3)} runs on average</strong>, and score at least one run <strong>{(scorePct * 100).toFixed(1)}%</strong> of the time.
              </p>
              {!advanced && <p className="text-blue-200">{explainSituation(selectedState.bases, selectedOuts)}</p>}
              {advanced && (
                <div className="space-y-1 text-blue-100">
                  <p className="text-blue-200">{explainSituation(selectedState.bases, selectedOuts)}</p>
                  <div className="space-y-1.5 rounded border border-blue-900/70 bg-blue-900/30 p-2.5 text-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400"><StatLabel label="RE value" statKey="re24" sport="MLB" mode={props.mode} className="border-blue-400" /></span>
                      <span className="font-medium">{expectedRuns.toFixed(3)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400"><StatLabel label="Probability of scoring" statKey="score_probability" sport="MLB" mode={props.mode} className="border-blue-400" /></span>
                      <span className="font-medium">{(scorePct * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400"><StatLabel label="Delta vs baseline" statKey="delta_vs_baseline" sport="MLB" mode={props.mode} className="border-blue-400" /></span>
                      <span className={`font-medium ${expectedRuns >= BASELINE_RE ? "text-emerald-300" : "text-red-300"}`}>
                        {expectedRuns >= BASELINE_RE ? "+" : ""}{(expectedRuns - BASELINE_RE).toFixed(3)}
                      </span>
                    </div>
                    <p className="border-t border-blue-900/50 pt-1 text-[10px] text-blue-400">
                      Empty, 0 outs baseline = {BASELINE_RE}
                    </p>
                  </div>
                  <p className="text-blue-300">
                    RE24 is the average number of runs teams score from this exact base/out state until the inning ends.
                  </p>
                  <p className="text-blue-200">
                    This state matters because one out or one extra baserunner can change the inning from a low-threat setup into a high-scoring opportunity immediately.
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-neutral-600">{reData.source}</p>
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
