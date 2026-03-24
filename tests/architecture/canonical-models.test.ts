import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizeGameFromApiSports,
  normalizePlayerFromApiSports,
  normalizeTeamFromApiSports,
} from "@/lib/sports/adapters";
import { findTeamByAlias, findTeamByProviderId } from "@/lib/sports/mappings/teamMap";
import { resolveWatchlistData } from "@/lib/sports/resolvers";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { canAutoUseFixtureFallback } from "@/lib/sports/utils/fixturePolicy";

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

describe("canonical api-sports adapters", () => {
  it("normalizes team/player/game rows into canonical models", () => {
    const teamsPayload = loadJson("tests/fixtures/apiSports/mlb/teams_search_sample.json") as {
      response: Array<Record<string, unknown>>;
    };
    const playersPayload = loadJson("tests/fixtures/apiSports/mlb/players_search_sample.json") as {
      response: Array<Record<string, unknown>>;
    };
    const schedulePayload = loadJson("tests/fixtures/apiSports/mlb/team_schedule_window_sample.json") as {
      response: Array<Record<string, unknown>>;
    };

    const team = normalizeTeamFromApiSports(teamsPayload.response[0], "MLB");
    const player = normalizePlayerFromApiSports(playersPayload.response[0], "MLB");
    const game = normalizeGameFromApiSports(schedulePayload.response[0], "MLB");

    expect(team).toEqual(expect.objectContaining({
      league: "MLB",
      abbreviation: "NYM",
      name: "New York Mets",
      id: expect.stringContaining("mlb-"),
    }));
    expect(player).toEqual(expect.objectContaining({
      league: "MLB",
      fullName: "Juan Soto",
      teamId: team.id,
      position: "RF",
      providerIds: expect.objectContaining({
        apiSports: "40286",
      }),
    }));
    expect(game).toEqual(expect.objectContaining({
      league: "MLB",
      homeTeamId: expect.any(String),
      awayTeamId: expect.any(String),
      status: "ft",
      sourceMeta: expect.objectContaining({
        provider: "apiSports",
      }),
    }));
  });
});

describe("fallback and widget envelope metadata", () => {
  it("marks fallback mode when provider differs from primary", () => {
    const payload = toWidgetPayload({
      data: [{ any: "value" }],
      error: null,
      meta: {
        sourceUsed: "espn",
        updatedAt: "2026-03-09T00:00:00.000Z",
        requestId: "test-request",
      },
      primaryProvider: "apiSports",
    });

    expect(payload.ok).toBe(true);
    expect(payload.source.provider).toBe("espn");
    expect(payload.source.mode).toBe("fallback");
    expect(payload.source.fallbackUsed).toBe(true);
  });

  it("returns widget-facing canonical watchlist envelope", () => {
    const payload = resolveWatchlistData({
      league: "NFL",
      items: [{ teamKey: "NYJ", teamName: "New York Jets", apiSportsTeamId: "20", espnTeamId: "20" }],
    });

    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data?.[0]).toEqual(expect.objectContaining({
      league: "NFL",
      abbreviation: "NYJ",
      providerIds: expect.objectContaining({
        apiSports: "20",
        espn: "20",
      }),
    }));
  });
});

describe("team mapping and fixture policy", () => {
  it("resolves stable team mapping by alias and provider id", () => {
    const byAlias = findTeamByAlias("NBA", "lakers");
    const byProvider = findTeamByProviderId("MLB", "apiSports", "22");

    expect(byAlias?.abbreviation).toBe("LAL");
    expect(byProvider?.abbreviation).toBe("NYM");
  });

  it("allows auto fixture fallback only in dev/test unless explicitly enabled", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevFlag = process.env.NASHBOARD_ALLOW_AUTO_FIXTURE_FALLBACK;

    process.env.NODE_ENV = "production";
    delete process.env.NASHBOARD_ALLOW_AUTO_FIXTURE_FALLBACK;
    expect(canAutoUseFixtureFallback()).toBe(false);

    process.env.NASHBOARD_ALLOW_AUTO_FIXTURE_FALLBACK = "1";
    expect(canAutoUseFixtureFallback()).toBe(true);

    process.env.NODE_ENV = "test";
    delete process.env.NASHBOARD_ALLOW_AUTO_FIXTURE_FALLBACK;
    expect(canAutoUseFixtureFallback()).toBe(true);

    process.env.NODE_ENV = prevNodeEnv;
    if (prevFlag === undefined) {
      delete process.env.NASHBOARD_ALLOW_AUTO_FIXTURE_FALLBACK;
    } else {
      process.env.NASHBOARD_ALLOW_AUTO_FIXTURE_FALLBACK = prevFlag;
    }
  });
});
