"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { findStatGlossaryEntry } from "@/lib/stats/glossary";
import type { StatGlossaryEntry, StatSport } from "@/lib/stats/types";

export type StatExplainerOptions = {
  triggerLabel?: string;
};

export type StatExplainerState = {
  isOpen: boolean;
  requestedKey: string | null;
  sport: StatSport | null;
  entry: StatGlossaryEntry | null;
  options?: StatExplainerOptions;
};

type StatExplainerContextType = {
  current: StatExplainerState;
  openExplainer: (statKey: string, sport: StatSport, options?: StatExplainerOptions) => void;
  closeExplainer: () => void;
};

const CLOSED_STATE: StatExplainerState = {
  isOpen: false,
  requestedKey: null,
  sport: null,
  entry: null,
};

const StatExplainerContext = createContext<StatExplainerContextType | undefined>(undefined);

export function StatExplainerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<StatExplainerState>(CLOSED_STATE);

  const openExplainer = (statKey: string, sport: StatSport, options?: StatExplainerOptions) => {
    const entry = findStatGlossaryEntry(statKey, sport);
    if (!entry) {
      return;
    }

    setCurrent({
      isOpen: true,
      requestedKey: statKey,
      sport,
      entry,
      options,
    });
  };

  const closeExplainer = () => {
    setCurrent(CLOSED_STATE);
  };

  return (
    <StatExplainerContext.Provider value={{ current, openExplainer, closeExplainer }}>
      {children}
    </StatExplainerContext.Provider>
  );
}

export function useStatExplainer() {
  const ctx = useContext(StatExplainerContext);
  if (!ctx) throw new Error("useStatExplainer must be used inside StatExplainerProvider");
  return ctx;
}
