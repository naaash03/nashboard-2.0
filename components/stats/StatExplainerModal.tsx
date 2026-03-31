"use client";

import { useEffect } from "react";
import { useStatExplainer } from "@/components/stats/StatExplainerProvider";

export default function StatExplainerModal() {
  const context = useStatExplainer();
  const activeTerm = context?.activeTerm ?? null;
  const closeExplainer = context?.closeExplainer;

  useEffect(() => {
    if (!activeTerm || !closeExplainer) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeExplainer();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTerm, closeExplainer]);

  if (!activeTerm || !closeExplainer) {
    return null;
  }

  const { term, mode } = activeTerm;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 p-4" onClick={() => closeExplainer()}>
      <div
        className="mx-auto max-w-lg rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-sm text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-400">{term.sport}</p>
            <h2 className="mt-1 text-lg font-semibold">{term.label}</h2>
          </div>
          <button
            type="button"
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-200"
            onClick={() => closeExplainer()}
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-6">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Definition</p>
            <p className="text-neutral-100">{term.plainDefinition}</p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Why It Matters</p>
            <p className="text-neutral-300">{term.whyItMatters}</p>
          </div>

          {mode === "ADVANCED" && term.advancedNotes ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">Advanced Note</p>
              <p className="text-neutral-300">{term.advancedNotes}</p>
            </div>
          ) : null}

          {term.learnMoreUrl ? (
            <a
              href={term.learnMoreUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-xs text-blue-300 underline"
            >
              Learn more
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
