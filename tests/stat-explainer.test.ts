import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  BUILTIN_GLOSSARY_TERMS,
  enrichTermWithFallbacks,
  lookupGlossaryTerm,
  mergeGlossaryTerms,
} from "@/lib/stats/glossary";
import { getRankabilityRule, isRankable } from "@/lib/stats/rankability";

describe("stat explainer glossary lookup", () => {
  it("resolves legacy widget aliases to shared glossary entries", () => {
    expect(lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "kPer9", sport: "MLB" })?.key).toBe("k_per_9");
    expect(lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "inningsPitched", sport: "MLB" })?.key).toBe("innings_pitched");
    expect(lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { label: "Team OBP", sport: "MLB" })?.key).toBe("obp");
    expect(lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { label: "Usage %", sport: "MLB" })?.key).toBe("pitch_usage_pct");
    expect(lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { label: "usage percent", sport: "MLB" })?.key).toBe("pitch_usage_pct");
    expect(lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { label: "Mix Share", sport: "MLB" })?.key).toBe("pitch_usage_pct");
    expect(lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { label: "Velo", sport: "MLB" })?.key).toBe("velocity_mph");
    expect(lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "pass_ypg", sport: "NFL" })?.key).toBe("pass_ypg");
  });

  it("preserves builtin aliases and richer builtin metadata when db terms override copy", () => {
    const merged = mergeGlossaryTerms([
      {
        sport: "MLB",
        key: "avg",
        label: "AVG",
        plainDefinition: "Database override definition.",
        whyItMatters: "Database override value.",
      },
    ]);

    const avg = lookupGlossaryTerm(merged, { label: "Team AVG", sport: "MLB" });

    expect(avg?.plainDefinition).toBe("Database override definition.");
    expect(avg?.advancedNotes).toBe("AVG ignores walks and power, so it is best paired with OBP and SLG.");
    expect(avg?.direction).toBe("HIGHER_IS_BETTER");
    expect(avg?.interpretation).toContain("Higher AVG");
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
      "components/widgets/MlbPitcherArsenalWidget.tsx",
      "components/widgets/MlbBullpenFatigueWidget.tsx",
      "components/widgets/MlbRunExpectancyWidget.tsx",
      "components/widgets/PlayerCardWidget.tsx",
      "components/widgets/WatchlistWidget.tsx",
    ];

    for (const file of sources) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("StatLabel")).toBe(true);
    }
  });

  it("keeps the explainer modal viewport-bounded and scrollable", () => {
    const source = readFileSync("components/stats/StatExplainerModal.tsx", "utf8");

    expect(source.includes("overflow-y-auto bg-black/75")).toBe(true);
    expect(source.includes("max-h-[calc(100vh-3rem)] overflow-y-auto overscroll-contain")).toBe(true);
    expect(source.includes('role="dialog"')).toBe(true);
    expect(source.includes('aria-modal="true"')).toBe(true);
  });

  it("renders HOW IT'S CALCULATED and INTERPRETATION sections in the modal source", () => {
    const source = readFileSync("components/stats/StatExplainerModal.tsx", "utf8");

    expect(source.includes("How it")).toBe(true);
    expect(source.includes("Interpretation")).toBe(true);
    expect(source.includes("term.calculation")).toBe(true);
    expect(source.includes("term.tiers")).toBe(true);
    expect(source.includes("term.tags")).toBe(true);
  });
});

