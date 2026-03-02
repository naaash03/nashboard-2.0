"use client";

import { isDevDataModeOverrideEnabled, normalizeDataMode, type DataMode } from "@/lib/dataMode";

const KEY = "nashboard.devDataModeOverride";

export function getDevDataModeOverride(): DataMode | null {
  if (typeof window === "undefined") return null;
  if (!isDevDataModeOverrideEnabled()) return null;
  return normalizeDataMode(window.sessionStorage.getItem(KEY));
}

export function setDevDataModeOverride(mode: DataMode | null): void {
  if (typeof window === "undefined") return;
  if (!isDevDataModeOverrideEnabled()) {
    window.sessionStorage.removeItem(KEY);
    return;
  }
  if (mode === "fixture") {
    window.sessionStorage.setItem(KEY, mode);
    return;
  }
  window.sessionStorage.removeItem(KEY);
}
