import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("MLB pitcher arsenal route", () => {
  it("returns 400 envelope when playerId is missing", async () => {
    const mod = await import("@/app/api/widgets/mlb-pitcher-arsenal/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-pitcher-arsenal?mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.data).toBeNull();
    expect(body.error).toBe("playerId is required");
    expect(body.meta?.sourceUsed).toBe("fixture");
  });

  it("returns fixture envelope with pitch rows", async () => {
    const mod = await import("@/app/api/widgets/mlb-pitcher-arsenal/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-pitcher-arsenal?playerId=669203&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("fixture");
    expect(body.meta?.dataMode).toBe("fixture");
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      playerId: expect.any(String),
      pitches: expect.any(Array),
    }));
    expect(body.data.pitches.length).toBeGreaterThan(0);
    expect(body.data.pitches[0]).toEqual(expect.objectContaining({
      type: expect.any(String),
      usagePct: expect.any(Number),
    }));
  });

  it("resolves a pitcher name input to numeric playerId", async () => {
    const mod = await import("@/app/api/widgets/mlb-pitcher-arsenal/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-pitcher-arsenal?playerId=Juan%20Soto&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      playerId: expect.any(String),
      pitches: expect.any(Array),
    }));
  });

  it("returns clean 400 when name cannot be resolved to numeric id", async () => {
    vi.doMock("@/lib/providers", () => ({
      resolvePlayersSearch: vi.fn(async () => ({
        data: [],
        meta: {
          sourceUsed: "fixture",
          updatedAt: new Date().toISOString(),
          requestId: "mock-no-player",
          dataMode: "fixture",
        },
      })),
    }));

    const mod = await import("@/app/api/widgets/mlb-pitcher-arsenal/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-pitcher-arsenal?playerId=No%20Such%20Pitcher&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Could not resolve a valid MLB pitcher id from the provided input.");
    expect(body.data).toBeNull();
  });

  it("returns a graceful partial response for unsupported numeric pitcher ids", async () => {
    vi.doMock("@/lib/providers/mlb/client", async () => {
      const actual = await vi.importActual<typeof import("@/lib/providers/mlb/client")>("@/lib/providers/mlb/client");
      return {
        ...actual,
        getMlbDataMode: vi.fn(() => "live"),
        fetchMlbJson: vi.fn(async () => {
          throw new Error("MLB Stats API 404: player not found");
        }),
      };
    });

    const mod = await import("@/app/api/widgets/mlb-pitcher-arsenal/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-pitcher-arsenal?playerId=32827&mode=advanced&dataMode=live"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeNull();
    expect(body.data).toBeNull();
    expect(body.meta?.warning).toBe("Pitch arsenal is not available from MLB Stats API for this pitcher id.");
  });

  it("treats unsupported pitchArsenal upstream errors as partial instead of failed", async () => {
    vi.doMock("@/lib/providers/mlb/client", async () => {
      const actual = await vi.importActual<typeof import("@/lib/providers/mlb/client")>("@/lib/providers/mlb/client");
      return {
        ...actual,
        getMlbDataMode: vi.fn(() => "live"),
        fetchMlbJson: vi.fn(async () => {
          throw new Error("422 Unprocessable Entity: pitchArsenal unsupported for this player");
        }),
      };
    });

    const mod = await import("@/app/api/widgets/mlb-pitcher-arsenal/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-pitcher-arsenal?playerId=32827&mode=advanced&dataMode=live"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeNull();
    expect(body.data).toBeNull();
    expect(body.meta?.warning).toBe("Pitch arsenal is not available from MLB Stats API for this pitcher id.");
  });
});
