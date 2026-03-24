"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import { MLB_TEAM_OPTIONS } from "@/lib/providers/mlb/teamMap";
import type { MlbSeriesTimelineGame, MlbSeriesTrackerData } from "@/lib/sports/resolvers/mlbSeriesTracker";

type SeriesTrackerResponse = {
  data: MlbSeriesTrackerData | null;
  meta?: (WidgetMeta & {
    state?: "success" | "partial" | "failed";
    seriesGroupingMethod?: "official" | "opponent_consecutive_dates";
    season?: number;
    seriesType?: string;
  }) | null;
  error?: string | null;
};

export function isSeriesAnalyticsGroupingMode(groupingMode?: MlbSeriesTrackerData["groupingMode"]): boolean {
  return groupingMode === "official_series" || groupingMode === "inferred_series";
}

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function safeError(message?: string | null): string {
  if (!message) return "The source failed.";
  const lowered = message.toLowerCase();
  if (lowered.includes("teamkey is required")) return "Select an MLB team.";
  return "The source failed.";
}

function safeWarning(message?: string): string | null {
  if (!message) return null;
  const lowered = message.toLowerCase();
  if (lowered.includes("cache") || lowered.includes("endpoint") || lowered.includes("request")) {
    return "MLB data warning. Use Report a bug for diagnostics.";
  }
  return message;
}

function timelineSecondaryLine(game: MlbSeriesTimelineGame): string {
  if (game.postponed?.isPostponed) {
    return game.postponed.rescheduledTime
      ? `Postponed. Rescheduled ${new Date(game.postponed.rescheduledTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}`
      : "Postponed";
  }
  if (game.status === "final" && game.recapLine) {
    return game.recapLine;
  }
  return game.statusText ?? "Scheduled";
}

function statusTone(game: MlbSeriesTimelineGame): string {
  if (game.result === "W") return "text-emerald-300";
  if (game.result === "L") return "text-rose-300";
  if (game.status === "postponed") return "text-amber-300";
  return "text-neutral-300";
}

function primaryTimelineGame(data: MlbSeriesTrackerData | null): MlbSeriesTimelineGame | null {
  if (!data || data.gameTimeline.length === 0) {
    return null;
  }
  return data.gameTimeline[0];
}

