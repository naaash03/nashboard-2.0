import { afterEach, describe, expect, it } from "vitest";
import { __resetRateLimitsForTest, checkRateLimit, clientIpFromRequest } from "@/lib/security/rateLimit";

afterEach(() => {
  __resetRateLimitsForTest();
});

describe("checkRateLimit", () => {
  it("allows up to the limit then blocks within the window", () => {
    const key = "test:1.2.3.4";
    expect(checkRateLimit(key, 3, 60_000).ok).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).ok).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).ok).toBe(true);

    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = "test:reset";
    expect(checkRateLimit(key, 1, 0).ok).toBe(true);
    // windowMs = 0 means the next call sees an already-expired window.
    expect(checkRateLimit(key, 1, 0).ok).toBe(true);
  });

  it("tracks distinct keys independently", () => {
    expect(checkRateLimit("a", 1, 60_000).ok).toBe(true);
    expect(checkRateLimit("a", 1, 60_000).ok).toBe(false);
    expect(checkRateLimit("b", 1, 60_000).ok).toBe(true);
  });
});

describe("clientIpFromRequest", () => {
  it("takes the first hop of x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" },
    });
    expect(clientIpFromRequest(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip then unknown", () => {
    expect(clientIpFromRequest(new Request("http://localhost", { headers: { "x-real-ip": "198.51.100.5" } }))).toBe("198.51.100.5");
    expect(clientIpFromRequest(new Request("http://localhost"))).toBe("unknown");
  });
});
