import { describe, expect, it } from "vitest";
import {
  normalizePitcherSearchName,
  resolvePitcherSelectionFromSearch,
} from "@/components/widgets/MlbPitcherArsenalWidget";

describe("MLB Pitcher Arsenal widget search resolution", () => {
  it("normalizes pitcher names for stable matching", () => {
    expect(normalizePitcherSearchName("  Max-Fried ")).toBe("max fried");
    expect(normalizePitcherSearchName("Clay   Holmes")).toBe("clay holmes");
  });

  it("resolves exact name matches to numeric pitcher ids", () => {
    const selected = resolvePitcherSelectionFromSearch("Max Fried", [
      { playerId: "547943", fullName: "Max Fried" },
      { playerId: "12345", fullName: "Max Muncy" },
    ]);

    expect(selected).toEqual({
      playerId: "547943",
      fullName: "Max Fried",
    });
  });

  it("falls back to first numeric candidate when no exact name exists", () => {
    const selected = resolvePitcherSelectionFromSearch("Clay", [
      { playerId: "not-numeric", fullName: "Clay Holmes" },
      { playerId: "676694", fullName: "Clay Holmes" },
    ]);

    expect(selected).toEqual({
      playerId: "676694",
      fullName: "Clay Holmes",
    });
  });
});
