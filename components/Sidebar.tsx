
"use client";

import { useMode } from "@/app/context/ModeContext";

export function Sidebar() {
  const { mode, setMode } = useMode();
  const isBeginner = mode === "beginner";

  return (
    <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-950/80 p-4 md:flex">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/90 text-lg font-bold">
          N
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">NashBoard</span>
          <span className="text-xs text-slate-400">Personal sports hub</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 text-sm">
        <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Overview
        </span>
        <button className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-slate-100 transition hover:bg-slate-800/70">
          <span>My Feed</span>
          <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[11px] text-indigo-300">
            Default
          </span>
        </button>
        <button className="rounded-lg px-3 py-2 text-left text-slate-300 transition hover:bg-slate-800/70">
          NFL
        </button>
        <button className="rounded-lg px-3 py-2 text-left text-slate-300 transition hover:bg-slate-800/70">
          NBA
        </button>
        <button className="rounded-lg px-3 py-2 text-left text-slate-300 transition hover:bg-slate-800/70">
          MLB
        </button>

        <div className="mt-6 border-t border-slate-800 pt-4">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mode
          </span>

          <button
            className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-xs ${
              isBeginner
                ? "bg-slate-800 text-slate-100"
                : "bg-slate-900/40 text-slate-400 hover:bg-slate-800/70"
            }`}
            onClick={() => setMode("beginner")}
          >
            Beginner: Guided view
            {isBeginner && (
              <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                Active
              </span>
            )}
          </button>

          <button
            className={`w-full rounded-lg px-3 py-2 text-left text-xs ${
              !isBeginner
                ? "bg-slate-800 text-slate-100"
                : "bg-slate-900/40 text-slate-400 hover:bg-slate-800/70"
            }`}
            onClick={() => setMode("advanced")}
          >
            Advanced: Raw metrics
            {!isBeginner && (
              <span className="ml-2 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300">
                Active
              </span>
            )}
          </button>
        </div>
      </nav>

      <div className="mt-4 rounded-lg border border-slate-800/80 bg-slate-900/50 p-3 text-xs text-slate-400">
        <p className="mb-1 font-medium text-slate-300">Today&apos;s focus</p>
        <p className="text-[11px] leading-relaxed">
          Dial in your RB vs D-line model for tonight&apos;s slate. Start with pressure
          rate &amp; yards after contact.
        </p>
      </div>
    </aside>
  );
}

