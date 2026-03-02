import { randomUUID } from "node:crypto";
import { getDataMode } from "@/lib/providers/espn/client";
import {
  getGameLog,
  getPlayerProfile,
} from "@/lib/providers/espn/playerDirectory";
import { getTeamStatus } from "@/lib/providers/espn/teamStatus";
import type { Meta } from "@/lib/providers/types";
import type { Envelope } from "@/lib/types/players";
import type { PlayerInsights, SportKey } from "@/lib/types/playerInsights";

type ModeArg = "live" | "fixture";
type InsightsMode = "beginner" | "advanced";
type CacheBustArg = string | number | null | undefined;

type ParsedGame = {
  date?: string;
  opponent?: string;
  result?: string;
  stats: Record<string, number>;
};

type ParsedGamesResult = {
  games: ParsedGame[];
  notes: string[];
};

type StatMetric = {
  key: string;
  label: string;
  value: string;
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

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9/]/g, "");
}

function formatFixed(value: number, digits: number): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "0";
}

function formatAvg(value: number): string {
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
  const whole = Math.floor(Math.max(0, outs) / 3);
  const remainder = Math.max(0, outs) % 3;
  return `${whole}.${remainder}`;
}

function assignStat(stats: Record<string, number>, key: string, value: number): void {
  if (!Number.isFinite(value)) {
    return;
  }
  stats[key] = value;
}

function mapLabelToStats(
  stats: Record<string, number>,
  labelRaw: string,
  valueRaw: unknown,
  categoryRaw?: string,
): void {
  const label = normalizeKey(labelRaw);
  const category = normalizeKey(categoryRaw ?? "");

  const read = () => readNumber(valueRaw);
  const parseCompAtt = () => {
    if (typeof valueRaw !== "string") return;
    const match = valueRaw.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return;
    assignStat(stats, "passComp", Number(match[1]));
    assignStat(stats, "passAtt", Number(match[2]));
  };

  if (label === "c/att" || label === "cmp/att" || label === "comp/att") {
    parseCompAtt();
    return;
  }

  const numeric = read();
  if (typeof numeric !== "number") {
    return;
  }

  if (label === "pts" || label === "points") assignStat(stats, "points", numeric);
  if (label === "reb" || label === "rebounds") assignStat(stats, "rebounds", numeric);
  if (label === "ast" || label === "assists") assignStat(stats, "assists", numeric);
  if (label === "fga") assignStat(stats, "fga", numeric);
  if (label === "fta") assignStat(stats, "fta", numeric);

  if (label === "ip" || label === "inningspitched") assignStat(stats, "ip", numeric);
  if (label === "er" || label === "earnedruns") assignStat(stats, "er", numeric);
  if (label === "h" || label === "hits") assignStat(stats, "hits", numeric);
  if (label === "bb" || label === "walks" || label === "baseonballs") assignStat(stats, "bb", numeric);
  if (label === "k" || label === "so" || label === "strikeouts") assignStat(stats, "k", numeric);
  if (label === "ab" || label === "atbats") assignStat(stats, "ab", numeric);
  if (label === "hr" || label === "homeruns") assignStat(stats, "hr", numeric);
  if (label === "rbi" || label === "runsbattedin") assignStat(stats, "rbi", numeric);
  if (label === "2b" || label === "doubles") assignStat(stats, "doubles", numeric);
  if (label === "3b" || label === "triples") assignStat(stats, "triples", numeric);
  if (label === "hbp") assignStat(stats, "hbp", numeric);
  if (label === "sf") assignStat(stats, "sf", numeric);
  if (label === "tb" || label === "totalbases") assignStat(stats, "tb", numeric);

  if (label === "yds" || label === "yards") {
    if (category.includes("pass")) assignStat(stats, "passYds", numeric);
    if (category.includes("rush")) assignStat(stats, "rushYds", numeric);
    if (category.includes("receiv")) assignStat(stats, "recYds", numeric);
  }
  if (label === "td" || label === "touchdowns") {
    if (category.includes("pass")) assignStat(stats, "passTd", numeric);
    if (category.includes("rush")) assignStat(stats, "rushTd", numeric);
    if (category.includes("receiv")) assignStat(stats, "recTd", numeric);
  }
  if (label === "int" || label === "ints" || label === "interceptions") {
    if (category.includes("pass")) assignStat(stats, "int", numeric);
  }
  if (label === "att" || label === "attempts") {
    if (category.includes("pass")) assignStat(stats, "passAtt", numeric);
    if (category.includes("rush")) assignStat(stats, "rushAtt", numeric);
  }
  if (label === "rec" || label === "receptions") {
    assignStat(stats, "rec", numeric);
  }
}

