import { randomUUID } from "node:crypto";
import { fetchEspnJson, getDataMode } from "@/lib/providers/espn/client";
import { getPlayerProfile } from "@/lib/providers/espn/playerDirectory";
import { getTeamStatus } from "@/lib/providers/espn/teamStatus";
import type { Meta } from "@/lib/providers/types";
import type { Envelope } from "@/lib/types/players";
import type { PlayerInsights, SportKey } from "@/lib/types/playerInsights";

type ModeArg = "live" | "fixture";
type InsightsMode = "beginner" | "advanced";

type GamelogConfig = {
  endpoint: string;
  fixtureFile: string;
};

type ParsedGame = {
  date?: string;
  opponent?: string;
  result?: string;
  line: string;
  stats: Record<string, number>;
};

const GAMELOG_CONFIG: Record<SportKey, GamelogConfig> = {
  nfl: {
    endpoint: "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{playerId}/gamelog",
    fixtureFile: "nfl_athlete_gamelog_sample.json",
  },
  mlb: {
    endpoint: "https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/{playerId}/gamelog",
    fixtureFile: "mlb_athlete_gamelog_32827.json",
  },
  nba: {
    endpoint: "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{playerId}/gamelog",
    fixtureFile: "nba_athlete_gamelog_1966.json",
  },
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

function findObjectValue(source: Record<string, unknown>, candidates: string[]): number | undefined {
  for (const candidate of candidates) {
    if (candidate in source) {
      const value = readNumber(source[candidate]);
      if (typeof value === "number") {
        return value;
      }
    }
  }

  const lowerMap = new Map(Object.entries(source).map(([key, value]) => [key.toLowerCase(), value]));
  for (const candidate of candidates) {
    const value = readNumber(lowerMap.get(candidate.toLowerCase()));
    if (typeof value === "number") {
      return value;
    }
  }

  return undefined;
}

function toFixed(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}

function toAvgStyle(value: number): string {
  const fixed = value.toFixed(3);
  return fixed.startsWith("0") ? fixed.slice(1) : fixed;
}

function ipToOuts(ip: number): number {
  if (!Number.isFinite(ip)) {
    return 0;
  }
  const whole = Math.trunc(ip);
  const fractionDigit = Math.round((ip - whole) * 10);
  if (fractionDigit === 0 || fractionDigit === 1 || fractionDigit === 2) {
    return whole * 3 + fractionDigit;
  }
  return Math.round(ip * 3);
}

function outsToIp(outs: number): string {
  const whole = Math.floor(outs / 3);
  const remainder = outs % 3;
  return `${whole}.${remainder}`;
}

function parseStatsFromRow(row: Record<string, unknown>, sport: SportKey): Record<string, number> {
  const statsObj = asObject(row.stats) ?? asObject(row.statistics) ?? asObject(row.statLine) ?? {};

  const find = (candidates: string[]): number | undefined =>
    findObjectValue(row, candidates) ?? findObjectValue(statsObj, candidates);

  if (sport === "nba") {
    return {
      points: find(["pts", "points"]),
      rebounds: find(["reb", "rebounds"]),
      assists: find(["ast", "assists"]),
    } as Record<string, number>;
  }

  if (sport === "nfl") {
    return {
      passComp: find(["passComp", "cmp", "completions"]),
      passAtt: find(["passAtt", "att", "attempts"]),
      passYds: find(["passYds", "passYards", "passingYards"]),
      passTd: find(["passTd", "passingTouchdowns", "passTD"]),
      int: find(["int", "ints", "interceptions"]),
      rushAtt: find(["rushAtt", "rushAttempts"]),
      rushYds: find(["rushYds", "rushYards", "rushingYards"]),
      rushTd: find(["rushTd", "rushTD", "rushingTouchdowns"]),
      rec: find(["rec", "receptions"]),
      recYds: find(["recYds", "recYards", "receivingYards"]),
      recTd: find(["recTd", "receivingTouchdowns"]),
    } as Record<string, number>;
  }

  return {
    ip: find(["ip", "inningsPitched"]),
    er: find(["er", "earnedRuns"]),
    h: find(["h", "hits"]),
    bb: find(["bb", "walks", "baseOnBalls"]),
    k: find(["k", "strikeouts"]),
    ab: find(["ab", "atBats"]),
    hits: find(["hits", "h"]),
    hr: find(["hr", "homeRuns"]),
    rbi: find(["rbi", "runsBattedIn"]),
    doubles: find(["doubles", "2b"]),
    triples: find(["triples", "3b"]),
  } as Record<string, number>;
}

function compactStatLine(sport: SportKey, stats: Record<string, number>): string {
  if (sport === "nba") {
    const pts = typeof stats.points === "number" ? Math.round(stats.points) : undefined;
    const reb = typeof stats.rebounds === "number" ? Math.round(stats.rebounds) : undefined;
    const ast = typeof stats.assists === "number" ? Math.round(stats.assists) : undefined;
    const parts = [
      typeof pts === "number" ? `${pts} PTS` : undefined,
      typeof reb === "number" ? `${reb} REB` : undefined,
      typeof ast === "number" ? `${ast} AST` : undefined,
    ].filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(" · ") : "Stat line unavailable";
  }

  if (sport === "nfl") {
    if (typeof stats.passAtt === "number" || typeof stats.passYds === "number") {
      const compAtt = typeof stats.passComp === "number" && typeof stats.passAtt === "number"
        ? `${Math.round(stats.passComp)}/${Math.round(stats.passAtt)}`
        : undefined;
      const yards = typeof stats.passYds === "number" ? `${Math.round(stats.passYds)}y` : undefined;
      const td = typeof stats.passTd === "number" ? `${Math.round(stats.passTd)}TD` : undefined;
      const int = typeof stats.int === "number" ? `${Math.round(stats.int)}INT` : undefined;
      return ["Pass", compAtt, yards, td, int].filter(Boolean).join(" ");
    }

    if (typeof stats.rushAtt === "number" || typeof stats.rushYds === "number") {
      const attempts = typeof stats.rushAtt === "number" ? Math.round(stats.rushAtt) : undefined;
      const yards = typeof stats.rushYds === "number" ? Math.round(stats.rushYds) : undefined;
      const td = typeof stats.rushTd === "number" ? `${Math.round(stats.rushTd)}TD` : undefined;
      return ["Rush", typeof attempts === "number" && typeof yards === "number" ? `${attempts}-${yards}` : undefined, td]
        .filter(Boolean)
        .join(" ");
    }

    if (typeof stats.rec === "number" || typeof stats.recYds === "number") {
      const rec = typeof stats.rec === "number" ? Math.round(stats.rec) : undefined;
      const yards = typeof stats.recYds === "number" ? Math.round(stats.recYds) : undefined;
      const td = typeof stats.recTd === "number" ? `${Math.round(stats.recTd)}TD` : undefined;
      return ["Rec", typeof rec === "number" && typeof yards === "number" ? `${rec}-${yards}` : undefined, td]
        .filter(Boolean)
        .join(" ");
    }

    return "Stat line unavailable";
  }

  const hasPitcher = typeof stats.ip === "number" || typeof stats.er === "number" || typeof stats.k === "number";
  if (hasPitcher) {
    const ip = typeof stats.ip === "number" ? `${outsToIp(ipToOuts(stats.ip))} IP` : undefined;
    const er = typeof stats.er === "number" ? `${Math.round(stats.er)} ER` : undefined;
    const k = typeof stats.k === "number" ? `${Math.round(stats.k)} K` : undefined;
    return [ip, er, k].filter(Boolean).join(" · ") || "Stat line unavailable";
  }

  const hits = typeof stats.hits === "number" ? Math.round(stats.hits) : undefined;
  const ab = typeof stats.ab === "number" ? Math.round(stats.ab) : undefined;
  const hr = typeof stats.hr === "number" ? `HR ${Math.round(stats.hr)}` : undefined;
  const rbi = typeof stats.rbi === "number" ? `RBI ${Math.round(stats.rbi)}` : undefined;
  return [typeof hits === "number" && typeof ab === "number" ? `${hits}-${ab}` : undefined, hr, rbi]
    .filter(Boolean)
    .join(" · ") || "Stat line unavailable";
}

function extractGameRows(payload: unknown): Record<string, unknown>[] {
  const data = asObject(payload);
  if (!data) {
    return [];
  }

  const directCandidates = [data.events, data.games, data.entries];
  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((row): row is Record<string, unknown> => Boolean(asObject(row)));
    }
  }

  const gamelog = asObject(data.gamelog);
  if (gamelog) {
    for (const candidate of [gamelog.events, gamelog.games, gamelog.entries]) {
      if (Array.isArray(candidate)) {
        return candidate.filter((row): row is Record<string, unknown> => Boolean(asObject(row)));
      }
    }
  }

  return [];
}

