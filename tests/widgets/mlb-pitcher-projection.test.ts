import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MlbGameOdds } from "@/lib/providers/odds/client";
import type { GameDayWeather } from "@/lib/providers/weather/client";
import {
  resolveMlbPitcherProjection,
  type ProjectionDeps,
} from "@/lib/sports/resolvers/mlbPitcherProjection";
import type { PitcherMatchupCard } from "@/lib/sports/resolvers/mlbStartingPitcherMatchup";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function liveOdds(overUnder: number | null = 8.5): MlbGameOdds {
  return {
    homeMoneyline: -140,
    awayMoneyline: 120,
    overUnder,
    source: "odds_api",
    isFallback: false,
  };
}

function fallbackOdds(reason = "THE_ODDS_KEY is not configured."): MlbGameOdds {
  return {
    homeMoneyline: null,
    awayMoneyline: null,
    overUnder: null,
    source: "unavailable",
    isFallback: true,
    fallbackReason: reason,
  };
}

function liveWeather(impact: GameDayWeather["weatherImpact"] = "low"): GameDayWeather {
  return {
    tempF: 68,
    condition: "Clear",
    windMph: 8,
    isOutdoor: true,
    weatherImpact: impact,
    source: "openweather",
    isFallback: false,
  };
}

function fallbackWeather(reason = "OPEN_WEATHER_KEY is not configured."): GameDayWeather {
  return {
    tempF: null,
    condition: null,
    windMph: null,
    isOutdoor: false,
    weatherImpact: "none",
    source: "unavailable",
    isFallback: true,
    fallbackReason: reason,
  };
}

function pitcherCard(overrides?: Partial<PitcherMatchupCard>): PitcherMatchupCard {
  return {
    fullName: "Test Pitcher",
    era: 3.20,
    whip: 1.12,
    kPer9: 10.0,
    bbPer9: 2.8,
    hrPer9: 1.1,
    last3Starts: [
      { innings: "6.0", earnedRuns: 2, strikeouts: 7 },
      { innings: "7.0", earnedRuns: 1, strikeouts: 9 },
      { innings: "6.2", earnedRuns: 3, strikeouts: 6 },
    ],
    ...overrides,
  };
}

// Produces a resolver that fakes the matchup lookup with a controlled pitcher card
function makeDeps(
  pitcher: PitcherMatchupCard | null,
  oddsOverride?: MlbGameOdds,
  weatherOverride?: GameDayWeather,
  side: "home" | "away" = "home",
): ProjectionDeps & {
  matchupOverride: {
    teamKey: string;
    pitcher: PitcherMatchupCard | null;
    side: "home" | "away";
  };
} {
  return {
    fetchOdds: vi.fn().mockResolvedValue(oddsOverride ?? liveOdds()),
    fetchWeather: vi.fn().mockResolvedValue(weatherOverride ?? liveWeather()),
    matchupOverride: { teamKey: "NYM", pitcher, side },
  };
}

// Inject matchup resolver via vi.mock to avoid real network calls
function buildMatchupMock(pitcher: PitcherMatchupCard | null, side: "home" | "away") {
  return async (_args: unknown) => ({
    ok: pitcher !== null,
    data: pitcher
      ? {
          game: {
            gameId: "test-game-1",
            awayTeam: { key: side === "away" ? "NYM" : "ATL", name: side === "away" ? "New York Mets" : "Atlanta Braves" },
            homeTeam: { key: side === "home" ? "NYM" : "ATL", name: side === "home" ? "New York Mets" : "Atlanta Braves" },
            gameTime: "2026-04-20T23:10:00.000Z",
            venue: "Citi Field",
            status: "scheduled" as const,
          },
          pitchers: {
            away: side === "away" ? pitcher : { fullName: "Other Pitcher", era: 4.0 },
            home: side === "home" ? pitcher : { fullName: "Other Pitcher", era: 4.0 },
          },
          state: "success" as const,
        }
      : null,
    meta: {
      sourceUsed: "mlb" as const,
      updatedAt: "2026-04-20T12:00:00.000Z",
      fallbackUsed: false,
      state: pitcher ? ("success" as const) : ("failed" as const),
      requestId: "test-request-id",
    },
    error: pitcher ? null : { message: "Matchup failed", code: "MATCHUP_FAILED" },
  });
}

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

