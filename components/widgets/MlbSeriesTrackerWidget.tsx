"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type SeriesGame = {
  gamePk: number;
  date: string;
  gameTime: string;
  status: string;
  opponent: string;
  opponentKey: string;
  homeAway: "home" | "away";
  gameType?: string;
  gameTypeLabel?: string;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  duration?: string;
  startingPitcher?: string | null;
};

type SeriesInfo = {
  seriesId: string;
  opponent: string;
  opponentKey: string;
  homeAway: "home" | "away";
  games: SeriesGame[];
  teamWins: number;
  teamLosses: number;
  seriesDescription: string;
  gameTypeFilter: "R" | "S";
  gameTypeLabel: string;
};

type SeriesData = {
  teamKey: string;
  teamName: string;
  gameTypeFilter: "R" | "S";
  availableSeries: SeriesInfo[];
  selectedSeries: SeriesInfo | null;
};

type RecentResult = {
  gamePk: number;
  date: string;
  opponent: string;
  opponentKey: string;
  homeAway: "home" | "away";
  gameType?: string;
  gameTypeLabel?: string;
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

function formatRecentResult(result: RecentResult): string {
  const wl = result.result ?? "-";
  const score =
    result.teamScore !== null && result.opponentScore !== null
      ? `${result.teamScore}-${result.opponentScore}`
      : "-";
  const loc = result.homeAway === "home" ? "vs" : "@";
  return `${wl} ${score} ${loc} ${result.opponentKey}`;
}

function gameOutcome(game: SeriesGame): string {
  if (game.homeScore === undefined || game.awayScore === undefined) return game.status;
  const teamScore = game.homeAway === "home" ? game.homeScore : game.awayScore;
  const opponentScore = game.homeAway === "home" ? game.awayScore : game.homeScore;
  const result = teamScore > opponentScore ? "W" : "L";
  return `${result} ${teamScore}-${opponentScore}`;
}

export default function MlbSeriesTrackerWidget(props: WidgetCommonProps) {
  const config = props.config as { teamKey?: string; gameType?: "R" | "S"; seriesId?: string };
  const [teamKey, setTeamKey] = useState<string>(config.teamKey ?? "");
  const [gameType, setGameType] = useState<"R" | "S">(config.gameType ?? "R");
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(config.seriesId ?? "");
  const [data, setData] = useState<SeriesData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [recentResults, setRecentResults] = useState<RecentResultsData | null>(null);

  const load = useCallback(
    async (key: string, seasonType: "R" | "S", seriesId?: string) => {
      const params = new URLSearchParams({ teamKey: key, gameType: seasonType, dataMode: props.dataMode });
      if (seriesId) params.set("seriesId", seriesId);
      const res = await fetch(`/api/widgets/mlb-series-tracker?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as {
        data?: SeriesData | null;
        meta?: WidgetMeta;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load series data");
      return { data: json.data ?? null, meta: json.meta ?? null };
    },
    [props.dataMode],
  );

  useEffect(() => {
    if (!teamKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await load(teamKey, gameType, selectedSeriesId || undefined);
        if (!cancelled) {
          setData(result.data);
          setMeta(result.meta);
          setWarning(null);
          if (result.data?.selectedSeries?.seriesId && result.data.selectedSeries.seriesId !== selectedSeriesId) {
            setSelectedSeriesId(result.data.selectedSeries.seriesId);
          }
        }
      } catch (error) {
        if (!cancelled) setWarning(String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamKey, gameType, selectedSeriesId, load, props.refreshTick]);

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
        if (!cancelled) setRecentResults(json.data ?? null);
      } catch {
        // Ignore recent results failures.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamKey, props.dataMode, props.refreshTick]);

  async function persistConfig(next: Partial<typeof config>) {
    await props.onPersist({ config: { ...props.config, teamKey, gameType, seriesId: selectedSeriesId, ...next } });
  }

  const series = data?.selectedSeries;
  const advanced = props.mode === "ADVANCED";

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
          onClick={() => void persistConfig({ teamKey })}
          disabled={props.locked}
        >
          Set
        </button>
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          className={`flex-1 rounded border px-2 py-1 ${
            gameType === "R"
              ? "border-blue-500 bg-blue-950 text-blue-200"
              : "border-neutral-700 bg-neutral-950"
          }`}
          onClick={() => {
            setGameType("R");
            setSelectedSeriesId("");
            void persistConfig({ gameType: "R", seriesId: undefined });
          }}
          disabled={props.locked}
        >
          Regular Season
        </button>
        <button
          type="button"
          className={`flex-1 rounded border px-2 py-1 ${
            gameType === "S"
              ? "border-blue-500 bg-blue-950 text-blue-200"
              : "border-neutral-700 bg-neutral-950"
          }`}
          onClick={() => {
            setGameType("S");
            setSelectedSeriesId("");
            void persistConfig({ gameType: "S", seriesId: undefined });
          }}
          disabled={props.locked}
        >
          Spring Training
        </button>
      </div>

      {data?.availableSeries && data.availableSeries.length > 0 && (
        <select
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={selectedSeriesId || data.selectedSeries?.seriesId || ""}
          onChange={(e) => {
            setSelectedSeriesId(e.target.value);
            void persistConfig({ seriesId: e.target.value });
          }}
          disabled={props.locked}
        >
          {data.availableSeries.map((item) => (
            <option key={item.seriesId} value={item.seriesId}>
              {item.homeAway === "home" ? "vs" : "@"} {item.opponentKey} · {item.games[0]?.date ?? "-"}
            </option>
          ))}
        </select>
      )}

      {!teamKey && <p className="text-neutral-400">Enter a team abbreviation to start.</p>}
      {warning && <p className="text-amber-300">{warning}</p>}

      {recentResults && recentResults.results.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Recent Results</p>
          {recentResults.results.map((result) => (
            <div key={result.gamePk} className="rounded border border-neutral-800 bg-neutral-950 p-1.5">
              <div className="flex items-center justify-between">
                <span
                  className={
                    result.result === "W"
                      ? "font-medium text-emerald-400"
                      : result.result === "L"
                      ? "font-medium text-red-400"
                      : "text-neutral-400"
                  }
                >
                  {formatRecentResult(result)}
                </span>
                <span className="text-neutral-500">{result.date}</span>
              </div>
              <p className="text-[10px] text-neutral-500">({result.gameTypeLabel ?? "Season Unknown"})</p>
            </div>
          ))}
        </div>
      )}

      {data && !series && <p className="text-neutral-400">No series found for this filter.</p>}

      {data && series && (
        <div className="space-y-1">
          <p className="font-medium">
            {data.teamName} {series.homeAway === "home" ? "vs" : "@"} {series.opponent}
          </p>
          <p className="text-neutral-400">
            {series.seriesDescription} · {series.gameTypeLabel} · Series {series.teamWins}-{series.teamLosses}
          </p>
          {series.games.map((game) => (
            <div key={game.gamePk} className="rounded border border-neutral-700 bg-neutral-950 p-1.5">
              {!advanced && (
                <div className="flex items-center justify-between">
                  <span>{gameOutcome(game)} {game.homeAway === "home" ? "vs" : "@"} {game.opponentKey}</span>
                  <span className="text-neutral-500">{game.date}</span>
                </div>
              )}
              {advanced && (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span>{gameOutcome(game)} {game.homeAway === "home" ? "vs" : "@"} {game.opponentKey}</span>
                    <span className="text-neutral-500">{game.date}</span>
                  </div>
                  <p className="text-neutral-500">Starter: {game.startingPitcher ?? "-"} · Venue: {game.venue ?? "-"} · Duration: {game.duration ?? "-"}</p>
                </div>
              )}
              <p className="text-[10px] text-neutral-500">({game.gameTypeLabel ?? series.gameTypeLabel})</p>
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>
      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, warning, teamKey, gameType, selectedSeriesId })}
      >
        Report a bug
      </button>
    </div>
  );
}