function mergeObjectStats(target: Record<string, number>, source: Record<string, unknown>, category?: string): void {
  for (const [key, value] of Object.entries(source)) {
    mapLabelToStats(target, key, value, category);
  }
}

function mergeStatsFromBlock(target: Record<string, number>, blockInput: unknown, categoryHint?: string): void {
  const block = asObject(blockInput);
  if (!block) {
    return;
  }

  const category = readString(block.name) ?? readString(block.displayName) ?? categoryHint;
  const labels = Array.isArray(block.labels) ? block.labels : [];
  const stats = Array.isArray(block.stats) ? block.stats : [];

  if (labels.length > 0 && stats.length > 0) {
    const count = Math.min(labels.length, stats.length);
    for (let index = 0; index < count; index += 1) {
      const label = readString(labels[index]);
      if (!label) continue;
      mapLabelToStats(target, label, stats[index], category);
    }
  }

  for (const [key, value] of Object.entries(block)) {
    if (key === "labels" || key === "stats") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const nested of value) {
        const nestedObj = asObject(nested);
        if (nestedObj) {
          const nestedLabel =
            readString(nestedObj.label)
            ?? readString(nestedObj.name)
            ?? readString(nestedObj.abbreviation)
            ?? readString(nestedObj.displayName);
          if (nestedLabel) {
            mapLabelToStats(target, nestedLabel, nestedObj.value ?? nestedObj.displayValue ?? nestedObj.stat, category);
            continue;
          }
          mergeStatsFromBlock(target, nestedObj, category);
        }
      }
      continue;
    }

    const nestedObject = asObject(value);
    if (nestedObject) {
      mergeObjectStats(target, nestedObject, category);
      continue;
    }

    mapLabelToStats(target, key, value, category);
  }
}

function extractStatsFromRow(row: Record<string, unknown>): Record<string, number> {
  const stats: Record<string, number> = {};

  mergeObjectStats(stats, row);

  const directObjects = [
    asObject(row.stats),
    asObject(row.statistics),
    asObject(row.statLine),
    asObject(row.linescore),
  ].filter((entry): entry is Record<string, unknown> => Boolean(entry));

  for (const objectStats of directObjects) {
    mergeObjectStats(stats, objectStats);
  }

  const statArrays = [
    Array.isArray(row.stats) ? row.stats : [],
    Array.isArray(row.statistics) ? row.statistics : [],
    Array.isArray(row.categories) ? row.categories : [],
    Array.isArray(row.splits) ? row.splits : [],
  ];

  for (const blockList of statArrays) {
    for (const block of blockList) {
      mergeStatsFromBlock(stats, block);
    }
  }

  return stats;
}

function extractRowDate(row: Record<string, unknown>): string | undefined {
  return readString(row.date)
    ?? readString(row.gameDate)
    ?? readString(asObject(row.event)?.date)
    ?? readString(asObject(asObject(row.game)?.event)?.date);
}

function extractRowOpponent(row: Record<string, unknown>): string | undefined {
  const opponentObj = asObject(row.opponent)
    ?? asObject(asObject(row.event)?.opponent)
    ?? asObject(asObject(asObject(row.game)?.event)?.opponent);

  return readString(row.vs)
    ?? readString(row.opponent)
    ?? readString(opponentObj?.abbreviation)
    ?? readString(opponentObj?.displayName)
    ?? readString(opponentObj?.name);
}

function extractRowResult(row: Record<string, unknown>): string | undefined {
  return readString(row.result)
    ?? readString(row.outcome)
    ?? readString(asObject(row.event)?.result)
    ?? readString(asObject(asObject(row.game)?.event)?.result);
}

