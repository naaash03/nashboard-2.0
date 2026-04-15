"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import type { NflRecentFormUi } from "@/lib/templates/nflRecentForm";

type RecentFormResponse = {
  data?: NflRecentFormUi;
  meta?: WidgetMeta;
  error?: string | null;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function resultClass(result: string): string {
  if (result === "W") return "border-emerald-700 bg-emerald-950 text-emerald-300";
  if (result === "L") return "border-red-800 bg-red-950 text-red-300";
  if (result === "T") return "border-neutral-700 bg-neutral-900 text-neutral-300";
  if (result === "BYE") return "border-neutral-700 bg-neutral-900 text-neutral-400";
  return "border-blue-700 bg-transparent text-blue-300";
}

export default function NflRecentFormWidget(props: WidgetCommonProps) {
  const configuredTeamKey = typeof props.config.teamKey === "string" ? props.config.teamKey.toUpperCase() : "";
  const [teamInput, setTeamInput] = useState(configuredTeamKey);
  const [activeTeamKey, setActiveTeamKey] = useState(configuredTeamKey);
  const [data, setData] = useState<NflRecentFormUi | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const advanced = props.mode === "ADVANCED";

  useEffect(() => {
    setTeamInput(configuredTeamKey);
    setActiveTeamKey(configuredTeamKey);
  }, [configuredTeamKey]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      mode: props.mode.toLowerCase(),
      dataMode: props.dataMode,
      cacheBust: String(props.refreshTick),
    });
    if (activeTeamKey) params.set("teamKey", activeTeamKey);
    const url = `/api/widgets/nfl-recent-form?${params.toString()}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as RecentFormResponse;
      if (!response.ok) throw new Error(json.error ?? "Failed to load NFL recent form");
      setData(json.data ?? null);
      setMeta(json.meta ?? null);
      setError(json.error ?? null);
    } catch (loadError) {
      setData(null);
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }, [activeTeamKey, props.dataMode, props.mode, props.refreshTick]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">NFL Recent Form / Schedule Spot</span>
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
        <label className="text-[10px] uppercase tracking-wide text-neutral-500" htmlFor={`${props.widgetId}-recent-form-key`}>Live team key</label>
        <div className="flex gap-2">
          <input
            id={`${props.widgetId}-recent-form-key`}
            value={teamInput}
            onChange={(event) => setTeamInput(event.target.value.toUpperCase())}
            placeholder="e.g. PHI"
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            maxLength={4}
            disabled={props.locked}
          />
          <button
            type="button"
            className="rounded border border-neutral-700 px-2 py-1 text-neutral-200 disabled:text-neutral-500"
            disabled={props.locked || teamInput.trim().length === 0}
            onClick={() => {
              const nextTeamKey = teamInput.trim().toUpperCase();
              setTeamInput(nextTeamKey);
              setActiveTeamKey(nextTeamKey);
              void props.onPersist({ config: { ...props.config, teamKey: nextTeamKey } });
            }}
          >
            Set
          </button>
          <button
            type="button"
            className="rounded border border-neutral-700 px-2 py-1 text-neutral-400 disabled:text-neutral-600"
            disabled={props.locked || (!activeTeamKey && teamInput.trim().length === 0)}
            onClick={() => {
              setTeamInput("");
              setActiveTeamKey("");
              void props.onPersist({ config: { ...props.config, teamKey: "" } });
            }}
          >
            Clear
          </button>
        </div>
        {!activeTeamKey ? <p className="text-[10px] text-neutral-500">Without a team key, this widget stays on a demo recent-form read.</p> : null}
      </div>

      {loading ? <p className="text-neutral-400">Loading recent form...</p> : null}
      {error ? <p className="text-amber-300">{error}</p> : null}
      {meta?.warning ? <p className="text-amber-300">{meta.warning}</p> : null}

      {data ? (
        <div className="space-y-2">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-neutral-100">{data.teamName}</p>
                <p className="mt-1 text-neutral-400">{data.summary}</p>
              </div>
              <span className="rounded border border-amber-700 bg-amber-950 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-300">
                {data.scheduleLabel}
              </span>
            </div>

            <div className="mt-2 rounded border border-neutral-800 bg-neutral-900/70 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">{data.isOffseason ? `Final ${data.season} stretch` : "Trend read"}</p>
              <p className="mt-1 text-neutral-200">{data.streakSentence}</p>
              <p className="mt-1 text-[11px] text-neutral-500">Last five record: {data.recordLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {data.recentGames.map((game) => (
              <span key={game.gameId} className={`rounded border px-2 py-1 text-[11px] font-medium ${resultClass(game.result)}`}>
                {game.result} {game.opponentKey}
              </span>
            ))}
          </div>

          {advanced ? (
            <div className="space-y-2">
              <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500">Difficulty score</p>
                  <span className="text-[11px] text-neutral-400">{Math.round(data.scheduleDifficulty * 100)}%</span>
                </div>
                <div className="mt-2 h-2 rounded bg-neutral-800">
                  <div className="h-2 rounded bg-amber-500" style={{ width: `${Math.round(data.scheduleDifficulty * 100)}%` }} />
                </div>
              </div>

              <div className="space-y-2">
                {data.recentGames.map((game) => (
                  <div key={`${game.gameId}-row`} className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-neutral-100">
                        Week {game.week} {game.isHome ? "vs" : "@"} {game.opponentKey}
                      </p>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${resultClass(game.result)}`}>{game.result}</span>
                    </div>
                    <p className="mt-1 text-neutral-300">{game.score ?? "Score unavailable"}</p>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Opponent record: {game.opponentRecord ?? "Unavailable"}
                      {typeof game.opponentWinPct === "number" ? ` · ${(game.opponentWinPct * 100).toFixed(1)}% win pct` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} - Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, endpoint, meta, teamKey: activeTeamKey })}
      >
        Report a bug
      </button>
    </div>
  );
}
