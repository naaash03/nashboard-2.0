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
});