function parseGames(payload: unknown, sport: SportKey): ParsedGame[] {
  const rows = extractGameRows(payload);
  const parsed = rows.map((row) => {
    const stats = parseStatsFromRow(row, sport);
    const opponentObj = asObject(row.opponent);
    const opponent = readString(row.opponent)
      ?? readString(row.vs)
      ?? readString(opponentObj?.abbreviation)
      ?? readString(opponentObj?.displayName)
      ?? readString(opponentObj?.name);

    return {
      date: readString(row.date) ?? readString(row.gameDate),
      opponent,
      result: readString(row.result) ?? readString(row.outcome),
      line: readString(row.line) ?? compactStatLine(sport, stats),
      stats,
    };
  });

  return parsed
    .sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    })
    .filter((row) => row.line.length > 0);
}

function deriveNbaSeason(games: ParsedGame[], sampleSize: number): PlayerInsights["season"] {
  if (games.length === 0) {
    return null;
  }
  const slice = games.slice(0, sampleSize);
  const totals = slice.reduce((acc, game) => {
    acc.points += game.stats.points ?? 0;
    acc.rebounds += game.stats.rebounds ?? 0;
    acc.assists += game.stats.assists ?? 0;
    return acc;
  }, { points: 0, rebounds: 0, assists: 0 });

  const hasData = totals.points > 0 || totals.rebounds > 0 || totals.assists > 0;
  if (!hasData) {
    return null;
  }

  const n = slice.length;
  const ppg = totals.points / n;
  const rpg = totals.rebounds / n;
  const apg = totals.assists / n;

  return {
    headline: `PPG ${toFixed(ppg, 1)} · RPG ${toFixed(rpg, 1)} · APG ${toFixed(apg, 1)}`,
    metrics: [
      { key: "ppg", label: "PPG", value: toFixed(ppg, 1) },
      { key: "rpg", label: "RPG", value: toFixed(rpg, 1) },
      { key: "apg", label: "APG", value: toFixed(apg, 1) },
    ],
    source: "derived",
    sampleSize: n,
  };
}

