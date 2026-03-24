import { randomUUID } from "node:crypto";
import { fetchMlbJson } from "@/lib/providers/mlb/client";
import type { Meta } from "@/lib/providers/types";

export type MlbPitcherStatBasis =
  | "current_regular_season"
  | "prior_regular_season"
  | "spring_sample_only"
  | "unsupported";

export type MlbPitcherLastStart = {
  date?: string;
  opponent?: string;
  innings?: string;
  earnedRuns?: number;
  strikeouts?: number;
};

export type MlbPitcherComparisonCard = {
  playerId?: string;
  fullName: string;
  headshotUrl?: string;
  handedness?: string;
  record?: string;
  era?: number;
  whip?: number;
  inningsPitched?: number;
  strikeouts?: number;
  kPer9?: number;
  bbPer9?: number;
  hrPer9?: number;
  opponentAvg?: number;
  last3Starts?: MlbPitcherLastStart[];
  homeAwaySplits?: {
    home?: Record<string, string | number>;
    away?: Record<string, string | number>;
  };
  handednessSplits?: {
    vsLeft?: Record<string, string | number>;
    vsRight?: Record<string, string | number>;
  };
  gameLogMiniSummary?: string[];
  statsBasis: MlbPitcherStatBasis;
  statsBasisLabel: string;
  confidenceNote?: string;
};

type ModeArg = "live" | "fixture";
type CacheBustArg = string | number | undefined;
type RecordMap = Record<string, unknown>;
type MlbHydrateType = "season" | "gameLog" | "homeAndAway" | "statSplits";

export type ResolveMlbPitcherComparisonStatsArgs = {
  playerId?: string;
  fallbackName: string;
  selectedGameTime?: string;
  dataMode: ModeArg;
  cacheBust?: CacheBustArg;
};

export type ResolveMlbPitcherComparisonStatsResult = {
  card: MlbPitcherComparisonCard | null;
  meta: Meta;
  warning?: string;
};

type Snapshot = {
  candidatePlayerId: string;
  season: number;
  gameType: "R" | "S";
  card: Omit<MlbPitcherComparisonCard, "statsBasis" | "statsBasisLabel"> | null;
  meta: Meta | null;
  diagnostics: string[];
};

function fallbackMeta(mode: ModeArg, warning: string, notes?: string[]): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : "mlb",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    notes,
    dataMode: mode,
    dataModeEffective: mode,
  };
}

function asObject(value: unknown): RecordMap | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordMap) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]|_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asDisplay(value: number | undefined, digits: number): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Number(value.toFixed(digits));
}

function normalizeRecord(wins?: number, losses?: number): string | undefined {
  if (wins === undefined || losses === undefined) return undefined;
  return `${Math.round(wins)}-${Math.round(losses)}`;
}

