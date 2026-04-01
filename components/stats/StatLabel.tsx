"use client";

import { useStatExplainer } from "@/components/stats/StatExplainerProvider";
import { lookupGlossaryTerm } from "@/lib/stats/glossary";
import type { RankingContext } from "@/lib/stats/rankability";

type ExplainerMode = "BEGINNER" | "ADVANCED";

export default function StatLabel({
  label,
  statKey,
  sport,
  mode = "BEGINNER",
  className = "",
  rankingContext,
}: {
  label: string;
  statKey?: string;
  sport?: string;
  mode?: ExplainerMode;
  className?: string;
  /** Optional subject context supplied by the widget so the explainer can show live rankings. */
  rankingContext?: RankingContext;
}) {
  const context = useStatExplainer();
  const term = context ? lookupGlossaryTerm(context.terms, { key: statKey, label, sport }) : null;

  if (!context || !term) {
    return <span className={className}>{label}</span>;
  }

  return (
    <button
      type="button"
      className={`inline-flex cursor-help items-center rounded-sm text-inherit underline decoration-dotted underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${className}`.trim()}
      onClick={() => context.openExplainer({ key: statKey, label, sport, mode, rankingContext })}
      title={`Explain ${term.label}`}
    >
      {label}
    </button>
  );
}
