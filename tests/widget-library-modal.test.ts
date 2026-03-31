import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("WidgetLibrary modal layout", () => {
  it("keeps the modal viewport-bounded with per-category scroll areas", () => {
    const source = readFileSync("components/widgets/WidgetLibrary.tsx", "utf8");

    expect(source.includes("max-h-[calc(100vh-2rem)]")).toBe(true);
    expect(source.includes("auto-rows-fr")).toBe(true);
    expect(source.includes("min-h-0 overflow-y-auto")).toBe(true);
    expect(source.includes("Close")).toBe(true);
    expect(source.includes("onAddWidget(widget.key)")).toBe(true);
  });
});
