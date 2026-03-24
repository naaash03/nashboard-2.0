"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type SeriesGame = {
  gamePk: number;
  date: string;
  gameTime: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
};

type SeriesInfo = {
  opponent: string;
  opponentKey: string;
  homeAway: "home" | "away";
  games: SeriesGame[];
  teamWins: number;
  teamLosses: number;
  seriesDescription: string;
};

type SeriesData = {
  teamKey: string;
  teamName: string;
  currentSeriesOrNextSeries: SeriesInfo | null;
};

type RecentResult = {
  gamePk: number;
  date: string;
  opponent: string;
  opponentKey: string;
  homeAway: "home" | "away";
  result: "W" | "L" | null;
  teamScore: number | null;
  opponentScore: number | null;
  status: string;
};

type RecentResultsData = {
  teamKey: string;
  teamName: string;
  results: RecentResult[];
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatRecentResult(r: RecentResult): string {
  const wl = r.result ?? "—";
  const score =
    r.teamScore !== null && r.opponentScore !== null
      ? `${r.teamScore}-${r.opponentScore}`
      : "—";
  const loc = r.homeAway === "home" ? "vs" : "@";
  return `${wl} ${score} ${loc} ${r.opponentKey}`;
}

export default function MlbSeriesTrackerWidget(props: WidgetCommonProps) {
  const [teamKey, setTeamKey] = useState<string>((props.config.teamKey as string) ?? "");
  const [data, setData] = useState<SeriesData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [recentResults, setRecentResults] = useState<RecentResultsData | null>(null);

  const load = useCallback(
    async (key: string) => {
      const res = await fetch(
        `/api/widgets/mlb-series-tracker?teamKey=${encodeURIComponent(key)}&dataMode=${props.dataMode}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        data?: SeriesData | null;
        meta?: WidgetMeta;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load series");
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
        if (!cancelled) setWarning(String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamKey, load, props.refreshTick]);

  useEffect(() => {
    if (!teamKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/widgets/mlb-recent-results?teamKey=${encodeURIComponent(teamKey)}&limit=3&dataMode=${props.dataMode}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { data?: RecentResultsData | null };
        if (!cancelled) {
          setRecentResults(json.data ?? null);
        }
      } catch {
        // Recent results are supplemental — swallow errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamKey, props.dataMode, props.refreshTick]);

  async function applyTeam() {
    await props.onPersist({ config: { ...props.config, teamKey } });
  }

  const series = data?.currentSeriesOrNextSeries;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Series Tracker</span>
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
          value={teamKey}
          onChange={(e) => setTeamKey(e.target.value.toUpperCase())}
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

      {!teamKey && <p className="text-neutral-400">Enter a team abbreviation to start.</p>}
      {warning && <p className="text-amber-300">{warning}</p>}

      {recentResults && recentResults.results.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Recent Results</p>
          {recentResults.results.map((r) => (
            <div
              key={r.gamePk}
              className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-950 p-1.5"
            >
              <span
                className={
                  r.result === "W"
                    ? "font-medium text-emerald-400"
                    : r.result === "L"
                    ? "font-medium text-red-400"
                    : "text-neutral-400"
                }
              >
                {formatRecentResult(r)}
              </span>
              <span className="text-neutral-500">{r.date}</span>
            </div>
          ))}
        </div>
      )}

      {data && !series && (
        <p className="text-neutral-400">
          No active or upcoming series found for {data.teamName}.
        </p>
      )}

      {data && series && (
        <div className="space-y-1">
          <p className="font-medium">
            {data.teamName} {series.homeAway === "home" ? "vs" : "@"} {series.opponent}
          </p>
          <p className="text-neutral-400">
            {series.seriesDescription} · Series {series.teamWins}-{series.teamLosses}
          </p>
          {series.games.map((game) => (
            <div
              key={game.gamePk}
              className="flex items-center justify-between rounded border border-neutral-700 bg-neutral-950 p-1.5"
            >
              <span>{game.date}</span>
              <span>
                {game.status === "Final" &&
                game.homeScore !== undefined &&
                game.awayScore !== undefined
                  ? `${game.awayScore}–${game.homeScore}`
                  : to12h(game.gameTime)}
              </span>
              <span className="text-neutral-400">{game.status}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source{" "}
        {meta ? meta.sourceUsed.toUpperCase() : "-"}
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
