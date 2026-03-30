"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StatLabel from "@/components/stats/StatLabel";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import { MLB_TEAM_OPTIONS } from "@/lib/providers/mlb/teamMap";
import type { MlbStartingPitcherMatchupData, PitcherMatchupCard } from "@/lib/sports/resolvers/mlbStartingPitcherMatchup";

type MatchupResponse = {
  data: MlbStartingPitcherMatchupData | null;
  meta?: (WidgetMeta & {
    fallbackUsed?: boolean;
    state?: "success" | "partial" | "failed";
    notes?: string[];
    warnings?: string[];
  }) | null;
  error?: string | null;
};

type MatchupSide = "away" | "home";

type PitcherMetricTile = {
  key: string;
  label: string;
  value: unknown;
  digits?: number;
  colSpan2?: boolean;
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

function metricLabel(value: unknown, digits = 2): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(digits);
  if (typeof value === "string") return value || "-";
  return "-";
}

function hasMetric(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return Number.isFinite(Number(value));
}

const PITCHER_METRIC_EXPLAINERS: Partial<Record<PitcherMetricTile["key"], { statKey: string; triggerLabel?: string }>> = {
  era: { statKey: "ERA" },
  whip: { statKey: "WHIP" },
  kPer9: { statKey: "K/9" },
  bbPer9: { statKey: "BB/9" },
  opponentAvg: { statKey: "AVG", triggerLabel: "Opp AVG" },
};

function renderPitcherMetricLabel(tile: PitcherMetricTile) {
  const explainer = PITCHER_METRIC_EXPLAINERS[tile.key];
  if (!explainer) {
    return tile.label;
  }

  return (
    <StatLabel statKey={explainer.statKey} sport="MLB" options={explainer.triggerLabel ? { triggerLabel: explainer.triggerLabel } : undefined}>
      {tile.label}
    </StatLabel>
  );
}

export function buildPitcherMetricTiles(
  pitcher: PitcherMatchupCard | null,
  mode: "BEGINNER" | "ADVANCED",
): PitcherMetricTile[] {
  if (!pitcher) {
    return [];
  }

  const base: PitcherMetricTile[] = [
    { key: "era", label: "ERA", value: pitcher.era, digits: 2 },
    { key: "record", label: "W-L", value: pitcher.record, digits: 0 },
  ];

  if (mode === "BEGINNER") {
    return base;
  }

  return [
    ...base,
    { key: "whip", label: "WHIP", value: pitcher.whip, digits: 2 },
    { key: "inningsPitched", label: "IP", value: pitcher.inningsPitched, digits: 1 },
    { key: "strikeouts", label: "K", value: pitcher.strikeouts, digits: 0 },
    { key: "kPer9", label: "K/9", value: pitcher.kPer9, digits: 1 },
    { key: "bbPer9", label: "BB/9", value: pitcher.bbPer9, digits: 1 },
    { key: "hrPer9", label: "HR/9", value: pitcher.hrPer9, digits: 1 },
    { key: "opponentAvg", label: "Opp AVG", value: pitcher.opponentAvg, digits: 3, colSpan2: true },
  ].filter((tile) => hasMetric(tile.value));
}

export function buildBeginnerStatLine(pitcher: PitcherMatchupCard | null): string[] {
  return buildPitcherMetricTiles(pitcher, "BEGINNER").map((tile) => `${tile.label} ${metricLabel(tile.value, tile.digits ?? 2)}`);
}

function hasPostedStarter(pitcher: PitcherMatchupCard | null): boolean {
  return Boolean(pitcher?.fullName);
}

