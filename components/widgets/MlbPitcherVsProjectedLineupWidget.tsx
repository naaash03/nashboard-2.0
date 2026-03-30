"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import { MLB_TEAM_OPTIONS } from "@/lib/providers/mlb/teamMap";
import type { MlbPitcherVsProjectedLineupUi } from "@/lib/templates/mlbPitcherVsProjectedLineup";

type MatchupResponse = {
  data: MlbPitcherVsProjectedLineupUi | null;
  meta?: WidgetMeta | null;
  error?: string | null;
};

type StateNotice = {
  tone: "neutral" | "warning" | "error";
  title: string;
  detail?: string;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function toGameDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function findTeamByKey(key: string) {
  return MLB_TEAM_OPTIONS.find((team) => team.key === key.toUpperCase());
}

function formatHandedness(value?: string): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "L") return "left-handed";
  if (normalized === "R") return "right-handed";
  return value;
}

function parseTeamKeyFromQuery(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();

  const byKey = MLB_TEAM_OPTIONS.find((team) => team.key === upper);
  if (byKey) return byKey.key;

  const byName = MLB_TEAM_OPTIONS.find((team) => team.name.toUpperCase() === upper);
  if (byName) return byName.key;

  const keyFromSuffix = trimmed.match(/\(([A-Za-z]{2,4})\)\s*$/)?.[1]?.toUpperCase();
  if (keyFromSuffix && findTeamByKey(keyFromSuffix)) {
    return keyFromSuffix;
  }

  const byContains = MLB_TEAM_OPTIONS.find((team) => team.name.toUpperCase().includes(upper));
  return byContains?.key ?? null;
}

function verdictStyles(verdict?: string) {
  switch (verdict) {
    case "Good strikeout spot":
      return "border-emerald-500 bg-emerald-950/70 text-emerald-200";
    case "Slight pitcher edge":
      return "border-blue-500 bg-blue-950/70 text-blue-200";
    case "Neutral matchup":
      return "border-neutral-600 bg-neutral-900 text-neutral-200";
    case "Contact-risk matchup":
      return "border-amber-500 bg-amber-950/70 text-amber-200";
    case "Dangerous lineup spot":
      return "border-red-500 bg-red-950/70 text-red-200";
    default:
      return "border-neutral-700 bg-neutral-950 text-neutral-200";
  }
}

function confidenceStyles(label?: string) {
  switch (label) {
    case "High":
      return "border-emerald-900/80 bg-emerald-950/30 text-emerald-300";
    case "Medium":
      return "border-amber-900/80 bg-amber-950/30 text-amber-300";
    default:
      return "border-neutral-800 bg-neutral-950 text-neutral-300";
  }
}

function componentTone(direction: "pitcher" | "hitter" | "neutral") {
  if (direction === "pitcher") return "border-emerald-900/80 bg-emerald-950/25";
  if (direction === "hitter") return "border-red-900/80 bg-red-950/20";
  return "border-neutral-800 bg-neutral-950";
}

function stateNoticeStyles(tone: StateNotice["tone"]) {
  if (tone === "error") return "border-red-900/80 bg-red-950/20";
  if (tone === "warning") return "border-amber-900/80 bg-amber-950/20";
  return "border-neutral-800 bg-neutral-950";
}

function safeError(message?: string | null): string {
  if (!message) return "Failed to load matchup data";
  if (message.toLowerCase().includes("no upcoming")) return "No upcoming MLB game found";
  return message === "Select a valid MLB team." ? message : "Failed to load matchup data";
}

function formatUiNote(note: string): string {
  if (note === "Projected lineup uses an active-roster approximation.") {
    return "Projected lineup is estimated from the active roster.";
  }
  if (note === "Opponent team contact and strikeout inputs are partial.") {
    return "Opponent contact and strikeout inputs are still partial.";
  }
  if (note.startsWith("Pitcher basis: ")) {
    return `Pitcher sample: ${note.slice("Pitcher basis: ".length)}`;
  }
  return note;
}

