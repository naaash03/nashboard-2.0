import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  BUILTIN_GLOSSARY_TERMS,
  lookupGlossaryTerm,
  mergeGlossaryTerms,
} from "@/lib/stats/glossary";

describe("stat explainer glossary lookup", () => {
  it("resolves legacy widget aliases to shared glossary entries", () => {
    expect(lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "kPer9", sport: "MLB" })?.key).toBe("k_per_9");
    expect(lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "inningsPitched", sport: "MLB" })?.key).toBe("innings_pitched");
    expect(lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { label: "Team OBP", sport: "MLB" })?.key).toBe("obp");
    expect(lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "pass_ypg", sport: "NFL" })?.key).toBe("pass_ypg");
  });

  it("preserves builtin aliases when db terms override copy", () => {
    const merged = mergeGlossaryTerms([
      {
        sport: "MLB",
        key: "avg",
        label: "AVG",
        plainDefinition: "Database override definition.",
        whyItMatters: "Database override value.",
      },
    ]);

    expect(lookupGlossaryTerm(merged, { label: "Team AVG", sport: "MLB" })?.plainDefinition).toBe("Database override definition.");
  });
});

describe("glossary route fallback", () => {
  it("returns builtin glossary terms when the database is unavailable", async () => {
    vi.resetModules();
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const mod = await import("@/app/api/glossary/route");
    const res = await mod.GET();
    const body = await res.json();

    process.env.DATABASE_URL = originalDatabaseUrl;

    expect(res.status).toBe(200);
    expect(Array.isArray(body.terms)).toBe(true);
    expect(body.terms.length).toBeGreaterThan(10);
    expect(body.terms.some((term: { key: string }) => term.key === "era")).toBe(true);
    expect(body.terms.some((term: { key: string }) => term.key === "ppg")).toBe(true);
  });
});

describe("stat explainer rollout wiring", () => {
  it("keeps a shared dashboard-level provider and widget-level stat labels", () => {
    const dashboardSource = readFileSync("components/dashboard/DashboardPage.tsx", "utf8");
    expect(dashboardSource.includes("StatExplainerProvider")).toBe(true);

    const sources = [
      "components/widgets/MlbSeasonStatsWidget.tsx",
      "components/widgets/MlbStartingPitcherMatchupWidget.tsx",
      "components/widgets/MlbSeriesTrackerWidget.tsx",
      "components/widgets/MlbPlatoonAdvantageWidget.tsx",
      "components/widgets/MlbRecentFormWidget.tsx",
      "components/widgets/MlbBullpenFatigueWidget.tsx",
      "components/widgets/MlbRunExpectancyWidget.tsx",
      "components/widgets/NbaStandingsWidget.tsx",
      "components/widgets/PlayerCardWidget.tsx",
      "components/widgets/WatchlistWidget.tsx",
    ];

    for (const file of sources) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("StatLabel")).toBe(true);
    }
  });
});
