import type { DataMode } from "@/lib/dataMode";

function normalized(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function canAutoUseFixtureFallback(): boolean {
  if (normalized(process.env.NASHBOARD_ALLOW_AUTO_FIXTURE_FALLBACK) === "1") {
    return true;
  }

  const nodeEnv = normalized(process.env.NODE_ENV);
  return nodeEnv === "test" || nodeEnv === "development";
}

export function shouldUseFixtureMode(mode: DataMode): boolean {
  return mode === "fixture";
}
