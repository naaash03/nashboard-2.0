import { randomUUID } from "node:crypto";
import { getApiSportsConfig } from "@/lib/providers/apiSports/config";
import { fetchApiSportsJson } from "@/lib/providers/apiSports/client";
import { getPlayerProfile } from "@/lib/providers/apiSports/playerDirectory";
import type { Meta } from "@/lib/providers/types";
import type { Envelope, SportKey } from "@/lib/types/players";
import type { PlayerInsights } from "@/lib/types/playerInsights";

type ModeArg = "live" | "fixture";
type InsightsMode = "beginner" | "advanced";
type CacheBustArg = string | number | null | undefined;

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function fallbackMeta(mode: ModeArg, warning: string): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : "apiSports",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: mode,
    dataModeEffective: mode,
  };
}

function collectStats(payload: unknown): Record<string, number> {
  const totals: Record<string, number> = {};
  const typed = asObject(payload);
  if (!typed) {
    return totals;
  }
  const response = Array.isArray(typed.response) ? typed.response : [];
  for (const row of response) {
    const typedRow = asObject(row);
    const statistics = Array.isArray(typedRow?.statistics) ? typedRow.statistics : [];
    for (const item of statistics) {
      const typedItem = asObject(item);
      for (const [blockName, blockValue] of Object.entries(typedItem ?? {})) {
        const block = asObject(blockValue);
        if (!block) {
          continue;
        }
        for (const [key, value] of Object.entries(block)) {
          const numeric = readNumber(value);
          if (typeof numeric === "number") {
            totals[`${blockName}.${key}`.toLowerCase()] = numeric;
            totals[key.toLowerCase()] = numeric;
          }
        }
      }
    }
  }
  return totals;
}

function pick(stats: Record<string, number>, keys: string[]): number {
  for (const key of keys) {
    const normalized = key.toLowerCase();
    if (typeof stats[normalized] === "number") {
      return stats[normalized];
    }
  }
  return 0;
}

function fixed(value: number, digits: number): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "0";
}

function avg(value: number): string {
  const fixedValue = fixed(value, 3);
  return fixedValue.startsWith("0") ? fixedValue.slice(1) : fixedValue;
}

function buildNbaSeason(stats: Record<string, number>): PlayerInsights["season"] {
  const gp = Math.max(1, pick(stats, ["games.appearences", "games.played", "games", "appearences"]));
  const pts = pick(stats, ["points.points", "points.total", "points"]);
  const reb = pick(stats, ["rebounds.total", "rebounds"]);
  const ast = pick(stats, ["assists.total", "assists"]);
  if (pts <= 0 && reb <= 0 && ast <= 0) {
    return null;
  }

  const ppg = pts / gp;
  const rpg = reb / gp;
  const apg = ast / gp;
  const metrics: Array<{ key: string; label: string; value: string }> = [
    { key: "ppg", label: "PPG", value: fixed(ppg, 1) },
    { key: "rpg", label: "RPG", value: fixed(rpg, 1) },
    { key: "apg", label: "APG", value: fixed(apg, 1) },
  ];

  const fga = pick(stats, ["shots.total", "fga"]);
  const fta = pick(stats, ["free_throws.attempts", "fta"]);
  const tsDen = 2 * (fga + 0.44 * fta);
  if (tsDen > 0) {
    metrics.push({ key: "ts", label: "TS%", value: fixed(pts / tsDen, 3) });
  }

  return {
    headline: metrics.map((metric) => `${metric.label} ${metric.value}`).join(" · "),
    metrics,
    source: "derived",
  };
}