function extractGameRows(payload: unknown): Record<string, unknown>[] {
  const data = asObject(payload);
  if (!data) {
    return [];
  }

  const directCandidates = [data.events, data.games, data.entries, data.items, data.rows];
  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map((entry) => asObject(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry));
    }
  }

  const gamelog = asObject(data.gamelog);
  if (gamelog) {
    for (const candidate of [gamelog.events, gamelog.games, gamelog.entries]) {
      if (Array.isArray(candidate)) {
        return candidate
          .map((entry) => asObject(entry))
          .filter((entry): entry is Record<string, unknown> => Boolean(entry));
      }
    }
  }

  return [];
}

function parseGames(payload: unknown): ParsedGamesResult {
  const rows = extractGameRows(payload);
  const games = rows.map((row) => ({
    date: extractRowDate(row),
    opponent: extractRowOpponent(row),
    result: extractRowResult(row),
    stats: extractStatsFromRow(row),
  }));

  const sorted = games
    .sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    })
    .filter((game) => Object.keys(game.stats).length > 0 || game.opponent || game.date);

  const notes: string[] = [];
  if (sorted.length === 0) {
    notes.push("Recent game log is not available from current upstream payload.");
  }

  return {
    games: sorted,
    notes,
  };
}

function buildNbaSeasonAndRecent(games: ParsedGame[], notes: string[]): {
  season: PlayerInsights["season"];
  recent: PlayerInsights["recent"];
} {
  if (games.length === 0) {
    return { season: null, recent: null };
  }

  const seasonSlice = games.slice(0, Math.min(10, games.length));
  const totals = seasonSlice.reduce((acc, game) => {
    acc.points += game.stats.points ?? 0;
    acc.rebounds += game.stats.rebounds ?? 0;
    acc.assists += game.stats.assists ?? 0;
    acc.fga += game.stats.fga ?? 0;
    acc.fta += game.stats.fta ?? 0;
    return acc;
  }, { points: 0, rebounds: 0, assists: 0, fga: 0, fta: 0 });

  const gp = seasonSlice.length;
  if (gp === 0 || (totals.points === 0 && totals.rebounds === 0 && totals.assists === 0)) {
    notes.push("Season stat summary is not available from current upstream payload.");
    return { season: null, recent: null };
  }

  const ppg = totals.points / gp;
  const rpg = totals.rebounds / gp;
  const apg = totals.assists / gp;

  const metrics: StatMetric[] = [
    { key: "ppg", label: "PPG", value: formatFixed(ppg, 1) },
    { key: "rpg", label: "RPG", value: formatFixed(rpg, 1) },
    { key: "apg", label: "APG", value: formatFixed(apg, 1) },
  ];

  let tsValue: string | null = null;
  const tsDenominator = 2 * (totals.fga + 0.44 * totals.fta);
  if (tsDenominator > 0) {
    tsValue = formatFixed(totals.points / tsDenominator, 3);
    metrics.push({ key: "ts", label: "TS%", value: tsValue });
  } else {
    notes.push("TS% omitted because FGA/FTA inputs were not available.");
  }

  const season: PlayerInsights["season"] = {
    headline: [`PPG ${formatFixed(ppg, 1)}`, `RPG ${formatFixed(rpg, 1)}`, `APG ${formatFixed(apg, 1)}`, tsValue ? `TS% ${tsValue}` : undefined]
      .filter(Boolean)
      .join(" · "),
    metrics,
    source: "derived",
    sampleSize: gp,
  };

  const recentGames = games.slice(0, 5);
  const recent: PlayerInsights["recent"] = {
    headline: `Last ${recentGames.length}: ${season.headline}`,
    source: "derived",
    games: recentGames.map((game) => ({
      date: game.date,
      opponent: game.opponent,
      result: game.result,
      line: `${Math.round(game.stats.points ?? 0)} PTS · ${Math.round(game.stats.rebounds ?? 0)} REB · ${Math.round(game.stats.assists ?? 0)} AST`,
    })),
  };

  return { season, recent };
}

function isPitcher(position?: string, games: ParsedGame[] = []): boolean {
  const positionKey = (position ?? "").trim().toUpperCase();
  if (positionKey === "P" || positionKey === "SP" || positionKey === "RP" || positionKey === "CP") {
    return true;
  }
  return games.some((game) =>
    typeof game.stats.ip === "number"
    || typeof game.stats.er === "number"
    || typeof game.stats.k === "number",
  );
}