export function buildMatchupSummary(data: MlbStartingPitcherMatchupData | null): string | null {
  if (!data) return null;
  const awayStarter = data.pitchers.away;
  const homeStarter = data.pitchers.home;

  if (hasPostedStarter(awayStarter) && hasPostedStarter(homeStarter)) {
    return `${data.game.awayTeam.key} starter ${metricLabel(awayStarter?.era)} ERA vs ${data.game.homeTeam.key} starter ${metricLabel(homeStarter?.era)} ERA`;
  }

  if (hasPostedStarter(awayStarter) && !hasPostedStarter(homeStarter)) {
    return `${awayStarter?.fullName ?? data.game.awayTeam.key} announced. ${data.game.homeTeam.key} starter TBD.`;
  }

  if (!hasPostedStarter(awayStarter) && hasPostedStarter(homeStarter)) {
    return `${homeStarter?.fullName ?? data.game.homeTeam.key} announced. ${data.game.awayTeam.key} starter TBD.`;
  }

  return "Probable starters not posted yet.";
}

function shouldShowBeginnerBasisLabel(label?: string): boolean {
  if (!label) return false;
  const lowered = label.toLowerCase();
  return lowered.includes("spring") || lowered.includes("limited") || lowered.includes("regular season");
}

function resolveBeginnerBasisLabel(data: MlbStartingPitcherMatchupData | null): string | null {
  if (!data) return null;
  const away = data.pitchers.away?.statsBasisLabel;
  const home = data.pitchers.home?.statsBasisLabel;
  if (away && home && away === home && shouldShowBeginnerBasisLabel(away)) {
    return away;
  }
  if (shouldShowBeginnerBasisLabel(away)) return away ?? null;
  if (shouldShowBeginnerBasisLabel(home)) return home ?? null;
  return null;
}

function safeMatchupError(message?: string | null): string {
  if (!message) return "Failed to load pitching matchup";
  const lowered = message.toLowerCase();
  if (lowered.includes("no upcoming")) return "No upcoming MLB game found";
  if (lowered.includes("teamkey is required")) return "Select an MLB team to load matchup data.";
  return "Failed to load pitching matchup";
}

function safeMatchupWarning(message?: string): string | null {
  if (!message) return null;
  const lowered = message.toLowerCase();
  if (
    lowered.includes("configured season")
    || lowered.includes("inferred")
    || lowered.includes("schedule window")
    || lowered.includes("time zone")
    || lowered.includes("timezone")
    || lowered.includes("cache")
    || lowered.includes("diagnostic")
    || lowered.includes("endpoint")
  ) {
    return null;
  }
  if (lowered.includes("no upcoming mlb game")) return "No upcoming MLB game found";
  if (lowered.includes("probable starter")) return "Probable starters are not fully posted yet.";
  if (lowered.includes("upstream")) return "MLB data warning. Use Report a bug for diagnostics.";
  return message;
}

function edgeLabelForWinner(winner: MatchupSide | "even", game: MlbStartingPitcherMatchupData["game"]): string {
  if (winner === "away") return game.awayTeam.key;
  if (winner === "home") return game.homeTeam.key;
  return "Even";
}

function categoryWinner(
  matchup: MlbStartingPitcherMatchupData | null,
  categoryLabel: "K/9" | "BB/9" | "Recent Form (3-start ERA)",
): string {
  if (!matchup?.edge?.categories || matchup.edge.categories.length === 0) {
    return "Even";
  }
  const found = matchup.edge.categories.find((row) => row.label === categoryLabel);
  if (!found) return "Even";
  return edgeLabelForWinner(found.winner, matchup.game);
}

function formatSplitsBlock(splits: Record<string, string | number> | undefined): string[] {
  if (!splits) return [];
  return Object.entries(splits).map(([key, value]) => `${key}: ${metricLabel(value, 2)}`);
}

