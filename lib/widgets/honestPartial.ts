export function markAsPartial<T extends Record<string, unknown>>(
  payload: T,
  reason: string,
): T & { isPartial: true; partialReason: string } {
  return { ...payload, isPartial: true as const, partialReason: reason };
}

export function markAsScaffold<T extends Record<string, unknown>>(
  payload: T,
  reason: string,
): T & { isScaffold: true; scaffoldReason: string } {
  return { ...payload, isScaffold: true as const, scaffoldReason: reason };
}

export function markAsDemo<T extends Record<string, unknown>>(
  payload: T,
): T & { isDemo: true } {
  return { ...payload, isDemo: true as const };
}

export function markAsFallback<T extends Record<string, unknown>>(
  payload: T,
  reason: string,
): T & { isFallback: true; fallbackReason: string } {
  return { ...payload, isFallback: true as const, fallbackReason: reason };
}
