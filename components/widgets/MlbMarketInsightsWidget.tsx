"use client";

import { useCallback, useEffect, useState } from "react";
import SourceChips from "@/components/widgets/shared/SourceChips";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type PublicBettingFallback = {
  isFallback: true;
  fallbackReason: string;
};

type BeginnerGame = {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  status: string;
  favoredSide: "home" | "away" | "even" | "unavailable";
  lineMovementDirection: "toward_home" | "toward_away" | "stable" | "unavailable";
  overUnderLine: number | null;
  publicBetting: PublicBettingFallback;
  marketSummary: string;
};

type AdvancedGame = {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  status: string;
  odds: {
    moneyline: { away: number | null; home: number | null; isFallback: boolean; fallbackReason?: string };
    overUnder: { line: number | null; isFallback: boolean; fallbackReason?: string };
    lineMovement: {
      awayOpen: number | null;
      homeOpen: number | null;
      awayVigShift: string | null;
      homeVigShift: string | null;
      isFallback: boolean;
      fallbackReason?: string;
    };
    publicBetting: PublicBettingFallback;
  };
  marketSummary: string;
};

type GameCard = BeginnerGame | AdvancedGame;

type InsightsData = {
  dateUsed: string;
  games: GameCard[];
  userFacingMessage: string;
  oddsUnavailable: boolean;
};

type InsightsResponse = {
  data: InsightsData | null;
  meta?: WidgetMeta | null;
  error?: string | null;
};

function formatGameTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: "America/New_York",
    });
  } catch {
    return dateStr;
  }
}

function FavoredBadge({ side }: { side: BeginnerGame["favoredSide"] }) {
  const labels: Record<typeof side, string> = {
    home: "Home favored",
    away: "Away favored",
    even: "Pick em",
    unavailable: "Odds N/A",
  };
  const colors: Record<typeof side, string> = {
    home: "text-blue-300",
    away: "text-purple-300",
    even: "text-zinc-400",
    unavailable: "text-zinc-600",
  };
  return <span className={`text-[10px] ${colors[side]}`}>{labels[side]}</span>;
}

function MovementBadge({ dir }: { dir: BeginnerGame["lineMovementDirection"] }) {
  if (dir === "unavailable") return null;
  const labels: Record<Exclude<typeof dir, "unavailable">, string> = {
    toward_home: "Line → home",
    toward_away: "Line → away",
    stable: "Line stable",
  };
  return (
    <span className="text-[10px] text-zinc-500">{labels[dir]}</span>
  );
}

function FallbackChip({ reason }: { reason?: string }) {
  return (
    <span className="text-[10px] text-zinc-600 italic">{reason ?? "Unavailable"}</span>
  );
}

function BeginnerCard({ game }: { game: BeginnerGame }) {
  return (
    <div className="rounded border border-white/10 bg-neutral-800/40 p-2.5 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[12px] font-semibold text-zinc-100">{game.awayTeam}</span>
          <span className="text-[10px] text-zinc-500 mx-1.5">@</span>
          <span className="text-[12px] font-semibold text-zinc-100">{game.homeTeam}</span>
        </div>
        <span className="text-[10px] text-zinc-500 whitespace-nowrap">{formatGameTime(game.gameTime)}</span>
      </div>
      <p className="text-[11px] text-zinc-300 leading-snug">{game.marketSummary}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <FavoredBadge side={game.favoredSide} />
        <MovementBadge dir={game.lineMovementDirection} />
        {game.overUnderLine !== null && (
          <span className="text-[10px] text-zinc-400">O/U {game.overUnderLine}</span>
        )}
      </div>
    </div>
  );
}