function buildMlbSeason(stats: Record<string, number>, position?: string): PlayerInsights["season"] {
  const pos = (position ?? "").toUpperCase();
  const pitcher = pos === "P" || pos === "SP" || pos === "RP" || pos === "CP";
  if (pitcher) {
    const ip = pick(stats, ["pitching.innings_pitched", "innings_pitched", "ip"]);
    const er = pick(stats, ["pitching.earned_runs", "earned_runs", "er"]);
    const hits = pick(stats, ["pitching.hits", "hits"]);
    const bb = pick(stats, ["pitching.base_on_balls", "walks", "bb"]);
    const so = pick(stats, ["pitching.strike_outs", "strike_outs", "so", "k"]);
    if (ip <= 0) {
      return null;
    }
    const era = (er * 9) / ip;
    const whip = (bb + hits) / ip;
    const k9 = (so * 9) / ip;
    return {
      headline: `ERA ${fixed(era, 2)} · WHIP ${fixed(whip, 2)} · K/9 ${fixed(k9, 1)}`,
      metrics: [
        { key: "era", label: "ERA", value: fixed(era, 2) },
        { key: "whip", label: "WHIP", value: fixed(whip, 2) },
        { key: "k9", label: "K/9", value: fixed(k9, 1) },
      ],
      source: "derived",
    };
  }

  const ab = pick(stats, ["batting.at_bats", "at_bats", "ab"]);
  const hits = pick(stats, ["batting.hits", "hits", "h"]);
  const bb = pick(stats, ["batting.base_on_balls", "walks", "bb"]);
  const hbp = pick(stats, ["batting.hit_by_pitch", "hbp"]);
  const sf = pick(stats, ["batting.sac_flies", "sf"]);
  const hr = pick(stats, ["batting.home_runs", "home_runs", "hr"]);
  const rbi = pick(stats, ["batting.runs_batted_in", "runs_batted_in", "rbi"]);
  const tb = pick(stats, ["batting.total_bases", "total_bases", "tb"]);
  if (ab <= 0 && hr <= 0 && rbi <= 0) {
    return null;
  }
  if (ab <= 0) {
    return {
      headline: `HR ${Math.round(hr)} · RBI ${Math.round(rbi)}`,
      metrics: [
        { key: "hr", label: "HR", value: String(Math.round(hr)) },
        { key: "rbi", label: "RBI", value: String(Math.round(rbi)) },
      ],
      source: "derived",
    };
  }

  const avgValue = hits / ab;
  const obpDen = ab + bb + hbp + sf;
  const obp = obpDen > 0 ? (hits + bb + hbp) / obpDen : 0;
  const slg = tb > 0 ? tb / ab : 0;
  const ops = obp + slg;
  return {
    headline: `AVG ${avg(avgValue)} · OBP ${avg(obp)} · SLG ${avg(slg)} · OPS ${avg(ops)} · HR ${Math.round(hr)} · RBI ${Math.round(rbi)}`,
    metrics: [
      { key: "avg", label: "AVG", value: avg(avgValue) },
      { key: "obp", label: "OBP", value: avg(obp) },
      { key: "slg", label: "SLG", value: avg(slg) },
      { key: "ops", label: "OPS", value: avg(ops) },
      { key: "hr", label: "HR", value: String(Math.round(hr)) },
      { key: "rbi", label: "RBI", value: String(Math.round(rbi)) },
    ],
    source: "derived",
  };
}