// ---------------------------------------------------------------------------
// 1. Fixture / shape test
// ---------------------------------------------------------------------------

describe("resolveMlbPitcherProjection — shape", () => {
  it("returns a valid PredictionPayload when all sources are live", async () => {
    vi.doMock("@/lib/sports/resolvers/mlbStartingPitcherMatchup", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/lib/sports/resolvers/mlbStartingPitcherMatchup")>();
      return {
        ...original,
        resolveMlbStartingPitcherMatchup: buildMatchupMock(pitcherCard(), "home"),
      };
    });

    const { resolveMlbPitcherProjection: resolve } = await import("@/lib/sports/resolvers/mlbPitcherProjection");

    const result = await resolve(
      { pitcherTeamKey: "NYM", mode: "ADVANCED", dataMode: "fixture" },
      { fetchOdds: vi.fn().mockResolvedValue(liveOdds()), fetchWeather: vi.fn().mockResolvedValue(liveWeather()) },
    );

    expect(result.ok).toBe(true);
    expect(result.error).toBeNull();
    expect(result.data).toEqual(expect.objectContaining({
      pointEstimate: expect.any(Number),
      rangeLow: expect.any(Number),
      rangeHigh: expect.any(Number),
      confidenceLabel: expect.stringMatching(/^(low|medium|high)$/),
      explanation: expect.any(String),
      keyFactors: expect.arrayContaining([expect.any(String)]),
      inputs: expect.any(Object),
      sources: expect.arrayContaining(["mlb"]),
      generatedAt: expect.any(String),
      isFallback: expect.any(Boolean),
    }));
    expect(result.data!.rangeLow).toBeLessThanOrEqual(result.data!.pointEstimate);
    expect(result.data!.rangeHigh).toBeGreaterThanOrEqual(result.data!.pointEstimate);
  });
});

// ---------------------------------------------------------------------------
// 2. Fallback confidence test
// ---------------------------------------------------------------------------

