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

type RecentForm = {
  teamKey: string;
  record: { wins: number; losses: number };
  winPct: number;
  streak: string;
  rating: "Hot" | "Warm" | "Cool" | "Cold";
  games: ScheduleGame[];
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function RatingBadge({ rating }: { rating: RecentForm["rating"] }) {
  const styles: Record<RecentForm["rating"], string> = {
    Hot: "border-red-500 bg-red-950 text-red-300",
    Warm: "border-orange-500 bg-orange-950 text-orange-300",
    Cool: "border-blue-500 bg-blue-950 text-blue-300",
    Cold: "border-cyan-700 bg-cyan-950 text-cyan-300",
  };
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${styles[rating]}`}>
      {rating}
    </span>
  );
}

export default function NbaRecentFormWidget(props: WidgetCommonProps) {
  const initialTeamKey = ((props.config.teamKey as string) ?? "").toUpperCase();
  const [teamKey, setTeamKey] = useState(initialTeamKey);
  const [teamInput, setTeamInput] = useState(initialTeamKey);
  const [data, setData] = useState<RecentForm | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const advanced = props.mode === "ADVANCED";

  const load = useCallback(async (key: string) => {
    setLoading(true);
    const res = await fetch(`/api/widgets/nba-recent-form?teamKey=${encodeURIComponent(key)}&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`, { cache: "no-store" });
    const json = (await res.json()) as { data?: RecentForm | null; meta?: WidgetMeta; error?: string };
    setLoading(false);
    if (!res.ok) throw new Error(json.error ?? "Failed to load NBA recent form");
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
        setWarning(result.meta?.warning ?? (!result.data || result.data.games.length === 0 ? "No recent NBA games found for this team." : null));
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

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">NBA Recent Form</span>
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
      {warning && <p className="text-amber-300">{warning}</p>}
      {loading && <p className="text-neutral-400">Loading recent form...</p>}

      {data && data.games.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{data.teamKey}</span>
            <RatingBadge rating={data.rating} />
            <span className="text-neutral-400">
              {data.record.wins}-{data.record.losses} · {(data.winPct * 100).toFixed(0)}% · Streak {data.streak}
            </span>
          </div>

          {!advanced ? (
            <p className="text-neutral-400">
              Rating reflects wins and losses over the last {data.games.length} games. {data.rating === "Hot" || data.rating === "Warm" ? "Trending up." : "Trending down."}
            </p>
          ) : (
            <div className="space-y-1 rounded border border-neutral-800 bg-neutral-950 p-2">
              {data.games.map((game) => (
                <div key={game.id} className="grid grid-cols-4 gap-1">
                  <span className={game.result === "W" ? "text-emerald-400" : "text-red-400"}>{game.result ?? "-"}</span>
                  <span className="text-neutral-300">{game.homeAway === "home" ? "vs" : "@"} {game.opponentKey}</span>
                  <span className="text-right text-neutral-400">{game.teamScore ?? "-"}-{game.opponentScore ?? "-"}</span>
                  <span className="text-right text-neutral-500">{to12h(game.date)}</span>
                </div>
              ))}
            </div>
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
      >
        Report a bug
      </button>
    </div>
  );
}
