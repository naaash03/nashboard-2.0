"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
<<<<<<< HEAD

type GameEntry = {
  gamePk: number;
  date: string;
  gameTime: string;
  opponent: string;
  opponentKey: string;
  homeAway: "home" | "away";
  status: string;
  gameType?: string;
  gameTypeLabel?: string;
  venue?: string;
  seriesDescription?: string;
  probableStarter?: {
    playerId: string;
    fullName: string;
    throwsHand?: string;
  } | null;
};

type NextGamesData = {
  teamKey: string;
  teamName: string;
  games: GameEntry[];
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
=======
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
>>>>>>> 5518813dbf8beb460abbc3bf1376ae9c65caee03
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

<<<<<<< HEAD
function formatRecentResult(result: RecentResult): string {
  const wl = result.result ?? "-";
  const score =
    result.teamScore !== null && result.opponentScore !== null
      ? `${result.teamScore}-${result.opponentScore}`
      : "-";
  const loc = result.homeAway === "home" ? "vs" : "@";
  return `${wl} ${score} ${loc} ${result.opponentKey}`;
}

export default function MlbNext7GamesWidget(props: WidgetCommonProps) {
  const [teamKey, setTeamKey] = useState<string>((props.config.teamKey as string) ?? "");
  const [data, setData] = useState<NextGamesData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [recentResults, setRecentResults] = useState<RecentResultsData | null>(null);

  const load = useCallback(
    async (key: string) => {
      const mode = props.mode.toLowerCase();
      const res = await fetch(
        `/api/widgets/mlb-next-7-games?teamKey=${encodeURIComponent(key)}&mode=${mode}&dataMode=${props.dataMode}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        data?: NextGamesData | null;
        meta?: WidgetMeta;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load schedule");
      return { data: json.data ?? null, meta: json.meta ?? null };
    },
    [props.mode, props.dataMode],
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
        if (!cancelled) setRecentResults(json.data ?? null);
      } catch {
        // Ignore supplemental recent result failures.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamKey, props.dataMode, props.refreshTick]);

  async function applyTeam() {
    await props.onPersist({ config: { ...props.config, teamKey } });
  }
=======
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
>>>>>>> 5518813dbf8beb460abbc3bf1376ae9c65caee03

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">MLB Next 7 Games</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={props.mode}
<<<<<<< HEAD
          onChange={(e) =>
            void props.onPersist({ mode: e.target.value as "BEGINNER" | "ADVANCED" })
          }
=======
          onChange={(event) => props.onPersist({ mode: event.target.value as "BEGINNER" | "ADVANCED" })}
>>>>>>> 5518813dbf8beb460abbc3bf1376ae9c65caee03
          disabled={props.locked}
        >
          <option value="BEGINNER">Beginner</option>
          <option value="ADVANCED">Advanced</option>
        </select>
      </div>

<<<<<<< HEAD
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
              <p className="text-[10px] text-neutral-500">{result.gameTypeLabel ?? "Season Unknown"}</p>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-1">
          <p className="font-medium">{data.teamName}</p>
          {data.games.length === 0 ? (
            <p className="text-neutral-400">No games in the next 7 days.</p>
          ) : (
            data.games.map((game) => (
              <div key={game.gamePk} className="rounded border border-neutral-700 bg-neutral-950 p-1.5">
                <div className="flex items-center justify-between">
                  <span>
                    {game.homeAway === "home" ? "vs" : "@"} {game.opponentKey}
                  </span>
                  <span className="text-neutral-400">{game.date}</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>{to12h(game.gameTime)}</span>
                  <span>{game.status}</span>
                </div>
                <p className="text-[10px] text-neutral-500">{game.gameTypeLabel ?? game.seriesDescription ?? "Season Unknown"}</p>
                {props.mode === "ADVANCED" && game.probableStarter && (
                  <p className="text-neutral-300">
                    Probable starter: {game.probableStarter.fullName}
                    {game.probableStarter.throwsHand ? ` (${game.probableStarter.throwsHand}HP)` : ""}
                  </p>
                )}
                {props.mode === "ADVANCED" && game.venue && (
                  <p className="text-neutral-500">{game.venue}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>
      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, warning, teamKey })}
=======
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
>>>>>>> 5518813dbf8beb460abbc3bf1376ae9c65caee03
      >
        Report a bug
      </button>
    </div>
  );
}
