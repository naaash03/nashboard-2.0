import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("teams status batch api route", () => {
  it("returns fixture envelope with one status per requested team", async () => {
    const mod = await import("@/app/api/teams/status/batch/route");
    const res = await mod.GET(new Request("http://localhost/api/teams/status/batch?sport=mlb&teamKeys=NYM,LAD,SEA&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.sourceUsed).toBe("fixture");
    expect(Array.isArray(body.data?.statuses)).toBe(true);
    expect(body.data.statuses).toHaveLength(3);

    const mets = body.data.statuses.find((row: { teamKey?: string }) => row.teamKey === "NYM");
    expect(mets).toEqual(expect.objectContaining({
      teamKey: "NYM",
      hasGameToday: expect.any(Boolean),
    }));
  });

  it("returns 400 envelope when teamKeys is missing", async () => {
    const mod = await import("@/app/api/teams/status/batch/route");
    const res = await mod.GET(new Request("http://localhost/api/teams/status/batch?sport=nba&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.data).toBeNull();
    expect(body.error?.code).toBe("MISSING_TEAM_KEYS");
    expect(body.meta.sourceUsed).toBe("fixture");
  });
});
