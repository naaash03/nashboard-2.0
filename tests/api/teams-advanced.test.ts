import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("teams advanced api route", () => {
  it("returns fixture envelope with status for each requested team", async () => {
    const mod = await import("@/app/api/teams/advanced/route");
    const res = await mod.GET(new Request("http://localhost/api/teams/advanced?sport=nba&teamKeys=LAL,BOS&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.sourceUsed).toBe("fixture");
    expect(Array.isArray(body.data?.teams)).toBe(true);
    expect(body.data.teams).toHaveLength(2);
    for (const team of body.data.teams) {
      expect(team.teamKey).toEqual(expect.any(String));
      expect(team.status?.hasGameToday).toEqual(expect.any(Boolean));
      if (team.record !== null && team.record !== undefined) {
        expect(team.record.wins).toEqual(expect.any(Number));
        expect(team.record.losses).toEqual(expect.any(Number));
      }
    }
  });

  it("returns 400 envelope when teamKeys is missing", async () => {
    const mod = await import("@/app/api/teams/advanced/route");
    const res = await mod.GET(new Request("http://localhost/api/teams/advanced?sport=mlb&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.data).toBeNull();
    expect(body.error?.code).toBe("MISSING_TEAM_KEYS");
    expect(body.meta.sourceUsed).toBe("fixture");
  });
});
