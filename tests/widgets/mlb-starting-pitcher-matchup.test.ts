import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Meta } from "@/lib/providers/types";
import {
  computePitcherEdge,
  isTechnicalMatchupNote,
  resolveMlbStartingPitcherMatchup,
  selectMatchupGame,
  toUserFacingMatchupNotes,
  type PitcherMatchupCard,
} from "@/lib/sports/resolvers/mlbStartingPitcherMatchup";

function testMeta(sourceUsed: Meta["sourceUsed"] = "apiSports"): Meta {
  return {
    sourceUsed,
    updatedAt: "2026-03-09T12:00:00.000Z",
    requestId: `test-${sourceUsed}`,
    dataMode: "fixture",
    dataModeEffective: "fixture",
  };
}

function pitcherCard(name: string, overrides?: Partial<PitcherMatchupCard>): PitcherMatchupCard {
  return {
    fullName: name,
    era: 3.2,
    whip: 1.1,
    kPer9: 9.4,
    bbPer9: 2.6,
    hrPer9: 1.0,
    ...overrides,
  };
}

function sampleGame(args?: {
  gameId?: string;
  dateKey?: string;
  startTime?: string;
  status?: "scheduled" | "live" | "final";
  probableAway?: PitcherMatchupCard | null;
  probableHome?: PitcherMatchupCard | null;
}) {
  const probableAway = args && Object.prototype.hasOwnProperty.call(args, "probableAway")
    ? (args.probableAway ?? null)
    : pitcherCard("Away Starter");
  const probableHome = args && Object.prototype.hasOwnProperty.call(args, "probableHome")
    ? (args.probableHome ?? null)
    : pitcherCard("Home Starter");

  return {
    gameId: args?.gameId ?? "901001",
    startTime: args?.startTime ?? "2026-03-09T23:10:00.000Z",
    dateKey: args?.dateKey ?? "2026-03-09",
    venue: "Citi Field",
    status: args?.status ?? "scheduled",
    awayTeam: {
      key: "ATL",
      name: "Atlanta Braves",
    },
    homeTeam: {
      key: "NYM",
      name: "New York Mets",
    },
    probableAway,
    probableHome,
  };
}

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("MLB Starting Pitcher Matchup route", () => {
  it("returns standardized envelope", async () => {
    const mod = await import("@/app/api/widgets/mlb-starting-pitcher-matchup/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-starting-pitcher-matchup?sport=mlb&teamKey=NYM&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeNull();
    expect(body.data).toEqual(expect.objectContaining({
      game: expect.any(Object),
      pitchers: expect.any(Object),
      state: expect.any(String),
    }));
    expect(body.contract).toEqual(expect.objectContaining({
      ok: true,
      data: expect.any(Object),
      source: expect.objectContaining({
        provider: expect.any(String),
        mode: expect.any(String),
        fallbackUsed: expect.any(Boolean),
      }),
    }));
  });

  it("resolves matchup gameId using the same MLB schedule path as next-7-games", async () => {
    const next7Mod = await import("@/app/api/widgets/mlb-next-7-games/route");
    const next7Res = await next7Mod.GET(new Request("http://localhost/api/widgets/mlb-next-7-games?teamKey=NYM&mode=advanced&dataMode=fixture"));
    const next7Body = await next7Res.json();
    const gamePk = next7Body.data?.games?.[0]?.gamePk;

    expect(gamePk).toBeDefined();

    const matchupMod = await import("@/app/api/widgets/mlb-starting-pitcher-matchup/route");
    const matchupRes = await matchupMod.GET(new Request(`http://localhost/api/widgets/mlb-starting-pitcher-matchup?sport=mlb&teamKey=NYM&gameId=${gamePk}&mode=advanced&dataMode=fixture`));
    const matchupBody = await matchupRes.json();

    expect(matchupRes.status).toBe(200);
    expect(matchupBody.error).toBeNull();
    expect(matchupBody.data?.game?.gameId).toBe(String(gamePk));
  });

  it("falls back to the prior completed regular season when current sample is too thin", async () => {
    const mod = await import("@/app/api/widgets/mlb-starting-pitcher-matchup/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-starting-pitcher-matchup?sport=mlb&teamKey=NYM&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeNull();
    expect(body.data?.pitchers?.away).toEqual(expect.objectContaining({
      era: expect.any(Number),
      whip: expect.any(Number),
      inningsPitched: expect.any(Number),
      strikeouts: expect.any(Number),
      kPer9: expect.any(Number),
      bbPer9: expect.any(Number),
      hrPer9: expect.any(Number),
      opponentAvg: expect.any(Number),
      statsBasisLabel: "Using 2025 regular season",
    }));
    expect(body.data?.pitchers?.home?.statsBasisLabel).toBe("Using 2025 regular season");
  });

  it("hydrates advanced cards from name-based identity fallback when starter id is unavailable", async () => {
    const mod = await import("@/app/api/widgets/mlb-starting-pitcher-matchup/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/mlb-starting-pitcher-matchup?sport=mlb&teamKey=NYM&gameId=900001&mode=advanced&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBeNull();
    expect(body.data?.pitchers?.away?.fullName).toBeTruthy();
    expect(body.data?.pitchers?.away?.statsBasisLabel).toBe("Using 2025 regular season");
  });
});

describe("MLB Starting Pitcher Matchup resolver", () => {
  it("returns partial state when probable starters are missing", async () => {
    const result = await resolveMlbStartingPitcherMatchup({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
    }, {
      fetchTeamIdentity: async () => ({
        team: { key: "NYM", name: "New York Mets", apiSportsTeamId: "22" },
        meta: testMeta("apiSports"),
      }),
      fetchApiSportsGames: async () => ({
        games: [sampleGame({ probableAway: null, probableHome: null })],
        meta: testMeta("apiSports"),
        notes: [],
      }),
      fetchEspnGameFallback: async () => ({
        game: null,
        meta: testMeta("espn"),
      }),
      fetchPitcherStats: async (pitcher) => ({
        pitcher,
        meta: testMeta("apiSports"),
      }),
      now: () => new Date("2026-03-09T15:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.error).toBeNull();
    expect(result.data?.state).toBe("partial");
    expect(result.data?.notes).toContain("Game found, probable starters not posted yet.");
  });

  it("uses ESPN fallback when APISports game exists but starters are missing", async () => {
    const result = await resolveMlbStartingPitcherMatchup({
      teamKey: "NYM",
      mode: "beginner",
      dataMode: "fixture",
    }, {
      fetchTeamIdentity: async () => ({
        team: { key: "NYM", name: "New York Mets", apiSportsTeamId: "22" },
        meta: testMeta("apiSports"),
      }),
      fetchApiSportsGames: async () => ({
        games: [sampleGame({ probableAway: null, probableHome: pitcherCard("Home Starter") })],
        meta: testMeta("apiSports"),
        notes: [],
      }),
      fetchEspnGameFallback: async () => ({
        game: sampleGame({
          probableAway: pitcherCard("Away Fallback", { playerId: "1" }),
          probableHome: pitcherCard("Home Starter", { playerId: "2" }),
        }),
        meta: testMeta("espn"),
      }),
      fetchPitcherStats: async (pitcher) => ({
        pitcher,
        meta: testMeta("apiSports"),
      }),
      now: () => new Date("2026-03-09T15:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.data?.pitchers.away?.fullName).toBe("Away Fallback");
    expect(result.data?.state).toBe("success");
  });

  it("team-first game resolution prefers today's game", () => {
    const now = new Date("2026-03-09T15:00:00.000Z");
    const out = selectMatchupGame({
      games: [
        sampleGame({
          gameId: "old",
          dateKey: "2026-03-08",
          startTime: "2026-03-08T20:00:00.000Z",
          status: "final",
        }),
        sampleGame({
          gameId: "today",
          dateKey: "2026-03-09",
          startTime: "2026-03-09T23:10:00.000Z",
          status: "scheduled",
        }),
        sampleGame({
          gameId: "next",
          dateKey: "2026-03-11",
          startTime: "2026-03-11T23:10:00.000Z",
          status: "scheduled",
        }),
      ],
      now,
      timeZone: "America/New_York",
    });

    expect(out.selected?.gameId).toBe("today");
    expect(out.selectableGames.length).toBeGreaterThan(0);
  });

  it("gameId override takes priority", () => {
    const now = new Date("2026-03-09T15:00:00.000Z");
    const out = selectMatchupGame({
      games: [
        sampleGame({ gameId: "today", dateKey: "2026-03-09" }),
        sampleGame({ gameId: "override", dateKey: "2026-03-11", startTime: "2026-03-11T23:10:00.000Z" }),
      ],
      gameId: "override",
      now,
      timeZone: "America/New_York",
    });

    expect(out.selected?.gameId).toBe("override");
  });

  it("surfaces labeled past-game contexts in advanced selection options", () => {
    const now = new Date("2026-03-09T15:00:00.000Z");
    const out = selectMatchupGame({
      games: [
        sampleGame({
          gameId: "past",
          dateKey: "2026-03-08",
          startTime: "2026-03-08T20:00:00.000Z",
          status: "final",
        }),
        sampleGame({
          gameId: "upcoming",
          dateKey: "2026-03-10",
          startTime: "2026-03-10T23:10:00.000Z",
          status: "scheduled",
        }),
      ],
      now,
      timeZone: "America/New_York",
    });

    expect(out.selectableGames).toEqual(expect.arrayContaining([
      expect.objectContaining({ gameId: "past", contextType: "past" }),
      expect.objectContaining({ gameId: "upcoming", contextType: "upcoming" }),
    ]));
    expect(out.selectableGames.find((row) => row.gameId === "past")?.label.startsWith("Past:")).toBe(true);
  });

  it("edge calculation is stable", () => {
    const away = pitcherCard("Away Ace", {
      era: 2.8,
      whip: 1.01,
      kPer9: 10.4,
      bbPer9: 2.1,
      hrPer9: 0.7,
      last3Starts: [
        { innings: "6.0", earnedRuns: 1 },
        { innings: "7.0", earnedRuns: 2 },
        { innings: "6.2", earnedRuns: 1 },
      ],
    });
    const home = pitcherCard("Home Starter", {
      era: 3.7,
      whip: 1.22,
      kPer9: 8.5,
      bbPer9: 3.0,
      hrPer9: 1.3,
      last3Starts: [
        { innings: "5.0", earnedRuns: 3 },
        { innings: "5.1", earnedRuns: 4 },
        { innings: "6.0", earnedRuns: 3 },
      ],
    });

    const first = computePitcherEdge({
      away,
      home,
      awayTeamLabel: "ATL",
      homeTeamLabel: "NYM",
    });
    const second = computePitcherEdge({
      away,
      home,
      awayTeamLabel: "ATL",
      homeTeamLabel: "NYM",
    });

    expect(first).toEqual(second);
    expect(first?.overall).toBe("Edge: ATL starter");
    expect(first?.categories?.length).toBeGreaterThanOrEqual(5);
  });

  it("resolver returns structured failed state instead of throwing for missing teamKey", async () => {
    const result = await resolveMlbStartingPitcherMatchup({
      teamKey: "",
      mode: "beginner",
      dataMode: "fixture",
    });

    expect(result.ok).toBe(false);
    expect(result.meta.state).toBe("failed");
    expect(result.error?.code).toBe("MISSING_TEAM_KEY");
  });

  it("keeps technical notes in meta while user-facing notes are filtered", async () => {
    const result = await resolveMlbStartingPitcherMatchup({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
    }, {
      fetchTeamIdentity: async () => ({
        team: { key: "NYM", name: "New York Mets", apiSportsTeamId: "22" },
        meta: testMeta("mlb"),
      }),
      fetchApiSportsGames: async () => ({
        games: [sampleGame()],
        meta: testMeta("mlb"),
        notes: [
          "Schedule window 2026-03-01..2026-03-14 (America/New_York) from MLB schedule provider.",
          "No configured season found; using inferred 2026.",
          "Pitcher stat diagnostic: endpoint /people/608331 season 2025 gameType R type season returned data.",
          "ESPN fallback was used to enrich probable starter context.",
        ],
      }),
      fetchEspnGameFallback: async () => ({
        game: null,
        meta: testMeta("espn"),
      }),
      fetchPitcherStats: async (pitcher) => ({
        pitcher,
        meta: testMeta("mlb"),
      }),
      now: () => new Date("2026-03-09T15:00:00.000Z"),
    });

    expect(result.meta.notes).toContain("No configured season found; using inferred 2026.");
    expect(result.data?.notes).toContain("ESPN fallback was used to enrich probable starter context.");
    expect(result.data?.notes).toContain("Limited matchup data available.");
    expect(result.data?.notes).not.toContain("No configured season found; using inferred 2026.");
    expect(result.data?.notes).not.toContain("Pitcher stat diagnostic: endpoint /people/608331 season 2025 gameType R type season returned data.");
    expect(isTechnicalMatchupNote("No configured season found; using inferred 2026.")).toBe(true);
    expect(isTechnicalMatchupNote("Pitcher stat diagnostic: endpoint foo")).toBe(true);
    expect(toUserFacingMatchupNotes(["Schedule window foo", "Limited matchup data available."])).toEqual(["Limited matchup data available."]);
  });

  it("passes selected game time into advanced pitcher stat hydration", async () => {
    const seenTimes: string[] = [];
    const result = await resolveMlbStartingPitcherMatchup({
      teamKey: "NYM",
      mode: "advanced",
      dataMode: "fixture",
    }, {
      fetchTeamIdentity: async () => ({
        team: { key: "NYM", name: "New York Mets", apiSportsTeamId: "22" },
        meta: testMeta("mlb"),
      }),
      fetchApiSportsGames: async () => ({
        games: [sampleGame({
          startTime: "2026-03-11T23:10:00.000Z",
          probableAway: pitcherCard("Away Starter", { playerId: "1" }),
          probableHome: pitcherCard("Home Starter", { playerId: "2" }),
        })],
        meta: testMeta("mlb"),
        notes: [],
      }),
      fetchEspnGameFallback: async () => ({
        game: null,
        meta: testMeta("espn"),
      }),
      fetchPitcherStats: async (pitcher, _providerMode, _cacheBust, selectedGameTime) => {
        if (selectedGameTime) {
          seenTimes.push(selectedGameTime);
        }
        return {
          pitcher: {
            ...pitcher,
            statsBasisLabel: "Stats basis: 2025 regular season",
          },
          meta: testMeta("mlb"),
        };
      },
      now: () => new Date("2026-03-09T15:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(seenTimes).toEqual([
      "2026-03-11T23:10:00.000Z",
      "2026-03-11T23:10:00.000Z",
    ]);
  });

  it("allows a custom pitcher selection for the tracked team in advanced mode", async () => {
    const result = await resolveMlbStartingPitcherMatchup({
      teamKey: "NYM",
      pitcherId: "99",
      mode: "advanced",
      dataMode: "fixture",
    }, {
      fetchTeamIdentity: async () => ({
        team: { key: "NYM", name: "New York Mets", apiSportsTeamId: "22" },
        meta: testMeta("mlb"),
      }),
      fetchApiSportsGames: async () => ({
        games: [sampleGame({
          probableAway: pitcherCard("Away Starter", { playerId: "1" }),
          probableHome: pitcherCard("Home Starter", { playerId: "2" }),
        })],
        meta: testMeta("mlb"),
        notes: [],
      }),
      fetchEspnGameFallback: async () => ({
        game: null,
        meta: testMeta("espn"),
      }),
      fetchPitcherStats: async (pitcher) => ({
        pitcher: pitcher.playerId === "99"
          ? {
            ...pitcher,
            fullName: "Custom Mets Pitcher",
            era: 2.91,
            statsBasisLabel: "Using 2025 regular season",
          }
          : pitcher,
        meta: testMeta("mlb"),
      }),
      now: () => new Date("2026-03-09T15:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.data?.pitcherSelection).toEqual(expect.objectContaining({
      type: "custom",
      label: "Custom pitcher selection",
      selectedPitcherId: "99",
      selectedPitcherName: "Custom Mets Pitcher",
      teamKey: "NYM",
    }));
    expect(result.data?.pitchers.home?.fullName).toBe("Custom Mets Pitcher");
    expect(result.data?.pitchers.away?.fullName).toBe("Away Starter");
  });
});
