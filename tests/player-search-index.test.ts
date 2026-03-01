import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NflAthleteIndexEntry } from "@/lib/providers/espn/nfl";

describe("NFL athlete index search", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NASHBOARD_DATA_MODE = "live";
    process.env.DATABASE_URL = "";
  });

  it("ranks Daniel Jones first for query 'daniel jones'", async () => {
    const { searchNflAthleteIndex } = await import("@/lib/providers/espn/nfl");
    const index: NflAthleteIndexEntry[] = [
      { id: "1", fullName: "Daniel Jones", firstName: "Daniel", lastName: "Jones", position: { abbreviation: "QB" } },
      { id: "2", fullName: "Mac Jones", firstName: "Mac", lastName: "Jones", position: { abbreviation: "QB" } },
      { id: "3", fullName: "Daniel Carlson", firstName: "Daniel", lastName: "Carlson", position: { abbreviation: "K" } },
    ];

    const results = searchNflAthleteIndex(index, "daniel jones", 8);
    expect(results[0]?.fullName).toBe("Daniel Jones");
  });

  it("finds Patrick Mahomes for query 'mahomes'", async () => {
    const { searchNflAthleteIndex } = await import("@/lib/providers/espn/nfl");
    const index: NflAthleteIndexEntry[] = [
      { id: "1", fullName: "Patrick Mahomes", firstName: "Patrick", lastName: "Mahomes", position: { abbreviation: "QB" } },
      { id: "2", fullName: "Patrick Taylor", firstName: "Patrick", lastName: "Taylor", position: { abbreviation: "RB" } },
    ];

    const results = searchNflAthleteIndex(index, "mahomes", 8);
    expect(results[0]?.fullName).toBe("Patrick Mahomes");
  });

  it("falls back to disk cache when network fetch fails", async () => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), "nashboard-athletes-"));
    try {
      process.env.NASHBOARD_CACHE_DIR = cacheDir;
      await writeFile(
        path.join(cacheDir, "athletes_nfl.json"),
        JSON.stringify({
          fetchedAt: new Date(Date.now() - 90_000).toISOString(),
          athletes: [
            { id: "99", fullName: "Patrick Mahomes", firstName: "Patrick", lastName: "Mahomes", position: { abbreviation: "QB" } },
          ],
        }),
        "utf8",
      );

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
      const mod = await import("@/lib/providers/espn/nfl");
      mod.__resetAthleteIndexCacheForTests();

      const result = await mod.fetchAllNflAthletesIndex("live");
      expect(result.athletes).toHaveLength(1);
      expect(result.athletes[0]?.fullName).toBe("Patrick Mahomes");
      expect(result.diagnostics.source).toBe("disk");
      expect(result.diagnostics.cacheHit).toBe(true);
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
      delete process.env.NASHBOARD_CACHE_DIR;
      vi.unstubAllGlobals();
    }
  });

  it("tries endpoint fallbacks in order and succeeds on third endpoint", async () => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), "nashboard-athletes-order-"));
    try {
      process.env.NASHBOARD_CACHE_DIR = cacheDir;
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ code: 1, detail: "invalid URI" }), { status: 400 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ code: 1, detail: "invalid URI" }), { status: 400 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          items: [{ id: "101", fullName: "Daniel Jones", firstName: "Daniel", lastName: "Jones" }],
        }), { status: 200 }));

      vi.stubGlobal("fetch", fetchMock);
      const mod = await import("@/lib/providers/espn/nfl");
      mod.__resetAthleteIndexCacheForTests();

      const result = await mod.fetchAllNflAthletesIndex("live");
      expect(result.athletes[0]?.fullName).toBe("Daniel Jones");
      expect(result.diagnostics.finalUrl).toBe("https://sports.core.api.espn.com/v3/sports/football/nfl/athletes?limit=20000");
      expect(result.diagnostics.endpointAttempts).toHaveLength(3);
      expect(result.diagnostics.endpointAttempts[0]?.status).toBe(400);
      expect(result.diagnostics.endpointAttempts[1]?.status).toBe(400);
      expect(result.diagnostics.endpointAttempts[2]?.status).toBe(200);
      expect(fetchMock.mock.calls[0]?.[0]).toBe("https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes?limit=20000");
      expect(fetchMock.mock.calls[1]?.[0]).toBe("https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes?limit=20000");
      expect(fetchMock.mock.calls[2]?.[0]).toBe("https://sports.core.api.espn.com/v3/sports/football/nfl/athletes?limit=20000");
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
      delete process.env.NASHBOARD_CACHE_DIR;
      vi.unstubAllGlobals();
    }
  });
});

describe("/api/search/players diagnostics", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NASHBOARD_DATA_MODE = "live";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes diagnostics fields in response", async () => {
    const route = await import("@/app/api/search/players/route");
    const res = await route.GET(new Request("http://localhost/api/search/players?sport=NFL&q=mahomes&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.diagnostics).toEqual(expect.objectContaining({
      provider: "espn-athlete-index",
      cacheHit: expect.any(Boolean),
      indexAgeSeconds: expect.any(Number),
      source: expect.any(String),
      requestId: expect.any(String),
      finalUrl: expect.anything(),
      endpointAttempts: expect.any(Array),
    }));
  });

  it("returns 200 with graceful message and diagnostics when upstream fails without disk cache", async () => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), "nashboard-athletes-empty-"));
    try {
      process.env.NASHBOARD_CACHE_DIR = cacheDir;
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("upstream down")));
      const mod = await import("@/lib/providers/espn/nfl");
      mod.__resetAthleteIndexCacheForTests();

      const route = await import("@/app/api/search/players/route");
      const res = await route.GET(new Request("http://localhost/api/search/players?sport=NFL&q=daniel%20jones&dataMode=live"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.results).toEqual([]);
      expect(body.userFacingMessage).toBe("Player index not available right now; try again in a minute.");
      expect(body.diagnostics.source).toBe("network");
      expect(body.diagnostics.endpointAttempts).toHaveLength(3);
      expect(body.meta.warning).toContain("Player index not available right now");
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
      delete process.env.NASHBOARD_CACHE_DIR;
      vi.unstubAllGlobals();
    }
  });
});
