import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dashboard data-mode persistence boundaries", () => {
  it("does not persist dev fixture override via preferences PUT", () => {
    const source = readFileSync("components/dashboard/DashboardPage.tsx", "utf8");
    expect(/\/api\/preferences\/data-mode[\s\S]*method:\s*"PUT"/.test(source)).toBe(false);
  });

  it("still reads persisted preference mode from API", () => {
    const source = readFileSync("components/dashboard/DashboardPage.tsx", "utf8");
    expect(source.includes('fetch("/api/preferences/data-mode"')).toBe(true);
  });
});
