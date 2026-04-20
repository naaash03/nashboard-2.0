import { randomUUID } from "node:crypto";
import { fetchMlbGameOdds, type MlbGameOdds } from "@/lib/providers/odds/client";
import { fetchGameDayWeather, type GameDayWeather } from "@/lib/providers/weather/client";
import type { PredictionPayload } from "@/lib/types/prediction";
import {
  resolveMlbStartingPitcherMatchup,
  type PitcherMatchupCard,
  type PitcherLastStart,
} from "@/lib/sports/resolvers/mlbStartingPitcherMatchup";

export type ProjectionMode = "BEGINNER" | "ADVANCED";

export type MlbPitcherProjectionArgs = {
  gameId?: string;
  pitcherTeamKey: string;
  mode: ProjectionMode;
  dataMode?: "auto" | "live" | "fixture";
};

export type MlbPitcherProjectionMeta = {
  sourceUsed: string;
  generatedAt: string;
  isFallback: boolean;
  fallbackReason?: string;
  requestId: string;
  pitcherName?: string;
  venue?: string;
  warning?: string;
};

export type MlbPitcherProjectionResult = {
  ok: boolean;
  data: PredictionPayload | null;
  meta: MlbPitcherProjectionMeta;
  error: { message: string; code: string } | null;
};

export type ProjectionDeps = {
  fetchOdds: (homeTeam: string, awayTeam: string) => Promise<MlbGameOdds>;
  fetchWeather: (venue: string, city: string) => Promise<GameDayWeather>;
};

// Assumed innings pitched for a typical starting-pitcher projection
const ASSUMED_IP = 5.5;

const VENUE_CITY_MAP: Record<string, string> = {
  "fenway park": "Boston,MA,US",
  "yankee stadium": "New York,NY,US",
  "citi field": "New York,NY,US",
  "camden yards": "Baltimore,MD,US",
  "oriole park": "Baltimore,MD,US",
  "great american ball park": "Cincinnati,OH,US",
  "pnc park": "Pittsburgh,PA,US",
  "wrigley field": "Chicago,IL,US",
  "guaranteed rate field": "Chicago,IL,US",
  "busch stadium": "St. Louis,MO,US",
  "petco park": "San Diego,CA,US",
  "dodger stadium": "Los Angeles,CA,US",
  "angel stadium": "Anaheim,CA,US",
  "oracle park": "San Francisco,CA,US",
  "target field": "Minneapolis,MN,US",
  "progressive field": "Cleveland,OH,US",
  "comerica park": "Detroit,MI,US",
  "kauffman stadium": "Kansas City,MO,US",
  "truist park": "Atlanta,GA,US",
  "nationals park": "Washington,DC,US",
  "citizens bank park": "Philadelphia,PA,US",
  "coors field": "Denver,CO,US",
  "minute maid park": "Houston,TX,US",
  "globe life field": "Arlington,TX,US",
  "tropicana field": "St. Petersburg,FL,US",
  "loandepot park": "Miami,FL,US",
  "marlins park": "Miami,FL,US",
  "rogers centre": "Toronto,ON,CA",
  "t-mobile park": "Seattle,WA,US",
  "chase field": "Phoenix,AZ,US",
  "american family field": "Milwaukee,WI,US",
  "oakland coliseum": "Oakland,CA,US",
};

function venueToCity(venue: string | undefined): string | null {
  if (!venue) return null;
  const normalized = venue.toLowerCase().trim();
  for (const [key, city] of Object.entries(VENUE_CITY_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return city;
    }
  }
  return null;
}

