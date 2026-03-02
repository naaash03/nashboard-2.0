import { describe, expect, it } from "vitest";
import { resolveDataMode, resolveDataModeFromRequest } from "@/lib/dataMode";

describe("data mode resolution", () => {
  it("applies precedence query > dev override > preference > live", () => {
    const preference = resolveDataMode({
      preferenceDataMode: "fixture",
      isDevEnvironment: true,
    });
    expect(preference.resolvedDataMode).toBe("fixture");
    expect(preference.source).toBe("preference");

    const devOverride = resolveDataMode({
      devOverrideDataMode: "fixture",
      preferenceDataMode: "live",
      isDevEnvironment: true,
    });
    expect(devOverride.resolvedDataMode).toBe("fixture");
    expect(devOverride.source).toBe("dev_override");

    const query = resolveDataMode({
      queryDataMode: "live",
      devOverrideDataMode: "fixture",
      preferenceDataMode: "fixture",
      isDevEnvironment: true,
    });
    expect(query.resolvedDataMode).toBe("live");
    expect(query.source).toBe("query");
  });

  it("ignores dev override in production mode", () => {
    const production = resolveDataMode({
      devOverrideDataMode: "fixture",
      preferenceDataMode: "live",
      isDevEnvironment: false,
    });
    expect(production.resolvedDataMode).toBe("live");
    expect(production.source).toBe("preference");
    expect(production.devOverrideDataMode).toBeNull();
  });

  it("reads request params into unified resolution", () => {
    const result = resolveDataModeFromRequest(new Request(
      "http://localhost/api/players/search?dataMode=fixture&devOverrideMode=live&preferenceMode=live",
    ));
    expect(result.resolvedDataMode).toBe("fixture");
    expect(result.source).toBe("query");
    expect(result.queryDataMode).toBe("fixture");
    expect(result.preferenceDataMode).toBe("live");
  });
});