export function buildPitcherVsProjectedLineupStateNotice(args: {
  loading: boolean;
  error: string | null;
  data: MlbPitcherVsProjectedLineupUi | null;
}): StateNotice | null {
  if (args.loading) {
    return {
      tone: "neutral",
      title: "Loading matchup",
      detail: "Checking the next game, probable starter, and projected lineup context.",
    };
  }
  if (args.error) {
    return {
      tone: args.error === "No upcoming MLB game found" ? "neutral" : "error",
      title: args.error,
      detail: args.error === "Select a valid MLB team." ? "Search by full team name or abbreviation." : undefined,
    };
  }
  if (!args.data) {
    return {
      tone: "neutral",
      title: "No upcoming MLB game found",
      detail: "The selected team does not have a scheduled upcoming game in the current data window.",
    };
  }
  if (args.data.state === "partial") {
    return {
      tone: "warning",
      title: "Starter not posted yet",
      detail: "This read uses the projected lineup only until the probable starter is listed.",
    };
  }
  return null;
}

export function buildPitcherVsLineupPitcherStatLine(
  pitcherSummary: MlbPitcherVsProjectedLineupUi["pitcherSummary"],
): string[] {
  if (!pitcherSummary) {
    return [];
  }

  return [
    pitcherSummary.era !== undefined ? `ERA ${pitcherSummary.era.toFixed(2)}` : null,
    pitcherSummary.kPer9 !== undefined ? `K/9 ${pitcherSummary.kPer9.toFixed(1)}` : null,
    pitcherSummary.bbPer9 !== undefined ? `BB/9 ${pitcherSummary.bbPer9.toFixed(1)}` : null,
  ].filter((value): value is string => Boolean(value));
}

