import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  fetchEspnJson: vi.fn(),
}));

vi.mock("@/lib/providers/espn/client", () => ({
  fetchEspnJson: hoisted.fetchEspnJson,
  getDataMode: (value?: string) => (value === "fixture" ? "fixture" : "live"),
}));

describe("refresh cacheBust in auto mode", () => {
  beforeEach(() => {
    vi.resetModules();
    hoisted.fetchEspnJson.mockReset();

    hoisted.fetchEspnJson.mockImplementation(async ({ dataMode }: { dataMode: string }) => {
      if (dataMode === "live") {
        return {
          data: { items: [] },
          meta: {
            sourceUsed: "espn",
            updatedAt: "2026-03-02T00:00:00.000Z",
            requestId: "live-search",
            dataMode: "live",
            cacheHit: false,
          },
        };
      }
      return {
        data: {
          items: [
            { abbreviation: "NYM", displayName: "New York Mets", league: "mlb" },
          ],
        },
        meta: {
          sourceUsed: "fixture",
          updatedAt: "2026-03-02T00:00:00.000Z",
          requestId: "fixture-search",
          dataMode: "fixture",
          cacheHit: false,
        },
      };
    });
  });

  it("passes cacheBust to both live and fixture calls when auto falls back", async () => {
    const { searchTeams } = await import("@/lib/providers/espn/teamDirectory");
    const result = await searchTeams("mlb", "mets", "auto", 8, "refresh-1");

    expect(result.data?.[0]?.teamKey).toBe("NYM");

    const calls = hoisted.fetchEspnJson.mock.calls.map((call) => call[0]);
    const modes = calls.map((call) => call.dataMode);
    expect(modes).toContain("live");
    expect(modes).toContain("fixture");
    for (const call of calls) {
      expect(call.cacheBust).toBe("refresh-1");
    }
  });
});
