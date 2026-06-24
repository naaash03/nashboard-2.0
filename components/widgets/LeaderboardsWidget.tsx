"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BUILTIN_GLOSSARY_TERMS, lookupGlossaryTerm } from "@/lib/stats/glossary";
import { listRankableStats } from "@/lib/stats/rankability";
import type { WidgetCommonProps } from "@/components/widgets/types";

type LeaderEntry = {
  rank: number;
  name: string;
  entityId: string;
  value: string;
};

type RankingResponse =
  | {
      rankable: true;
      total: number;
      scopeLabel: string;
      qualifierText: string;
      leaderboard: LeaderEntry[];
    }
  | { rankable: false };

const SPORT = "MLB";

function labelForStat(statKey: string): string {
  const term = lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: statKey, sport: SPORT });
  if (term) return term.label;
  return statKey.replace(/_/g, " ").toUpperCase();
}

export default function LeaderboardsWidget(props: WidgetCommonProps) {
  const categories = useMemo(() => {
    return listRankableStats(SPORT).map((stat) => ({
      ...stat,
      label: labelForStat(stat.statKey),
    }));
  }, []);

  const initial = ((props.config.statKey as string) ?? categories[0]?.statKey ?? "era");
  const [statKey, setStatKey] = useState(initial);
  const [data, setData] = useState<Extract<RankingResponse, { rankable: true }> | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = categories.find((c) => c.statKey === statKey) ?? categories[0];
  const advanced = props.mode === "ADVANCED";

  const load = useCallback(
    async (key: string, entityType: string) => {
      setLoading(true);
      setWarning(null);
      try {
        const url = `/api/stat-ranking?statKey=${encodeURIComponent(key)}&sport=${SPORT}&entityType=${entityType}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json()) as RankingResponse;
        setLoading(false);
        if (!json.rankable) {
          setData(null);
          setWarning("No leaderboard is available for this category right now.");
          return;
        }
        setData(json);
      } catch (error) {
        setLoading(false);
        setData(null);
        setWarning(String(error));
      }
    },
    [],
  );

  useEffect(() => {
    if (!selected) return;
    // Wrapped in an async IIFE (matches the other widgets) so the load's
    // initial setState isn't called synchronously in the effect body.
    void (async () => {
      await load(selected.statKey, selected.entityType);
    })();
  }, [selected, load, props.refreshTick]);

  async function applyStat(nextKey: string) {
    setStatKey(nextKey);
    setData(null);
    await props.onPersist({ config: { ...props.config, statKey: nextKey } });
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">MLB Leaderboards</span>
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

      <select
        className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
        value={statKey}
        onChange={(e) => void applyStat(e.target.value)}
        disabled={props.locked}
      >
        {categories.map((c) => (
          <option key={c.statKey} value={c.statKey}>
            {c.label} — {c.entityType === "team" ? "Teams" : "Players"}
          </option>
        ))}
      </select>

      {selected && advanced ? (
        <p className="text-[10px] text-neutral-500">{selected.scopeLabel}</p>
      ) : null}

      {loading ? <p className="text-neutral-400">Loading leaderboard...</p> : null}
      {warning ? <p className="text-amber-300">{warning}</p> : null}

      {data && data.leaderboard.length > 0 ? (
        <div className="rounded border border-neutral-800 bg-neutral-950">
          {data.leaderboard.map((entry, index) => (
            <div
              key={`${entry.entityId}-${entry.rank}`}
              className={`flex items-center justify-between px-2.5 py-1.5 ${
                index < data.leaderboard.length - 1 ? "border-b border-neutral-800/60" : ""
              }`}
            >
              <span className="text-neutral-300">
                <span className="mr-1.5 tabular-nums text-neutral-600">{entry.rank}.</span>
                {entry.name}
              </span>
              <span className="tabular-nums text-neutral-200">{entry.value}</span>
            </div>
          ))}
          {advanced ? (
            <p className="px-2.5 py-1 text-[10px] text-neutral-600">{data.qualifierText}</p>
          ) : null}
        </div>
      ) : null}

      <div className="text-[10px] text-neutral-500">
        {selected ? `${labelForStat(selected.statKey)} · top ${data?.leaderboard.length ?? 10}` : ""}
      </div>
      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, statKey, warning })}
      >
        Report a bug
      </button>
    </div>
  );
}
