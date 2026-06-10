"use client";

import { useCallback, useEffect, useState } from "react";
import SourceChips from "@/components/widgets/shared/SourceChips";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import type { NflTeamContextCardUi } from "@/lib/templates/nflTeamContextCard";

type TeamContextResponse = {
  data?: NflTeamContextCardUi;
  meta?: WidgetMeta;
  error?: string | null;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function toGameDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function badgeClass(statusLabel: string): string {
  if (statusLabel === "Offseason") return "border-neutral-700 bg-neutral-900 text-neutral-300";
  if (statusLabel === "Bye week") return "border-amber-700 bg-amber-950 text-amber-300";
  if (statusLabel === "What's next") return "border-emerald-700 bg-emerald-950 text-emerald-300";
  return "border-blue-700 bg-blue-950 text-blue-300";
}

export default function NflTeamContextCardWidget(props: WidgetCommonProps) {
  const configuredTeamKey = typeof props.config.teamKey === "string" ? props.config.teamKey.toUpperCase() : "";
  const configuredSeason = (() => {
    const raw = props.config.season;
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
    if (typeof raw === "string" && /^\d{4}$/.test(raw.trim())) return Number.parseInt(raw.trim(), 10);
    return null;
  })();
  const currentYear = new Date().getUTCFullYear();
  const baseSeasonOptions = Array.from({ length: 6 }, (_, index) => currentYear - index);
  const [teamInput, setTeamInput] = useState(configuredTeamKey);
  const [activeTeamKey, setActiveTeamKey] = useState(configuredTeamKey);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(configuredSeason);
  const [data, setData] = useState<NflTeamContextCardUi | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const advanced = props.mode === "ADVANCED";

  useEffect(() => {
    setTeamInput(configuredTeamKey);
    setActiveTeamKey(configuredTeamKey);
  }, [configuredTeamKey]);

  useEffect(() => {
    setSelectedSeason(configuredSeason);
  }, [configuredSeason]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      mode: props.mode.toLowerCase(),
      dataMode: props.dataMode,
      cacheBust: String(props.refreshTick),
    });
    if (activeTeamKey) params.set("teamKey", activeTeamKey);
    if (selectedSeason) params.set("season", String(selectedSeason));
    const url = `/api/widgets/nfl-team-context-card?${params.toString()}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as TeamContextResponse;
      if (!response.ok) throw new Error(json.error ?? "Failed to load NFL team context");
      setData(json.data ?? null);
      setMeta(json.meta ?? null);
      setError(json.error ?? null);
    } catch (loadError) {
      setData(null);
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }, [activeTeamKey, props.dataMode, props.mode, props.refreshTick, selectedSeason]);

  useEffect(() => {
    void load();
  }, [load]);

  const game = data?.nextGame ?? data?.mostRecentGame ?? null;
  const recordLabel = data?.currentRecord
    ? `${data.currentRecord.wins}-${data.currentRecord.losses}${data.currentRecord.ties ? `-${data.currentRecord.ties}` : ""}`
    : "Record unavailable";
  const seasonValueLabel = data?.seasonLabel ?? (data ? `${data.season}` : "-");
  const autoSeasonLabel = data?.isOffseason ? `Auto (${data.season} Season)` : "Auto (Current)";
  const seasonOptions = Array.from(new Set([
    ...baseSeasonOptions,
    ...(configuredSeason ? [configuredSeason] : []),
    ...(data?.season ? [data.season] : []),
  ])).sort((left, right) => right - left);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">NFL Team Context Card</span>
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
        <label className="text-[10px] uppercase tracking-wide text-neutral-500" htmlFor={`${props.widgetId}-team-context-key`}>{advanced ? "Live team key" : "Team"}</label>
        <div className="flex gap-2">
          <input
            id={`${props.widgetId}-team-context-key`}
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
        {teamInput && teamInput !== activeTeamKey ? <p className="text-[10px] text-neutral-500">Press Set to load {teamInput}.</p> : null}
        {!activeTeamKey ? <p className="text-[10px] text-neutral-500">Choose a team to replace the sample offseason card.</p> : null}
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-neutral-500" htmlFor={`${props.widgetId}-team-context-season`}>Season</label>
        <select
          id={`${props.widgetId}-team-context-season`}
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={selectedSeason ? String(selectedSeason) : "auto"}
          onChange={(event) => {
            const nextValue = event.target.value;
            const parsedSeason = nextValue === "auto" ? null : Number.parseInt(nextValue, 10);
            const nextSeason = parsedSeason !== null && Number.isFinite(parsedSeason) ? parsedSeason : null;
            setSelectedSeason(nextSeason);
            void props.onPersist({
              config: {
                ...props.config,
                season: nextSeason ?? "",
              },
            });
          }}
          disabled={props.locked}
        >
          <option value="auto">{autoSeasonLabel}</option>
          {seasonOptions.map((season) => (
            <option key={season} value={season}>{season} Season</option>
          ))}
        </select>
        {!selectedSeason && data?.isOffseason ? (
          <p className="text-[10px] text-neutral-500">Offseason default uses the last completed season unless you choose a different year.</p>
        ) : null}
      </div>

      {loading ? <p className="text-neutral-400">Loading team context...</p> : null}
      {error ? <p className="text-amber-300">{error}</p> : null}
      {meta?.warning ? <p className="text-amber-300">{meta.warning}</p> : null}

      {data ? (
        <div className="space-y-2">
          {!advanced ? (
            <div className="rounded border border-blue-800 bg-blue-950/35 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-300">What to watch</p>
              <p className="mt-1 text-neutral-300">
                Check whether the team has a real next game, a bye-week pause, or only the last completed season to review.
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-neutral-100">{data.teamName}</p>
                <p className="mt-1 text-neutral-400">{data.summary}</p>
              </div>
              <span className={`rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${badgeClass(data.statusLabel)}`}>
                {data.statusLabel}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded border border-neutral-800 bg-neutral-900/70 p-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">Current record</p>
                <p className="mt-1 font-medium text-neutral-100">{recordLabel}</p>
              </div>
              <div className="rounded border border-neutral-800 bg-neutral-900/70 p-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">Season</p>
                <p className="mt-1 font-medium text-neutral-100">{seasonValueLabel}</p>
              </div>
            </div>
          </div>

          {game ? (
            <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                {data.nextGame ? "Game window" : "Last result"}
              </p>
              <p className="mt-1 font-medium text-neutral-100">
                {game.awayTeam.abbreviation} at {game.homeTeam.abbreviation}
              </p>
              <p className="mt-1 text-neutral-300">{toGameDate(game.date)}</p>
              {game.status === "final" && game.homeScore !== null && game.awayScore !== null ? (
                <p className="mt-1 text-neutral-400">Final score: {game.awayTeam.abbreviation} {game.awayScore} - {game.homeTeam.abbreviation} {game.homeScore}</p>
              ) : null}
              {game.venue ? <p className="mt-1 text-[11px] text-neutral-500">{game.venue}</p> : null}
            </div>
          ) : (
            <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5 text-neutral-400">
              No game card available right now.
            </div>
          )}

          {advanced ? (
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">Division rank</p>
                <p className="mt-1 text-neutral-200">{data.divisionRank ? `${data.divisionRank}` : "Unavailable"}</p>
              </div>
              <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">Conference seed</p>
                <p className="mt-1 text-neutral-200">{data.currentRank ? `${data.currentRank}` : "Unavailable"}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-500">
        <span>Updated {meta ? to12h(meta.updatedAt) : "-"}</span>
        <SourceChips meta={meta} />
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
