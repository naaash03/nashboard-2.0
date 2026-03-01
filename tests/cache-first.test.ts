import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedPrisma = {
  cachedResponse: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/db/prisma", () => ({ prisma: mockedPrisma }));

describe("espn client cache-first", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NASHBOARD_DATA_MODE = "live";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/nashboard";
  });

  it("returns cached response when upstream fails", async () => {
    mockedPrisma.cachedResponse.findUnique.mockResolvedValue({
      payload: { events: [{ id: "cached" }] },
      fetchedAt: new Date(Date.now() - 30_000),
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("upstream down")));

    const { fetchEspnJson } = await import("@/lib/providers/espn/client");
    const result = await fetchEspnJson<{ events: Array<{ id: string }> }>({ endpoint: "/scoreboard", params: { dates: "20260910" } });

    expect(result.meta.sourceUsed).toBe("cache");
    expect(result.data.events[0].id).toBe("cached");
    expect(String(result.meta.warning)).toContain("cached");
  });
});



