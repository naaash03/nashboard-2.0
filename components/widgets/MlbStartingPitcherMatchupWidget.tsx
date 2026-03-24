"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type PitcherInfo = {
  playerId: string;
  fullName: string;
  throwsHand?: string;
  era?: string;
  whip?: string;
  inningsPitched?: string;
  strikeOuts?: number;
  wins?: number;
  losses?: number;
};

type GameInfo = {
  gameId: string;
  gamePk: number;
  gameTime: string;
  officialDate: string;
  status: string;
  homeTeam: { key: string; name: string; id: number };
  awayTeam: { key: string; name: string; id: number };
  venue?: string;
  seriesDescription?: string;
};

type MatchupData = {
  game: GameInfo;
  pitchers: { home: PitcherInfo | null; away: PitcherInfo | null };
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function PitcherBlock({
  pitcher,
  advanced,
}: {
  pitcher: PitcherInfo | null;
  advanced: boolean;
}) {
  if (!pitcher) return <p className="text-neutral-500">TBD</p>;
  return (
    <div>
      <p className="font-medium">
        {pitcher.fullName}
        {pitcher.throwsHand ? ` (${pitcher.throwsHand}HP)` : ""}
      </p>
      <p className="text-neutral-400">
        {pitcher.wins ?? "-"}W-{pitcher.losses ?? "-"}L · {pitcher.era ?? "-"} ERA
      </p>
      {advanced && (
        <p className="text-neutral-500">
          {pitcher.strikeOuts ?? "-"} K · {pitcher.inningsPitched ?? "-"} IP ·{" "}
          {pitcher.whip ?? "-"} WHIP
        </p>
      )}
    </div>
  );
}

export default function MlbStartingPitcherMatchupWidget(props: WidgetCommonProps) {
  const [teamKey, setTeamKey] = useState<string>((props.config.teamKey as string) ?? "");
  const [data, setData] = useState<MatchupData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(
    async (key: string) => {
      const res = await fetch(
        `/api/widgets/mlb-starting-pitcher-matchup?teamKey=${encodeURIComponent(key)}&dataMode=${props.dataMode}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        data?: MatchupData | null;
        meta?: WidgetMeta;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load matchup");
      return { data: json.data ?? null, meta: json.meta ?? null };
    },
    [props.dataMode],
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

  async function applyTeam() {
    await props.onPersist({ config: { ...props.config, teamKey } });
  }

  const advanced = props.mode === "ADVANCED";

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Starting Pitcher Matchup</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={props.mode}
          onChange={(e) =>
            void props.onPersist({ mode: e.target.value as "BEGINNER" | "ADVANCED" })
          }
          disabled={props.locked}
        >
          <option value="BEGINNER">Beginner</option>
          <option value="ADVANCED">Advanced</option>
        </select>
      </div>

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
      {data && !data.game && (
        <p className="text-neutral-400">No upcoming games found.</p>
      )}

      {data?.game && (
        <div className="space-y-2 rounded border border-neutral-700 bg-neutral-950 p-2">
          <div>
            <p className="font-medium">
              {data.game.awayTeam.key} @ {data.game.homeTeam.key}
            </p>
            <p className="text-neutral-400">
              {data.game.officialDate} · {to12h(data.game.gameTime)} · {data.game.status}
            </p>
            {advanced && data.game.venue && (
              <p className="text-neutral-500">{data.game.venue}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[10px] uppercase text-neutral-500">
                Away · {data.game.awayTeam.key}
              </p>
              <PitcherBlock pitcher={data.pitchers.away} advanced={advanced} />
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase text-neutral-500">
                Home · {data.game.homeTeam.key}
              </p>
              <PitcherBlock pitcher={data.pitchers.home} advanced={advanced} />
            </div>
          </div>
        </div>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source{" "}
        {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>
      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() =>
          props.onReportBug({ widgetId: props.widgetId, meta, warning, teamKey })
        }
      >
        Report a bug
      </button>
    </div>
  );
}