describe("glossary rich metadata", () => {
  it("K/9 has calculation, tiers, leagueAverage, and tags", () => {
    const k9 = lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "k_per_9", sport: "MLB" });

    expect(k9?.calculation).toBeDefined();
    expect(k9?.calculation?.formula).toContain("Strikeouts");
    expect(k9?.calculation?.components.length).toBeGreaterThanOrEqual(3);
    expect(k9?.tiers).toBeDefined();
    expect(k9?.tiers?.length).toBe(4);
    expect(k9?.leagueAverage).toBeDefined();
    expect(k9?.tags).toBeDefined();
    expect(k9?.tags?.length).toBeGreaterThan(0);
  });

  it("ERA has calculation and tiers", () => {
    const era = lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "era", sport: "MLB" });

    expect(era?.calculation).toBeDefined();
    expect(era?.tiers?.length).toBe(4);
    expect(era?.tags).toBeDefined();
  });

  it("WHIP has calculation and tiers", () => {
    const whip = lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "whip", sport: "MLB" });

    expect(whip?.calculation).toBeDefined();
    expect(whip?.tiers?.length).toBe(4);
    expect(whip?.tags).toBeDefined();
  });

  it("tiers preserve through mergeGlossaryTerms when db does not override them", () => {
    const merged = mergeGlossaryTerms([
      {
        sport: "MLB",
        key: "k_per_9",
        label: "K/9",
        plainDefinition: "DB override.",
        whyItMatters: "DB override.",
      },
    ]);

    const k9 = lookupGlossaryTerm(merged, { key: "k_per_9", sport: "MLB" });
    expect(k9?.tiers?.length).toBe(4);
    expect(k9?.tags?.length).toBeGreaterThan(0);
  });
});

describe("rankability registry", () => {
  it("pitcher rate stats are rankable for players", () => {
    expect(isRankable("era", "MLB", "player")).toBe(true);
    expect(isRankable("whip", "MLB", "player")).toBe(true);
    expect(isRankable("k_per_9", "MLB", "player")).toBe(true);
    expect(isRankable("bb_per_9", "MLB", "player")).toBe(true);
    expect(isRankable("hr_per_9", "MLB", "player")).toBe(true);
  });

  it("hitter rate stats are rankable for players", () => {
    expect(isRankable("avg", "MLB", "player")).toBe(true);
    expect(isRankable("obp", "MLB", "player")).toBe(true);
    expect(isRankable("slg", "MLB", "player")).toBe(true);
    expect(isRankable("ops", "MLB", "player")).toBe(true);
  });

  it("team stats are rankable for teams", () => {
    expect(isRankable("run_differential", "MLB", "team")).toBe(true);
    expect(isRankable("w_l_record", "MLB", "team")).toBe(true);
  });

  it("entity type mismatch returns false", () => {
    // avg is a player stat — should not be rankable for teams
    expect(isRankable("avg", "MLB", "team")).toBe(false);
    // run_differential is a team stat — should not be rankable for players
    expect(isRankable("run_differential", "MLB", "player")).toBe(false);
  });

  it("unknown stats are not rankable", () => {
    expect(isRankable("days_rest", "MLB")).toBe(false);
    expect(isRankable("games_played", "MLB")).toBe(false);
    expect(isRankable("ppg", "NBA")).toBe(false);
  });

  it("ERA rule has an mlbLeaderCategory for the stats/leaders endpoint", () => {
    const rule = getRankabilityRule("era", "MLB");
    expect(rule).not.toBeNull();
    expect(rule?.mlbLeaderCategory).toBe("earnedRunAverage");
    expect(rule?.scopeLabel).toBeTruthy();
    expect(rule?.qualifierText).toBeTruthy();
  });

  it("team stats rules have no mlbLeaderCategory (they use standings)", () => {
    const rule = getRankabilityRule("run_differential", "MLB");
    expect(rule?.mlbLeaderCategory).toBeUndefined();
    expect(rule?.entityType).toBe("team");
  });

  it("stat explainer modal source includes RankingSection and isRankable wiring", () => {
    const source = readFileSync("components/stats/StatExplainerModal.tsx", "utf8");
    expect(source.includes("RankingSection")).toBe(true);
    expect(source.includes("isRankable")).toBe(true);
    expect(source.includes("rankingContext")).toBe(true);
    expect(source.includes("Where they rank")).toBe(true);
    expect(source.includes("Top 10")).toBe(true);
  });

  it("StatLabel source includes rankingContext prop", () => {
    const source = readFileSync("components/stats/StatLabel.tsx", "utf8");
    expect(source.includes("rankingContext")).toBe(true);
  });
});

