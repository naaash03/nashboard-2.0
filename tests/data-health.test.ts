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

  it("resolves dataMode priority query > dev override > preference", async () => {
    const mod = await import("@/app/api/health/data/route");

    const devWins = await mod.GET(new Request("http://localhost/api/health/data?preferenceMode=live&devOverrideMode=fixture"));
    const devBody = await devWins.json();
    expect(devBody.resolvedDataMode).toBe("fixture");
    expect(devBody.devOverrideDataMode).toBe("fixture");
    expect(devBody.preferenceDataMode).toBe("live");
    expect(devBody.resolutionSource).toBe("dev_override");

    const queryWins = await mod.GET(new Request("http://localhost/api/health/data?dataMode=live&preferenceMode=live&devOverrideMode=fixture"));
    const queryBody = await queryWins.json();
    expect(queryBody.resolvedDataMode).toBe("live");
    expect(queryBody.queryDataMode).toBe("live");
    expect(queryBody.devOverrideDataMode).toBe("fixture");
    expect(queryBody.preferenceDataMode).toBe("live");
    expect(queryBody.resolutionSource).toBe("query");
  });
});
