import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/providers/espn/client", () => ({
  getDataMode: vi.fn((mode?: "auto" | "live" | "fixture") => mode ?? "fixture"),
  fetchEspnJson: vi.fn(),
}));

const meta = {
  sourceUsed: "fixture" as const,
  updatedAt: "2026-05-02T01:30:00.000Z",
  requestId: "test-request-id",
  dataMode: "fixture" as const,
  dataModeEffective: "fixture" as const,
};

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-02T01:30:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("ESPN scoreboard local date handling", () => {
  it("NBA today's slate uses America/New_York date when UTC is tomorrow", async () => {
    const { fetchEspnJson } = await import("@/lib/providers/espn/client");
    vi.mocked(fetchEspnJson).mockResolvedValueOnce({ data: { events: [] }, meta });

    const { getTodaysSlate } = await import("@/lib/providers/espn/nba");
    const result = await getTodaysSlate("beginner", "fixture");

    expect(result.dateUsed).toBe("2026-05-01");
    expect(fetchEspnJson).toHaveBeenCalledWith(expect.objectContaining({
      params: { dates: "20260501" },
    }));
  });

  it("MLB today's schedule uses America/New_York date when UTC is tomorrow", async () => {
    const { fetchEspnJson } = await import("@/lib/providers/espn/client");
    vi.mocked(fetchEspnJson).mockResolvedValueOnce({ data: { events: [] }, meta });

    const { getTodaysSchedule } = await import("@/lib/providers/espn/mlb");
    const result = await getTodaysSchedule("fixture");

    expect(result.dateUsed).toBe("2026-05-01");
    expect(fetchEspnJson).toHaveBeenCalledWith(expect.objectContaining({
      params: { dates: "20260501" },
    }));
  });
});