function deriveNflSeason(games: ParsedGame[], sampleSize: number): PlayerInsights["season"] {
  if (games.length === 0) {
    return null;
  }

  const slice = games.slice(0, sampleSize);
  const totals = slice.reduce((acc, game) => {
    acc.passYds += game.stats.passYds ?? 0;
    acc.passTd += game.stats.passTd ?? 0;
    acc.int += game.stats.int ?? 0;
    acc.rushYds += game.stats.rushYds ?? 0;
    acc.rushTd += game.stats.rushTd ?? 0;
    acc.recYds += game.stats.recYds ?? 0;
    acc.recTd += game.stats.recTd ?? 0;
    return acc;
  }, {
    passYds: 0, passTd: 0, int: 0, rushYds: 0, rushTd: 0, recYds: 0, recTd: 0,
  });

  const n = slice.length;
  const metrics: { key: string; label: string; value: string }[] = [];

  if (totals.passYds > 0 || totals.passTd > 0 || totals.int > 0) {
    metrics.push(
      { key: "pass_ypg", label: "Pass YPG", value: toFixed(totals.passYds / n, 1) },
      { key: "pass_td_pg", label: "Pass TD/G", value: toFixed(totals.passTd / n, 2) },
      { key: "int_pg", label: "INT/G", value: toFixed(totals.int / n, 2) },
    );
  }
  if (totals.rushYds > 0 || totals.rushTd > 0) {
    metrics.push(
      { key: "rush_ypg", label: "Rush YPG", value: toFixed(totals.rushYds / n, 1) },
      { key: "rush_td_pg", label: "Rush TD/G", value: toFixed(totals.rushTd / n, 2) },
    );
  }
  if (totals.recYds > 0 || totals.recTd > 0) {
    metrics.push(
      { key: "rec_ypg", label: "Rec YPG", value: toFixed(totals.recYds / n, 1) },
      { key: "rec_td_pg", label: "Rec TD/G", value: toFixed(totals.recTd / n, 2) },
    );
  }

  if (metrics.length === 0) {
    return null;
  }

  return {
    headline: metrics.slice(0, 3).map((metric) => `${metric.label} ${metric.value}`).join(" · "),
    metrics,
    source: "derived",
    sampleSize: n,
  };
}