export default function MlbPitcherVsProjectedLineupWidget(props: WidgetCommonProps) {
  const [teamQuery, setTeamQuery] = useState("");
  const [activeTeamKey, setActiveTeamKey] = useState<string>(String(props.config.teamKey ?? "NYM").toUpperCase());
  const [selectedGameId, setSelectedGameId] = useState<string>(String(props.config.gameId ?? ""));
  const [data, setData] = useState<MlbPitcherVsProjectedLineupUi | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    const configTeamKey = String(props.config.teamKey ?? "NYM").toUpperCase();
    if (configTeamKey !== activeTeamKey) {
      setActiveTeamKey(configTeamKey);
    }
    const option = findTeamByKey(configTeamKey);
    setTeamQuery(option ? `${option.name} (${option.key})` : configTeamKey);
  }, [props.config.teamKey, activeTeamKey]);

  useEffect(() => {
    const configGameId = String(props.config.gameId ?? "");
    if (configGameId !== selectedGameId) {
      setSelectedGameId(configGameId);
    }
  }, [props.config.gameId, selectedGameId]);

  const matchingTeams = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    if (!q) return MLB_TEAM_OPTIONS.slice(0, 6);
    return MLB_TEAM_OPTIONS
      .filter((team) => team.name.toLowerCase().includes(q) || team.key.toLowerCase().includes(q))
      .slice(0, 6);
  }, [teamQuery]);

  const load = useCallback(async () => {
    const mode = props.mode.toLowerCase();
    const params = new URLSearchParams({
      teamKey: activeTeamKey,
      mode,
      dataMode: props.dataMode,
      cacheBust: String(props.refreshTick),
    });
    if (selectedGameId) {
      params.set("gameId", selectedGameId);
    }
    const url = `/api/widgets/mlb-pitcher-vs-projected-lineup?${params.toString()}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as MatchupResponse;
      setMeta(json.meta ?? null);
      setData(json.data ?? null);
      setError(json.error ? safeError(json.error) : null);
      if (!response.ok && !json.data) {
        throw new Error(safeError(json.error));
      }
    } catch (loadError) {
      setError(safeError(String(loadError)));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeTeamKey, selectedGameId, props.mode, props.dataMode, props.refreshTick]);

  useEffect(() => {
    void load();
  }, [load, props.refreshTick]);

  const applyTeam = async (nextTeamKey: string) => {
    if (!nextTeamKey) return;
    const option = findTeamByKey(nextTeamKey);
    setActiveTeamKey(nextTeamKey);
    setSelectedGameId("");
    setTeamQuery(option ? `${option.name} (${option.key})` : nextTeamKey);
    await props.onPersist({
      config: {
        ...props.config,
        teamKey: nextTeamKey,
        gameId: "",
      },
    });
  };

  const onSubmitTeamSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const resolved = parseTeamKeyFromQuery(teamQuery);
    if (!resolved) {
      setError("Select a valid MLB team.");
      return;
    }
    await applyTeam(resolved);
  };

  const onGameChange = async (nextGameId: string) => {
    setSelectedGameId(nextGameId);
    await props.onPersist({
      config: {
        ...props.config,
        teamKey: activeTeamKey,
        gameId: nextGameId,
      },
    });
  };

  const advanced = props.mode === "ADVANCED";
  const stateNotice = buildPitcherVsProjectedLineupStateNotice({ loading, error, data });
  const pitcherStatLine = buildPitcherVsLineupPitcherStatLine(data?.pitcherSummary ?? null);

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">Pitcher vs Projected Lineup</span>
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

      <form className="space-y-1.5" onSubmit={(event) => void onSubmitTeamSearch(event)}>
        <label className="block">
          <span className="mb-1 block text-neutral-400">Team</span>
          <div className="flex gap-2">
            <input
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
              value={teamQuery}
              onChange={(event) => setTeamQuery(event.target.value)}
              placeholder="Search MLB team"
              disabled={props.locked}
            />
            <button type="submit" className="rounded border border-neutral-700 px-2 py-1" disabled={props.locked}>
              Apply
            </button>
          </div>
        </label>
        <div className="flex flex-wrap gap-1">
          {matchingTeams.map((team) => (
            <button
              key={team.key}
              type="button"
              className={`rounded border px-2 py-1 text-[10px] ${
                team.key === activeTeamKey
                  ? "border-emerald-600 bg-emerald-950/20 text-emerald-300"
                  : "border-neutral-700 text-neutral-300"
              }`}
              onClick={() => void applyTeam(team.key)}
              disabled={props.locked}
            >
              {team.name} ({team.key})
            </button>
          ))}
        </div>
      </form>

      {data?.selectableGames && data.selectableGames.length > 1 ? (
        <label className="block">
          <span className="mb-1 block text-neutral-400">Game</span>
          <select
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            value={selectedGameId || data.game.gameId}
            onChange={(event) => void onGameChange(event.target.value)}
            disabled={props.locked}
          >
            {data.selectableGames.map((option) => (
              <option key={option.gameId} value={option.gameId}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {stateNotice ? (
        <div className={`rounded border p-3 ${stateNoticeStyles(stateNotice.tone)}`}>
          <p className="font-medium text-neutral-100">{stateNotice.title}</p>
          {stateNotice.detail ? <p className="mt-1 text-[11px] text-neutral-300">{stateNotice.detail}</p> : null}
        </div>
      ) : null}

      {data ? (
        <div className="space-y-3 rounded border border-neutral-700 bg-neutral-900/40 p-3">
          <div className="rounded border border-neutral-700 bg-neutral-950 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                  {data.state === "partial" ? "Starter pending" : "Matchup summary"}
                </p>
                <p className="text-sm font-semibold text-neutral-100">
                  {data.teamKey} {data.game.homeAway === "home" ? "vs" : "at"} {data.game.opponentKey}
                </p>
                <p className="text-[11px] text-neutral-400">
                  {toGameDateTime(data.game.gameDate)}
                  {data.game.venue ? ` | ${data.game.venue}` : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded border border-neutral-800 px-2 py-1 text-[10px] text-neutral-300">
                    {data.lineupSummary.projectedLineupLabel}
                  </span>
                  <span className="rounded border border-neutral-800 px-2 py-1 text-[10px] text-neutral-300">
                    {data.game.probableStarterPosted ? "Starter posted" : "Starter pending"}
                  </span>
                </div>
              </div>

              <div className="space-y-2 md:text-right">
                <span className={`inline-flex rounded border px-2 py-1 text-[10px] font-medium ${verdictStyles(data.verdict ?? "Pending")}`}>
                  {data.verdict ?? "Matchup pending"}
                </span>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {data.matchupScore !== undefined ? (
                    <span className="rounded border border-neutral-800 px-2 py-1 text-[10px] text-neutral-200">
                      Score {data.matchupScore}/100
                    </span>
                  ) : null}
                  {data.confidenceLabel ? (
                    <span className={`rounded border px-2 py-1 text-[10px] ${confidenceStyles(data.confidenceLabel)}`}>
                      Confidence {data.confidenceLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded border border-neutral-700 bg-neutral-950 p-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                {advanced ? "Pitcher profile" : "Starting pitcher"}
              </p>
              {data.pitcherSummary ? (
                <div className="mt-2 space-y-1.5 text-neutral-200">
                  <p className="font-medium text-neutral-100">{data.pitcherSummary.fullName}</p>
                  <p className="text-[11px] text-neutral-400">
                    {formatHandedness(data.pitcherSummary.handedness)
                      ? `Throws ${formatHandedness(data.pitcherSummary.handedness)}`
                      : "Handedness not available"}
                  </p>
                  {pitcherStatLine.length > 0 ? (
                    <p className="text-[11px] text-neutral-200">{pitcherStatLine.join(" | ")}</p>
                  ) : (
                    <p className="text-[11px] text-neutral-400">No posted stat line yet.</p>
                  )}
                  {data.pitcherSummary.recentFormEra !== undefined ? (
                    <p className="text-[11px] text-neutral-300">Last 3 starts ERA {data.pitcherSummary.recentFormEra.toFixed(2)}</p>
                  ) : null}
                  {advanced && data.pitcherSummary.record ? (
                    <p className="text-[11px] text-neutral-400">Record {data.pitcherSummary.record}</p>
                  ) : null}
                  {advanced && data.pitcherSummary.statsBasisLabel ? (
                    <p className="text-[11px] text-neutral-400">{data.pitcherSummary.statsBasisLabel}</p>
                  ) : null}
                  {advanced && data.pitcherSummary.confidenceNote ? (
                    <p className="text-[11px] text-amber-300">{data.pitcherSummary.confidenceNote}</p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 space-y-1.5">
                  <p className="text-neutral-300">Probable starter not posted yet.</p>
                  <p className="text-[11px] text-neutral-500">The grade stays partial until MLB lists a starter.</p>
                </div>
              )}
            </div>

            <div className="rounded border border-neutral-700 bg-neutral-950 p-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                {advanced ? "Projected lineup profile" : "Opponent profile"}
              </p>
              <div className="mt-2 space-y-1.5 text-neutral-200">
                <p className="font-medium text-neutral-100">{data.lineupSummary.teamName}</p>
                <p className="text-[11px] text-neutral-300">{data.lineupSummary.handednessSummary}</p>
                {data.lineupSummary.contactSummary ? (
                  <p className="text-[11px] text-neutral-400">Team tendency: {data.lineupSummary.contactSummary}</p>
                ) : null}
                {advanced ? (
                  <p className="text-[11px] text-neutral-500">{data.lineupSummary.projectedLineupLabel}</p>
                ) : null}
                {advanced && data.lineupSummary.recentContext ? (
                  <p className="text-[11px] text-neutral-400">{data.lineupSummary.recentContext}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded border border-neutral-700 bg-neutral-950 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">Why this grade</p>
              <span className="text-[10px] text-neutral-500">3 key reasons</span>
            </div>
            <ol className="mt-2 space-y-2">
              {data.reasons.map((reason, index) => (
                <li key={`${reason}-${index}`} className="flex gap-3 rounded border border-neutral-800 bg-neutral-950/70 p-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-700 text-[10px] text-neutral-400">
                    {index + 1}
                  </span>
                  <span className="text-[11px] leading-5 text-neutral-200">{reason}</span>
                </li>
              ))}
            </ol>
          </div>

          {advanced && data.componentBreakdown && data.componentBreakdown.length > 0 ? (
            <div className="rounded border border-neutral-700 bg-neutral-950 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">Advanced breakdown</p>
                <span className="text-[10px] text-neutral-500">5 scoring inputs</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {data.componentBreakdown.map((component) => (
                  <div key={component.key} className={`rounded border p-2 ${componentTone(component.direction)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-neutral-100">{component.label}</p>
                        {component.valueLabel ? <p className="mt-0.5 text-[10px] text-neutral-500">{component.valueLabel}</p> : null}
                      </div>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${
                          component.delta > 0
                            ? "border-emerald-900/80 text-emerald-300"
                            : component.delta < 0
                            ? "border-red-900/80 text-red-300"
                            : "border-neutral-800 text-neutral-400"
                        }`}
                      >
                        {component.delta > 0 ? "+" : ""}
                        {component.delta.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-neutral-300">{component.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded border border-neutral-800 bg-neutral-950/90 p-3">
            <p className="text-[10px] uppercase tracking-wide text-neutral-600">Context and assumptions</p>
            <p className="mt-1 text-[11px] text-neutral-400">{data.assumptionsNote}</p>
            {advanced && data.notes && data.notes.length > 0 ? (
              <div className="mt-2 space-y-1 text-[10px] text-neutral-500">
                {data.notes.map((note, index) => (
                  <p key={`${note}-${index}`}>{formatUiNote(note)}</p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {meta?.warning ? <p className="text-amber-300">{meta.warning}</p> : null}
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
          teamKey: activeTeamKey,
          gameId: selectedGameId || data?.game.gameId,
          state: data?.state,
          notes: data?.notes,
        })}
      >
        Report a bug
      </button>
    </div>
  );
}
