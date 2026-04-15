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
    expect(body.data.playerName).toBe("Corbin Burnes");
    expect(body.data.pitches[0].type).toBe("Four-Seam Fastball");
  });

  it("resolves a pitcher name input to the MLB pitcher personId before loading arsenal", async () => {
    const searchPlayers = vi.fn(async () => ({
      data: [
        { playerId: "605280", fullName: "Clay Holmes", position: "P", isPitcher: true },
      ],
      meta: {
        sourceUsed: "fixture",
        updatedAt: new Date().toISOString(),
        requestId: "mock-search",
        dataMode: "fixture",
      },
    }));
    const getPitcherArsenal = vi.fn(async () => ({
      data: {
        playerId: "605280",
        playerName: "Clay Holmes",
        pitches: [
          { type: "Sinker", usagePct: 41.2, velocityMph: 96.8 },
        ],
      },
      meta: {
        sourceUsed: "fixture",
        updatedAt: new Date().toISOString(),
        requestId: "mock-arsenal",
        dataMode: "fixture",
      },
    }));

    vi.doMock("@/lib/providers/mlb", () => ({
      mlbProvider: {
        searchPlayers,
        getPitcherArsenal,
      },
    }));

    const mod = await import("@/app/api/widgets/mlb-pitcher-arsenal/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-pitcher-arsenal?playerId=Clay%20Holmes&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeNull();
    expect(searchPlayers).toHaveBeenCalledWith("Clay Holmes", 8, "fixture");
    expect(getPitcherArsenal).toHaveBeenCalledWith("605280", "fixture", undefined);
    expect(body.data).toEqual(expect.objectContaining({
      playerId: "605280",
      pitches: expect.any(Array),
    }));
  });

  it("returns honest 400 when the selected player is not a supported pitcher", async () => {
    vi.doMock("@/lib/providers/mlb", () => ({
      mlbProvider: {
        searchPlayers: vi.fn(async () => ({
          data: [
            { playerId: "665742", fullName: "Juan Soto", position: "RF", isPitcher: false },
          ],
          meta: {
            sourceUsed: "fixture",
            updatedAt: new Date().toISOString(),
            requestId: "mock-non-pitcher",
            dataMode: "fixture",
          },
        })),
        getPitcherArsenal: vi.fn(),
      },
    }));

    const mod = await import("@/app/api/widgets/mlb-pitcher-arsenal/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-pitcher-arsenal?playerId=Juan%20Soto&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Selected player is not a supported MLB pitcher for arsenal data.");
    expect(body.data).toBeNull();
  });

  it("returns honest 400 when a numeric id cannot be mapped to an MLB pitcher identity", async () => {
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

    expect(res.status).toBe(400);
    expect(body.error).toBe("Could not map the selected player to a valid MLB pitcher id.");
    expect(body.data).toBeNull();
  });

  it("keeps unsupported arsenal feeds honest after a valid pitcher name maps correctly", async () => {
    vi.doMock("@/lib/providers/mlb", () => ({
      mlbProvider: {
        searchPlayers: vi.fn(async () => ({
          data: [
            { playerId: "605280", fullName: "Clay Holmes", position: "P", isPitcher: true },
          ],
          meta: {
            sourceUsed: "live",
            updatedAt: new Date().toISOString(),
            requestId: "mock-search-live",
            dataMode: "live",
          },
        })),
        getPitcherArsenal: vi.fn(async () => ({
          data: null,
          meta: {
            sourceUsed: "mlb",
            updatedAt: new Date().toISOString(),
            requestId: "mock-no-arsenal",
            dataMode: "live",
            warning: "Pitch arsenal is not available from MLB Stats API for this pitcher id.",
          },
        })),
      },
    }));

    const mod = await import("@/app/api/widgets/mlb-pitcher-arsenal/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-pitcher-arsenal?playerId=Clay%20Holmes&mode=advanced&dataMode=live"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeNull();
    expect(body.data).toBeNull();
    expect(body.meta?.warning).toBe("Pitch arsenal is not available from MLB Stats API for this pitcher id.");
  });
});