function deriveMlbSeason(games: ParsedGame[], sampleSize: number): PlayerInsights["season"] {
  if (games.length === 0) {
    return null;
  }

  const slice = games.slice(0, sampleSize);
  const hasPitcherData = slice.some((game) =>
    typeof game.stats.ip === "number" || typeof game.stats.er === "number" || typeof game.stats.k === "number");

  if (hasPitcherData) {
    const totals = slice.reduce((acc, game) => {
      acc.outs += typeof game.stats.ip === "number" ? ipToOuts(game.stats.ip) : 0;
      acc.er += game.stats.er ?? 0;
      acc.h += game.stats.h ?? 0;
      acc.bb += game.stats.bb ?? 0;
      acc.k += game.stats.k ?? 0;
      return acc;
    }, { outs: 0, er: 0, h: 0, bb: 0, k: 0 });

    const innings = totals.outs / 3;
    if (innings <= 0) {
      return null;
    }

    const era = (totals.er * 9) / innings;
    const whip = (totals.bb + totals.h) / innings;
    const k9 = (totals.k * 9) / innings;

    return {
      headline: `ERA ${toFixed(era, 2)} · WHIP ${toFixed(whip, 2)} · K/9 ${toFixed(k9, 1)}`,
      metrics: [
        { key: "era", label: "ERA", value: toFixed(era, 2) },
        { key: "whip", label: "WHIP", value: toFixed(whip, 2) },
        { key: "k9", label: "K/9", value: toFixed(k9, 1) },
      ],
      source: "derived",
      sampleSize: slice.length,
    };
  }

  const totals = slice.reduce((acc, game) => {
    acc.ab += game.stats.ab ?? 0;
    acc.hits += game.stats.hits ?? 0;
    acc.bb += game.stats.bb ?? 0;
    acc.hr += game.stats.hr ?? 0;
    acc.rbi += game.stats.rbi ?? 0;
    acc.doubles += game.stats.doubles ?? 0;
    acc.triples += game.stats.triples ?? 0;
    return acc;
  }, { ab: 0, hits: 0, bb: 0, hr: 0, rbi: 0, doubles: 0, triples: 0 });

  if (totals.ab <= 0 && totals.hr <= 0 && totals.rbi <= 0) {
    return null;
  }

  const singles = Math.max(0, totals.hits - totals.doubles - totals.triples - totals.hr);
  const totalBases = singles + totals.doubles * 2 + totals.triples * 3 + totals.hr * 4;
  const avg = totals.ab > 0 ? totals.hits / totals.ab : 0;
  const obpDenominator = totals.ab + totals.bb;
  const obp = obpDenominator > 0 ? (totals.hits + totals.bb) / obpDenominator : null;
  const slg = totals.ab > 0 ? totalBases / totals.ab : null;
  const ops = obp !== null && slg !== null ? obp + slg : null;

  const metrics = [
    { key: "avg", label: "AVG", value: toAvgStyle(avg) },
    ...(ops !== null ? [{ key: "ops", label: "OPS", value: toFixed(ops, 3) }] : []),
    { key: "hr", label: "HR", value: String(Math.round(totals.hr)) },
    { key: "rbi", label: "RBI", value: String(Math.round(totals.rbi)) },
  ];

  return {
    headline: `AVG ${toAvgStyle(avg)} · HR ${Math.round(totals.hr)} · RBI ${Math.round(totals.rbi)}`,
    metrics,
    source: "derived",
    sampleSize: slice.length,
  };
}

function deriveSeason(sport: SportKey, games: ParsedGame[]): PlayerInsights["season"] {
  const sampleSize = Math.min(10, games.length);
  if (sport === "nba") {
    return deriveNbaSeason(games, sampleSize);
  }
  if (sport === "nfl") {
    return deriveNflSeason(games, sampleSize);
  }
  return deriveMlbSeason(games, sampleSize);
}