function buildNflSeason(stats: Record<string, number>, position?: string): PlayerInsights["season"] {
  const pos = (position ?? "").toUpperCase();
  const passYds = pick(stats, ["passing.yards", "yards", "pass_yards"]);
  const passTd = pick(stats, ["passing.touchdowns", "touchdowns", "pass_touchdowns"]);
  const passInt = pick(stats, ["passing.interceptions", "interceptions"]);
  const rushYds = pick(stats, ["rushing.yards", "rush_yards"]);
  const rushTd = pick(stats, ["rushing.touchdowns", "rush_touchdowns"]);
  const recYds = pick(stats, ["receiving.yards", "rec_yards"]);
  const recTd = pick(stats, ["receiving.touchdowns", "rec_touchdowns"]);

  if (pos === "QB" || passYds > 0) {
    if (passYds <= 0 && passTd <= 0 && passInt <= 0) {
      return null;
    }
    return {
      headline: `Pass YDS ${Math.round(passYds)} · TD ${Math.round(passTd)} · INT ${Math.round(passInt)}`,
      metrics: [
        { key: "pass_yds", label: "Pass YDS", value: String(Math.round(passYds)) },
        { key: "pass_td", label: "Pass TD", value: String(Math.round(passTd)) },
        { key: "int", label: "INT", value: String(Math.round(passInt)) },
      ],
      source: "derived",
    };
  }

  if (rushYds > 0 || rushTd > 0) {
    return {
      headline: `Rush YDS ${Math.round(rushYds)} · Rush TD ${Math.round(rushTd)}`,
      metrics: [
        { key: "rush_yds", label: "Rush YDS", value: String(Math.round(rushYds)) },
        { key: "rush_td", label: "Rush TD", value: String(Math.round(rushTd)) },
      ],
      source: "derived",
    };
  }

  if (recYds > 0 || recTd > 0) {
    return {
      headline: `Rec YDS ${Math.round(recYds)} · Rec TD ${Math.round(recTd)}`,
      metrics: [
        { key: "rec_yds", label: "Rec YDS", value: String(Math.round(recYds)) },
        { key: "rec_td", label: "Rec TD", value: String(Math.round(recTd)) },
      ],
      source: "derived",
    };
  }
  return null;
}

function buildSeason(sport: SportKey, stats: Record<string, number>, position?: string): PlayerInsights["season"] {
  if (sport === "nba") {
    return buildNbaSeason(stats);
  }
  if (sport === "mlb") {
    return buildMlbSeason(stats, position);
  }
  return buildNflSeason(stats, position);
}

export async function getPlayerInsights(
  sport: SportKey,
  playerIdInput: string,
  mode: InsightsMode,
  dataMode: ModeArg = "live",
  cacheBust?: CacheBustArg,
): Promise<Envelope<PlayerInsights>> {
  const playerId = playerIdInput.trim();
  if (!playerId) {
    return {
      data: null,
      meta: fallbackMeta(dataMode, "playerId is required"),
      error: {
        message: "playerId is required",
        code: "MISSING_PLAYER_ID",
      },
    };
  }

  const profileEnvelope = await getPlayerProfile(sport, playerId, dataMode, cacheBust);
  const profile = profileEnvelope.data;

  const config = getApiSportsConfig(sport);
  try {
    const statsResponse = await fetchApiSportsJson<unknown>({
      sport,
      endpoint: "players/statistics",
      params: {
        id: playerId,
        player: playerId,
        league: config.league,
        season: config.season,
      },
      dataMode,
      ttlSeconds: 240,
      cacheBust,
      fixtureFile: "player_insights_sample.json",
    });

    const stats = collectStats(statsResponse.data);
    const season = mode === "advanced" ? buildSeason(sport, stats, profile?.position) : null;
    const notes: string[] = [];
    if (!season && mode === "advanced") {
      notes.push("API-Sports season insights were incomplete for this player.");
    }

    return {
      data: {
        sport,
        playerId,
        fullName: profile?.fullName,
        teamAbbrev: profile?.teamAbbrev,
        teamName: profile?.teamName,
        injury: profile?.injury ?? null,
        live: null,
        season,
        recent: null,
        metaNotes: notes.length > 0 ? notes : undefined,
      },
      meta: {
        ...statsResponse.meta,
        warning: notes.length > 0 ? notes.join(" ") : statsResponse.meta.warning,
      },
    };
  } catch (error) {
    const warning = `API-Sports player insights unavailable: ${String(error)}`;
    return {
      data: {
        sport,
        playerId,
        fullName: profile?.fullName,
        teamAbbrev: profile?.teamAbbrev,
        teamName: profile?.teamName,
        injury: profile?.injury ?? null,
        live: null,
        season: null,
        recent: null,
        metaNotes: [warning],
      },
      meta: fallbackMeta(dataMode, warning),
    };
  }
}