export default function MlbSeriesTrackerWidget(props: WidgetCommonProps) {
  const [teamKey, setTeamKey] = useState<string>(String(props.config.teamKey ?? "NYM").toUpperCase());
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(String(props.config.seriesId ?? ""));
  const [selectionPinned, setSelectionPinned] = useState<boolean>(Boolean(props.config.selectionPinned));
  const [data, setData] = useState<MlbSeriesTrackerData | null>(null);
  const [meta, setMeta] = useState<SeriesTrackerResponse["meta"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    const nextTeamKey = String(props.config.teamKey ?? "NYM").toUpperCase();
    if (nextTeamKey !== teamKey) {
      setTeamKey(nextTeamKey);
    }
  }, [props.config.teamKey, teamKey]);

  useEffect(() => {
    const nextSeriesId = String(props.config.seriesId ?? "");
    if (nextSeriesId !== selectedSeriesId) {
      setSelectedSeriesId(nextSeriesId);
    }
  }, [props.config.seriesId, selectedSeriesId]);

  useEffect(() => {
    const nextSelectionPinned = Boolean(props.config.selectionPinned);
    if (nextSelectionPinned !== selectionPinned) {
      setSelectionPinned(nextSelectionPinned);
    }
  }, [props.config.selectionPinned, selectionPinned]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      teamKey,
      mode: props.mode.toLowerCase(),
      dataMode: props.dataMode,
      cacheBust: String(props.refreshTick),
    });
    if (selectedSeriesId) {
      params.set("seriesId", selectedSeriesId);
      if (selectionPinned) {
        params.set("selectionPinned", "1");
      }
    }

    const url = `/api/widgets/mlb-series-tracker?${params.toString()}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as SeriesTrackerResponse;
      setMeta(json.meta ?? null);
      setData(json.data ?? null);
      setError(json.error ? safeError(json.error) : null);
      if (!response.ok && !json.data) {
        throw new Error(json.error ?? "Failed to load series tracker");
      }
    } catch {
      setData(null);
      setError("The source failed.");
    } finally {
      setLoading(false);
    }
  }, [teamKey, selectedSeriesId, selectionPinned, props.mode, props.dataMode, props.refreshTick]);

  useEffect(() => {
    void load();
  }, [load, props.refreshTick]);

  const onTeamChange = async (nextTeamKey: string) => {
    setTeamKey(nextTeamKey);
    setSelectedSeriesId("");
    setSelectionPinned(false);
    await props.onPersist({
      config: {
        ...props.config,
        teamKey: nextTeamKey,
        seriesId: "",
        selectionPinned: false,
      },
    });
  };

  const onSeriesChange = async (nextSeriesId: string) => {
    setSelectedSeriesId(nextSeriesId);
    setSelectionPinned(true);
    await props.onPersist({
      config: {
        ...props.config,
        teamKey,
        seriesId: nextSeriesId,
        selectionPinned: true,
      },
    });
  };

  const onGoToCurrentSeries = async () => {
    if (!data?.currentSeriesId) {
      return;
    }
    setSelectedSeriesId(data.currentSeriesId);
    setSelectionPinned(false);
    await props.onPersist({
      config: {
        ...props.config,
        teamKey,
        seriesId: data.currentSeriesId,
        selectionPinned: false,
      },
    });
  };

  const stateBanner = (() => {
    if (loading) return "Loading series tracker...";
    if (error) return "The source failed.";
    if (!data) return "No active series. Showing next upcoming series.";
    if (data.selectionState === "auto_promoted") return "Showing current matchup.";
    if (data.selectionState === "persisted_missing") return "Saved matchup was not found. Showing current matchup.";
    if (data.selectionState === "persisted_past") return "Viewing a past matchup.";
    return data.message ?? null;
  })();

  const springMatchupMode = data?.groupingMode === "spring_matchup";
  const showSeriesAnalytics = isSeriesAnalyticsGroupingMode(data?.groupingMode);
  const leadGame = primaryTimelineGame(data);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">MLB Series Tracker</span>
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

      <label className="block">
        <span className="mb-1 block text-neutral-400">Team</span>
        <select
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={teamKey}
          onChange={(event) => void onTeamChange(event.target.value)}
          disabled={props.locked}
        >
          {MLB_TEAM_OPTIONS.map((team) => (
            <option key={team.key} value={team.key}>{team.name} ({team.key})</option>
          ))}
        </select>
      </label>

      {data?.selectableSeries && data.selectableSeries.length > 0 ? (
        <label className="block">
          <span className="mb-1 block text-neutral-400">Series / Matchup</span>
          <select
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            value={data.seriesId || selectedSeriesId}
            onChange={(event) => void onSeriesChange(event.target.value)}
            disabled={props.locked}
          >
            {data.selectableSeries.map((series) => (
              <option key={series.seriesId} value={series.seriesId}>{series.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      {data?.canGoToCurrentSeries && data.currentSeriesId ? (
        <button
          type="button"
          className="rounded border border-neutral-700 px-2 py-1"
          onClick={() => void onGoToCurrentSeries()}
          disabled={props.locked}
        >
          Go to Current Matchup
        </button>
      ) : null}

      {stateBanner ? (
        <p className={`${loading ? "text-neutral-300" : error ? "text-amber-300" : "text-neutral-400"}`}>{stateBanner}</p>
      ) : null}

      {data ? (
        <div className="space-y-3 rounded border border-neutral-700 bg-neutral-900/40 p-2">
          <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">{data.seriesType.replaceAll("_", " ")}</p>
                <p className="font-medium">{data.team.name} vs {data.opponent.name}</p>
                <p className="text-[11px] text-neutral-300">{data.summary}</p>
                <p className="text-[11px] text-neutral-400">{data.statusLine}</p>
                {data.postseasonRound ? <p className="text-[11px] text-neutral-400">{data.postseasonRound}{data.bestOf ? ` | Best of ${data.bestOf}` : ""}</p> : null}
              </div>
              {showSeriesAnalytics ? (
                <div className="text-right">
                  <p className="text-[10px] text-neutral-500">Series Score</p>
                  <p className="font-medium">{data.seriesScore.display}</p>
                  <p className="text-[11px] text-neutral-400">Run Diff {data.runDifferential >= 0 ? `+${data.runDifferential}` : data.runDifferential}</p>
                </div>
              ) : (
                <div className="text-right">
                  <p className="text-[10px] text-neutral-500">Matchup Status</p>
                  <p className="font-medium">{leadGame?.chip ?? "Scheduled"}</p>
                </div>
              )}
            </div>

            {data.labels.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {data.labels.map((label) => (
                  <span key={label} className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-300">{label}</span>
                ))}
              </div>
            ) : null}
          </div>

          {props.mode === "BEGINNER" ? (
            springMatchupMode && leadGame ? (
              <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">Spring training matchup</p>
                <p className="mt-1 font-medium">{leadGame.dateLabel} | {leadGame.homeAway === "home" ? "Home" : "Away"}</p>
                <p className="text-[11px] text-neutral-400">{timelineSecondaryLine(leadGame)}</p>
                <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-2">
                  <p>Probable starter: {leadGame.probableStarter?.fullName ?? "TBD"}</p>
                  <p>Opponent starter: {leadGame.opponentProbableStarter?.fullName ?? "TBD"}</p>
                </div>
              </div>
            ) : (
              <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">Game Chips</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {data.gameTimeline.map((game) => (
                    <span
                      key={game.gameId}
                      className={`rounded border border-neutral-700 px-2 py-1 ${statusTone(game)}`}
                    >
                      {game.chip}
                    </span>
                  ))}
                </div>
              </div>
            )
          ) : (
            showSeriesAnalytics ? (
              <>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
                    <p className="text-[11px] uppercase tracking-wide text-neutral-500">{data.team.key}</p>
                    <p>Runs Scored: {data.teamTotals.runsScored}</p>
                    <p>Runs Allowed: {data.teamTotals.runsAllowed}</p>
                    {typeof data.teamTotals.teamAVG === "number" ? <p>Team AVG: {data.teamTotals.teamAVG.toFixed(3)}</p> : null}
                    {typeof data.teamTotals.teamOBP === "number" ? <p>Team OBP: {data.teamTotals.teamOBP.toFixed(3)}</p> : null}
                    {typeof data.teamTotals.teamSLG === "number" ? <p>Team SLG: {data.teamTotals.teamSLG.toFixed(3)}</p> : null}
                  </div>
                  <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
                    <p className="text-[11px] uppercase tracking-wide text-neutral-500">Series Analytics</p>
                    <p>Grouping: {data.groupingMethod === "official" ? "Official" : "Opponent + consecutive dates"}</p>
                    <p>Resolution: {data.resolution}</p>
                    <p>Run Differential: {data.runDifferential >= 0 ? `+${data.runDifferential}` : data.runDifferential}</p>
                    {typeof data.pitchingTotals.startersEra === "number" ? <p>Starters ERA: {data.pitchingTotals.startersEra.toFixed(2)}</p> : null}
                    {typeof data.bullpenTotals.bullpenEra === "number" ? <p>Bullpen ERA: {data.bullpenTotals.bullpenEra.toFixed(2)}</p> : null}
                  </div>
                </div>

                <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-neutral-500">Series Timeline</p>
                  <div className="mt-2 space-y-2">
                    {data.gameTimeline.map((game) => (
                      <div key={game.gameId} className="rounded border border-neutral-800 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{game.dateLabel} | {game.homeAway === "home" ? "Home" : "Away"}</p>
                            <p className="text-[11px] text-neutral-400">{timelineSecondaryLine(game)}</p>
                          </div>
                          <p className={`font-medium ${statusTone(game)}`}>{game.chip}</p>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <div className="rounded border border-neutral-800 p-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Probable Starter</p>
                            <div className="mt-1 flex items-center gap-2">
                              {game.probableStarter?.headshotUrl ? (
                                <img
                                  src={game.probableStarter.headshotUrl}
                                  alt={`${game.probableStarter.fullName ?? "Pitcher"} headshot`}
                                  className="h-7 w-7 rounded-full border border-neutral-700 object-cover"
                                />
                              ) : null}
                              <p>{game.probableStarter?.fullName ?? "TBD"}</p>
                            </div>
                          </div>
                          <div className="rounded border border-neutral-800 p-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Opponent Starter</p>
                            <div className="mt-1 flex items-center gap-2">
                              {game.opponentProbableStarter?.headshotUrl ? (
                                <img
                                  src={game.opponentProbableStarter.headshotUrl}
                                  alt={`${game.opponentProbableStarter.fullName ?? "Pitcher"} headshot`}
                                  className="h-7 w-7 rounded-full border border-neutral-700 object-cover"
                                />
                              ) : null}
                              <p>{game.opponentProbableStarter?.fullName ?? "TBD"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {data.recentHeadToHead.length > 0 ? (
                  <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
                    <p className="text-[11px] uppercase tracking-wide text-neutral-500">Last 5 Series vs {data.opponent.name}</p>
                    <div className="mt-1 space-y-1">
                      {data.recentHeadToHead.map((row) => (
                        <p key={row.seriesId} className="text-[11px] text-neutral-300">{row.label} | {row.result}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">Spring Matchup Details</p>
                <div className="mt-2 space-y-2">
                  {data.gameTimeline.map((game) => (
                    <div key={game.gameId} className="rounded border border-neutral-800 p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{game.dateLabel} | {game.homeAway === "home" ? "Home" : "Away"}</p>
                          <p className="text-[11px] text-neutral-400">{timelineSecondaryLine(game)}</p>
                        </div>
                        <p className={`font-medium ${statusTone(game)}`}>{game.chip}</p>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-2">
                        <p>Probable starter: {game.probableStarter?.fullName ?? "TBD"}</p>
                        <p>Opponent starter: {game.opponentProbableStarter?.fullName ?? "TBD"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      ) : null}

      {safeWarning(meta?.warning) ? <p className="text-amber-300">{safeWarning(meta?.warning)}</p> : null}
      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} - Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({
          widgetId: props.widgetId,
          endpoint,
          meta,
          teamKey,
          selectedSeriesId,
          state: data?.state ?? meta?.state,
          warnings: meta?.warning,
        })}
      >
        Report a bug
      </button>
    </div>
  );
}
