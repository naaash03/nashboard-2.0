export type DataMode = "live" | "fixture";
export type DataModeSource = "query" | "dev_override" | "preference" | "fallback";

export type DataModeResolution = {
  resolvedDataMode: DataMode;
  source: DataModeSource;
  queryDataMode: DataMode | null;
  devOverrideDataMode: DataMode | null;
  preferenceDataMode: DataMode | null;
  fallbackDataMode: DataMode;
  isDevEnvironment: boolean;
};

export function normalizeDataMode(value: unknown): DataMode | null {
  if (value === "live" || value === "fixture") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "live" || normalized === "fixture") {
    return normalized;
  }
  return null;
}

export function isDevDataModeOverrideEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return process.env.NEXT_PUBLIC_ENABLE_DEV_DATA_MODE === "1";
}

export function resolveDataMode(input: {
  queryDataMode?: unknown;
  devOverrideDataMode?: unknown;
  preferenceDataMode?: unknown;
  fallbackDataMode?: unknown;
  isDevEnvironment?: boolean;
}): DataModeResolution {
  const queryDataMode = normalizeDataMode(input.queryDataMode);
  const devOverrideDataMode = normalizeDataMode(input.devOverrideDataMode);
  const preferenceDataMode = normalizeDataMode(input.preferenceDataMode);
  const fallbackDataMode = normalizeDataMode(input.fallbackDataMode) ?? "live";
  const isDevEnvironment = Boolean(input.isDevEnvironment ?? isDevDataModeOverrideEnabled());

  if (queryDataMode) {
    return {
      resolvedDataMode: queryDataMode,
      source: "query",
      queryDataMode,
      devOverrideDataMode: isDevEnvironment ? devOverrideDataMode : null,
      preferenceDataMode,
      fallbackDataMode,
      isDevEnvironment,
    };
  }

  if (isDevEnvironment && devOverrideDataMode) {
    return {
      resolvedDataMode: devOverrideDataMode,
      source: "dev_override",
      queryDataMode,
      devOverrideDataMode,
      preferenceDataMode,
      fallbackDataMode,
      isDevEnvironment,
    };
  }

  if (preferenceDataMode) {
    return {
      resolvedDataMode: preferenceDataMode,
      source: "preference",
      queryDataMode,
      devOverrideDataMode: isDevEnvironment ? devOverrideDataMode : null,
      preferenceDataMode,
      fallbackDataMode,
      isDevEnvironment,
    };
  }

  return {
    resolvedDataMode: fallbackDataMode,
    source: "fallback",
    queryDataMode,
    devOverrideDataMode: isDevEnvironment ? devOverrideDataMode : null,
    preferenceDataMode,
    fallbackDataMode,
    isDevEnvironment,
  };
}

export function resolveDataModeFromRequest(req: Request): DataModeResolution {
  const { searchParams } = new URL(req.url);
  return resolveDataMode({
    queryDataMode: searchParams.get("dataMode"),
    devOverrideDataMode: searchParams.get("devOverrideMode"),
    preferenceDataMode: searchParams.get("preferenceMode"),
    fallbackDataMode: "live",
    isDevEnvironment: isDevDataModeOverrideEnabled(),
  });
}
