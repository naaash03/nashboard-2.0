"use client";

import { useStatExplainer } from "@/components/stats/StatExplainerProvider";
import { lookupGlossaryTerm } from "@/lib/stats/glossary";

type ExplainerMode = "BEGINNER" | "ADVANCED";

export default function StatLabel({
  label,
  statKey,
  sport,
  mode = "BEGINNER",
  className = "",
}: {
  label: string;
  statKey?: string;
  sport?: string;
  mode?: ExplainerMode;
  className?: string;
}) {
  const context = useStatExplainer();
  const term = context ? lookupGlossaryTerm(context.terms, { key: statKey, label, sport }) : null;

  if (!context || !term) {
    return <span className={className}>{label}</span>;
  }

  return (
    <button
      type="button"
      className={`inline-flex cursor-help items-center border-b border-dotted border-current text-inherit ${className}`.trim()}
      onClick={() => context.openExplainer({ key: statKey, label, sport, mode })}
      title={`Explain ${term.label}`}
    >
      {label}
    </button>
  );
}
