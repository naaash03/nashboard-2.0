"use client";

const KEY = "nashboard_dev_data_mode_v1";

export function getGuestDataMode(): "live" | "fixture" {
  if (typeof window === "undefined") return "live";
  const value = window.sessionStorage.getItem(KEY);
  return value === "fixture" ? "fixture" : "live";
}

export function setGuestDataMode(mode: "live" | "fixture"): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, mode);
}

