
"use client";

import { useMode } from "@/app/context/ModeContext";

interface TopBarProps {
  watchlistCount: number;
}

export function TopBar({ watchlistCount }: TopBarProps) {
  const { mode } = useMode();
  const isBeginner = mode === "beginner";

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3 md:px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight md:text-xl">
          My NashBoard
        </h1>
        <p className="text-xs text-slate-400 md:text-sm">
          {isBeginner
            ? "Multi-sport snapshot - guided analytics for newer fans"
            : "Multi-sport snapshot - deeper metrics & matchup context"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 md:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Live games: <span className="font-semibold">3</span>
        </div>
        <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 md:flex">
          <span className="h-2 w-2 rounded-full bg-indigo-400" />
          <span className="text-sm font-semibold text-slate-100">
            {watchlistCount}
          </span>
          <span className="text-[11px] text-slate-400">Watchlist players</span>
        </div>
        <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 md:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-medium text-emerald-300">
            {isBeginner ? "v0.1 - guided" : "v0.1 - manual advanced"}
          </span>
        </div>
        <button className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
          Edit layout
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold">
          AN
        </div>
      </div>
    </header>
  );
}

