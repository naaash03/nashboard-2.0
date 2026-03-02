import { describe, expect, it } from "vitest";

describe("data health endpoint", () => {
  it("returns consistent status fields and non-negative cache age", async () => {
    process.env.DATABASE_URL = "";
    const mod = await import("@/app/api/health/data/route");

    const res = await mod.GET(new Request("http://localhost/api/health/data?dataMode=fixture&preferenceMode=live"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBeDefined();
    expect(["configured", "unconfigured"]).toContain(body.status.db);
    expect(["ok", "error", "timeout", "blocked", "empty"]).toContain(body.status.espn);
    expect(["enabled", "disabled"]).toContain(body.status.fixture);

    if (typeof body.cache.lastCacheAgeSeconds === "number") {
      expect(body.cache.lastCacheAgeSeconds).toBeGreaterThanOrEqual(0);
    }
  });

  it("resolves dataMode priority query > preference > fallback", async () => {
    const mod = await import("@/app/api/health/data/route");

    const preferenceWins = await mod.GET(new Request("http://localhost/api/health/data?preferenceMode=live"));
    const prefBody = await preferenceWins.json();
    expect(prefBody.resolvedDataMode).toBe("live");
    expect(prefBody.preferenceDataMode).toBe("live");
    expect(prefBody.resolutionSource).toBe("preference");

    const queryWins = await mod.GET(new Request("http://localhost/api/health/data?dataMode=fixture&preferenceMode=live"));
    const queryBody = await queryWins.json();
    expect(queryBody.resolvedDataMode).toBe("fixture");
    expect(queryBody.queryDataMode).toBe("fixture");
    expect(queryBody.preferenceDataMode).toBe("live");
    expect(queryBody.resolutionSource).toBe("query");
  });
});
