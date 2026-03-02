export type DataMode = "auto" | "live" | "fixture";
export type DataModeSource = "query" | "preference" | "fallback";

export type DataModeResolution = {
  resolvedDataMode: DataMode;
  source: DataModeSource;
  queryDataMode: DataMode | null;
  preferenceDataMode: DataMode | null;
  fallbackDataMode: DataMode;
};

export function normalizeDataMode(value: unknown): DataMode | null {
  if (value === "live" || value === "fixture" || value === "auto") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "live" || normalized === "fixture" || normalized === "auto") {
    return normalized;
  }
  return null;
}

export function resolveDataMode(input: {
  queryDataMode?: unknown;
  preferenceDataMode?: unknown;
  fallbackDataMode?: unknown;
}): DataModeResolution {
  const queryDataMode = normalizeDataMode(input.queryDataMode);
  const preferenceDataMode = normalizeDataMode(input.preferenceDataMode);
  const fallbackDataMode = normalizeDataMode(input.fallbackDataMode) ?? "auto";

  if (queryDataMode) {
    return {
      resolvedDataMode: queryDataMode,
      source: "query",
      queryDataMode,
      preferenceDataMode,
      fallbackDataMode,
    };
  }

  if (preferenceDataMode) {
    return {
      resolvedDataMode: preferenceDataMode,
      source: "preference",
      queryDataMode,
      preferenceDataMode,
      fallbackDataMode,
    };
  }

  return {
    resolvedDataMode: fallbackDataMode,
    source: "fallback",
    queryDataMode,
    preferenceDataMode,
    fallbackDataMode,
  };
}

export function resolveDataModeFromRequest(req: Request): DataModeResolution {
  const { searchParams } = new URL(req.url);
  return resolveDataMode({
    queryDataMode: searchParams.get("dataMode"),
    preferenceDataMode: searchParams.get("preferenceMode"),
    fallbackDataMode: "auto",
  });
}