function buildMlbSeasonAndRecent(
  games: ParsedGame[],
  position: string | undefined,
  notes: string[],
): {
  season: PlayerInsights["season"];
  recent: PlayerInsights["recent"];
} {
  if (games.length === 0) {
    return { season: null, recent: null };
  }

  const seasonSlice = games.slice(0, Math.min(10, games.length));
  const recentSlice = games.slice(0, 5);

  if (isPitcher(position, seasonSlice)) {
    const totals = seasonSlice.reduce((acc, game) => {
      acc.outs += typeof game.stats.ip === "number" ? ipToOuts(game.stats.ip) : 0;
      acc.er += game.stats.er ?? 0;
      acc.hits += game.stats.hits ?? 0;
      acc.bb += game.stats.bb ?? 0;
      acc.k += game.stats.k ?? 0;
      return acc;
    }, { outs: 0, er: 0, hits: 0, bb: 0, k: 0 });

    const innings = totals.outs / 3;
    if (innings <= 0) {
      notes.push("Season stat summary is not available from current upstream payload.");
      return { season: null, recent: null };
    }

    const era = (totals.er * 9) / innings;
    const whip = (totals.bb + totals.hits) / innings;
    const k9 = (totals.k * 9) / innings;

    const season: PlayerInsights["season"] = {
      headline: `ERA ${formatFixed(era, 2)} · WHIP ${formatFixed(whip, 2)} · K/9 ${formatFixed(k9, 1)}`,
      metrics: [
        { key: "era", label: "ERA", value: formatFixed(era, 2) },
        { key: "whip", label: "WHIP", value: formatFixed(whip, 2) },
        { key: "k9", label: "K/9", value: formatFixed(k9, 1) },
      ],
      source: "derived",
      sampleSize: seasonSlice.length,
    };

    const recent: PlayerInsights["recent"] = {
      headline: `Last ${recentSlice.length}: ERA ${formatFixed(era, 2)} · WHIP ${formatFixed(whip, 2)}`,
      source: "derived",
      games: recentSlice.map((game) => ({
        date: game.date,
        opponent: game.opponent,
        result: game.result,
        line: `${outsToIp(ipToOuts(game.stats.ip ?? 0))} IP · ${Math.round(game.stats.er ?? 0)} ER · ${Math.round(game.stats.k ?? 0)} K`,
      })),
    };

    return { season, recent };
  }

  const totals = seasonSlice.reduce((acc, game) => {
    acc.ab += game.stats.ab ?? 0;
    acc.hits += game.stats.hits ?? 0;
    acc.bb += game.stats.bb ?? 0;
    acc.hbp += game.stats.hbp ?? 0;
    acc.sf += game.stats.sf ?? 0;
    acc.hr += game.stats.hr ?? 0;
    acc.rbi += game.stats.rbi ?? 0;
    acc.doubles += game.stats.doubles ?? 0;
    acc.triples += game.stats.triples ?? 0;
    acc.tb += game.stats.tb ?? 0;
    return acc;
  }, {
    ab: 0,
    hits: 0,
    bb: 0,
    hbp: 0,
    sf: 0,
    hr: 0,
    rbi: 0,
    doubles: 0,
    triples: 0,
    tb: 0,
  });

  if (totals.ab <= 0) {
    notes.push("Season stat summary is not available from current upstream payload.");
    return { season: null, recent: null };
  }

  const singles = Math.max(0, totals.hits - totals.doubles - totals.triples - totals.hr);
  const totalBases = totals.tb > 0 ? totals.tb : singles + totals.doubles * 2 + totals.triples * 3 + totals.hr * 4;
  const avg = totals.hits / totals.ab;

  const obpDenominator = totals.ab + totals.bb + totals.hbp + totals.sf;
  const obp = obpDenominator > 0 ? (totals.hits + totals.bb + totals.hbp) / obpDenominator : null;
  if (totals.hbp === 0 || totals.sf === 0) {
    notes.push("MLB OBP used available fields; HBP/SF were missing in part of the game log.");
  }

  const slg = totalBases / totals.ab;
  const ops = obp !== null ? obp + slg : null;

  const seasonMetrics: StatMetric[] = [
    { key: "avg", label: "AVG", value: formatAvg(avg) },
    ...(obp !== null ? [{ key: "obp", label: "OBP", value: formatAvg(obp) }] : []),
    { key: "slg", label: "SLG", value: formatAvg(slg) },
    ...(ops !== null ? [{ key: "ops", label: "OPS", value: formatAvg(ops) }] : []),
    { key: "hr", label: "HR", value: String(Math.round(totals.hr)) },
    { key: "rbi", label: "RBI", value: String(Math.round(totals.rbi)) },
  ];

  const seasonHeadlineParts = [
    `AVG ${formatAvg(avg)}`,
    obp !== null ? `OBP ${formatAvg(obp)}` : undefined,
    `SLG ${formatAvg(slg)}`,
    ops !== null ? `OPS ${formatAvg(ops)}` : undefined,
    `HR ${Math.round(totals.hr)}`,
    `RBI ${Math.round(totals.rbi)}`,
  ].filter(Boolean) as string[];

  const season: PlayerInsights["season"] = {
    headline: seasonHeadlineParts.join(" · "),
    metrics: seasonMetrics,
    source: "derived",
    sampleSize: seasonSlice.length,
  };

  const recent: PlayerInsights["recent"] = {
    headline: `Last ${recentSlice.length}: ${season.headline}`,
    source: "derived",
    games: recentSlice.map((game) => ({
      date: game.date,
      opponent: game.opponent,
      result: game.result,
      line: `${Math.round(game.stats.hits ?? 0)}-${Math.round(game.stats.ab ?? 0)} · HR ${Math.round(game.stats.hr ?? 0)} · RBI ${Math.round(game.stats.rbi ?? 0)}`,
    })),
  };

  return { season, recent };
}

