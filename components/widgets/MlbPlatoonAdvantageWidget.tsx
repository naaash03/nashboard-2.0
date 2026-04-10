"use client";

import { useCallback, useEffect, useState } from "react";
import StatLabel from "@/components/stats/StatLabel";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type PitcherSplits = {
  vsLeft: { era?: string; whip?: string; avg?: string; ops?: string; sample?: number } | null;
  vsRight: { era?: string; whip?: string; avg?: string; ops?: string; sample?: number } | null;
};

type PlatoonAdvantage = {
  game: {
    gameId: string;
    gamePk: number;
    officialDate: string;
    homeTeam: { key: string; name: string };
    awayTeam: { key: string; name: string };
  };
  homePitcher: { playerId: string; fullName: string; throwsHand: string; splits: PitcherSplits } | null;
  awayPitcher: { playerId: string; fullName: string; throwsHand: string; splits: PitcherSplits } | null;
  advantage: "home" | "away" | "neutral";
  advantageScore: number;
  explanation: string;
  analysisMode: "splits" | "handedness";
  handednessAnalyses: Array<{
    pitcherTeamKey: string;
    lineupTeamKey: string;
    pitcherName: string;
    pitcherHand: string;
    lineupHandedness: "left" | "right" | "balanced" | "unknown";
    lineupSummary: string;
    edge: "pitcher" | "hitter" | "neutral" | "unknown";
    summary: string;
    reasoning: string;
  }>;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function AdvantageBadge({ advantage }: { advantage: "home" | "away" | "neutral" }) {
  const colors = {
    home: "border-emerald-500 bg-emerald-950 text-emerald-300",
    away: "border-blue-500 bg-blue-950 text-blue-300",
    neutral: "border-neutral-600 bg-neutral-900 text-neutral-300",
  };
  const labels = { home: "HOME EDGE", away: "AWAY EDGE", neutral: "EVEN MATCHUP" };
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${colors[advantage]}`}>
      {labels[advantage]}
    </span>
  );
}

function SplitsTable({ pitcher }: { pitcher: { fullName: string; throwsHand: string; splits: PitcherSplits } }) {
  return (
    <div>
      <p className="font-medium">{pitcher.fullName} ({pitcher.throwsHand}HP)</p>
      <table className="mt-1 w-full border-collapse">
        <thead>
          <tr className="text-neutral-500">
            <th className="py-0.5 text-left">Split</th>
            <th className="py-0.5 text-right"><StatLabel label="ERA" statKey="era" sport="MLB" mode="ADVANCED" /></th>
            <th className="py-0.5 text-right"><StatLabel label="WHIP" statKey="whip" sport="MLB" mode="ADVANCED" /></th>
            <th className="py-0.5 text-right"><StatLabel label="AVG" statKey="avg" sport="MLB" mode="ADVANCED" /></th>
            <th className="py-0.5 text-right"><StatLabel label="OPS" statKey="ops" sport="MLB" mode="ADVANCED" /></th>
            <th className="py-0.5 text-right"><StatLabel label="BF" statKey="batters_faced" sport="MLB" mode="ADVANCED" /></th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-neutral-800">
            <td className="py-0.5 text-neutral-400">vs L</td>
            <td className="py-0.5 text-right">{pitcher.splits.vsLeft?.era ?? "-"}</td>
            <td className="py-0.5 text-right">{pitcher.splits.vsLeft?.whip ?? "-"}</td>
            <td className="py-0.5 text-right">{pitcher.splits.vsLeft?.avg ?? "-"}</td>
            <td className="py-0.5 text-right">{pitcher.splits.vsLeft?.ops ?? "-"}</td>
            <td className="py-0.5 text-right text-neutral-500">{pitcher.splits.vsLeft?.sample ?? "-"}</td>
          </tr>
          <tr className="border-t border-neutral-800">
            <td className="py-0.5 text-neutral-400">vs R</td>
            <td className="py-0.5 text-right">{pitcher.splits.vsRight?.era ?? "-"}</td>
            <td className="py-0.5 text-right">{pitcher.splits.vsRight?.whip ?? "-"}</td>
            <td className="py-0.5 text-right">{pitcher.splits.vsRight?.avg ?? "-"}</td>
            <td className="py-0.5 text-right">{pitcher.splits.vsRight?.ops ?? "-"}</td>
            <td className="py-0.5 text-right text-neutral-500">{pitcher.splits.vsRight?.sample ?? "-"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function MlbPlatoonAdvantageWidget(props: WidgetCommonProps) {
  const initialTeamKey = ((props.config.teamKey as string) ?? "").toUpperCase();
  const [teamKey, setTeamKey] = useState<string>(initialTeamKey);
  const [teamInput, setTeamInput] = useState<string>(initialTeamKey);
  const [data, setData] = useState<PlatoonAdvantage | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (key: string) => {
      setLoading(true);
      setWarning(null);
      const res = await fetch(
        `/api/widgets/mlb-platoon-advantage?teamKey=${encodeURIComponent(key)}&dataMode=${props.dataMode}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        data?: PlatoonAdvantage | null;
        meta?: WidgetMeta;
        error?: string;
      };
      setLoading(false);
      if (!res.ok) throw new Error(json.error ?? "Failed to load platoon data");
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
          setWarning(result.meta?.warning ?? (!result.data ? "No matchup data is available for this team right now." : null));
        }
      } catch (error) {
        if (!cancelled) {
          setData(null);
          setMeta(null);
          setWarning(String(error));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamKey, load, props.refreshTick]);

  async function applyTeam() {
    const nextTeamKey = teamInput.trim().toUpperCase();
    setTeamInput(nextTeamKey);
    setTeamKey(nextTeamKey);
    setData(null);
    setMeta(null);
    setWarning(null);
    await props.onPersist({ config: { ...props.config, teamKey: nextTeamKey } });
  }

  const advanced = props.mode === "ADVANCED";

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Platoon Advantage</span>
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
          value={teamInput}
          onChange={(e) => setTeamInput(e.target.value.toUpperCase())}
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

      {!teamKey && <p className="text-neutral-400">Enter a team abbreviation and press Set.</p>}
      {teamInput && teamInput !== teamKey && <p className="text-[10px] text-neutral-500">Press Set to load {teamInput}.</p>}
      {warning && <p className="text-amber-300">{warning}</p>}
      {loading && <p className="text-neutral-400">Loading platoon matchup...</p>}
      {!loading && teamKey && !data && !warning && <p className="text-neutral-400">No platoon matchup data is available for this team right now.</p>}

      {data && (
        <div className="space-y-2">
          <div>
            <p className="font-medium">
              {data.game.awayTeam.key} @ {data.game.homeTeam.key}
            </p>
            <p className="text-neutral-400">{data.game.officialDate}</p>
          </div>

          {data.analysisMode === "splits" ? (
            <div className="flex items-center gap-2">
              <AdvantageBadge advantage={data.advantage} />
              {advanced && <span className="text-neutral-500">Score: {data.advantageScore > 0 ? "+" : ""}{data.advantageScore}</span>}
            </div>
          ) : (
            <span className="rounded border border-amber-500 bg-amber-950 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-300">
              Handedness Estimate
            </span>
          )}

          <p className="text-neutral-300">{data.explanation}</p>
          {data.analysisMode === "handedness" && (
            <p className="text-[10px] text-neutral-500">Use this as a rough lean until both probable starters have posted split data.</p>
          )}

          {data.analysisMode === "handedness" && !advanced && data.handednessAnalyses.length > 0 && (
            <p className="text-neutral-500">{data.handednessAnalyses[0].reasoning}</p>
          )}

          {advanced && data.analysisMode === "splits" && (
            <div className="space-y-3 border-t border-neutral-800 pt-2">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">Pitcher Splits</p>
              {data.awayPitcher ? (
                <div>
                  <p className="mb-1 text-[10px] uppercase text-neutral-500">Away · {data.game.awayTeam.key}</p>
                  <SplitsTable pitcher={data.awayPitcher} />
                </div>
              ) : (
                <p className="text-neutral-500">Away pitcher: TBD</p>
              )}
              {data.homePitcher ? (
                <div>
                  <p className="mb-1 text-[10px] uppercase text-neutral-500">Home · {data.game.homeTeam.key}</p>
                  <SplitsTable pitcher={data.homePitcher} />
                </div>
              ) : (
                <p className="text-neutral-500">Home pitcher: TBD</p>
              )}
            </div>
          )}

          {advanced && data.analysisMode === "handedness" && (
            <div className="space-y-2 border-t border-neutral-800 pt-2">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">Handedness Analysis</p>
              {data.handednessAnalyses.map((analysis) => (
                <div key={`${analysis.pitcherTeamKey}-${analysis.lineupTeamKey}`} className="rounded border border-neutral-800 bg-neutral-950 p-2">
                  <p className="font-medium">{analysis.summary}</p>
                  <p className="text-neutral-500">{analysis.reasoning}</p>
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
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, warning, teamKey })}
      >
        Report a bug
      </button>
    </div>
  );
}