describe("enrichTermWithFallbacks universal pipeline", () => {
  it("every builtin term resolves a direction after enrichment", () => {
    const valid = ["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "CONTEXT_DEPENDENT"];
    for (const t of BUILTIN_GLOSSARY_TERMS) {
      const enriched = enrichTermWithFallbacks(t);
      expect(valid).toContain(enriched.direction);
    }
  });

  it("generates fallback calculation for terms without authored calculation", () => {
    const hr = lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "hr", sport: "MLB" })!;
    expect(hr.calculation).toBeUndefined();
    const enriched = enrichTermWithFallbacks(hr);
    expect(enriched.calculation).toBeDefined();
    expect(enriched.calculation?.formula).toBeTruthy();
    expect(enriched.calculation?.components.length).toBeGreaterThanOrEqual(1);
  });

  it("generates fallback tiers for HIGHER_IS_BETTER stats without authored tiers", () => {
    const hr = lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "hr", sport: "MLB" })!;
    expect(hr.tiers).toBeUndefined();
    const enriched = enrichTermWithFallbacks(hr);
    expect(enriched.tiers).toBeDefined();
    expect(enriched.tiers?.length).toBe(4);
  });

  it("does not generate tiers for CONTEXT_DEPENDENT stats", () => {
    const rest = lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "days_rest", sport: "MLB" })!;
    const enriched = enrichTermWithFallbacks(rest);
    expect(enriched.direction).toBe("CONTEXT_DEPENDENT");
    expect(enriched.tiers).toBeUndefined();
  });

  it("generates fallback tags for terms without authored tags", () => {
    const rbi = lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "rbi", sport: "MLB" })!;
    expect(rbi.tags).toBeUndefined();
    const enriched = enrichTermWithFallbacks(rbi);
    expect(enriched.tags).toBeDefined();
    expect(enriched.tags!.length).toBeGreaterThan(0);
  });

  it("generates fallback advancedNotes for terms without authored notes", () => {
    const hr = lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "hr", sport: "MLB" })!;
    expect(hr.advancedNotes).toBeUndefined();
    const enriched = enrichTermWithFallbacks(hr);
    expect(enriched.advancedNotes).toBeTruthy();
  });

  it("does not overwrite authored rich metadata with fallbacks", () => {
    const k9 = lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "k_per_9", sport: "MLB" })!;
    const enriched = enrichTermWithFallbacks(k9);
    expect(enriched.calculation?.formula).toContain("Strikeouts");
    expect(enriched.tiers?.length).toBe(4);
    expect(enriched.tiers?.[0].label).toBe("Bat-missing");
    expect(enriched.tags).toContain("Swing-and-miss");
  });

  it("avg has authored rich metadata that passes through enrichment intact", () => {
    const avg = lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "avg", sport: "MLB" })!;
    expect(avg.calculation).toBeDefined();
    expect(avg.tiers?.length).toBe(4);
    const enriched = enrichTermWithFallbacks(avg);
    expect(enriched.calculation?.formula).toContain("Hits");
    expect(enriched.tags).toContain("Contact rate");
  });

  it("NBA and NFL terms get fallback calculation and tiers after enrichment", () => {
    const ppg = lookupGlossaryTerm(BUILTIN_GLOSSARY_TERMS, { key: "ppg", sport: "NBA" })!;
    expect(ppg.calculation).toBeUndefined();
    const enriched = enrichTermWithFallbacks(ppg);
    expect(enriched.calculation).toBeDefined();
    expect(enriched.tiers?.length).toBe(4);
    expect(enriched.tags!.length).toBeGreaterThan(0);
  });
});
