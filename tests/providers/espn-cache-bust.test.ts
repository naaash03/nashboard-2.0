import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  process.env.NASHBOARD_DATA_MODE = "live";
  delete process.env.DATABASE_URL;
});

describe("espn client cache bust", () => {
  it("bypasses cache when cacheBust is provided", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ ok: true, value: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { fetchEspnJson } = await import("@/lib/providers/espn/client");

    const endpoint = "https://example.com/espn/cache-bust-test";
    const first = await fetchEspnJson<{ ok: boolean; value: number }>({
      endpoint,
      ttlSeconds: 120,
      dataMode: "live",
    });
    const second = await fetchEspnJson<{ ok: boolean; value: number }>({
      endpoint,
      ttlSeconds: 120,
      dataMode: "live",
    });
    const third = await fetchEspnJson<{ ok: boolean; value: number }>({
      endpoint,
      ttlSeconds: 120,
      dataMode: "live",
      cacheBust: "refresh-1",
    });

    expect(first.meta.sourceUsed).toBe("espn");
    expect(first.meta.cacheHit).toBe(false);
    expect(second.meta.sourceUsed).toBe("cache");
    expect(second.meta.cacheHit).toBe(true);
    expect(third.meta.sourceUsed).toBe("espn");
    expect(third.meta.cacheHit).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
