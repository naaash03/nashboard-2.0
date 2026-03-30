"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import { MLB_TEAM_OPTIONS } from "@/lib/providers/mlb/teamMap";

type NextSevenGame = {
  date: string;
  opponent: string;
  homeAway: "home" | "away";
  matchup: string;
  gamePk?: number;
  probablePitcherName?: string;
  probablePitcherId?: string;
};

type NextSevenResponse = {
  data: {
    teamKey: string;
    games: NextSevenGame[];
  } | null;
  meta?: WidgetMeta;
  error?: string | null;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function toShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function probablePitcherDisplayName(name?: string): string {
  const trimmed = (name ?? "").trim();
  return trimmed.length > 0 ? trimmed : "TBD";
}

export function buildMlbHeadshotUrl(playerId?: string): string | null {
  const id = (playerId ?? "").trim();
  if (!/^\d+$/.test(id)) return null;
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_80,q_auto:best/v1/people/${id}/headshot/67/current`;
}

function safeWarning(message?: string): string | null {
  if (!message) return null;
  const lowered = message.toLowerCase();
  if (lowered.includes("no upcoming games")) return "No upcoming games in the current window.";
  if (lowered.includes("unknown mlb team")) return "Unknown MLB team key.";
  return "MLB data warning. Use Report a bug for diagnostics.";
}

export default function MlbNext7GamesWidget(props: WidgetCommonProps) {
  const [teamKey, setTeamKey] = useState<string>(String(props.config.teamKey ?? "NYM").toUpperCase());
  const [data, setData] = useState<NextSevenResponse["data"]>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    const next = String(props.config.teamKey ?? "NYM").toUpperCase();
    if (next !== teamKey) {
      setTeamKey(next);
    }
  }, [props.config.teamKey, teamKey]);

  const load = useCallback(async () => {
    const mode = props.mode.toLowerCase();
    const url = `/api/widgets/mlb-next-7-games?teamKey=${encodeURIComponent(teamKey)}&mode=${mode}&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as NextSevenResponse;
      if (!response.ok) {
        throw new Error("Failed to load MLB next 7 games");
      }
      setData(json.data ?? null);
      setMeta(json.meta ?? null);
      setError(json.error ?? null);
    } catch (loadError) {
      setError("Failed to load MLB next 7 games");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [props.dataMode, props.mode, props.refreshTick, teamKey]);

  useEffect(() => {
    void load();
  }, [load, props.refreshTick]);

  const onTeamChange = async (nextTeamKey: string) => {
    setTeamKey(nextTeamKey);
    await props.onPersist({ config: { ...props.config, teamKey: nextTeamKey } });
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">MLB Next 7 Games</span>
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

      {loading ? <p className="text-neutral-300">Loading upcoming games...</p> : null}
      {error ? <p className="text-amber-300">{error}</p> : null}

      {!loading && !error && data?.games.length === 0 ? (
        <p className="text-neutral-400">No upcoming games in the current window.</p>
      ) : null}

      {(data?.games ?? []).map((game) => {
        const probableName = probablePitcherDisplayName(game.probablePitcherName);
        const probableHeadshotUrl = buildMlbHeadshotUrl(game.probablePitcherId);
        return (
        <div key={`${game.date}-${game.matchup}-${game.gamePk ?? "na"}`} className="rounded border border-neutral-700 bg-neutral-950 p-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{game.matchup}</p>
            <p className="text-[11px] text-neutral-400">{toShortDate(game.date)}</p>
          </div>
          <div className="mt-1">
            <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
              {game.homeAway === "home" ? "Home" : "Away"}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {probableHeadshotUrl && probableName !== "TBD" ? (
              <img
                src={probableHeadshotUrl}
                alt={`${probableName} headshot`}
                className="h-8 w-8 rounded-full border border-neutral-700 object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 text-[9px] text-neutral-500">SP</div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">Probable Starter</p>
              <p className="text-neutral-200">{probableName}</p>
            </div>
          </div>
          {props.mode === "ADVANCED" ? <p className="mt-2 text-[10px] text-neutral-500">Game ID: {game.gamePk ?? "-"}</p> : null}
        </div>
      )})}

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
          warnings: meta?.warning,
          endpointUrl: meta?.endpointUrl,
          teamKey,
        })}
      >
        Report a bug
      </button>
    </div>
  );
}