function seasonFromValue(value: unknown): number | undefined {
  const direct = readNumber(value);
  if (typeof direct === "number") return Math.round(direct);
  const text = readString(value);
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function splitSeason(split: RecordMap | null): number | undefined {
  if (!split) return undefined;
  return seasonFromValue(split.season) ?? seasonFromValue(asObject(split.game)?.season);
}

function splitGameType(split: RecordMap | null): string | undefined {
  if (!split) return undefined;
  return readString(split.gameType) ?? readString(asObject(split.game)?.gameType);
}

function filterRows(rows: RecordMap[], season: number, gameType: "R" | "S"): RecordMap[] {
  const seasonRows = rows.filter((row) => splitSeason(row) === season);
  const seasonScoped = seasonRows.length > 0 ? seasonRows : rows;
  const typed = seasonScoped.filter((row) => splitGameType(row) === gameType);
  return typed.length > 0 ? typed : seasonScoped;
}

function statTypeLabel(group: RecordMap | null): string {
  const type = asObject(group?.type);
  return (
    readString(type?.displayName)
    ?? readString(type?.description)
    ?? readString(type?.code)
    ?? ""
  ).toLowerCase();
}

function pickGroup(groups: RecordMap[], candidates: string[]): RecordMap | null {
  return groups.find((group) => {
    const label = statTypeLabel(group);
    return candidates.some((candidate) => label.includes(candidate));
  }) ?? null;
}

function splitSummary(split: RecordMap | null): Record<string, string | number> | undefined {
  const stat = asObject(split?.stat);
  if (!stat) return undefined;

  const summary: Record<string, string | number> = {};
  const era = readNumber(stat.era);
  const whip = readNumber(stat.whip);
  const oppAvg = readNumber(stat.avg);
  const kPer9 = readNumber(stat.strikeoutsPer9Inn);
  const bbPer9 = readNumber(stat.walksPer9Inn);

  if (typeof era === "number") summary.ERA = Number(era.toFixed(2));
  if (typeof whip === "number") summary.WHIP = Number(whip.toFixed(2));
  if (typeof oppAvg === "number") summary["Opp AVG"] = Number(oppAvg.toFixed(3));
  if (typeof kPer9 === "number") summary["K/9"] = Number(kPer9.toFixed(1));
  if (typeof bbPer9 === "number") summary["BB/9"] = Number(bbPer9.toFixed(1));

  return Object.keys(summary).length > 0 ? summary : undefined;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return false;
}

function cardFieldPresence(card: Omit<MlbPitcherComparisonCard, "statsBasis" | "statsBasisLabel"> | null): string[] {
  if (!card) return [];
  const fields: Array<[string, unknown]> = [
    ["ERA", card.era],
    ["W-L", card.record],
    ["WHIP", card.whip],
    ["IP", card.inningsPitched],
    ["K", card.strikeouts],
    ["K/9", card.kPer9],
    ["BB/9", card.bbPer9],
    ["HR/9", card.hrPer9],
    ["Opp AVG", card.opponentAvg],
  ];
  return fields.filter(([, value]) => hasValue(value)).map(([label]) => label);
}

function hasAnySample(card: Omit<MlbPitcherComparisonCard, "statsBasis" | "statsBasisLabel"> | null): boolean {
  if (!card) return false;
  return cardFieldPresence(card).length > 0;
}

function hasMeaningfulSample(card: Omit<MlbPitcherComparisonCard, "statsBasis" | "statsBasisLabel"> | null): boolean {
  if (!card) return false;
  const innings = readNumber(card.inningsPitched);
  const metrics = [
    card.era,
    card.whip,
    card.strikeouts,
    card.kPer9,
    card.bbPer9,
    card.hrPer9,
    card.opponentAvg,
  ].filter((value) => hasValue(value)).length;

  if (typeof innings === "number" && innings >= 10 && metrics >= 4) return true;
  if (typeof innings === "number" && innings >= 20 && metrics >= 3) return true;
  return false;
}

function parseSeasonCard(args: {
  person: RecordMap | null;
  statsGroups: RecordMap[];
  fallbackName: string;
  playerId: string;
  targetSeason: number;
  gameType: "R" | "S";
}): Omit<MlbPitcherComparisonCard, "statsBasis" | "statsBasisLabel"> | null {
  const person = args.person;
  if (!person) return null;

  const seasonGroup = pickGroup(args.statsGroups, ["season", "statssingleseason"]);
  const gameLogGroup = pickGroup(args.statsGroups, ["gamelog", "game log"]);
  const homeAwayGroup = pickGroup(args.statsGroups, ["home and away", "homeandaway"]);
  const handednessGroup = pickGroup(args.statsGroups, ["vs batter side", "stat splits", "statsplits"]);

  const seasonRows = asArray(seasonGroup?.splits).map((row) => asObject(row)).filter((row): row is RecordMap => Boolean(row));
  const seasonSplit = filterRows(seasonRows, args.targetSeason, args.gameType)[0] ?? null;
  const seasonStat = asObject(seasonSplit?.stat);
  const wins = readNumber(seasonStat?.wins);
  const losses = readNumber(seasonStat?.losses);
  const inningsPitched = readNumber(seasonStat?.inningsPitched);
  const strikeouts = readNumber(seasonStat?.strikeOuts) ?? readNumber(seasonStat?.strikeouts);
  const walks = readNumber(seasonStat?.baseOnBalls) ?? readNumber(seasonStat?.walks);
  const homeRuns = readNumber(seasonStat?.homeRuns);
  const hits = readNumber(seasonStat?.hits);
  const era = readNumber(seasonStat?.era);
  const whip = readNumber(seasonStat?.whip);
  const opponentAvg = readNumber(seasonStat?.avg);
  const kPer9 = readNumber(seasonStat?.strikeoutsPer9Inn)
    ?? (inningsPitched && inningsPitched > 0 && strikeouts !== undefined ? (strikeouts * 9) / inningsPitched : undefined);
  const bbPer9 = readNumber(seasonStat?.walksPer9Inn)
    ?? (inningsPitched && inningsPitched > 0 && walks !== undefined ? (walks * 9) / inningsPitched : undefined);
  const hrPer9 = readNumber(seasonStat?.homeRunsPer9)
    ?? (inningsPitched && inningsPitched > 0 && homeRuns !== undefined ? (homeRuns * 9) / inningsPitched : undefined);

  const gameLogRaw = asArray(gameLogGroup?.splits).map((row) => asObject(row)).filter((row): row is RecordMap => Boolean(row));
  const gameLogRows = filterRows(gameLogRaw, args.targetSeason, args.gameType);
  const gameLog = gameLogRows
    .sort((left, right) => new Date(readString(right.date) ?? "").getTime() - new Date(readString(left.date) ?? "").getTime())
    .slice(0, 3)
    .map((row) => {
      const stat = asObject(row.stat);
      const opponent = asObject(row.opponent);
      return {
        date: readString(row.date),
        opponent: readString(opponent?.abbreviation) ?? readString(opponent?.name),
        innings: readString(stat?.inningsPitched) ?? (readNumber(stat?.inningsPitched) !== undefined ? String(readNumber(stat?.inningsPitched)) : undefined),
        earnedRuns: readNumber(stat?.earnedRuns),
        strikeouts: readNumber(stat?.strikeOuts) ?? readNumber(stat?.strikeouts),
      };
    })
    .filter((row) => Boolean(row.date || row.opponent || row.innings || row.earnedRuns !== undefined || row.strikeouts !== undefined));

  const homeAwayRows = filterRows(
    asArray(homeAwayGroup?.splits).map((row) => asObject(row)).filter((row): row is RecordMap => Boolean(row)),
    args.targetSeason,
    args.gameType,
  );
  const homeSplit = homeAwayRows.find((row) => {
    const split = asObject(row.split);
    const code = (readString(split?.code) ?? "").toLowerCase();
    const desc = (readString(split?.description) ?? "").toLowerCase();
    return row.isHome === true || code === "h" || desc.includes("home");
  }) ?? null;
  const awaySplit = homeAwayRows.find((row) => {
    const split = asObject(row.split);
    const code = (readString(split?.code) ?? "").toLowerCase();
    const desc = (readString(split?.description) ?? "").toLowerCase();
    return row.isHome === false || code === "a" || desc.includes("away");
  }) ?? null;

  const handedRows = filterRows(
    asArray(handednessGroup?.splits).map((row) => asObject(row)).filter((row): row is RecordMap => Boolean(row)),
    args.targetSeason,
    args.gameType,
  );
  const vsLeft = handedRows.find((row) => {
    const split = asObject(row.split);
    const code = (readString(split?.code) ?? "").toLowerCase();
    const desc = (readString(split?.description) ?? "").toLowerCase();
    return code === "vl" || desc.includes("left");
  }) ?? null;
  const vsRight = handedRows.find((row) => {
    const split = asObject(row.split);
    const code = (readString(split?.code) ?? "").toLowerCase();
    const desc = (readString(split?.description) ?? "").toLowerCase();
    return code === "vr" || desc.includes("right");
  }) ?? null;

  const summary = [
    typeof inningsPitched === "number" ? `IP ${inningsPitched.toFixed(1)}` : "",
    typeof strikeouts === "number" ? `K ${Math.round(strikeouts)}` : "",
    typeof era === "number" ? `ERA ${era.toFixed(2)}` : "",
  ].filter(Boolean);

  const name = readString(person.fullName) ?? readString(person.name) ?? args.fallbackName;
  const pitchHand = asObject(person.pitchHand);

  return {
    playerId: readString(person.id) ?? readNumber(person.id)?.toString() ?? args.playerId,
    fullName: name,
    headshotUrl: readString(asObject(person.primaryImage)?.url) ?? readString(person.headshot) ?? readString(person.photo),
    handedness: readString(pitchHand?.code) ?? readString(pitchHand?.description),
    record: normalizeRecord(wins, losses),
    era: asDisplay(era, 2),
    whip: asDisplay(whip, 2),
    inningsPitched: typeof inningsPitched === "number" ? Number(inningsPitched.toFixed(1)) : undefined,
    strikeouts: typeof strikeouts === "number" ? Math.round(strikeouts) : undefined,
    kPer9: asDisplay(kPer9, 1),
    bbPer9: asDisplay(bbPer9, 1),
    hrPer9: asDisplay(hrPer9, 1),
    opponentAvg: asDisplay(opponentAvg, 3),
    last3Starts: gameLog.length > 0 ? gameLog : undefined,
    homeAwaySplits: {
      home: splitSummary(homeSplit),
      away: splitSummary(awaySplit),
    },
    handednessSplits: {
      vsLeft: splitSummary(vsLeft),
      vsRight: splitSummary(vsRight),
    },
    gameLogMiniSummary: summary.length > 0 ? summary : undefined,
    confidenceNote: hits === undefined ? "Some pitching fields were unavailable from upstream." : undefined,
  };
}

function extractPerson(payload: unknown, playerId: string): RecordMap | null {
  const root = asObject(payload);
  const people = asArray(root?.people).map((row) => asObject(row)).filter((row): row is RecordMap => Boolean(row));
  if (people.length === 0) return null;
  const matched = people.find((item) => {
    const id = readString(item.id) ?? readNumber(item.id)?.toString();
    return id === playerId;
  });
  if (matched) return matched;
  return people.length === 1 ? people[0] : null;
}

async function fetchHydrateGroup(args: {
  playerId: string;
  season: number;
  gameType: "R" | "S";
  hydrateType: MlbHydrateType;
  input: ResolveMlbPitcherComparisonStatsArgs;
}): Promise<{ person: RecordMap | null; group: RecordMap | null; meta: Meta | null; diagnostic: string }> {
  let hydrate = `stats(group=[pitching],type=[${args.hydrateType}],season=${args.season},gameType=[${args.gameType}])`;
  if (args.hydrateType === "statSplits") {
    hydrate = `stats(group=[pitching],type=[statSplits],sitCodes=[vl,vr],season=${args.season},gameType=[${args.gameType}])`;
  }

  try {
    const response = await fetchMlbJson<unknown>({
      endpoint: `/people/${encodeURIComponent(args.playerId)}`,
      params: {
        hydrate,
      },
      dataMode: args.input.dataMode,
      cacheBust: args.input.cacheBust,
      ttlSeconds: 240,
      fixtureFile: "starting_pitcher_matchup_pitcher_stats_sample.json",
    });
    const person = extractPerson(response.data, args.playerId);
    const stats = asArray(person?.stats).map((row) => asObject(row)).filter((row): row is RecordMap => Boolean(row));
    const group = stats[0] ?? null;
    const endpointUrl = response.meta.endpointUrl ?? `/people/${args.playerId}?hydrate=${hydrate}`;
    return {
      person,
      group,
      meta: response.meta,
      diagnostic: `Pitcher stat diagnostic: endpoint ${endpointUrl} season ${args.season} gameType ${args.gameType} type ${args.hydrateType} ${group ? "returned data" : "returned no splits"}.`,
    };
  } catch (error) {
    return {
      person: null,
      group: null,
      meta: null,
      diagnostic: `Pitcher stat diagnostic: season ${args.season} gameType ${args.gameType} type ${args.hydrateType} failed (${String(error)}).`,
    };
  }
}

async function fetchSnapshot(args: {
  playerId: string;
  season: number;
  gameType: "R" | "S";
  input: ResolveMlbPitcherComparisonStatsArgs;
}): Promise<Snapshot> {
  const results = await Promise.all([
    fetchHydrateGroup({ ...args, hydrateType: "season" }),
    fetchHydrateGroup({ ...args, hydrateType: "gameLog" }),
    fetchHydrateGroup({ ...args, hydrateType: "homeAndAway" }),
    fetchHydrateGroup({ ...args, hydrateType: "statSplits" }),
  ]);

  const person = results.find((row) => row.person)?.person ?? null;
  const groups = results.map((row) => row.group).filter((row): row is RecordMap => Boolean(row));
  const latestMeta = results.find((row) => row.meta)?.meta ?? null;
  const card = parseSeasonCard({
    person,
    statsGroups: groups,
    fallbackName: args.input.fallbackName,
    playerId: args.playerId,
    targetSeason: args.season,
    gameType: args.gameType,
  });
  const fields = cardFieldPresence(card);
  const fieldNote = fields.length > 0
    ? `Pitcher stat diagnostic: mapped fields for season ${args.season} gameType ${args.gameType}: ${fields.join(", ")}.`
    : `Pitcher stat diagnostic: no mapped fields for season ${args.season} gameType ${args.gameType}.`;

  return {
    candidatePlayerId: args.playerId,
    season: args.season,
    gameType: args.gameType,
    card,
    meta: latestMeta,
    diagnostics: [...results.map((row) => row.diagnostic), fieldNote],
  };
}

async function resolvePlayerIdFromName(args: ResolveMlbPitcherComparisonStatsArgs): Promise<{ playerId: string | null; meta: Meta | null; diagnostics: string[] }> {
  const query = args.fallbackName.trim();
  if (!query) {
    return { playerId: null, meta: null, diagnostics: ["Pitcher stat diagnostic: empty fallback name; MLB id lookup skipped."] };
  }

  try {
    const response = await fetchMlbJson<unknown>({
      endpoint: "/people/search",
      params: {
        names: query,
        sportId: 1,
      },
      dataMode: args.dataMode,
      cacheBust: args.cacheBust,
      ttlSeconds: 240,
      fixtureFile: "starting_pitcher_matchup_pitcher_stats_sample.json",
    });
    const root = asObject(response.data);
    const people = asArray(root?.people).map((row) => asObject(row)).filter((row): row is RecordMap => Boolean(row));
    const normalized = normalizeName(query);
    const exact = people.find((row) => normalizeName(readString(row.fullName) ?? "") === normalized);
    const best = exact ?? people[0] ?? null;
    const playerId = readString(best?.id) ?? readNumber(best?.id)?.toString() ?? null;
    return {
      playerId,
      meta: response.meta,
      diagnostics: [
        `Pitcher stat diagnostic: identity lookup endpoint ${response.meta.endpointUrl ?? "/people/search"} for "${query}" returned ${people.length} candidates.`,
        playerId
          ? `Pitcher stat diagnostic: identity lookup selected playerId ${playerId}.`
          : `Pitcher stat diagnostic: identity lookup found no usable playerId for "${query}".`,
      ],
    };
  } catch (error) {
    return {
      playerId: null,
      meta: null,
      diagnostics: [`Pitcher stat diagnostic: identity lookup failed for "${query}" (${String(error)}).`],
    };
  }
}

function applyBasis(
  card: Omit<MlbPitcherComparisonCard, "statsBasis" | "statsBasisLabel">,
  basis: MlbPitcherStatBasis,
  basisLabel: string,
): MlbPitcherComparisonCard {
  return {
    ...card,
    statsBasis: basis,
    statsBasisLabel: basisLabel,
  };
}

function mergeMetaAndDiagnostics(meta: Meta | null, mode: ModeArg, diagnostics: string[], warning?: string): Meta {
  if (!meta) {
    return fallbackMeta(mode, warning ?? "Pitcher stats unavailable.", diagnostics);
  }
  return {
    ...meta,
    notes: diagnostics,
    warning: warning ?? meta.warning,
  };
}

async function evaluateCandidate(args: {
  candidatePlayerId: string;
  input: ResolveMlbPitcherComparisonStatsArgs;
  currentSeason: number;
  priorSeason: number;
}): Promise<{ card: MlbPitcherComparisonCard; meta: Meta; warning?: string }> {
  const diagnostics: string[] = [`Pitcher stat diagnostic: evaluating candidate playerId ${args.candidatePlayerId}.`];
  const currentRegular = await fetchSnapshot({
    playerId: args.candidatePlayerId,
    season: args.currentSeason,
    gameType: "R",
    input: args.input,
  });
  diagnostics.push(...currentRegular.diagnostics);

  if (hasMeaningfulSample(currentRegular.card)) {
    return {
      card: applyBasis(
        currentRegular.card as Omit<MlbPitcherComparisonCard, "statsBasis" | "statsBasisLabel">,
        "current_regular_season",
        `Using ${args.currentSeason} regular season`,
      ),
      meta: mergeMetaAndDiagnostics(currentRegular.meta, args.input.dataMode, diagnostics),
    };
  }

  const priorRegular = await fetchSnapshot({
    playerId: args.candidatePlayerId,
    season: args.priorSeason,
    gameType: "R",
    input: args.input,
  });
  diagnostics.push(...priorRegular.diagnostics);

  if (hasMeaningfulSample(priorRegular.card)) {
    const card = applyBasis(
      priorRegular.card as Omit<MlbPitcherComparisonCard, "statsBasis" | "statsBasisLabel">,
      "prior_regular_season",
      `Using ${args.priorSeason} regular season`,
    );

    const spring = await fetchSnapshot({
      playerId: args.candidatePlayerId,
      season: args.currentSeason,
      gameType: "S",
      input: args.input,
    });
    diagnostics.push(...spring.diagnostics);

    if (hasAnySample(spring.card) && spring.card?.last3Starts && spring.card.last3Starts.length > 0) {
      card.last3Starts = spring.card.last3Starts;
      card.confidenceNote = "Recent form uses current spring sample; core basis uses prior regular season.";
    }

    return {
      card,
      meta: mergeMetaAndDiagnostics(priorRegular.meta ?? spring.meta, args.input.dataMode, diagnostics),
    };
  }

  const springSample = await fetchSnapshot({
    playerId: args.candidatePlayerId,
    season: args.currentSeason,
    gameType: "S",
    input: args.input,
  });
  diagnostics.push(...springSample.diagnostics);

  if (hasAnySample(springSample.card)) {
    return {
      card: applyBasis(
        springSample.card as Omit<MlbPitcherComparisonCard, "statsBasis" | "statsBasisLabel">,
        "spring_sample_only",
        "Using spring sample only",
      ),
      meta: mergeMetaAndDiagnostics(springSample.meta ?? priorRegular.meta ?? currentRegular.meta, args.input.dataMode, diagnostics),
    };
  }

  if (hasAnySample(priorRegular.card)) {
    return {
      card: applyBasis(
        priorRegular.card as Omit<MlbPitcherComparisonCard, "statsBasis" | "statsBasisLabel">,
        "prior_regular_season",
        `Using ${args.priorSeason} regular season`,
      ),
      meta: mergeMetaAndDiagnostics(priorRegular.meta ?? currentRegular.meta, args.input.dataMode, diagnostics),
      warning: "Pitcher stat sample is thin; limited posted data.",
    };
  }

  if (hasAnySample(currentRegular.card)) {
    return {
      card: applyBasis(
        currentRegular.card as Omit<MlbPitcherComparisonCard, "statsBasis" | "statsBasisLabel">,
        "unsupported",
        "Limited posted data",
      ),
      meta: mergeMetaAndDiagnostics(currentRegular.meta ?? priorRegular.meta, args.input.dataMode, diagnostics),
      warning: "Pitcher stat sample is thin; limited posted data.",
    };
  }

  const warning = `No pitcher statistics returned for ${args.input.fallbackName}.`;
  return {
    card: {
      playerId: args.candidatePlayerId,
      fullName: args.input.fallbackName,
      statsBasis: "unsupported",
      statsBasisLabel: "Limited posted data",
    },
    meta: mergeMetaAndDiagnostics(
      springSample.meta ?? priorRegular.meta ?? currentRegular.meta,
      args.input.dataMode,
      diagnostics,
      warning,
    ),
    warning,
  };
}

export async function resolveMlbPitcherComparisonStats(
  args: ResolveMlbPitcherComparisonStatsArgs,
): Promise<ResolveMlbPitcherComparisonStatsResult> {
  const basisDate = args.selectedGameTime ? new Date(args.selectedGameTime) : new Date();
  const currentSeason = Number.isNaN(basisDate.getTime()) ? new Date().getUTCFullYear() : basisDate.getUTCFullYear();
  const priorSeason = currentSeason - 1;

  const diagnostics: string[] = [];
  const initialPlayerId = args.playerId?.trim();
  if (initialPlayerId) {
    diagnostics.push(`Pitcher stat diagnostic: initial probable-starter playerId ${initialPlayerId}.`);
    const first = await evaluateCandidate({
      candidatePlayerId: initialPlayerId,
      input: args,
      currentSeason,
      priorSeason,
    });
    if (first.card.statsBasis !== "unsupported" || hasAnySample(first.card)) {
      return first;
    }

    const lookup = await resolvePlayerIdFromName(args);
    diagnostics.push(...lookup.diagnostics);
    if (lookup.playerId && lookup.playerId !== initialPlayerId) {
      const fallback = await evaluateCandidate({
        candidatePlayerId: lookup.playerId,
        input: args,
        currentSeason,
        priorSeason,
      });
      if (fallback.card.statsBasis !== "unsupported" || hasAnySample(fallback.card)) {
        return {
          ...fallback,
          meta: {
            ...fallback.meta,
            notes: [...(fallback.meta.notes ?? []), ...diagnostics],
          },
        };
      }
      return {
        ...fallback,
        meta: {
          ...fallback.meta,
          notes: [...(fallback.meta.notes ?? []), ...diagnostics],
        },
      };
    }

    return {
      ...first,
      meta: {
        ...first.meta,
        notes: [...(first.meta.notes ?? []), ...diagnostics],
      },
    };
  }

  const lookup = await resolvePlayerIdFromName(args);
  diagnostics.push(...lookup.diagnostics);
  if (!lookup.playerId) {
    const warning = "Probable starter id unavailable; advanced stats remain limited.";
    return {
      card: {
        fullName: args.fallbackName,
        statsBasis: "unsupported",
        statsBasisLabel: "Limited posted data",
      },
      meta: mergeMetaAndDiagnostics(lookup.meta, args.dataMode, diagnostics, warning),
      warning,
    };
  }

  const resolved = await evaluateCandidate({
    candidatePlayerId: lookup.playerId,
    input: args,
    currentSeason,
    priorSeason,
  });
  return {
    ...resolved,
    meta: {
      ...resolved.meta,
      notes: [...(resolved.meta.notes ?? []), ...diagnostics],
    },
  };
}