function PitcherCard({
  side,
  pitcher,
  mode,
}: {
  side: MatchupSide;
  pitcher: PitcherMatchupCard | null;
  mode: "BEGINNER" | "ADVANCED";
}) {
  if (!pitcher) {
    return (
      <div className="flex h-full min-h-[126px] flex-col justify-center rounded border border-dashed border-neutral-700 bg-neutral-950 p-3">
        <p className="text-[11px] uppercase tracking-wide text-neutral-400">{side === "away" ? "Away Starter" : "Home Starter"}</p>
        <p className="mt-2 text-neutral-300">Probable starter not posted yet.</p>
        <p className="text-[10px] text-neutral-500">We will update this side when the probable starter is listed.</p>
      </div>
    );
  }

  const last3 = pitcher.last3Starts ?? [];
  const homeSplitRows = formatSplitsBlock(pitcher.homeAwaySplits?.home);
  const awaySplitRows = formatSplitsBlock(pitcher.homeAwaySplits?.away);
  const vsLeftRows = formatSplitsBlock(pitcher.handednessSplits?.vsLeft);
  const vsRightRows = formatSplitsBlock(pitcher.handednessSplits?.vsRight);
  const gameLogRows = pitcher.gameLogMiniSummary ?? [];
  const metricTiles = buildPitcherMetricTiles(pitcher, mode);
  const hasAdvancedMetrics = mode !== "ADVANCED" || metricTiles.length > 0;

  return (
    <div className="h-full rounded border border-neutral-700 bg-neutral-950 p-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{side === "away" ? "Away Starter" : "Home Starter"}</p>
      <div className="mt-2 flex items-center gap-2">
        {pitcher.headshotUrl ? (
          <img
            src={pitcher.headshotUrl}
            alt={`${pitcher.fullName} headshot`}
            className="h-10 w-10 rounded-full border border-neutral-700 object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 text-[10px] text-neutral-400">N/A</div>
        )}
        <div>
          <p className="font-medium">{pitcher.fullName}</p>
          <p className="text-[11px] text-neutral-400">
            {pitcher.handedness ? `Throws ${pitcher.handedness}` : "Handedness -"}
          </p>
          {mode === "ADVANCED" && pitcher.statsBasisLabel ? <p className="text-[10px] text-neutral-400">{pitcher.statsBasisLabel}</p> : null}
        </div>
      </div>

      {mode === "BEGINNER" ? (
        <p className="mt-2 text-[11px] text-neutral-300">
          {metricTiles.length > 0 ? (
            metricTiles.map((tile, index) => (
              <span key={tile.key}>
                {index > 0 ? " | " : null}
                {renderPitcherMetricLabel(tile)} {metricLabel(tile.value, tile.digits ?? 2)}
              </span>
            ))
          ) : "No posted stat line yet."}
        </p>
      ) : null}

      {mode !== "ADVANCED" ? null : (
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        {metricTiles.map((tile) => (
          <div key={tile.key} className={`rounded border border-neutral-800 px-2 py-1 ${tile.colSpan2 ? "col-span-2" : ""}`}>
            {renderPitcherMetricLabel(tile)}: {metricLabel(tile.value, tile.digits ?? 2)}
          </div>
        ))}
      </div>
      )}
      {mode === "ADVANCED" && !hasAdvancedMetrics ? <p className="mt-3 text-[11px] text-neutral-400">Advanced season stat splits are not posted yet.</p> : null}

      {mode === "ADVANCED" && last3.length > 0 ? (
        <div className="mt-3 rounded border border-neutral-800 p-2">
          <p className="text-[11px] font-medium">Last 3 Starts</p>
          <div className="mt-1 space-y-1 text-[11px] text-neutral-300">
            {last3.map((start, index) => (
              <p key={`${start.date ?? "na"}-${start.opponent ?? "opp"}-${index}`}>
                {(start.date ?? "-")} vs {start.opponent ?? "-"} | IP {start.innings ?? "-"} | ER {metricLabel(start.earnedRuns, 0)} | K {metricLabel(start.strikeouts, 0)}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {mode === "ADVANCED" && (homeSplitRows.length > 0 || awaySplitRows.length > 0) ? (
        <div className="mt-3 rounded border border-neutral-800 p-2 text-[11px]">
          <p className="font-medium">Home / Away Splits</p>
          {homeSplitRows.length > 0 ? <p className="mt-1 text-neutral-300">Home: {homeSplitRows.join(" | ")}</p> : null}
          {awaySplitRows.length > 0 ? <p className="mt-1 text-neutral-300">Away: {awaySplitRows.join(" | ")}</p> : null}
        </div>
      ) : null}

      {mode === "ADVANCED" && (vsLeftRows.length > 0 || vsRightRows.length > 0) ? (
        <div className="mt-3 rounded border border-neutral-800 p-2 text-[11px]">
          <p className="font-medium">Handedness Splits</p>
          {vsLeftRows.length > 0 ? <p className="mt-1 text-neutral-300">vs L: {vsLeftRows.join(" | ")}</p> : null}
          {vsRightRows.length > 0 ? <p className="mt-1 text-neutral-300">vs R: {vsRightRows.join(" | ")}</p> : null}
        </div>
      ) : null}

      {mode === "ADVANCED" && gameLogRows.length > 0 ? (
        <div className="mt-3 rounded border border-neutral-800 p-2 text-[11px]">
          <p className="font-medium">Season Game Log Summary</p>
          <p className="mt-1 text-neutral-300">{gameLogRows.join(" | ")}</p>
        </div>
      ) : null}

      {mode === "ADVANCED" && pitcher.confidenceNote ? <p className="mt-2 text-[10px] text-amber-300">{pitcher.confidenceNote}</p> : null}
    </div>
  );
}

export default function MlbStartingPitcherMatchupWidget(props: WidgetCommonProps) {
  const [teamQuery, setTeamQuery] = useState("");
  const [activeTeamKey, setActiveTeamKey] = useState<string>(String(props.config.teamKey ?? "NYM").toUpperCase());
  const [selectedGameId, setSelectedGameId] = useState<string>(String(props.config.gameId ?? ""));
  const [data, setData] = useState<MlbStartingPitcherMatchupData | null>(null);
  const [meta, setMeta] = useState<MatchupResponse["meta"]>(null);
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
    if (!q) return MLB_TEAM_OPTIONS.slice(0, 8);
    return MLB_TEAM_OPTIONS
      .filter((team) => team.name.toLowerCase().includes(q) || team.key.toLowerCase().includes(q))
      .slice(0, 8);
  }, [teamQuery]);

  const load = useCallback(async () => {
    const mode = props.mode.toLowerCase();
    const params = new URLSearchParams({
      sport: "mlb",
      teamKey: activeTeamKey,
      mode,
      dataMode: props.dataMode,
      cacheBust: String(props.refreshTick),
    });
    if (selectedGameId) {
      params.set("gameId", selectedGameId);
    }
    const url = `/api/widgets/mlb-starting-pitcher-matchup?${params.toString()}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as MatchupResponse;
      setMeta(json.meta ?? null);
      setData(json.data ?? null);
      setError(json.error ? safeMatchupError(json.error) : null);
      if (!response.ok && !json.data) {
        throw new Error(safeMatchupError(json.error));
      }
    } catch (loadError) {
      setError(safeMatchupError(String(loadError)));
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

  const stateBanner = (() => {
    if (loading) return "Loading matchup...";
    if (error) return "Failed to load pitching matchup";
    if (!data) return "No upcoming MLB game found";
    if (data.state === "partial") return "Game found, probable starters not posted yet";
    return null;
  })();

  const matchupSummary = buildMatchupSummary(data);
  const beginnerBasisLabel = props.mode === "BEGINNER" ? resolveBeginnerBasisLabel(data) : null;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">MLB Starting Pitcher Matchup</span>
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

      <form className="space-y-1" onSubmit={(event) => void onSubmitTeamSearch(event)}>
        <label className="block">
          <span className="mb-1 block text-neutral-400">Team Search</span>
          <div className="flex gap-2">
            <input
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
              value={teamQuery}
              onChange={(event) => setTeamQuery(event.target.value)}
              placeholder="Search MLB team (example: Mets or NYM)"
              disabled={props.locked}
            />
            <button type="submit" className="rounded border border-neutral-700 px-2 py-1" disabled={props.locked}>Apply</button>
          </div>
        </label>
        <div className="flex flex-wrap gap-1">
          {matchingTeams.map((team) => (
            <button
              key={team.key}
              type="button"
              className={`rounded border px-2 py-1 text-[10px] ${team.key === activeTeamKey ? "border-emerald-600 text-emerald-300" : "border-neutral-700 text-neutral-300"}`}
              onClick={() => void applyTeam(team.key)}
              disabled={props.locked}
            >
              {team.name} ({team.key})
            </button>
          ))}
        </div>
      </form>

      {props.mode === "ADVANCED" && data?.selectableGames && data.selectableGames.length > 0 ? (
        <label className="block">
          <span className="mb-1 block text-neutral-400">Game Selection</span>
          <select
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            value={selectedGameId || data.game.gameId}
            onChange={(event) => void onGameChange(event.target.value)}
            disabled={props.locked}
          >
            {data.selectableGames.map((option) => (
              <option key={option.gameId} value={option.gameId}>{option.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      {stateBanner ? (
        <p className={`${loading ? "text-neutral-300" : error ? "text-amber-300" : data?.state === "partial" ? "text-amber-300" : "text-neutral-400"}`}>
          {stateBanner}
        </p>
      ) : null}

      {data ? (
        <div className="space-y-3 rounded border border-neutral-700 bg-neutral-900/40 p-2">
          <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {data.game.awayTeam.logoUrl ? (
                  <img src={data.game.awayTeam.logoUrl} alt={`${data.game.awayTeam.name} logo`} className="h-6 w-6 object-contain" />
                ) : null}
                <p className="font-medium">{data.game.awayTeam.key}</p>
                <span className="text-neutral-500">at</span>
                <p className="font-medium">{data.game.homeTeam.key}</p>
                {data.game.homeTeam.logoUrl ? (
                  <img src={data.game.homeTeam.logoUrl} alt={`${data.game.homeTeam.name} logo`} className="h-6 w-6 object-contain" />
                ) : null}
              </div>
              <p className="text-[11px] text-neutral-400">{toGameDateTime(data.game.gameTime)}</p>
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">Venue: {data.game.venue ?? "-"}</p>
            {matchupSummary ? <p className="mt-1 text-[11px] text-neutral-300">{matchupSummary}</p> : null}
          </div>

          <div className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-2">
            <PitcherCard side="away" pitcher={data.pitchers.away} mode={props.mode} />
            <PitcherCard side="home" pitcher={data.pitchers.home} mode={props.mode} />
          </div>

          <div className="rounded border border-neutral-700 bg-neutral-950 p-2 text-[11px]">
            {props.mode === "ADVANCED" ? (
              <div className="space-y-1">
                <p className="font-medium">{data.edge?.overall ?? "Edge: neutral"}</p>
                <p>Strikeout edge: {categoryWinner(data, "K/9")}</p>
                <p>Control edge: {categoryWinner(data, "BB/9")}</p>
                <p>Recent form edge: {categoryWinner(data, "Recent Form (3-start ERA)")}</p>
              </div>
            ) : (
              <p className="font-medium">{data.edge?.beginnerSummary ?? data.edge?.overall ?? "Edge: neutral"}</p>
            )}
          </div>
          {beginnerBasisLabel ? <p className="text-[10px] text-neutral-400">{beginnerBasisLabel}</p> : null}
        </div>
      ) : null}

      {props.mode === "ADVANCED" && (data?.notes ?? []).length > 0 ? (
        <div className="rounded border border-neutral-700 bg-neutral-950 p-2 text-[10px] text-neutral-400">
          {(data?.notes ?? []).slice(0, 2).map((note, index) => (
            <p key={`${note}-${index}`}>{note}</p>
          ))}
        </div>
      ) : null}

      {safeMatchupWarning(meta?.warning) ? <p className="text-amber-300">{safeMatchupWarning(meta?.warning)}</p> : null}
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
          state: data?.state ?? meta?.state,
          notes: meta?.notes,
          userNotes: data?.notes,
          warnings: meta?.warnings ?? meta?.warning,
        })}
      >
        Report a bug
      </button>
    </div>
  );
}
