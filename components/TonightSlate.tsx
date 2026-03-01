
"use client";

import { useMode } from "@/app/context/ModeContext";

type League = "NFL" | "NBA";

const games: {
  id: string;
  league: League;
  matchup: string;
  kickoff: string;
  line: string;
  beginnerBlurb: string;
  advancedBlurb: string;
}[] = [
  {
    id: "cowboys-eagles",
    league: "NFL",
    matchup: "Cowboys @ Eagles",
    kickoff: "8:15 PM",
    line: "PHI -3.5",
    beginnerBlurb:
      "Beginner view: keep an eye on QB vs defense and RB vs front-7 for this game.",
    advancedBlurb:
      "Advanced view: plug in pressure rate, rush EPA, and yards after contact once the metrics engine is wired.",
  },
  {
    id: "knicks-celtics",
    league: "NBA",
    matchup: "Knicks @ Celtics",
    kickoff: "7:30 PM",
    line: "BOS -6.0",
    beginnerBlurb:
      "Beginner view: focus on star vs team defense and pace to see if the line feels high or low.",
    advancedBlurb:
      "Advanced view: layer in on/off splits, 3P rate, and opponent eFG% when NBA stats are hooked up.",
  },
  {
    id: "rams-49ers",
    league: "NFL",
    matchup: "Rams @ 49ers",
    kickoff: "4:25 PM",
    line: "SF -4.0",
    beginnerBlurb:
      "Beginner view: watch QB vs pass rush and RB vs front-7 like in the RB vs D-line model.",
    advancedBlurb:
      "Advanced view: add pressure-to-sack rate, explosive run rate allowed, and red zone pass rate.",
  },
];

export function TonightSlate() {
  const { mode } = useMode();
  const isBeginner = mode === "beginner";

  return (
    <div className="lg:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-slate-100 md:text-base">
          Tonight&apos;s slate
        </h2>
        <span className="text-xs text-slate-400">
          Static data for now · API hookup later
        </span>
      </div>

      <div className="space-y-3">
        {games.map((game) => (
          <div
            key={game.id}
            className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3 md:flex-row md:items-center md:px-4"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {game.league}
              </span>
              <span className="text-sm font-semibold text-slate-50 md:text-base">
                {game.matchup}
              </span>
              <span className="text-xs text-slate-400">
                Kickoff · {game.kickoff}
              </span>
            </div>

            <div className="flex flex-col items-start gap-1 text-xs md:items-end">
              <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-200">
                Line: {game.line}
              </span>
              <p className="mt-1 text-xs text-slate-400">
                {isBeginner ? game.beginnerBlurb : game.advancedBlurb}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

