import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("MLB pitcher vs projected lineup route", () => {
  it("keeps the stable envelope and shapes beginner versus advanced payloads correctly", async () => {
    const mod = await import("@/app/api/widgets/mlb-pitcher-vs-projected-lineup/route");

    const beginnerRes = await mod.GET(
      new Request("http://localhost/api/widgets/mlb-pitcher-vs-projected-lineup?teamKey=NYM&mode=beginner&dataMode=fixture"),
    );
    const beginnerBody = await beginnerRes.json();

    expect(beginnerRes.status).toBe(200);
    expect(beginnerBody.error).toBeNull();
    expect(beginnerBody.data).toEqual(expect.objectContaining({
      teamKey: "NYM",
      matchupScore: expect.any(Number),
      confidenceLabel: expect.any(String),
      reasons: expect.any(Array),
      assumptionsNote: expect.any(String),
      state: expect.any(String),
    }));
    expect(beginnerBody.data.reasons).toHaveLength(3);
    expect(beginnerBody.data.componentBreakdown).toBeUndefined();
    expect(beginnerBody.data.pitcherSelection).toBeUndefined();
    expect(beginnerBody.data.assumptionsNote).toContain("approximate lineup");
    expect(beginnerBody.data.assumptionsNote).toContain("not a confirmed batting order");
    expect(beginnerBody.contract).toEqual(expect.objectContaining({
      ok: true,
      data: expect.any(Object),
      source: expect.objectContaining({
        provider: expect.any(String),
        mode: expect.any(String),
      }),
    }));

    const advancedRes = await mod.GET(
      new Request("http://localhost/api/widgets/mlb-pitcher-vs-projected-lineup?teamKey=NYM&mode=advanced&dataMode=fixture"),
    );
    const advancedBody = await advancedRes.json();

    expect(advancedRes.status).toBe(200);
    expect(advancedBody.error).toBeNull();
    expect(advancedBody.data.reasons).toHaveLength(3);
    expect(advancedBody.data.componentBreakdown.length).toBeGreaterThan(0);
    expect(advancedBody.data.pitcherSelection).toEqual(expect.objectContaining({
      label: "Probable starter baseline",
      selectedPitcherRole: "starter",
      options: expect.any(Array),
    }));
    expect(advancedBody.data.pitcherSelection.options.length).toBeGreaterThan(0);
    expect(advancedBody.data.componentBreakdown.map((component: { key: string }) => component.key)).toEqual([
      "handedness",
      "strikeoutSkill",
      "control",
      "recentForm",
      "opponentContact",
    ]);
  });
});
