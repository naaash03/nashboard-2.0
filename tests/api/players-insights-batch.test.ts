import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("players insights batch api route", () => {
  it("returns fixture envelope with one player insight per requested id", async () => {
    const mod = await import("@/app/api/players/insights/batch/route");
    const res = await mod.GET(new Request("http://localhost/api/players/insights/batch?sport=nba&playerIds=1966,9999&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.sourceUsed).toBe("fixture");
    expect(Array.isArray(body.data?.players)).toBe(true);
    expect(body.data.players).toHaveLength(2);
    expect(body.data.players[0]).toEqual(expect.objectContaining({
      playerId: expect.any(String),
      sport: "nba",
    }));
    const first = body.data.players[0];
    const summary = first.season?.headline ?? first.recent?.headline ?? "";
    expect(summary.length).toBeGreaterThan(0);
  });

  it("returns 400 envelope when playerIds is missing", async () => {
    const mod = await import("@/app/api/players/insights/batch/route");
    const res = await mod.GET(new Request("http://localhost/api/players/insights/batch?sport=nba&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.data).toBeNull();
    expect(body.error?.code).toBe("MISSING_PLAYER_IDS");
    expect(body.meta.sourceUsed).toBe("fixture");
  });
});