describe("resolveMlbPitcherProjection — fallback confidence", () => {
  it("drops confidenceLabel to medium when odds isFallback", async () => {
    vi.doMock("@/lib/sports/resolvers/mlbStartingPitcherMatchup", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/lib/sports/resolvers/mlbStartingPitcherMatchup")>();
      return {
        ...original,
        resolveMlbStartingPitcherMatchup: buildMatchupMock(pitcherCard(), "home"),
      };
    });

    const { resolveMlbPitcherProjection: resolve } = await import("@/lib/sports/resolvers/mlbPitcherProjection");

    const result = await resolve(
      { pitcherTeamKey: "NYM", mode: "ADVANCED", dataMode: "fixture" },
      { fetchOdds: vi.fn().mockResolvedValue(fallbackOdds()), fetchWeather: vi.fn().mockResolvedValue(liveWeather()) },
    );

    expect(result.ok).toBe(true);
    expect(result.data?.confidenceLabel).toBe("medium");
  });

  it("drops confidenceLabel to low when both odds and weather are fallback", async () => {
    vi.doMock("@/lib/sports/resolvers/mlbStartingPitcherMatchup", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/lib/sports/resolvers/mlbStartingPitcherMatchup")>();
      return {
        ...original,
        resolveMlbStartingPitcherMatchup: buildMatchupMock(pitcherCard(), "home"),
      };
    });

    const { resolveMlbPitcherProjection: resolve } = await import("@/lib/sports/resolvers/mlbPitcherProjection");

    const result = await resolve(
      { pitcherTeamKey: "NYM", mode: "BEGINNER", dataMode: "fixture" },
      { fetchOdds: vi.fn().mockResolvedValue(fallbackOdds()), fetchWeather: vi.fn().mockResolvedValue(fallbackWeather()) },
    );

    expect(result.ok).toBe(true);
    expect(result.data?.confidenceLabel).toBe("low");
    expect(result.data?.isFallback).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Weather impact test
// ---------------------------------------------------------------------------

describe("resolveMlbPitcherProjection — weather modifier", () => {
  it("reduces pointEstimate by 0.5 compared to low-impact baseline when weather is high", async () => {
    vi.doMock("@/lib/sports/resolvers/mlbStartingPitcherMatchup", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/lib/sports/resolvers/mlbStartingPitcherMatchup")>();
      return {
        ...original,
        resolveMlbStartingPitcherMatchup: buildMatchupMock(pitcherCard(), "home"),
      };
    });

    const { resolveMlbPitcherProjection: resolve } = await import("@/lib/sports/resolvers/mlbPitcherProjection");

    const [baseline, highWind] = await Promise.all([
      resolve(
        { pitcherTeamKey: "NYM", mode: "ADVANCED", dataMode: "fixture" },
        { fetchOdds: vi.fn().mockResolvedValue(liveOdds()), fetchWeather: vi.fn().mockResolvedValue(liveWeather("low")) },
      ),
      resolve(
        { pitcherTeamKey: "NYM", mode: "ADVANCED", dataMode: "fixture" },
        { fetchOdds: vi.fn().mockResolvedValue(liveOdds()), fetchWeather: vi.fn().mockResolvedValue(liveWeather("high")) },
      ),
    ]);

    expect(baseline.ok).toBe(true);
    expect(highWind.ok).toBe(true);
    const diff = (baseline.data?.pointEstimate ?? 0) - (highWind.data?.pointEstimate ?? 0);
    expect(Math.round(diff * 10) / 10).toBeCloseTo(0.5, 1);
  });

  it("reduces pointEstimate by 0.25 when weather impact is moderate", async () => {
    vi.doMock("@/lib/sports/resolvers/mlbStartingPitcherMatchup", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/lib/sports/resolvers/mlbStartingPitcherMatchup")>();
      return {
        ...original,
        resolveMlbStartingPitcherMatchup: buildMatchupMock(pitcherCard(), "home"),
      };
    });

    const { resolveMlbPitcherProjection: resolve } = await import("@/lib/sports/resolvers/mlbPitcherProjection");

    const [baseline, moderate] = await Promise.all([
      resolve(
        { pitcherTeamKey: "NYM", mode: "ADVANCED", dataMode: "fixture" },
        { fetchOdds: vi.fn().mockResolvedValue(liveOdds()), fetchWeather: vi.fn().mockResolvedValue(liveWeather("low")) },
      ),
      resolve(
        { pitcherTeamKey: "NYM", mode: "ADVANCED", dataMode: "fixture" },
        { fetchOdds: vi.fn().mockResolvedValue(liveOdds()), fetchWeather: vi.fn().mockResolvedValue(liveWeather("moderate")) },
      ),
    ]);

    const diff = (baseline.data?.pointEstimate ?? 0) - (moderate.data?.pointEstimate ?? 0);
    expect(Math.round(diff * 10) / 10).toBeCloseTo(0.25, 1);
  });
});

// ---------------------------------------------------------------------------
// 4. Source metadata test
// ---------------------------------------------------------------------------