function buildNflSeasonAndRecent(
  games: ParsedGame[],
  position: string | undefined,
  notes: string[],
): {
  season: PlayerInsights["season"];
  recent: PlayerInsights["recent"];
} {
  if (games.length === 0) {
    return { season: null, recent: null };
  }

  const seasonSlice = games.slice(0, Math.min(10, games.length));
  const recentSlice = games.slice(0, 5);
  const pos = (position ?? "").trim().toUpperCase();

  const totals = seasonSlice.reduce((acc, game) => {
    acc.passYds += game.stats.passYds ?? 0;
    acc.passTd += game.stats.passTd ?? 0;
    acc.int += game.stats.int ?? 0;
    acc.rushYds += game.stats.rushYds ?? 0;
    acc.rushTd += game.stats.rushTd ?? 0;
    acc.recYds += game.stats.recYds ?? 0;
    acc.recTd += game.stats.recTd ?? 0;
    return acc;
  }, {
    passYds: 0,
    passTd: 0,
    int: 0,
    rushYds: 0,
    rushTd: 0,
    recYds: 0,
    recTd: 0,
  });

  const gamesCount = seasonSlice.length;
  if (gamesCount === 0) {
    notes.push("Season stat summary is not available from current upstream payload.");
    return { season: null, recent: null };
  }

  let seasonMetrics: StatMetric[] = [];
  if (pos === "QB" || totals.passYds > 0) {
    seasonMetrics = [
      { key: "pass_ypg", label: "Pass YPG", value: formatFixed(totals.passYds / gamesCount, 1) },
      { key: "pass_tdpg", label: "Pass TD/G", value: formatFixed(totals.passTd / gamesCount, 2) },
      { key: "intpg", label: "INT/G", value: formatFixed(totals.int / gamesCount, 2) },
    ];
  } else if (pos === "RB" || totals.rushYds > 0) {
    seasonMetrics = [
      { key: "rush_ypg", label: "Rush YPG", value: formatFixed(totals.rushYds / gamesCount, 1) },
      { key: "rush_tdpg", label: "Rush TD/G", value: formatFixed(totals.rushTd / gamesCount, 2) },
    ];
  } else {
    seasonMetrics = [
      { key: "rec_ypg", label: "Rec YPG", value: formatFixed(totals.recYds / gamesCount, 1) },
      { key: "rec_tdpg", label: "Rec TD/G", value: formatFixed(totals.recTd / gamesCount, 2) },
    ];
  }

  const meaningfulMetrics = seasonMetrics.filter((metric) => Number(metric.value) > 0);
  if (meaningfulMetrics.length === 0) {
    notes.push("Season stat summary is not available from current upstream payload.");
    return { season: null, recent: null };
  }

  const season: PlayerInsights["season"] = {
    headline: meaningfulMetrics.map((metric) => `${metric.label} ${metric.value}`).join(" · "),
    metrics: meaningfulMetrics,
    source: "derived",
    sampleSize: gamesCount,
  };

  const recent: PlayerInsights["recent"] = {
    headline: `Last ${recentSlice.length}: ${season.headline}`,
    source: "derived",
    games: recentSlice.map((game) => {
      const line = pos === "QB" || (game.stats.passYds ?? 0) > 0
        ? `Pass ${Math.round(game.stats.passYds ?? 0)}y · ${Math.round(game.stats.passTd ?? 0)} TD · ${Math.round(game.stats.int ?? 0)} INT`
        : pos === "RB" || (game.stats.rushYds ?? 0) > 0
          ? `Rush ${Math.round(game.stats.rushYds ?? 0)}y · ${Math.round(game.stats.rushTd ?? 0)} TD`
          : `Rec ${Math.round(game.stats.recYds ?? 0)}y · ${Math.round(game.stats.recTd ?? 0)} TD`;
      return {
        date: game.date,
        opponent: game.opponent,
        result: game.result,
        line,
      };
    }),
  };

  return { season, recent };
}

