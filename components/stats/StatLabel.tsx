"use client";

import type { ReactNode } from "react";
import { useStatExplainer, type StatExplainerOptions } from "@/app/context/StatExplainerContext";
import { hasStatGlossaryEntry } from "@/lib/stats/glossary";
import type { StatSport } from "@/lib/stats/types";

type StatLabelProps = {
  statKey: string;
  sport: StatSport;
  children?: ReactNode;
  className?: string;
  options?: StatExplainerOptions;
};

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export default function StatLabel({
  statKey,
  sport,
  children,
  className,
  options,
}: StatLabelProps) {
  const { openExplainer } = useStatExplainer();
  const label = children ?? statKey;

  if (!hasStatGlossaryEntry(statKey, sport)) {
    return <>{label}</>;
  }

  return (
    <button
      type="button"
      className={cx(
        "group inline-flex items-center gap-1 rounded-sm text-current underline decoration-dotted underline-offset-4 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
        className,
      )}
      onClick={() => openExplainer(statKey, sport, options)}
      aria-label={`Explain ${options?.triggerLabel ?? statKey}`}
    >
      <span>{label}</span>
      <span aria-hidden className="text-[10px] font-semibold text-cyan-300 transition group-hover:text-cyan-200">
        i
      </span>
    </button>
  );
}
