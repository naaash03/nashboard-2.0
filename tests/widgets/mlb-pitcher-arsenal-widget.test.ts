import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  describePitchRole,
  describePitchTakeaway,
  normalizePitcherSearchName,
  resolvePitcherSearchResult,
  resolvePitcherSelectionFromSearch,
  sortArsenalPitches,
} from "@/components/widgets/MlbPitcherArsenalWidget";

describe("MLB Pitcher Arsenal widget search resolution", () => {
  it("normalizes pitcher names for stable matching", () => {
    expect(normalizePitcherSearchName("  Max-Fried ")).toBe("max fried");
    expect(normalizePitcherSearchName("Clay   Holmes")).toBe("clay holmes");
  });

  it("resolves exact name matches to numeric pitcher ids", () => {
    const selected = resolvePitcherSelectionFromSearch("Max Fried", [
      { playerId: "547943", fullName: "Max Fried", position: "P", isPitcher: true },
      { playerId: "12345", fullName: "Max Muncy", position: "3B", isPitcher: false },
    ]);

    expect(selected).toEqual({
      playerId: "547943",
      fullName: "Max Fried",
      position: "P",
      isPitcher: true,
    });
  });

  it("falls back to the first pitcher candidate when no exact name exists", () => {
    const selected = resolvePitcherSelectionFromSearch("Clay", [
      { playerId: "not-numeric", fullName: "Clay Holmes", position: "P", isPitcher: true },
      { playerId: "676694", fullName: "Clay Holmes", position: "P", isPitcher: true },
      { playerId: "112233", fullName: "Clay Dungan", position: "2B", isPitcher: false },
    ]);

    expect(selected).toEqual({
      playerId: "676694",
      fullName: "Clay Holmes",
      position: "P",
      isPitcher: true,
    });
  });

  it("rejects exact non-pitcher matches instead of treating them as arsenal candidates", () => {
    const resolution = resolvePitcherSearchResult("Juan Soto", [
      { playerId: "665742", fullName: "Juan Soto", position: "RF", isPitcher: false },
      { playerId: "673540", fullName: "Kodai Senga", position: "P", isPitcher: true },
    ]);

    expect(resolution.selection).toBeNull();
    expect(resolution.reason).toBe("NOT_PITCHER");
  });

  it("sorts pitch mix rows from highest usage to lowest", () => {
    const sorted = sortArsenalPitches([
      { type: "Curveball", usagePct: 18.1, velocityMph: 82.1 },
      { type: "Four-Seam Fastball", usagePct: 30.2, velocityMph: 95.1 },
      { type: "Changeup", usagePct: 16.7, velocityMph: 86.4 },
    ]);

    expect(sorted.map((pitch) => pitch.type)).toEqual([
      "Four-Seam Fastball",
      "Curveball",
      "Changeup",
    ]);
  });

  it("describes primary offerings as the arsenal foundation", () => {
    const pitch = { type: "Four-Seam Fastball", usagePct: 30.2, velocityMph: 95.1 };

    expect(describePitchRole(pitch, 1)).toBe("Primary weapon");
    expect(describePitchTakeaway(pitch, 1)).toContain("foundation of the mix");
    expect(describePitchTakeaway(pitch, 1)).toContain("95.1 mph");
  });

  it("describes lower-usage offerings as situational looks", () => {
    const pitch = { type: "Changeup", usagePct: 6.2 };

    expect(describePitchRole(pitch, 4)).toBe("Situational look");
    expect(describePitchTakeaway(pitch, 4)).toContain("matchup or surprise look");
  });

  it("renders both Usage % and Velocity through shared StatLabel wiring", () => {
    const source = readFileSync("components/widgets/MlbPitcherArsenalWidget.tsx", "utf8");

    expect(source.includes('label="Usage %"')).toBe(true);
    expect(source.includes('statKey="pitch_usage_pct"')).toBe(true);
    expect(source.includes('label="Velocity"')).toBe(true);
    expect(source.includes('statKey="velocity_mph"')).toBe(true);
  });
});
