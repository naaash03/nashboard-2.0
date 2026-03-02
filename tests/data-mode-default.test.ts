import { describe, expect, it } from "vitest";
import { resolveDataModeFromRequest } from "@/lib/dataMode";

describe("data mode default", () => {
  it("defaults to auto when no query and no preference are provided", () => {
    const resolution = resolveDataModeFromRequest(new Request("http://localhost/api/players/search"));
    expect(resolution.resolvedDataMode).toBe("auto");
    expect(resolution.source).toBe("fallback");
  });
});
