"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import { MLB_TEAM_OPTIONS } from "@/lib/providers/mlb/teamMap";

type GameEntry = {
  gamePk: number;
  gameNumber: number;
  date: string;
  dateISO: string;
  opponent: string;
  opponentKey: string;
  homeAway?: "home" | "away";
  isHome?: boolean;
  runsScored: number;
  runsAllowed: number;
  result: "W" | "L";
};

type BeginnerSummary = {
  wins: number;
  losses: number;
  avgRunsScored: string;
  avgRunsAllowed: string;
  streakLabel: string;
};

type AdvancedSummary = {
  wins: number;
  losses: number;
  avgRunsScored: string;
  avgRunsAllowed: string;
  streak: string;
};

type TrendData = {
  teamKey: string;
  teamName: string;
  games: GameEntry[];
  summary: BeginnerSummary | AdvancedSummary;
  isPartial: boolean;
  gamesShown: number;
};

type TrendResponse = {
  data: TrendData | null;
  meta?: WidgetMeta | null;
  error?: string | null;
};

function readConfigString(config: WidgetCommonProps["config"], key: string): string {
  const v = config[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : "";
}

function parseTeamKey(query: string): string | null {
  const upper = query.trim().toUpperCase();
  if (!upper) return null;
  if (MLB_TEAM_OPTIONS.find((t) => t.key === upper)) return upper;
  const byName = MLB_TEAM_OPTIONS.find((t) => t.name.toUpperCase() === upper);
  if (byName) return byName.key;
  const suffix = query.match(/\(([A-Za-z]{2,4})\)\s*$/)?.[1]?.toUpperCase();
  if (suffix && MLB_TEAM_OPTIONS.find((t) => t.key === suffix)) return suffix;
  return null;
}

type DotProps = {
  cx?: number;
  cy?: number;
  payload?: GameEntry;
};

function WinLossDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  const isWin = payload.result === "W";
  return isWin
    ? <circle cx={cx} cy={cy} r={4} fill="#60a5fa" stroke="#60a5fa" />
    : <circle cx={cx} cy={cy} r={4} fill="transparent" stroke="#f87171" strokeWidth={2} />;
}

type TooltipPayloadItem = {
  name: string;
  value: number;
  color: string;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  isAdvanced?: boolean;
};

function CustomTooltip({ active, payload, label, isAdvanced }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const game = (payload[0] as unknown as { payload: GameEntry }).payload;
  const locationLabel = isAdvanced && game.isHome !== undefined
    ? (game.isHome ? "vs (Home)" : "@ (Away)")
    : null;
  return (
    <div className="rounded border border-zinc-700 bg-zinc-900 p-2 text-[11px] text-zinc-200 shadow-lg">
      <div className="font-semibold mb-0.5">Game {label} · {game.date}</div>
      <div className="text-zinc-400">
        {game.opponent}
        {locationLabel && <span className="text-zinc-500 ml-1">{locationLabel}</span>}
      </div>
      <div className="mt-1 flex gap-3">
        <span className="text-blue-400">Scored: {game.runsScored}</span>
        <span className="text-red-400">Allowed: {game.runsAllowed}</span>
      </div>
      <div className={`mt-0.5 font-semibold ${game.result === "W" ? "text-emerald-400" : "text-red-400"}`}>
        {game.result === "W" ? "Win" : "Loss"}
      </div>
    </div>
  );
}

