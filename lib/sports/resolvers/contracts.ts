import type { Meta } from "@/lib/providers/types";
import type { WidgetPayload } from "@/lib/sports/models";

type PrimaryProvider = "apiSports" | "espn" | "mlb" | "balldontlie";

function effectiveProvider(meta: Meta, primary: PrimaryProvider): string {
  if (meta.sourceUsed === "cache") {
    return primary;
  }
  return meta.sourceUsed;
}

function resolveMode(meta: Meta, primary: PrimaryProvider): "live" | "fallback" | "fixture" {
  if (meta.dataModeEffective === "fixture" || meta.sourceUsed === "fixture") {
    return "fixture";
  }
  const provider = effectiveProvider(meta, primary);
  if (provider !== primary) {
    return "fallback";
  }
  return "live";
}

export function toWidgetPayload<T>(args: {
  data: T | null;
  error?: string | null;
  meta: Meta;
  primaryProvider: PrimaryProvider;
  notes?: string[];
}): WidgetPayload<T> {
  const { data, error = null, meta, primaryProvider, notes = [] } = args;
  const mode = resolveMode(meta, primaryProvider);
  const provider = effectiveProvider(meta, primaryProvider);
  const fallbackUsed = mode === "fallback"
    || mode === "fixture"
    || Boolean(meta.hydrationUsed)
    || ((meta.attemptedSources?.length ?? 0) > 1 && provider !== primaryProvider);
  const stale = meta.sourceUsed === "cache";
  const debugNotes = [
    ...(meta.notes ?? []),
    ...(meta.warnings ?? []),
    ...(meta.warning ? [meta.warning] : []),
    ...notes,
  ].filter(Boolean);

  return {
    ok: !error,
    data,
    error,
    source: {
      provider,
      mode,
      fallbackUsed,
      stale: stale || undefined,
      fetchedAt: meta.updatedAt,
    },
    debug: {
      notes: debugNotes.length > 0 ? debugNotes : undefined,
      requestId: meta.requestId,
    },
  };
}