describe("resolveMlbPitcherProjection — source metadata", () => {
  it("includes odds_api and openweather in sources when both are live", async () => {
    vi.doMock("@/lib/sports/resolvers/mlbStartingPitcherMatchup", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/lib/sports/resolvers/mlbStartingPitcherMatchup")>();
      return {
        ...original,
        resolveMlbStartingPitcherMatchup: buildMatchupMock(pitcherCard(), "home"),
      };
    });

    const { resolveMlbPitcherProjection: resolve } = await import("@/lib/sports/resolvers/mlbPitcherProjection");

    const result = await resolve(
      { pitcherTeamKey: "NYM", mode: "ADVANCED", dataMode: "fixture" },
      { fetchOdds: vi.fn().mockResolvedValue(liveOdds()), fetchWeather: vi.fn().mockResolvedValue(liveWeather()) },
    );

    expect(result.data?.sources).toContain("odds_api");
    expect(result.data?.sources).toContain("openweather");
  });

  it("excludes odds_api from sources when odds isFallback", async () => {
    vi.doMock("@/lib/sports/resolvers/mlbStartingPitcherMatchup", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/lib/sports/resolvers/mlbStartingPitcherMatchup")>();
      return {
        ...original,
        resolveMlbStartingPitcherMatchup: buildMatchupMock(pitcherCard(), "home"),
      };
    });

    const { resolveMlbPitcherProjection: resolve } = await import("@/lib/sports/resolvers/mlbPitcherProjection");

    const result = await resolve(
      { pitcherTeamKey: "NYM", mode: "ADVANCED", dataMode: "fixture" },
      { fetchOdds: vi.fn().mockResolvedValue(fallbackOdds()), fetchWeather: vi.fn().mockResolvedValue(liveWeather()) },
    );

    expect(result.data?.sources).not.toContain("odds_api");
    expect(result.data?.sources).toContain("openweather");
  });

  it("meta.sourceUsed reflects the combined sources used", async () => {
    vi.doMock("@/lib/sports/resolvers/mlbStartingPitcherMatchup", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/lib/sports/resolvers/mlbStartingPitcherMatchup")>();
      return {
        ...original,
        resolveMlbStartingPitcherMatchup: buildMatchupMock(pitcherCard(), "home"),
      };
    });

    const { resolveMlbPitcherProjection: resolve } = await import("@/lib/sports/resolvers/mlbPitcherProjection");

    const result = await resolve(
      { pitcherTeamKey: "NYM", mode: "ADVANCED", dataMode: "fixture" },
      { fetchOdds: vi.fn().mockResolvedValue(liveOdds()), fetchWeather: vi.fn().mockResolvedValue(liveWeather()) },
    );

    expect(result.meta.sourceUsed).toContain("odds_api");
    expect(result.meta.sourceUsed).toContain("openweather");
  });
});

// ---------------------------------------------------------------------------
// 5. Error / edge case tests
// ---------------------------------------------------------------------------

describe("resolveMlbPitcherProjection — error cases", () => {
  it("returns MISSING_TEAM_KEY error for empty pitcherTeamKey", async () => {
    const { resolveMlbPitcherProjection: resolve } = await import("@/lib/sports/resolvers/mlbPitcherProjection");

    const result = await resolve({ pitcherTeamKey: "", mode: "BEGINNER", dataMode: "fixture" });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("MISSING_TEAM_KEY");
    expect(result.data).toBeNull();
  });

  it("O/U above 9 applies -0.3 reduction", async () => {
    vi.doMock("@/lib/sports/resolvers/mlbStartingPitcherMatchup", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/lib/sports/resolvers/mlbStartingPitcherMatchup")>();
      return {
        ...original,
        resolveMlbStartingPitcherMatchup: buildMatchupMock(pitcherCard(), "home"),
      };
    });

    const { resolveMlbPitcherProjection: resolve } = await import("@/lib/sports/resolvers/mlbPitcherProjection");

    const [normal, highOu] = await Promise.all([
      resolve(
        { pitcherTeamKey: "NYM", mode: "ADVANCED", dataMode: "fixture" },
        { fetchOdds: vi.fn().mockResolvedValue(liveOdds(8.5)), fetchWeather: vi.fn().mockResolvedValue(liveWeather("none")) },
      ),
      resolve(
        { pitcherTeamKey: "NYM", mode: "ADVANCED", dataMode: "fixture" },
        { fetchOdds: vi.fn().mockResolvedValue(liveOdds(9.5)), fetchWeather: vi.fn().mockResolvedValue(liveWeather("none")) },
      ),
    ]);

    const diff = (normal.data?.pointEstimate ?? 0) - (highOu.data?.pointEstimate ?? 0);
    expect(Math.round(diff * 10) / 10).toBeCloseTo(0.3, 1);
  });
});

// ---------------------------------------------------------------------------
// 6. API route smoke test
// ---------------------------------------------------------------------------

describe("mlb-pitcher-projection route", () => {
  it("returns 400 for missing pitcherTeamKey", async () => {
    const mod = await import("@/app/api/widgets/mlb-pitcher-projection/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-pitcher-projection"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.data).toBeNull();
    expect(body.error).toBeTruthy();
  });
});