export default function MlbTrendChartWidget(props: WidgetCommonProps) {
  const initialTeamKey = readConfigString(props.config, "teamKey");

  const [teamQuery, setTeamQuery] = useState(initialTeamKey);
  const [activeTeamKey, setActiveTeamKey] = useState(initialTeamKey);
  const [data, setData] = useState<TrendData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdvanced = props.mode === "ADVANCED";

  const fetchTrend = useCallback(async (teamKey: string) => {
    if (!teamKey) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        teamKey,
        mode: props.mode.toLowerCase(),
        dataMode: props.dataMode,
      });
      const res = await fetch(`/api/widgets/mlb-trend-chart?${params}&cacheBust=${props.refreshTick}`);
      const body: TrendResponse = await res.json();
      setData(body.data ?? null);
      setMeta(body.meta ?? null);
      setError(body.error ?? (body.data ? null : "No data returned."));
    } catch {
      setError("Failed to load run trend.");
    } finally {
      setLoading(false);
    }
  }, [props.mode, props.dataMode, props.refreshTick]);

  useEffect(() => {
    if (activeTeamKey) {
      void fetchTrend(activeTeamKey);
    }
  }, [activeTeamKey, fetchTrend]);

  function handleTeamSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolved = parseTeamKey(teamQuery) ?? teamQuery.trim().toUpperCase();
    if (!resolved) return;
    setActiveTeamKey(resolved);
    void props.onPersist({ config: { ...props.config, teamKey: resolved } });
  }

  const games = data?.games ?? [];
  const yMax = games.length > 0
    ? Math.max(...games.map((g) => Math.max(g.runsScored, g.runsAllowed))) + 1
    : 10;

  const summary = data?.summary;
  const streakText = summary
    ? ("streakLabel" in summary ? summary.streakLabel : summary.streak)
    : null;

  const homeWins = isAdvanced ? games.filter((g) => g.isHome === true && g.result === "W").length : 0;
  const homeLosses = isAdvanced ? games.filter((g) => g.isHome === true && g.result === "L").length : 0;
  const awayWins = isAdvanced ? games.filter((g) => g.isHome === false && g.result === "W").length : 0;
  const awayLosses = isAdvanced ? games.filter((g) => g.isHome === false && g.result === "L").length : 0;
  const hasHomeSplit = isAdvanced && games.some((g) => g.isHome !== undefined);

  return (
    <div className="flex flex-col gap-2 p-3 h-full text-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-zinc-200 leading-none">
          MLB Run Trend
          {data?.teamName && <span className="text-zinc-400 font-normal"> · {data.teamName}</span>}
        </div>
        <span className="text-[9px] text-zinc-600 uppercase tracking-wide font-medium">MLB</span>
      </div>

      {/* Team input */}
      <form onSubmit={handleTeamSubmit} className="flex gap-1.5">
        <input
          className="flex-1 rounded bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          placeholder="Team (e.g. NYY)"
          value={teamQuery}
          onChange={(e) => setTeamQuery(e.target.value)}
          list="mlb-team-trend-options"
        />
        <datalist id="mlb-team-trend-options">
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

      {/* Partial notice */}
      {data?.isPartial && (
        <div className="rounded bg-yellow-900/30 border border-yellow-700/50 px-2 py-1 text-[10px] text-yellow-300">
          Showing {data.gamesShown} games (season in progress)
        </div>
      )}

      {/* Body */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[11px] text-zinc-500 animate-pulse">
            Loading {data?.teamName ?? activeTeamKey} game log...
          </span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-[11px] text-amber-400">
          {error}
        </div>
      )}

      {!loading && !activeTeamKey && !error && (
        <div className="text-[11px] text-zinc-500 mt-1">
          Enter a team abbreviation to see runs scored and allowed over the last 15 games.
        </div>
      )}

      {!loading && !error && games.length === 0 && activeTeamKey && data && (
        <div className="text-[11px] text-zinc-500 mt-1">
          No completed games found for {data.teamName}.
        </div>
      )}

      {!loading && !error && games.length > 0 && (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={games} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="gameNumber"
                tick={{ fill: "#94a3b8", fontSize: 9 }}
                tickFormatter={(_, i) => games[i]?.opponentKey ?? ""}
                interval={0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#94a3b8", fontSize: 9 }}
                domain={[0, yMax]}
              />
              <Tooltip content={<CustomTooltip isAdvanced={isAdvanced} />} />
              <Legend
                wrapperStyle={{ fontSize: "10px", color: "#94a3b8" }}
                iconSize={8}
              />
              <Line
                type="monotone"
                dataKey="runsScored"
                name="Runs Scored"
                stroke="#60a5fa"
                strokeWidth={1.5}
                dot={<WinLossDot />}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="runsAllowed"
                name="Runs Allowed"
                stroke="#f87171"
                strokeWidth={1.5}
                dot={<WinLossDot />}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary bar */}
      {!loading && summary && games.length > 0 && (
        <div className="flex flex-col gap-0.5 border-t border-white/10 pt-1.5">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-400">
            <span>Record: <span className="text-zinc-200">{summary.wins}-{summary.losses}</span></span>
            <span>Avg scored: <span className="text-blue-400">{summary.avgRunsScored} RPG</span></span>
            <span>Avg allowed: <span className="text-red-400">{summary.avgRunsAllowed} RPG</span></span>
            {streakText && <span>Streak: <span className="text-zinc-200">{streakText}</span></span>}
          </div>
          {hasHomeSplit && (
            <div className="flex gap-x-3 text-[10px] text-zinc-500">
              <span>Home: <span className="text-zinc-300">{homeWins}-{homeLosses}</span></span>
              <span>Away: <span className="text-zinc-300">{awayWins}-{awayLosses}</span></span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {meta && (
        <div className="flex items-center justify-between mt-auto pt-1 border-t border-white/5">
          <span className="text-[9px] text-zinc-700">
            Updated {new Date(meta.updatedAt).toLocaleTimeString()} · Source {(meta.sourceUsed ?? "mlb").toUpperCase()}
          </span>
          <button
            type="button"
            className="text-[9px] text-zinc-700 hover:text-zinc-500 transition-colors"
            onClick={() => props.onReportBug({ widget: "mlb_trend_chart", teamKey: activeTeamKey, meta })}
          >
            Report issue
          </button>
        </div>
      )}
    </div>
  );
}
