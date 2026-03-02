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
        throw new Error(json.error ?? "Failed to load MLB next 7 games");
      }
      setData(json.data ?? null);
      setMeta(json.meta ?? null);
      setError(json.error ?? null);
    } catch (loadError) {
      setError(String(loadError));
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

      {(data?.games ?? []).map((game) => (
        <div key={`${game.date}-${game.matchup}-${game.gamePk ?? "na"}`} className="rounded border border-neutral-700 bg-neutral-950 p-2">
          <p className="font-medium">{game.matchup}</p>
          <p>{toShortDate(game.date)} - {game.homeAway === "home" ? "Home" : "Away"}</p>
          {props.mode === "ADVANCED" ? (
            <>
              <p>GamePk: {game.gamePk ?? "-"}</p>
              <p>Probable pitcher: {game.probablePitcherName ?? "TBD"}</p>
            </>
          ) : null}
        </div>
      ))}

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
