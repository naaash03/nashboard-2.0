import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

function loadFixture(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  process.env.NASHBOARD_DATA_MODE = "live";
  delete process.env.DATABASE_URL;
});

describe("players insights live derivation path", () => {
  it("returns at least one advanced metric in live mode from mocked upstream payloads", async () => {
    const profileFixture = loadFixture("tests/fixtures/espn/players/nba_profile_sample.json");
    const gamelogFixture = loadFixture("tests/fixtures/espn/gamelog/nba_athlete_gamelog_1966.json");
    const scoreboardFixture = loadFixture("tests/fixtures/espn/scoreboard/nba_scoreboard_sample.json");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/athletes/1966/gamelog")) {
        return jsonResponse(gamelogFixture);
      }
      if (url.includes("sports.core.api.espn.com") && url.includes("/athletes/1966")) {
        return jsonResponse(profileFixture);
      }
      if (url.includes("site.web.api.espn.com") && url.includes("/sports/basketball/nba/athletes/1966")) {
        return jsonResponse(profileFixture);
      }
      if (url.includes("/sports/basketball/nba/scoreboard")) {
        return jsonResponse(scoreboardFixture);
      }
      if (url.includes("/sports/basketball/nba/athletes/1966")) {
        return jsonResponse(profileFixture);
      }
      return jsonResponse({ message: "not found" }, 404);
    });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const mod = await import("@/app/api/players/insights/route");
    const res = await mod.GET(new Request("http://localhost/api/players/insights?sport=nba&playerId=1966&mode=advanced&dataMode=live&cacheBust=live-test"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.dataMode).toBe("live");
    expect(body.meta.sourceUsed).toBe("espn");
    expect(body.data).toEqual(expect.objectContaining({
      playerId: "1966",
      sport: "nba",
    }));
    expect((body.data.season?.metrics?.length ?? 0) > 0 || (body.data.recent?.games?.length ?? 0) > 0).toBe(true);
  });
});