function seasonFromPayload(payload: unknown, sport: SportKey): PlayerInsights["season"] {
  const data = asObject(payload);
  if (!data) {
    return null;
  }

  const seasonTotals = asObject(data.seasonTotals) ?? asObject(asObject(data.season)?.totals);
  if (!seasonTotals) {
    return null;
  }

  const find = (keys: string[]) => findObjectValue(seasonTotals, keys);

  if (sport === "nba") {
    const ppg = find(["pts", "points", "ppg"]);
    const rpg = find(["reb", "rebounds", "rpg"]);
    const apg = find(["ast", "assists", "apg"]);
    if (typeof ppg !== "number" && typeof rpg !== "number" && typeof apg !== "number") {
      return null;
    }

    const metrics = [
      typeof ppg === "number" ? { key: "ppg", label: "PPG", value: toFixed(ppg, 1) } : null,
      typeof rpg === "number" ? { key: "rpg", label: "RPG", value: toFixed(rpg, 1) } : null,
      typeof apg === "number" ? { key: "apg", label: "APG", value: toFixed(apg, 1) } : null,
    ].filter((row): row is { key: string; label: string; value: string } => row !== null);

    return {
      headline: metrics.map((metric) => `${metric.label} ${metric.value}`).join(" · "),
      metrics,
      source: "upstream",
    };
  }

  if (sport === "nfl") {
    const passYpg = find(["passYpg", "passYardsPerGame"]);
    const passTd = find(["passTd", "passingTouchdowns"]);
    const int = find(["int", "interceptions"]);
    const rushYpg = find(["rushYpg", "rushingYardsPerGame"]);
    const recYpg = find(["recYpg", "receivingYardsPerGame"]);

    const metrics = [
      typeof passYpg === "number" ? { key: "pass_ypg", label: "Pass YPG", value: toFixed(passYpg, 1) } : null,
      typeof passTd === "number" ? { key: "pass_td", label: "Pass TD", value: toFixed(passTd, 0) } : null,
      typeof int === "number" ? { key: "int", label: "INT", value: toFixed(int, 0) } : null,
      typeof rushYpg === "number" ? { key: "rush_ypg", label: "Rush YPG", value: toFixed(rushYpg, 1) } : null,
      typeof recYpg === "number" ? { key: "rec_ypg", label: "Rec YPG", value: toFixed(recYpg, 1) } : null,
    ].filter((row): row is { key: string; label: string; value: string } => row !== null);

    if (metrics.length === 0) {
      return null;
    }

    return {
      headline: metrics.slice(0, 3).map((metric) => `${metric.label} ${metric.value}`).join(" · "),
      metrics,
      source: "upstream",
    };
  }

  const era = find(["era"]);
  const whip = find(["whip"]);
  const avg = find(["avg", "battingAverage"]);
  const ops = find(["ops"]);
  const hr = find(["hr", "homeRuns"]);
  const rbi = find(["rbi", "runsBattedIn"]);

  const metrics = [
    typeof era === "number" ? { key: "era", label: "ERA", value: toFixed(era, 2) } : null,
    typeof whip === "number" ? { key: "whip", label: "WHIP", value: toFixed(whip, 2) } : null,
    typeof avg === "number" ? { key: "avg", label: "AVG", value: toAvgStyle(avg) } : null,
    typeof ops === "number" ? { key: "ops", label: "OPS", value: toFixed(ops, 3) } : null,
    typeof hr === "number" ? { key: "hr", label: "HR", value: String(Math.round(hr)) } : null,
    typeof rbi === "number" ? { key: "rbi", label: "RBI", value: String(Math.round(rbi)) } : null,
  ].filter((row): row is { key: string; label: string; value: string } => row !== null);

  if (metrics.length === 0) {
    return null;
  }

  return {
    headline: metrics.slice(0, 3).map((metric) => `${metric.label} ${metric.value}`).join(" · "),
    metrics,
    source: "upstream",
  };
}

function recentFromGames(sport: SportKey, games: ParsedGame[]): PlayerInsights["recent"] {
  if (games.length === 0) {
    return null;
  }

  const recentGames = games.slice(0, 5);
  const derivedSeason = deriveSeason(sport, recentGames);
  const headline = derivedSeason
    ? `Last ${recentGames.length}: ${derivedSeason.headline}`
    : `Last ${recentGames.length}: Game log available`;

  return {
    headline,
    games: recentGames.map((game) => ({
      date: game.date,
      opponent: game.opponent,
      result: game.result,
      line: game.line,
    })),
    source: "derived",
  };
}

async function fetchGamelog(
  sport: SportKey,
  playerId: string,
  dataMode: ModeArg,
): Promise<{ payload: unknown; meta: Meta } | null> {
  const config = GAMELOG_CONFIG[sport];
  const endpoint = config.endpoint.replace("{playerId}", encodeURIComponent(playerId));

  try {
    const response = await fetchEspnJson<unknown>({
      endpoint,
      fixtureFile: config.fixtureFile,
      fixtureSubdir: "gamelog",
      ttlSeconds: 240,
      dataMode,
    });
    return {
      payload: response.data,
      meta: response.meta,
    };
  } catch {
    return null;
  }
}

