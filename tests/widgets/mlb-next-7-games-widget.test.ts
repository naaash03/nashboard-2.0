import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMlbHeadshotUrl, probablePitcherDisplayName } from "@/components/widgets/MlbNext7GamesWidget";

describe("MLB next 7 games widget UI polish", () => {
  it("shows probable pitcher name when available and clean TBD fallback when missing", () => {
    expect(probablePitcherDisplayName("Max Fried")).toBe("Max Fried");
    expect(probablePitcherDisplayName("")).toBe("TBD");
    expect(probablePitcherDisplayName(undefined)).toBe("TBD");
  });

  it("builds cheap headshot url from existing probable pitcher id", () => {
    expect(buildMlbHeadshotUrl("608331")).toContain("/people/608331/headshot/");
    expect(buildMlbHeadshotUrl("not-id")).toBeNull();
  });

  it("does not render probable pitcher id in visible game rows", () => {
    const source = readFileSync("components/widgets/MlbNext7GamesWidget.tsx", "utf8");
    expect(source.includes("Probable pitcherId:")).toBe(false);
    expect(source.includes("Probable Starter")).toBe(true);
  });
});
