import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  dashboard: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  widgetInstance: {
    create: vi.fn(),
    count: vi.fn(),
  },
  watchlistTeam: {
    count: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ getViewer: vi.fn(async () => ({ userId: "user-1", userName: "Nash", isGuest: false })) }));

describe("persistence guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/nashboard";
    prismaMock.dashboard.findUnique.mockResolvedValue({ id: "dash-1" });
    prismaMock.widgetInstance.count.mockResolvedValue(0);
  });

  it("dedupe blocks duplicate same-player widget", async () => {
    prismaMock.widgetInstance.create.mockRejectedValue(new Error("Unique constraint failed on the fields: (`dashboardId`,`widgetType`,`playerId`)"));
    const mod = await import("@/app/api/dashboard/widgets/route");

    const res = await mod.POST(new Request("http://localhost/api/dashboard/widgets", {
      method: "POST",
      body: JSON.stringify({ widgetType: "player_card", sport: "NFL", playerId: "42" }),
    }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(String(body.error)).toContain("already on your dashboard");
  });

  it("watchlist blocks 6th team", async () => {
    prismaMock.watchlistTeam.count.mockResolvedValue(5);
    const mod = await import("@/app/api/watchlist/route");

    const res = await mod.POST(new Request("http://localhost/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ sport: "NFL", teamKey: "PHI", teamName: "Philadelphia Eagles" }),
    }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(String(body.error)).toContain("Remove a team");
  });
});


