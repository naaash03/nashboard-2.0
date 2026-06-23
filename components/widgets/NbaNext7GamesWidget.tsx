"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type ScheduleGame = {
  id: string;
  date: string;
  opponentKey: string;
  opponentName: string;
  homeAway: "home" | "away";
  result?: "W" | "L";
  teamScore?: number;
  opponentScore?: number;
};

type NextGames = {
  teamKey: string;
  inSeason: boolean;
  games: ScheduleGame[];
  recent: ScheduleGame[];
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

export default function NbaNext7GamesWidget(props: WidgetCommonProps) {
  const initialTeamKey = ((props.config.teamKey as string) ?? "").toUpperCase();
  const [teamKey, setTeamKey] = useState(initialTeamKey);
  const [teamInput, setTeamInput] = useState(initialTeamKey);
  const [data, setData] = useState<NextGames | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const advanced = props.mode === "ADVANCED";

  const load = useCallback(async (key: string) => {
    setLoading(true);
    const res = await fetch(`/api/widgets/nba-next-7-games?teamKey=${encodeURIComponent(key)}&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`, { cache: "no-store" });
    const json = (await res.json()) as { data?: NextGames | null; meta?: WidgetMeta; error?: string };
    setLoading(false);
    if (!res.ok) throw new Error(json.error ?? "Failed to load NBA schedule");
    return { data: json.data ?? null, meta: json.meta ?? null };
  }, [props.dataMode, props.refreshTick]);

  useEffect(() => {
    if (!teamKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await load(teamKey);
        if (cancelled) return;
        setData(result.data);
        setMeta(result.meta);
        setWarning(result.meta?.warning ?? null);
      } catch (error) {
        if (cancelled) return;
        setData(null);
        setMeta(null);
        setWarning(String(error));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teamKey, load, props.refreshTick]);

  async function applyTeam() {
    const next = teamInput.trim().toUpperCase();
    setTeamInput(next);
    setTeamKey(next);
    setData(null);
    await props.onPersist({ config: { ...props.config, teamKey: next } });
  }

  // Off-season fallback: when there are no upcoming games, show last results.
  const offseason = data ? !data.inSeason : false;
  const games = data?.games ?? [];
  const recent = data?.recent ?? [];

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">NBA Next 7 Games</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={props.mode}
          onChange={(e) => void props.onPersist({ mode: e.target.value as "BEGINNER" | "ADVANCED" })}
          disabled={props.locked}
        >
          <option value="BEGINNER">Beginner</option>
          <option value="ADVANCED">Advanced</option>
        </select>
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          placeholder="Team (e.g. NYK)"
          value={teamInput}
          onChange={(e) => setTeamInput(e.target.value.toUpperCase())}
        />
        <button className="rounded border border-neutral-700 px-2 py-1" type="button" onClick={() => void applyTeam()} disabled={props.locked}>
          Set
        </button>
      </div>

      {!teamKey && <p className="text-neutral-400">Enter a team abbreviation and press Set.</p>}
      {loading && <p className="text-neutral-400">Loading schedule...</p>}
      {warning && <p className="text-amber-300">{warning}</p>}

      {data && offseason && (
        <div className="rounded border border-amber-800 bg-amber-950/40 p-2 text-amber-200">
          <span className="rounded border border-amber-700 bg-amber-950 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
            Out of season
          </span>
          <p className="mt-1 text-neutral-300">No upcoming NBA games scheduled. Showing this team&apos;s most recent results.</p>
        </div>
      )}

      {games.length > 0 && (
        <div className="space-y-1">
          {games.map((game) => (
            <div key={game.id} className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-950 p-2">
              <span className="text-neutral-200">{game.homeAway === "home" ? "vs" : "@"} {advanced ? game.opponentName : game.opponentKey}</span>
              <span className="text-neutral-500">{to12h(game.date)}</span>
            </div>
          ))}
        </div>
      )}

      {games.length === 0 && recent.length > 0 && (
        <div className="space-y-1">
          {recent.map((game) => (
            <div key={game.id} className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-950 p-2">
              <span className="flex items-center gap-1.5">
                <span className={game.result === "W" ? "text-emerald-400" : "text-red-400"}>{game.result ?? "-"}</span>
                <span className="text-neutral-200">{game.homeAway === "home" ? "vs" : "@"} {advanced ? game.opponentName : game.opponentKey}</span>
              </span>
              <span className="text-neutral-500">{game.teamScore ?? "-"}-{game.opponentScore ?? "-"}</span>
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
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, warning, teamKey })}
      >
        Report a bug
      </button>
    </div>
  );
}
