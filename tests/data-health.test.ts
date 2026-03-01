import { describe, expect, it } from "vitest";

describe("data health endpoint", () => {
  it("returns consistent status fields and non-negative cache age", async () => {
    process.env.DATABASE_URL = "";
    process.env.NASHBOARD_DATA_MODE = "live";
    const mod = await import("@/app/api/health/data/route");

    const res = await mod.GET(new Request("http://localhost/api/health/data?dataMode=fixture"));
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

  it("resolves dataMode priority query > cookie > env", async () => {
    process.env.NASHBOARD_DATA_MODE = "live";
    const mod = await import("@/app/api/health/data/route");

    const cookieOnly = await mod.GET(new Request("http://localhost/api/health/data", {
      headers: { cookie: "nashboard_dataMode=fixture" },
    }));
    const cookieBody = await cookieOnly.json();
    expect(cookieBody.resolvedDataMode).toBe("fixture");
    expect(cookieBody.cookieDataMode).toBe("fixture");

    const queryWins = await mod.GET(new Request("http://localhost/api/health/data?dataMode=live", {
      headers: { cookie: "nashboard_dataMode=fixture" },
    }));
    const queryBody = await queryWins.json();
    expect(queryBody.resolvedDataMode).toBe("live");
    expect(queryBody.queryDataMode).toBe("live");
    expect(queryBody.cookieDataMode).toBe("fixture");
  });
});