function parseInnings(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const whole = Math.trunc(value);
    const outs = Math.round((value - whole) * 10);
    return whole + Math.min(2, Math.max(0, outs)) / 3;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const dotIdx = trimmed.indexOf(".");
    if (dotIdx === -1) {
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    const whole = Number(trimmed.slice(0, dotIdx));
    const outs = Number(trimmed.charAt(dotIdx + 1));
    if (!Number.isFinite(whole) || !Number.isFinite(outs)) return null;
    return whole + Math.min(2, Math.max(0, outs)) / 3;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function computeRecentKPer9(starts: PitcherLastStart[] | undefined): number | null {
  if (!starts || starts.length === 0) return null;
  let totalK = 0;
  let totalIP = 0;
  for (const start of starts) {
    const k = toNumber(start.strikeouts);
    const ip = parseInnings(start.innings);
    if (k === null || ip === null || ip <= 0) continue;
    totalK += k;
    totalIP += ip;
  }
  if (totalIP <= 0) return null;
  return (totalK / totalIP) * 9;
}

function confidenceLabel(fallbackCount: number): PredictionPayload["confidenceLabel"] {
  if (fallbackCount === 0) return "high";
  if (fallbackCount === 1) return "medium";
  return "low";
}

function halfRange(confidence: PredictionPayload["confidenceLabel"]): number {
  if (confidence === "high") return 0.75;
  if (confidence === "medium") return 1.0;
  return 1.5;
}

function buildExplanation(args: {
  pitcherName: string;
  seasonKPer9: number | null;
  recentKPer9: number | null;
  weatherImpact: GameDayWeather["weatherImpact"];
  overUnder: number | null;
  pointEstimate: number;
}): string {
  const lead = `Projected ${args.pointEstimate.toFixed(1)} strikeouts`;
  const clauses: string[] = [];

  if (args.seasonKPer9 !== null) {
    const base = args.recentKPer9 !== null
      ? `season K/9 of ${args.seasonKPer9.toFixed(1)} blended with recent form (${args.recentKPer9.toFixed(1)})`
      : `season K/9 of ${args.seasonKPer9.toFixed(1)}`;
    clauses.push(`based on ${args.pitcherName}'s ${base}`);
  }

  if (args.weatherImpact === "moderate" || args.weatherImpact === "high") {
    clauses.push(`${args.weatherImpact} weather impact reduces the total`);
  }

  if (args.overUnder !== null && args.overUnder > 9) {
    clauses.push(`O/U of ${args.overUnder} suggests an elevated run environment`);
  }

  return clauses.length > 0
    ? `${lead}: ${clauses.join("; ")}.`
    : `${lead} for ${args.pitcherName}.`;
}

const UNAVAILABLE_WEATHER: GameDayWeather = {
  tempF: null,
  condition: null,
  windMph: null,
  isOutdoor: false,
  weatherImpact: "none",
  source: "unavailable",
  isFallback: true,
  fallbackReason: "Venue city not mapped for weather lookup",
};

function defaultDeps(): ProjectionDeps {
  return {
    fetchOdds: fetchMlbGameOdds,
    fetchWeather: fetchGameDayWeather,
  };
}

export async function resolveMlbPitcherProjection(
  args: MlbPitcherProjectionArgs,
  depsInput?: Partial<ProjectionDeps>,
): Promise<MlbPitcherProjectionResult> {
  const deps = { ...defaultDeps(), ...depsInput };
  const requestId = randomUUID();
  const generatedAt = new Date().toISOString();
  const teamKey = args.pitcherTeamKey.trim().toUpperCase();

  if (!teamKey) {
    return {
      ok: false,
      data: null,
      meta: {
        sourceUsed: "mlb",
        generatedAt,
        isFallback: true,
        fallbackReason: "pitcherTeamKey is required",
        requestId,
        warning: "pitcherTeamKey is required",
      },
      error: { message: "pitcherTeamKey is required", code: "MISSING_TEAM_KEY" },
    };
  }

  // Always call the matchup resolver in "advanced" mode to get full pitcher stats
  const matchupResult = await resolveMlbStartingPitcherMatchup({
    teamKey,
    gameId: args.gameId,
    mode: "advanced",
    dataMode: args.dataMode ?? "auto",
  });

  if (!matchupResult.ok || !matchupResult.data) {
    return {
      ok: false,
      data: null,
      meta: {
        sourceUsed: matchupResult.meta.sourceUsed,
        generatedAt,
        isFallback: true,
        fallbackReason: matchupResult.error?.message ?? "Matchup resolver failed",
        requestId,
      },
      error: matchupResult.error ?? { message: "Matchup resolver failed", code: "MATCHUP_FAILED" },
    };
  }

  const matchupData = matchupResult.data;
  const venue = matchupData.game.venue;
  const isHome = matchupData.game.homeTeam.key === teamKey;
  const pitcher: PitcherMatchupCard | null = isHome
    ? matchupData.pitchers.home
    : matchupData.pitchers.away;

  if (!pitcher?.fullName) {
    return {
      ok: false,
      data: null,
      meta: {
        sourceUsed: matchupResult.meta.sourceUsed,
        generatedAt,
        isFallback: true,
        fallbackReason: "Pitcher not found for the selected team in this game",
        requestId,
        venue,
      },
      error: { message: "Pitcher not found for the selected team", code: "PITCHER_NOT_FOUND" },
    };
  }

  const homeTeamName = matchupData.game.homeTeam.name;
  const awayTeamName = matchupData.game.awayTeam.name;
  const city = venueToCity(venue);

  const [odds, weather] = await Promise.all([
    deps.fetchOdds(homeTeamName, awayTeamName),
    city && venue
      ? deps.fetchWeather(venue, city)
      : Promise.resolve(UNAVAILABLE_WEATHER),
  ]);

  const seasonKPer9 = toNumber(pitcher.kPer9);
  const recentKPer9 = computeRecentKPer9(pitcher.last3Starts);

  const blendedKPer9 = seasonKPer9 !== null && recentKPer9 !== null
    ? 0.65 * seasonKPer9 + 0.35 * recentKPer9
    : (seasonKPer9 ?? recentKPer9);

  if (blendedKPer9 === null) {
    const payload: PredictionPayload = {
      pointEstimate: 0,
      rangeLow: 0,
      rangeHigh: 0,
      confidenceLabel: "low",
      explanation: `Insufficient strikeout rate data available for ${pitcher.fullName}.`,
      keyFactors: ["No K/9 data available"],
      inputs: { pitcherName: pitcher.fullName, seasonKPer9: null, recentKPer9: null },
      sources: [matchupResult.meta.sourceUsed],
      generatedAt,
      isFallback: true,
      fallbackReason: "No K/9 data available for projection",
    };
    return {
      ok: true,
      data: payload,
      meta: {
        sourceUsed: matchupResult.meta.sourceUsed,
        generatedAt,
        isFallback: true,
        fallbackReason: "No K/9 data available for projection",
        requestId,
        pitcherName: pitcher.fullName,
        venue,
      },
      error: null,
    };
  }

  const baseK = (blendedKPer9 / 9) * ASSUMED_IP;

  const weatherAdj: number = weather.weatherImpact === "high"
    ? -0.5
    : weather.weatherImpact === "moderate"
      ? -0.25
      : 0;

  const ouAdj: number = odds.overUnder !== null && odds.overUnder > 9 ? -0.3 : 0;

  const rawEstimate = baseK + weatherAdj + ouAdj;
  const pointEstimate = Math.max(0, Math.round(rawEstimate * 10) / 10);

  // Confidence based on which of the three sources are live
  const fallbackCount = [odds.isFallback, weather.isFallback].filter(Boolean).length;
  const confidence = confidenceLabel(fallbackCount);
  const band = halfRange(confidence);

  const rangeLow = Math.max(0, Math.round((pointEstimate - band) * 10) / 10);
  const rangeHigh = Math.round((pointEstimate + band) * 10) / 10;

  const sources: string[] = [matchupResult.meta.sourceUsed];
  if (!odds.isFallback) sources.push("odds_api");
  if (!weather.isFallback) sources.push("openweather");

  const keyFactors: string[] = [];
  if (seasonKPer9 !== null) keyFactors.push(`Season K/9: ${seasonKPer9.toFixed(1)}`);
  if (recentKPer9 !== null) keyFactors.push(`Recent form K/9 (3-start): ${recentKPer9.toFixed(1)}`);
  if (weatherAdj !== 0) {
    keyFactors.push(`Weather (${weather.weatherImpact}): ${weatherAdj > 0 ? "+" : ""}${weatherAdj}K`);
  } else {
    keyFactors.push(`Weather: minimal impact`);
  }
  if (odds.overUnder !== null) {
    keyFactors.push(ouAdj !== 0
      ? `O/U ${odds.overUnder} (high run environment): ${ouAdj}K`
      : `O/U line: ${odds.overUnder}`);
  }
  keyFactors.push(`Projected innings: ${ASSUMED_IP}`);

  const explanation = buildExplanation({
    pitcherName: pitcher.fullName,
    seasonKPer9,
    recentKPer9,
    weatherImpact: weather.weatherImpact,
    overUnder: odds.overUnder,
    pointEstimate,
  });

  const inputs: Record<string, unknown> = {
    pitcherName: pitcher.fullName,
    seasonKPer9,
    recentKPer9,
    blendedKPer9: Math.round(blendedKPer9 * 100) / 100,
    assumedInnings: ASSUMED_IP,
    baseProjectedK: Math.round(baseK * 10) / 10,
    weatherImpact: weather.weatherImpact,
    weatherAdj,
    tempF: weather.tempF,
    windMph: weather.windMph,
    overUnder: odds.overUnder,
    ouAdj,
  };

  const isFallback = odds.isFallback && weather.isFallback;
  const fallbackParts = [
    odds.isFallback ? (odds.fallbackReason ?? "Odds unavailable") : null,
    weather.isFallback ? (weather.fallbackReason ?? "Weather unavailable") : null,
  ].filter(Boolean);
  const fallbackReason = fallbackParts.length > 0 ? fallbackParts.join(" ") : undefined;

  const payload: PredictionPayload = {
    pointEstimate,
    rangeLow,
    rangeHigh,
    confidenceLabel: confidence,
    explanation,
    keyFactors,
    inputs,
    sources,
    generatedAt,
    isFallback,
    fallbackReason,
  };

  return {
    ok: true,
    data: payload,
    meta: {
      sourceUsed: sources.join("+"),
      generatedAt,
      isFallback,
      fallbackReason,
      requestId,
      pitcherName: pitcher.fullName,
      venue,
    },
    error: null,
  };
}
