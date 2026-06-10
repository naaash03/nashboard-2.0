import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { GET as canonicalPlayerProfile } from "@/app/api/players/profile/route";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getPlayer as getLegacyNflPlayer } from "@/lib/providers/espn/nfl";
import type { Meta, Sport } from "@/lib/providers/types";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { shapePlayerCard } from "@/lib/templates/playerCard";
import type { PlayerProfile, SportKey } from "@/lib/types/players";

type PrimaryProvider = "apiSports" | "espn" | "mlb" | "balldontlie";
type LegacyPlayerCardPayload = {
  playerId: string;
  fullName: string;
  team?: string;
  position?: string;
  jersey?: string;
  headshotUrl?: string;
  teamLogoUrl?: string;
  weightLbs?: number;
  heightIn?: number;
  whyItMatters: string;
  tooltip: string;
  stats?: Record<string, string | number | null>;
  height?: string;
  weight?: string;
  learnMore?: string;
};

function normalizeSport(raw: string | null): SportKey {
  const value = (raw ?? "nfl").trim().toLowerCase();
  if (value === "mlb" || value === "nba" || value === "nfl") return value;
  return "nfl";
}

function sportLabel(sport: SportKey): Sport {
  return sport.toUpperCase() as Sport;
}

function primaryProviderForSport(sport: SportKey): PrimaryProvider {
  if (sport === "mlb") return "mlb";
  if (sport === "nba") return "balldontlie";
  return "espn";
}

function fallbackMeta(warning: string, resolvedDataMode: "auto" | "live" | "fixture"): Meta {
  return {
    sourceUsed: resolvedDataMode === "fixture" ? "fixture" : "espn",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: resolvedDataMode,
    dataModeEffective: resolvedDataMode === "fixture" ? "fixture" : "live",
  };
}

function legacyPlayerCard(profile: PlayerProfile, sport: SportKey, advanced: boolean, requestedPlayerId: string): LegacyPlayerCardPayload {
  const base = {
    playerId: requestedPlayerId,
    fullName: profile.fullName,
    team: profile.teamName,
    position: profile.position,
    jersey: profile.jersey,
    headshotUrl: profile.headshot,
    teamLogoUrl: undefined,
    whyItMatters: profile.whyItMatters
      ?? "Track role, matchup relevance, and recent production before making lineup or watch decisions.",
    tooltip: profile.tooltip ?? "Use this profile as your fast baseline before diving into advanced context.",
  };

  if (!advanced) {
    return base;
  }

  return {
    ...base,
    stats: profile.stats ?? {},
    height: profile.height,
    weight: profile.weight,
    learnMore: profile.learnMore ?? (sport === "nfl" ? `https://www.espn.com/nfl/player/_/id/${profile.playerId}` : undefined),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = normalizeSport(searchParams.get("sport"));
  const playerId = (searchParams.get("playerId") ?? "").trim();
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!playerId) {
    const error = "playerId is required";
    const meta = fallbackMeta(error, resolvedDataMode);
    const contract = toWidgetPayload({ data: null, error, meta, primaryProvider: "espn" });
    return NextResponse.json({ data: null, meta, error, contract }, { status: 400 });
  }

  const canonicalUrl = new URL(req.url);
  canonicalUrl.pathname = "/api/players/profile";
  canonicalUrl.searchParams.set("sport", sport);
  canonicalUrl.searchParams.set("playerId", playerId);

  const response = await canonicalPlayerProfile(new Request(canonicalUrl, {
    headers: req.headers,
    method: "GET",
  }));
  const body = await response.json();
  const meta = body.meta as Meta | undefined;
  const profile = body.data as PlayerProfile | null | undefined;
  const error = typeof body.error?.message === "string"
    ? body.error.message
    : (typeof body.error === "string" ? body.error : null);

  if (!profile || !meta) {
    const fallback = meta ?? fallbackMeta(error ?? "No player data returned from provider.", resolvedDataMode);
    const contract = toWidgetPayload({ data: null, error: error ?? fallback.warning ?? "No player data returned from provider.", meta: fallback, primaryProvider: "espn" });
    return NextResponse.json({
      data: null,
      meta: fallback,
      error: error ?? fallback.warning ?? "No player data returned from provider.",
      contract,
      legacyAdapter: {
        from: "/api/players/profile",
        sport,
      },
    }, { status: response.status });
  }

  let data = legacyPlayerCard(profile, sport, mode === "advanced", playerId);
  let metaForLegacyPayload = meta;
  let legacyPayloadFrom: string | undefined;

  if (sport === "nfl" && profile.playerId !== playerId) {
    const legacy = await getLegacyNflPlayer(playerId, resolvedDataMode, cacheBust);
    if (legacy.player) {
      data = shapePlayerCard(legacy.player, mode);
      metaForLegacyPayload = {
        ...legacy.meta,
        notes: [
          ...(legacy.meta.notes ?? []),
          "Legacy NFL widget payload preserved because the canonical profile fixture did not match the requested playerId.",
        ],
      };
      legacyPayloadFrom = "lib/providers/espn/nfl.getPlayer";
    }
  }

  const contract = toWidgetPayload({
    data: profile,
    error: null,
    meta: metaForLegacyPayload,
    primaryProvider: primaryProviderForSport(sport),
  });

  return NextResponse.json({
    data,
    meta: metaForLegacyPayload,
    error: null,
    contract,
    legacyAdapter: {
      from: "/api/players/profile",
      sport: sportLabel(sport),
      legacyPayloadFrom,
    },
  }, { status: response.status });
}
