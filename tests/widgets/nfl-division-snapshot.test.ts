import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildFinalSchedule(teamKey: string, wins: number, losses: number) {
  const events = [];
  for (let index = 0; index < wins + losses; index += 1) {
    const didWin = index < wins;
    const week = index + 1;
    events.push({
      id: `${teamKey}-g-${week}`,
      date: `2025-01-${String((week % 28) + 1).padStart(2, "0")}T20:20:00.000Z`,
      week: { number: week },
      seasonType: { type: 2 },
      competitions: [{
        date: `2025-01-${String((week % 28) + 1).padStart(2, "0")}T20:20:00.000Z`,
        status: { type: { state: "post", detail: "Final" } },
        competitors: [
          { id: teamKey, homeAway: "home", team: { id: teamKey, abbreviation: teamKey, displayName: `${teamKey} Team`, logos: [{ href: `${teamKey}.png` }] }, score: { value: didWin ? 24 : 17 } },
          { id: `OPP-${week}`, homeAway: "away", team: { id: `OPP-${week}`, abbreviation: `O${week}`, displayName: `Opponent ${week}`, logos: [{ href: `opp-${week}.png` }] }, score: { value: didWin ? 17 : 24 } },
        ],
      }],
    });
  }
  return events;
}

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

afterEach(() => {
  vi.doUnmock("@/lib/providers/espn/nfl");
});

describe("NFL division snapshot route", () => {
  it("returns a demo-backed division snapshot in fixture mode", async () => {
    const mod = await import("@/app/api/widgets/nfl-division-snapshot/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-division-snapshot?mode=beginner&dataMode=fixture"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("demo");
    expect(body.data?.source).toBe("demo");
    expect(body.data?.isOffseason).toBe(true);
    expect(body.data?.divisions.length).toBeGreaterThan(0);
  });

  it("returns live division rows when team profiles are available", async () => {
    process.env.NASHBOARD_DATA_MODE = "auto";
    const meta = {
      sourceUsed: "espn" as const,
      updatedAt: "2026-04-14T12:00:00.000Z",
      requestId: "nfl-division-live",
      dataMode: "live" as const,
      dataModeEffective: "live" as const,
    };
    const profiles: Record<string, unknown> = {
      PHI: {
        season: { year: 2025, type: 4 },
        team: {
          id: "21",
          abbreviation: "PHI",
          displayName: "Philadelphia Eagles",
          recordSummary: "0-0",
          standingSummary: "1st in NFC East",
          record: { items: [{ type: "total", summary: "0-0", stats: [] }] },
        },
      },
      WSH: {
        season: { year: 2025, type: 4 },
        team: {
          id: "28",
          abbreviation: "WSH",
          displayName: "Washington Commanders",
          recordSummary: "0-0",
          standingSummary: "2nd in NFC East",
          record: { items: [{ type: "total", summary: "0-0", stats: [] }] },
        },
      },
      DAL: {
        season: { year: 2025, type: 4 },
        team: {
          id: "6",
          abbreviation: "DAL",
          displayName: "Dallas Cowboys",
          recordSummary: "0-0",
          standingSummary: "3rd in NFC East",
          record: { items: [{ type: "total", summary: "0-0", stats: [] }] },
        },
      },
      NYG: {
        season: { year: 2025, type: 4 },
        team: {
          id: "19",
          abbreviation: "NYG",
          displayName: "New York Giants",
          recordSummary: "0-0",
          standingSummary: "4th in NFC East",
          record: { items: [{ type: "total", summary: "0-0", stats: [] }] },
        },
      },
    };

    vi.doMock("@/lib/providers/espn/nfl", async () => {
      const actual = await vi.importActual<typeof import("@/lib/providers/espn/nfl")>("@/lib/providers/espn/nfl");
      return {
        ...actual,
        getNflTeamProfile: async (teamKey: string) => ({ data: profiles[teamKey.toUpperCase()] as never, meta }),
        getNflTeamSchedule: async (teamKey: string, _dataMode: string, _cacheBust: string | undefined, season?: number) => ({
          data: {
            season: { year: 2025, type: 4 },
            requestedSeason: { year: season },
            team: {
              id: teamKey.toUpperCase(),
              abbreviation: teamKey.toUpperCase(),
              displayName: `${teamKey.toUpperCase()} Team`,
            },
            events: teamKey.toUpperCase() === "PHI"
              ? buildFinalSchedule("PHI", 14, 3)
              : teamKey.toUpperCase() === "WSH"
                ? buildFinalSchedule("WSH", 12, 5)
                : teamKey.toUpperCase() === "DAL"
                  ? buildFinalSchedule("DAL", 7, 10)
                  : buildFinalSchedule("NYG", 3, 14),
          },
          meta,
        }),
      };
    });

    const mod = await import("@/app/api/widgets/nfl-division-snapshot/route");
    const res = await mod.GET(new Request("http://localhost/api/widgets/nfl-division-snapshot?mode=advanced&dataMode=live&conference=NFC&division=East"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta?.sourceUsed).toBe("espn");
    expect(body.data?.source).toBe("live");
    expect(body.data?.divisions).toHaveLength(1);
    expect(body.data?.seasonLabel).toBe("2024 Final Standings");
    expect(body.data?.divisions[0]?.teams[0]?.wins).toBe(14);
    expect(body.data?.divisions[0]?.teams[0]?.teamKey).toBe("PHI");
    expect(body.data?.divisions[0]?.teams[0]?.divisionLeader).toBe(true);
  });
});