function AdvancedCard({ game }: { game: AdvancedGame }) {
  const { odds } = game;
  return (
    <div className="rounded border border-white/10 bg-neutral-800/40 p-2.5 flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[12px] font-semibold text-zinc-100">{game.awayTeam}</span>
          <span className="text-[10px] text-zinc-500 mx-1.5">@</span>
          <span className="text-[12px] font-semibold text-zinc-100">{game.homeTeam}</span>
        </div>
        <span className="text-[10px] text-zinc-500 whitespace-nowrap">{formatGameTime(game.gameTime)}</span>
      </div>

      <p className="text-[11px] text-zinc-300 leading-snug">{game.marketSummary}</p>

      {/* Moneyline row */}
      <div className="flex items-center gap-1 text-[10px]">
        <span className="text-zinc-600 w-20 shrink-0">Moneyline</span>
        {odds.moneyline.isFallback
          ? <FallbackChip reason={odds.moneyline.fallbackReason} />
          : <>
              <span className="text-zinc-400">{game.awayTeam.split(" ").pop()} {odds.moneyline.away ?? "—"}</span>
              <span className="text-zinc-600 mx-1">/</span>
              <span className="text-zinc-400">{game.homeTeam.split(" ").pop()} {odds.moneyline.home ?? "—"}</span>
            </>
        }
      </div>

      {/* O/U row */}
      <div className="flex items-center gap-1 text-[10px]">
        <span className="text-zinc-600 w-20 shrink-0">Over/Under</span>
        {odds.overUnder.isFallback
          ? <FallbackChip reason={odds.overUnder.fallbackReason} />
          : <span className="text-zinc-400">{odds.overUnder.line ?? "—"}</span>
        }
      </div>

      {/* Line movement row */}
      <div className="flex items-center gap-1 text-[10px]">
        <span className="text-zinc-600 w-20 shrink-0">Line movement</span>
        {odds.lineMovement.isFallback
          ? <FallbackChip reason={odds.lineMovement.fallbackReason} />
          : <span className="text-zinc-400">
              Open: away {odds.lineMovement.awayOpen} / home {odds.lineMovement.homeOpen}
              {odds.lineMovement.homeVigShift && (
                <span className="text-zinc-500 ml-1">(home shift {odds.lineMovement.homeVigShift})</span>
              )}
            </span>
        }
      </div>

      {/* Public betting row — always fallback */}
      <div className="flex items-center gap-1 text-[10px]">
        <span className="text-zinc-600 w-20 shrink-0">Public betting</span>
        <FallbackChip reason={odds.publicBetting.fallbackReason} />
      </div>
    </div>
  );
}

function isAdvancedGame(game: GameCard): game is AdvancedGame {
  return "odds" in game && typeof (game as AdvancedGame).odds === "object";
}

export default function MlbMarketInsightsWidget(props: WidgetCommonProps) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdvanced = props.mode === "ADVANCED";

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        mode: props.mode.toLowerCase(),
        dataMode: props.dataMode,
        cacheBust: String(props.refreshTick),
      });
      const res = await fetch(`/api/widgets/mlb-market-insights?${params}`);
      const body: InsightsResponse = await res.json();
      setData(body.data ?? null);
      setMeta(body.meta ?? null);
      setError(body.error ?? null);
    } catch {
      setError("Failed to load market insights.");
    } finally {
      setLoading(false);
    }
  }, [props.mode, props.dataMode, props.refreshTick]);

  useEffect(() => {
    void fetchInsights();
  }, [fetchInsights]);

  return (
    <div className="flex flex-col gap-2 p-3 h-full text-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-zinc-200 leading-none">
          MLB Market Insights
          {data?.dateUsed && <span className="text-zinc-500 font-normal"> · {data.dateUsed}</span>}
        </div>
        <SourceChips
          meta={meta}
          chips={[
            { label: meta?.sourceUsed === "fixture" ? "Fixture games" : "ESPN", tone: meta?.sourceUsed === "fixture" ? "fixture" : "live" },
            { label: "Odds", tone: data?.oddsUnavailable ? "partial" : "live" },
            { label: "Line movement", tone: "partial" },
          ]}
        />
      </div>

      {/* Odds unavailable notice */}
      {data?.oddsUnavailable && (
        <div className="rounded bg-zinc-800/60 border border-zinc-700 px-2 py-1.5 text-[10px] text-zinc-400">
          Odds data requires <span className="font-mono text-zinc-300">THE_ODDS_KEY</span> to be configured.
        </div>
      )}

      {/* Body */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[11px] text-zinc-500 animate-pulse">Loading market data...</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-[11px] text-amber-400">
          {error}
        </div>
      )}

      {!loading && !error && data && data.games.length === 0 && (
        <div className="text-[11px] text-zinc-500 mt-1">No MLB games scheduled today.</div>
      )}

      {!loading && !error && data && data.games.length > 0 && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0">
          {data.games.map((game) =>
            isAdvancedGame(game) && isAdvanced
              ? <AdvancedCard key={game.gameId} game={game} />
              : <BeginnerCard key={game.gameId} game={game as BeginnerGame} />
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-1.5 border-t border-white/5 flex flex-col gap-0.5">
        <p className="text-[9px] text-zinc-600 italic">
          For educational purposes only. NashBoard does not provide betting advice.
        </p>
        {meta && (
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-zinc-700">Updated {new Date(meta.updatedAt).toLocaleTimeString()}</span>
            <button
              type="button"
              className="text-[9px] text-zinc-700 hover:text-zinc-500 transition-colors"
              onClick={() => props.onReportBug({ widget: "mlb_market_insights", meta })}
            >
              Report issue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
