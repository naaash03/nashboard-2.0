"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type ViewMode = "beginner" | "advanced";

interface ModeContextType {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ViewMode>("beginner");

  const toggleMode = () =>
    setMode((prev) => (prev === "beginner" ? "advanced" : "beginner"));

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used inside ModeProvider");
  return ctx;
}

