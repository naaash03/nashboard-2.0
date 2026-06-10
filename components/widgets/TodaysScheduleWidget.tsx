"use client";

import { useCallback, useEffect, useState } from "react";
import SourceChips from "@/components/widgets/shared/SourceChips";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type Sport = "MLB" | "NBA" | "NFL";

export type TodaysScheduleWidgetProps = WidgetCommonProps & {
  sport: Sport;
};

type TeamEntry = {
  key: string;
  name: string;
  record?: string;
};

type ProbablePitcher = {
  homeAway: "home" | "away";
  name: string;
};

type WeatherInfo = {
  tempF: number | null;
  windMph: number | null;
  condition: string | null;
  weatherImpact: string;
  isOutdoor: boolean;
  isFallback: boolean;
  fallbackReason?: string;
};

type OddsInfo = {
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  overUnder: number | null;
  isFallback: boolean;
  fallbackReason?: string;
};

type ScheduleGame = {
  id: string;
  date: string;
  status: string;
  broadcaster?: string;
  awayTeam: TeamEntry;
  homeTeam: TeamEntry;
  probables?: ProbablePitcher[];
  oddsSummary?: string;
  odds?: OddsInfo;
  weather?: WeatherInfo;
  venueName?: string;
};

type ScheduleResponse = {
  data: {
    sport: Sport;
    dateUsed: string;
    games: ScheduleGame[];
    userFacingMessage: string;
  } | null;
  meta?: WidgetMeta;
  error?: string | null;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function weatherImpactColor(impact: string): string {
  if (impact === "high") return "text-red-400";
  if (impact === "moderate") return "text-amber-400";
  return "text-neutral-400";
}

function moneylineDisplay(value: number | null): string {
  if (value === null) return "-";
  return value > 0 ? `+${value}` : String(value);
}

function GameCard({ game, mode, sport }: { game: ScheduleGame; mode: string; sport: Sport }) {
  const awayRecord = game.awayTeam.record ? ` (${game.awayTeam.record})` : "";
  const homeRecord = game.homeTeam.record ? ` (${game.homeTeam.record})` : "";

  const homeProbable = game.probables?.find((p) => p.homeAway === "home");
  const awayProbable = game.probables?.find((p) => p.homeAway === "away");

  return (
    <div className="rounded border border-white/10 bg-neutral-800/40 p-2 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-slate-200">
          {game.awayTeam.name}{awayRecord}
          <span className="mx-1 text-neutral-500">vs</span>
          {game.homeTeam.name}{homeRecord}
        </span>
        <span className="shrink-0 text-[10px] text-neutral-500">{game.status}</span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-400">
        {game.broadcaster ? <span>{game.broadcaster}</span> : null}
        {mode === "advanced" && game.venueName ? (
          <span className="text-neutral-500">{game.venueName}</span>
        ) : null}
      </div>

      {sport === "MLB" && (homeProbable ?? awayProbable) ? (
        <div className="mt-1 text-[11px] text-neutral-400">
          <span className="text-neutral-500">SP: </span>
          {awayProbable?.name ?? "TBD"} vs {homeProbable?.name ?? "TBD"}
        </div>
      ) : null}

      {sport === "MLB" && game.weather ? (
        <div className={`mt-1 text-[11px] ${weatherImpactColor(game.weather.weatherImpact)}`}>
          {game.weather.isFallback ? (
            <span className="text-neutral-500">Weather unavailable</span>
          ) : game.weather.isOutdoor ? (
            <span>
              {game.weather.tempF !== null ? `${Math.round(game.weather.tempF)}°F` : ""}
              {game.weather.windMph !== null ? `  ${Math.round(game.weather.windMph)} mph` : ""}
              {game.weather.condition ? `  ${game.weather.condition}` : ""}
              {"  "}
              <span className="capitalize">{game.weather.weatherImpact} impact</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {mode === "beginner" && game.oddsSummary ? (
        <div className="mt-1 text-[11px] text-neutral-400">{game.oddsSummary}</div>
      ) : null}

      {mode === "advanced" && game.odds ? (
        <div className="mt-1 text-[11px] text-neutral-400">
          {game.odds.isFallback ? (
            <span className="text-neutral-500">Odds unavailable</span>
          ) : (
            <span>
              {game.awayTeam.name} {moneylineDisplay(game.odds.awayMoneyline)}
              {" / "}
              {game.homeTeam.name} {moneylineDisplay(game.odds.homeMoneyline)}
              {game.odds.overUnder !== null ? `  O/U ${game.odds.overUnder}` : ""}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function TodaysScheduleWidget(props: TodaysScheduleWidgetProps) {
  const { sport } = props;
  const [data, setData] = useState<ScheduleResponse["data"]>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  const mode = props.mode.toLowerCase();
  const sourceChips = sport === "MLB"
    ? [
        { label: meta?.sourceUsed === "fixture" ? "Fixture schedule" : "ESPN", tone: meta?.sourceUsed === "fixture" ? "fixture" as const : "live" as const },
        { label: "Odds", tone: "partial" as const },
        { label: "Weather", tone: "partial" as const },
      ]
    : [
        { label: meta?.sourceUsed === "fixture" ? "Fixture schedule" : "ESPN", tone: meta?.sourceUsed === "fixture" ? "fixture" as const : "live" as const },
        { label: "Odds", tone: "partial" as const },
      ];

  const load = useCallback(async () => {
    const url = `/api/widgets/${sport.toLowerCase()}-schedule-today?mode=${mode}&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as ScheduleResponse;
      if (!response.ok) {
        throw new Error(json.error ?? `Failed to load ${sport} schedule`);
      }
      setData(json.data ?? null);
      setMeta(json.meta ?? null);
      setError(json.error ?? null);
    } catch {
      setError(`Failed to load today's ${sport} schedule`);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [props.dataMode, props.refreshTick, mode, sport]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-200">Today&apos;s {sport} Schedule</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-300"
          value={props.mode}
          onChange={(event) => void props.onPersist({ mode: event.target.value as "BEGINNER" | "ADVANCED" })}
          disabled={props.locked}
        >
          <option value="BEGINNER">Beginner</option>
          <option value="ADVANCED">Advanced</option>
        </select>
      </div>

      {loading ? (
        <p className="text-neutral-400">Loading today&apos;s {sport} schedule...</p>
      ) : null}

      {!loading && error ? (
        <p className="text-amber-300">{error}</p>
      ) : null}

      {!loading && !error && data?.games.length === 0 ? (
        <p className="text-neutral-400">{data.userFacingMessage}</p>
      ) : null}

      {!loading && !error && sport === "NFL" && mode === "beginner" ? (
        <div className="rounded border border-blue-800 bg-blue-950/35 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-300">What to watch</p>
          <p className="mt-1 text-neutral-300">
            If no games are listed, it is usually an offseason or non-game day. On game days, start with kickoff time and TV before looking at odds.
          </p>
        </div>
      ) : null}

      {!loading && !error && (data?.games ?? []).length > 0 ? (
        <div className="space-y-2">
          {data?.games.map((game) => (
            <GameCard key={game.id} game={game} mode={mode} sport={sport} />
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-500">
        <span>Updated {meta ? to12h(meta.updatedAt) : "-"}</span>
        <SourceChips meta={meta} chips={sourceChips} />
      </div>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({
          widgetId: props.widgetId,
          sport,
          endpoint,
          meta,
          warnings: meta?.warning,
          endpointUrl: meta?.endpointUrl,
        })}
      >
        Report a bug
      </button>
    </div>
  );
}
