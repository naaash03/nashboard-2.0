"use client";

import { createContext, useContext, useEffect, useState } from "react";
import StatExplainerModal from "@/components/stats/StatExplainerModal";
import {
  BUILTIN_GLOSSARY_TERMS,
  lookupGlossaryTerm,
  mergeGlossaryTerms,
  type GlossaryTerm,
} from "@/lib/stats/glossary";

type ExplainerMode = "BEGINNER" | "ADVANCED";

type OpenExplainerArgs = {
  key?: string | null;
  label?: string | null;
  sport?: string | null;
  mode?: ExplainerMode;
};

type ActiveTerm = {
  term: GlossaryTerm;
  mode: ExplainerMode;
};

type StatExplainerContextValue = {
  activeTerm: ActiveTerm | null;
  terms: GlossaryTerm[];
  openExplainer: (args: OpenExplainerArgs) => boolean;
  closeExplainer: () => void;
};

const StatExplainerContext = createContext<StatExplainerContextValue | null>(null);

export function useStatExplainer(): StatExplainerContextValue | null {
  return useContext(StatExplainerContext);
}

export default function StatExplainerProvider({ children }: { children: React.ReactNode }) {
  const [terms, setTerms] = useState<GlossaryTerm[]>(BUILTIN_GLOSSARY_TERMS);
  const [activeTerm, setActiveTerm] = useState<ActiveTerm | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/glossary", { cache: "no-store" });
        const json = (await response.json()) as { terms?: Array<Partial<GlossaryTerm>> };
        if (cancelled) {
          return;
        }
        if (Array.isArray(json.terms)) {
          setTerms(mergeGlossaryTerms(json.terms));
        }
      } catch {
        // Built-in glossary terms remain available as the fallback source.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value: StatExplainerContextValue = {
    activeTerm,
    terms,
    openExplainer: (args) => {
      const term = lookupGlossaryTerm(terms, args);
      if (!term) {
        return false;
      }
      setActiveTerm({ term, mode: args.mode ?? "BEGINNER" });
      return true;
    },
    closeExplainer: () => setActiveTerm(null),
  };

  return (
    <StatExplainerContext.Provider value={value}>
      {children}
      <StatExplainerModal />
    </StatExplainerContext.Provider>
  );
}
