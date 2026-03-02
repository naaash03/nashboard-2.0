import { describe, expect, it } from "vitest";
import { resolveDataMode, resolveDataModeFromRequest } from "@/lib/dataMode";

describe("data mode resolution", () => {
  it("applies precedence query > preference > auto fallback", () => {
    const preference = resolveDataMode({
      preferenceDataMode: "fixture",
    });
    expect(preference.resolvedDataMode).toBe("fixture");
    expect(preference.source).toBe("preference");

    const preferenceLive = resolveDataMode({
      preferenceDataMode: "live",
    });
    expect(preferenceLive.resolvedDataMode).toBe("live");
    expect(preferenceLive.source).toBe("preference");

    const query = resolveDataMode({
      queryDataMode: "live",
      preferenceDataMode: "fixture",
    });
    expect(query.resolvedDataMode).toBe("live");
    expect(query.source).toBe("query");
  });

  it("defaults to auto when query and preference are missing", () => {
    const fallback = resolveDataMode({});
    expect(fallback.resolvedDataMode).toBe("auto");
    expect(fallback.source).toBe("fallback");
  });

  it("reads request params into unified resolution", () => {
    const result = resolveDataModeFromRequest(new Request(
      "http://localhost/api/players/search?dataMode=fixture&preferenceMode=live",
    ));
    expect(result.resolvedDataMode).toBe("fixture");
    expect(result.source).toBe("query");
    expect(result.queryDataMode).toBe("fixture");
    expect(result.preferenceDataMode).toBe("live");
  });
});
