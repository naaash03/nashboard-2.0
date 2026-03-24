import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("data health widget hierarchy", () => {
  it("keeps compact operational summary in the primary section", () => {
    const source = readFileSync("components/widgets/DataHealthWidget.tsx", "utf8");
    expect(source.includes("Effective mode:")).toBe(true);
    expect(source.includes("Effective source:")).toBe(true);
    expect(source.includes("Fallback state:")).toBe(true);
    expect(source.includes("Cache state:")).toBe(true);
  });

  it("gates diagnostics behind advanced mode", () => {
    const source = readFileSync("components/widgets/DataHealthWidget.tsx", "utf8");
    expect(source.includes("props.mode === \"ADVANCED\"")).toBe(true);
    expect(source.includes("Switch to Advanced mode for diagnostics and provider probes.")).toBe(true);
  });
});