function combineMeta(
  dataMode: ModeArg,
  candidates: Array<Meta | null | undefined>,
  notes: string[],
): Meta {
  const valid = candidates.filter((meta): meta is Meta => Boolean(meta));
  const primary = valid[0];
  const warnings = [
    ...valid.map((meta) => meta.warning).filter((warning): warning is string => Boolean(warning)),
    ...notes,
  ];

  return {
    sourceUsed: primary?.sourceUsed ?? (dataMode === "fixture" ? "fixture" : "espn"),
    updatedAt: primary?.updatedAt ?? new Date().toISOString(),
    requestId: primary?.requestId ?? randomUUID(),
    endpointUrl: primary?.endpointUrl,
    upstreamStatus: primary?.upstreamStatus,
    upstreamMessage: primary?.upstreamMessage,
    cacheHit: primary?.cacheHit,
    cacheAgeSeconds: primary?.cacheAgeSeconds,
    dataMode,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}

function teamAbbrevFromPayload(payload: unknown): string | undefined {
  const data = asObject(payload);
  if (!data) {
    return undefined;
  }
  const direct = readString(data.teamAbbrev);
  if (direct) {
    return direct.toUpperCase();
  }
  const team = asObject(data.team);
  const nested = readString(team?.abbreviation);
  return nested ? nested.toUpperCase() : undefined;
}

export async function getPlayerInsights(
  sport: SportKey,
  playerId: string,
  mode: InsightsMode,
  dataMode?: ModeArg,
): Promise<Envelope<PlayerInsights>> {
  const resolvedMode = getDataMode(dataMode);
  const trimmedPlayerId = playerId.trim();

  if (!trimmedPlayerId) {
    return {
      data: null,
      meta: {
        sourceUsed: resolvedMode === "fixture" ? "fixture" : "espn",
        updatedAt: new Date().toISOString(),
        requestId: randomUUID(),
        warning: "playerId is required",
        dataMode: resolvedMode,
      },
      error: {
        message: "playerId is required",
        code: "MISSING_PLAYER_ID",
      },
    };
  }

  const notes: string[] = [];
  const profileEnvelope = await getPlayerProfile(sport, trimmedPlayerId, resolvedMode);
  if (profileEnvelope.error) {
    notes.push(profileEnvelope.error.message);
  }

  const profile = profileEnvelope.data;
  let gamelogMeta: Meta | null = null;
  let parsedGames: ParsedGame[] = [];
  let season: PlayerInsights["season"] = null;
  let recent: PlayerInsights["recent"] = null;
  let teamAbbrev = profile?.teamAbbrev;

  if (mode === "advanced") {
    const gamelogEnvelope = await fetchGamelog(sport, trimmedPlayerId, resolvedMode);
    if (!gamelogEnvelope) {
      notes.push("Game log endpoint unavailable for this player/league.");
    } else {
      gamelogMeta = gamelogEnvelope.meta;
      parsedGames = parseGames(gamelogEnvelope.payload, sport);
      teamAbbrev = teamAbbrev ?? teamAbbrevFromPayload(gamelogEnvelope.payload);
      season = seasonFromPayload(gamelogEnvelope.payload, sport) ?? deriveSeason(sport, parsedGames);
      recent = recentFromGames(sport, parsedGames);

      if (!season) {
        notes.push("Season stat summary is not available from current upstream payload.");
      }
      if (!recent) {
        notes.push("Recent game log is not available from current upstream payload.");
      }
    }
  }

  let live: PlayerInsights["live"] = null;
  let liveMeta: Meta | null = null;
  if (teamAbbrev) {
    const liveEnvelope = await getTeamStatus(sport, teamAbbrev, resolvedMode);
    liveMeta = liveEnvelope.meta;
    if (liveEnvelope.error) {
      notes.push(liveEnvelope.error.message);
    } else {
      live = liveEnvelope.data;
    }
  } else if (mode === "advanced") {
    notes.push("Team abbreviation unavailable; skipped live team context.");
  }

  const data: PlayerInsights = {
    sport,
    playerId: trimmedPlayerId,
    fullName: profile?.fullName,
    teamAbbrev,
    teamName: profile?.teamName,
    injury: profile?.injury ?? null,
    live,
    season,
    recent,
    metaNotes: mode === "advanced" && notes.length > 0 ? notes : undefined,
  };

  return {
    data,
    meta: combineMeta(resolvedMode, [gamelogMeta, liveMeta, profileEnvelope.meta], notes),
  };
}
