// Lightweight fixed-window rate limiter.
//
// NOTE: state is held in-process, so limits are enforced per server instance.
// That is sufficient for the self-hosted / single-container deploy path. For
// multi-instance or serverless deployments, back this with the existing
// Postgres (e.g. a small `RateLimitHit` table keyed by the same composite key)
// — the public API here is deliberately storage-agnostic so that swap is local.

type Window = { count: number; resetAtMs: number };

const windows = new Map<string, Window>();

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the window resets — surface as Retry-After when blocked. */
  retryAfterSeconds: number;
  /** Remaining requests in the current window (0 when blocked). */
  remaining: number;
};

/**
 * Record a hit against `key` and report whether it is allowed.
 *
 * @param key    Composite identifier, e.g. `register:1.2.3.4` or `login:a@b.com|1.2.3.4`.
 * @param limit  Max allowed hits per window.
 * @param windowMs Window length in milliseconds.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAtMs <= now) {
    windows.set(key, { count: 1, resetAtMs: now + windowMs });
    return { ok: true, retryAfterSeconds: 0, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000)),
      remaining: 0,
    };
  }

  existing.count += 1;
  return { ok: true, retryAfterSeconds: 0, remaining: limit - existing.count };
}

/** Best-effort client IP from forwarding headers; falls back to "unknown". */
export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Test-only: clear all windows so cases don't bleed into each other. */
export function __resetRateLimitsForTest(): void {
  windows.clear();
}
