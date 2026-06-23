import { createHash } from "node:crypto";

type ParamRecord = Record<string, string | number | undefined | null> | undefined;

/** Deterministic, order-independent serialization of request params for cache keys. */
export function stableParams(params: ParamRecord): string {
  const entries = Object.entries(params ?? {})
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/** SHA-256 hex digest of an arbitrary string — used for the CachedResponse paramsHash. */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Normalize a cacheBust token; returns undefined when no meaningful bust was requested. */
export function resolveCacheBustToken(value: string | number | null | undefined): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve the effective data mode. "live"/"fixture" pass through; "auto" and
 * unset defer to the NASHBOARD_DATA_MODE env var (defaulting to live).
 */
export function resolveEnvDataMode(override?: "auto" | "live" | "fixture"): "live" | "fixture" {
  if (override === "live" || override === "fixture") {
    return override;
  }
  return (process.env.NASHBOARD_DATA_MODE ?? "live").toLowerCase() === "fixture" ? "fixture" : "live";
}
