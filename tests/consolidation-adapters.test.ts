import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  process.env.NASHBOARD_DATA_MODE = "fixture";
});

describe("legacy route adapters", () => {
  it("/api/search/mlb-players adapts the canonical players search route", async () => {
    const legacy = await import("@/app/api/search/mlb-players/route");
    const canonical = await import("@/app/api/players/search/route");

    const legacyRes = await legacy.GET(new Request("http://localhost/api/search/mlb-players?q=juan%20soto&dataMode=fixture"));
    const canonicalRes = await canonical.GET(new Request("http://localhost/api/players/search?sport=mlb&q=juan%20soto&dataMode=fixture"));
    const legacyBody = await legacyRes.json();
    const canonicalBody = await canonicalRes.json();

    expect(legacyRes.status).toBe(canonicalRes.status);
    expect(legacyBody.legacyAdapter).toEqual({ from: "/api/players/search", sport: "mlb" });
    expect(legacyBody.meta.sourceUsed).toBe("fixture");
    expect(legacyBody.data?.[0]?.playerId).toBe(canonicalBody.data?.[0]?.playerId);
    expect(legacyBody.data?.[0]?.fullName).toBe(canonicalBody.data?.[0]?.fullName);
  });

  it("/api/widgets/player-card adapts the canonical player profile route", async () => {
    const search = await import("@/app/api/players/search/route");
    const card = await import("@/app/api/widgets/player-card/route");
    const profile = await import("@/app/api/players/profile/route");

    const searchRes = await search.GET(new Request("http://localhost/api/players/search?sport=mlb&q=juan%20soto&dataMode=fixture"));
    const searchBody = await searchRes.json();
    const playerId = searchBody.data[0].playerId;

    const cardRes = await card.GET(new Request(`http://localhost/api/widgets/player-card?sport=MLB&playerId=${playerId}&mode=advanced&dataMode=fixture`));
    const profileRes = await profile.GET(new Request(`http://localhost/api/players/profile?sport=mlb&playerId=${playerId}&dataMode=fixture`));
    const cardBody = await cardRes.json();
    const profileBody = await profileRes.json();

    expect(cardRes.status).toBe(profileRes.status);
    expect(cardBody.legacyAdapter).toEqual({ from: "/api/players/profile", sport: "MLB" });
    expect(cardBody.meta.sourceUsed).toBe("fixture");
    expect(cardBody.data.playerId).toBe(profileBody.data.playerId);
    expect(cardBody.data.fullName).toBe(profileBody.data.fullName);
    expect(cardBody.contract.data.playerId).toBe(profileBody.data.playerId);
  });
});
