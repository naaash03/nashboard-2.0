"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type PitcherAvailability = {
  playerId: string;
  fullName: string;
  fatigue: "fatigued" | "tired" | "available" | "fresh" | "rested";
  daysRest: number;
  lastAppearance: string | null;
  lastAppearancePitches: number | null;
  lastAppearanceStrikes: number | null;
  inningsLastAppearance?: string | null;
  seasonKPer9?: string;
  seasonUsed?: number;
  recentAppearances: Array<{
    date: string;
    inningsPitched: string;
    numberOfPitches: number;
    strikes?: number;
  }>;
};

type StarterRow = {
  playerId: string;
  fullName: string;
  lastStartDate: string | null;
  daysRest: number;
  inningsLastStart: string | null;
  pitchesLastStart: number | null;
  strikesLastStart: number | null;
  seasonKPer9?: string;
  seasonUsed?: number;
};

type BullpenFatigue = {
  teamKey: string;
  teamName: string;
  starters: StarterRow[];
  relievers: PitcherAvailability[];
  fetchedAt: string;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function FatigueDot({ fatigue }: { fatigue: PitcherAvailability["fatigue"] }) {
  const colors = {
    fatigued: "bg-red-500",
    tired: "bg-yellow-500",
    available: "bg-yellow-300",
    fresh: "bg-emerald-400",
    rested: "bg-emerald-600",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[fatigue]}`} />;
}

function fatigueLabel(fatigue: PitcherAvailability["fatigue"]): string {
  return fatigue.charAt(0).toUpperCase() + fatigue.slice(1);
}

export default function MlbBullpenFatigueWidget(props: WidgetCommonProps) {
  const config = props.config as { teamKey?: string; viewMode?: "starters" | "bullpen" };
  const [teamKey, setTeamKey] = useState<string>(config.teamKey ?? "");
  const [viewMode, setViewMode] = useState<"starters" | "bullpen">(config.viewMode ?? "bullpen");
  const [data, setData] = useState<BullpenFatigue | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (key: string) => {
      setLoading(true);
      const res = await fetch(
        `/api/widgets/mlb-bullpen-fatigue?teamKey=${encodeURIComponent(key)}&dataMode=${props.dataMode}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        data?: BullpenFatigue | null;
        meta?: WidgetMeta;
        error?: string;
      };
      setLoading(false);
      if (!res.ok) throw new Error(json.error ?? "Failed to load pitcher availability");
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
        if (!cancelled) {
          setWarning(String(error));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamKey, load, props.refreshTick]);

  async function persistConfig(next: Partial<typeof config>) {
    await props.onPersist({ config: { ...props.config, teamKey, viewMode, ...next } });
  }

  const advanced = props.mode === "ADVANCED";
  const displayRelievers = advanced ? data?.relievers : data?.relievers.slice(0, 5);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Bullpen Fatigue</span>
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

      <div className="flex gap-1">
        <button
          type="button"
          className={`flex-1 rounded border px-2 py-1 ${
            viewMode === "starters"
              ? "border-blue-500 bg-blue-950 text-blue-200"
              : "border-neutral-700 bg-neutral-950"
          }`}
          onClick={() => {
            setViewMode("starters");
            void persistConfig({ viewMode: "starters" });
          }}
          disabled={props.locked}
        >
          Starters
        </button>
        <button
          type="button"
          className={`flex-1 rounded border px-2 py-1 ${
            viewMode === "bullpen"
              ? "border-blue-500 bg-blue-950 text-blue-200"
              : "border-neutral-700 bg-neutral-950"
          }`}
          onClick={() => {
            setViewMode("bullpen");
            void persistConfig({ viewMode: "bullpen" });
          }}
          disabled={props.locked}
        >
          Bullpen
        </button>
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
          onClick={() => void persistConfig({ teamKey })}
          disabled={props.locked}
        >
          Set
        </button>
      </div>

      {!teamKey && <p className="text-neutral-400">Enter a team abbreviation to start.</p>}
      {warning && <p className="text-amber-300">{warning}</p>}
      {loading && <p className="text-neutral-400">Loading pitcher availability...</p>}

      {data && !loading && (
        <div className="space-y-2">
          <p className="font-medium">{data.teamName}</p>

          {viewMode === "starters" && (
            <div className="space-y-1">
              {!advanced &&
                data.starters.map((starter) => (
                  <div key={starter.playerId} className="rounded border border-neutral-800 bg-neutral-950 p-1.5">
                    <p className="font-medium">{starter.fullName}</p>
                    <p className="text-neutral-400">
                      Last start: {starter.lastStartDate ?? "-"} · Rest: {starter.daysRest >= 99 ? "N/A" : `${starter.daysRest}d`}
                    </p>
                    <p className="text-neutral-500">IP in last start: {starter.inningsLastStart ?? "-"}</p>
                  </div>
                ))}
              {advanced && (
                <div className="space-y-1">
                  <div className="grid grid-cols-6 gap-1 text-[10px] text-neutral-500">
                    <span>Starter</span>
                    <span className="text-right">Last Start</span>
                    <span className="text-right">Rest</span>
                    <span className="text-right">IP</span>
                    <span className="text-right">P/S</span>
                    <span className="text-right">K/9</span>
                  </div>
                  {data.starters.map((starter) => (
                    <div key={starter.playerId} className="grid grid-cols-6 gap-1 rounded border border-neutral-800 bg-neutral-950 p-1.5">
                      <span>{starter.fullName}</span>
                      <span className="text-right text-neutral-400">{starter.lastStartDate ?? "-"}</span>
                      <span className="text-right text-neutral-400">{starter.daysRest >= 99 ? "N/A" : `${starter.daysRest}d`}</span>
                      <span className="text-right text-neutral-400">{starter.inningsLastStart ?? "-"}</span>
                      <span className="text-right text-neutral-400">
                        {starter.pitchesLastStart ?? "-"}
                        {starter.strikesLastStart !== null ? `/${starter.strikesLastStart}` : ""}
                      </span>
                      <span className="text-right text-neutral-400">{starter.seasonKPer9 ?? "-"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === "bullpen" && (
            <div className="space-y-1">
              {!advanced &&
                displayRelievers?.map((reliever) => (
                  <div key={reliever.playerId} className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-950 p-1.5">
                    <FatigueDot fatigue={reliever.fatigue} />
                    <span className="flex-1">{reliever.fullName}</span>
                    <span className="text-neutral-500">{fatigueLabel(reliever.fatigue)}</span>
                  </div>
                ))}
              {advanced &&
                displayRelievers?.map((reliever) => (
                  <div key={reliever.playerId} className="rounded border border-neutral-800 bg-neutral-950 p-1.5 space-y-0.5">
                    <div className="grid grid-cols-5 gap-1 items-center">
                      <div className="col-span-2 flex items-center gap-1.5">
                        <FatigueDot fatigue={reliever.fatigue} />
                        <span>{reliever.fullName}</span>
                      </div>
                      <span className="text-right text-neutral-400">{reliever.daysRest >= 99 ? "N/A" : `${reliever.daysRest}d`}</span>
                      <span className="text-right text-neutral-400">
                        {reliever.lastAppearancePitches ?? "-"}
                        {reliever.lastAppearanceStrikes !== null ? `/${reliever.lastAppearanceStrikes}` : ""}
                      </span>
                      <span className="text-right text-neutral-400">{reliever.seasonKPer9 ?? "-"}</span>
                    </div>
                    {reliever.lastAppearance && (
                      <p className="text-[10px] text-neutral-600">
                        Last outing: {reliever.lastAppearance} · {reliever.inningsLastAppearance ?? "-"} IP
                      </p>
                    )}
                    {reliever.recentAppearances.length > 0 && (
                      <p className="text-[10px] text-neutral-600">
                        Recent: {reliever.recentAppearances.slice(0, 3).map((appearance) => `${appearance.date.slice(5)} (${appearance.inningsPitched} IP, ${appearance.numberOfPitches}P${appearance.strikes !== undefined ? `/${appearance.strikes}S` : ""})`).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
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
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, warning, teamKey, viewMode })}
      >
        Report a bug
      </button>
    </div>
  );
}
