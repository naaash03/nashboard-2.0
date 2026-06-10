import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

async function loadRoute(path: string, route: Promise<{ GET: (req: Request) => Promise<Response> }>) {
  const mod = await route;
  const res = await mod.GET(new Request(`http://localhost${path}`));
  return { res, body: await res.json() };
}

function expectFixtureEnvelope(body: Record<string, unknown>) {
  const meta = body.meta as Record<string, unknown>;
  const contract = body.contract as Record<string, unknown>;
  const source = contract.source as Record<string, unknown>;

  expect(body.data).toBeDefined();
  expect(body.error).toBeNull();
  expect(meta.sourceUsed).toBe("fixture");
  expect(meta.updatedAt).toEqual(expect.any(String));
  expect(meta.requestId).toEqual(expect.any(String));
  expect(contract.ok).toBe(true);
  expect(source.mode).toBe("fixture");
  expect(source.provider).toBe("fixture");
}

describe("MLB route contracts", () => {
  it("mlb-season-stats returns a stable fixture envelope", async () => {
    const { res, body } = await loadRoute(
      "/api/widgets/mlb-season-stats?mode=team&teamKey=NYM&season=2025&dataMode=fixture",
      import("@/app/api/widgets/mlb-season-stats/route"),
    );

    expect(res.status).toBe(200);
    expectFixtureEnvelope(body);
  });

  it("mlb-platoon-advantage returns a stable fixture envelope", async () => {
    const { res, body } = await loadRoute(
      "/api/widgets/mlb-platoon-advantage?teamKey=NYM&dataMode=fixture",
      import("@/app/api/widgets/mlb-platoon-advantage/route"),
    );

    expect(res.status).toBe(200);
    expectFixtureEnvelope(body);
  });

  it("mlb-recent-form returns a stable fixture envelope", async () => {
    const { res, body } = await loadRoute(
      "/api/widgets/mlb-recent-form?teamKey=NYM&dataMode=fixture",
      import("@/app/api/widgets/mlb-recent-form/route"),
    );

    expect(res.status).toBe(200);
    expectFixtureEnvelope(body);
  });

  it("mlb-bullpen-fatigue returns a stable fixture envelope", async () => {
    const { res, body } = await loadRoute(
      "/api/widgets/mlb-bullpen-fatigue?teamKey=NYM&dataMode=fixture",
      import("@/app/api/widgets/mlb-bullpen-fatigue/route"),
    );

    expect(res.status).toBe(200);
    expectFixtureEnvelope(body);
  });
});