function buildSeasonAndRecent(
  sport: SportKey,
  games: ParsedGame[],
  position: string | undefined,
  notes: string[],
): {
  season: PlayerInsights["season"];
  recent: PlayerInsights["recent"];
} {
  if (sport === "nba") {
    return buildNbaSeasonAndRecent(games, notes);
  }
  if (sport === "mlb") {
    return buildMlbSeasonAndRecent(games, position, notes);
  }
  return buildNflSeasonAndRecent(games, position, notes);
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

  const teamObj = asObject(data.team);
  const nested = readString(teamObj?.abbreviation);
  return nested ? nested.toUpperCase() : undefined;
}

export async function getPlayerInsights(
  sport: SportKey,
  playerIdInput: string,
  mode: InsightsMode,
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<Envelope<PlayerInsights>> {
  const resolvedMode = getDataMode(dataMode);
  const playerId = playerIdInput.trim();

  if (!playerId) {
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

  const profileEnvelope = await getPlayerProfile(sport, playerId, resolvedMode, cacheBust);
  if (profileEnvelope.error) {
    notes.push(profileEnvelope.error.message);
  }
  const profile = profileEnvelope.data;

  let gamelogMeta: Meta | null = null;
  let parsedGames: ParsedGame[] = [];
  let teamAbbrev = profile?.teamAbbrev;
  if (mode === "advanced") {
    const gamelogEnvelope = await getGameLog({ sport, playerId, dataMode: resolvedMode, cacheBust });
    gamelogMeta = gamelogEnvelope.meta;

    if (gamelogEnvelope.error || !gamelogEnvelope.data) {
      notes.push("Game log endpoint unavailable for this player/league.");
    } else {
      const parsed = parseGames(gamelogEnvelope.data);
      parsedGames = parsed.games;
      notes.push(...parsed.notes);
      teamAbbrev = teamAbbrev ?? teamAbbrevFromPayload(gamelogEnvelope.data);
    }
  }

  let live: PlayerInsights["live"] = null;
  let liveMeta: Meta | null = null;
  if (teamAbbrev) {
    const liveEnvelope = await getTeamStatus(sport, teamAbbrev, resolvedMode, cacheBust);
    liveMeta = liveEnvelope.meta;
    if (liveEnvelope.error) {
      notes.push("Team live context unavailable right now.");
    } else {
      live = liveEnvelope.data;
    }
  } else if (mode === "advanced") {
    notes.push("Team abbreviation unavailable; skipped live team context.");
  }

  let season: PlayerInsights["season"] = null;
  let recent: PlayerInsights["recent"] = null;
  if (mode === "advanced") {
    const derived = buildSeasonAndRecent(sport, parsedGames, profile?.position, notes);
    season = derived.season;
    recent = derived.recent;
  }

  const data: PlayerInsights = {
    sport,
    playerId,
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
