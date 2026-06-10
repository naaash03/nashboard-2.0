import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getTodaysSchedule, type MlbScheduleGame } from "@/lib/providers/espn/mlb";
import {
  fetchGameOdds,
  fetchLineMovement,
  type MlbGameOdds,
  type LineMovement,
} from "@/lib/providers/odds/client";
import { fetchGameDayWeather, type GameDayWeather } from "@/lib/providers/weather/client";
import {
  mlbGetRecentGameLog,
  mlbGetBullpenFatigue,
  mlbGetTeamSeasonStats,
  mlbGetPlayerSeasonStats,
  type MlbPlayerSeasonStats,
  type MlbPlayerYearStats,
} from "@/lib/providers/mlb/teamStats";
import { inferAnalysis, getLastProviderUsed } from "@/lib/providers/ai/client";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { MLB_TEAMS } from "@/lib/providers/mlb/MLB_TEAMS";
import type { Meta } from "@/lib/providers/types";

type LocalModeArg = "auto" | "live" | "fixture";

// ─── Division Map (built from MLB_TEAMS to match ESPN abbreviations) ──────────
const MLB_DIVISION_MAP: Record<string, string> = Object.fromEntries(
  MLB_TEAMS.map((t) => [t.key, `${t.league} ${t.division}`]),
);

// ─── Commentary Cache (process-level, 30-min TTL) ────────────────────────────
type CacheEntry = {
  commentary: string;
  fingerprint: string;
  generatedAt: string;
  expiresAt: string;
  generatedBy: "groq" | "gemini" | "rules";
  inputsUsed: string[];
};

const COMMENTARY_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCachedEntry(gameId: string, fingerprint: string): CacheEntry | null {
  const entry = COMMENTARY_CACHE.get(gameId);
  if (!entry) return null;
  if (Date.now() > new Date(entry.expiresAt).getTime()) return null;
  if (entry.fingerprint !== fingerprint) return null;
  return entry;
}

// ─── Pitcher Stats Helpers ────────────────────────────────────────────────────
export function latestPitchingStats(
  stats: { data: MlbPlayerSeasonStats | null } | null,
): MlbPlayerYearStats | null {
  const rows = stats?.data?.pitching;
  if (!rows || rows.length === 0) return null;
  const recent = rows[0]; // sorted descending by season
  if (!recent.era && !recent.inningsPitched && !recent.strikeOuts) return null;
  return recent;
}

export function formatPitcherStats(s: MlbPlayerYearStats): string {
  return `${s.season} — ${s.wins ?? 0}-${s.losses ?? 0}, ERA ${s.era ?? "N/A"}, WHIP ${s.whip ?? "N/A"}, ${s.inningsPitched ?? "0.0"} IP, ${s.strikeOuts ?? 0} K`;
}

// ─── Input Gathering ──────────────────────────────────────────────────────────
type GameInputs = {
  awayForm: Awaited<ReturnType<typeof mlbGetRecentGameLog>>;
  homeForm: Awaited<ReturnType<typeof mlbGetRecentGameLog>>;
  odds: MlbGameOdds;
  lineMovement: LineMovement;
  weather: GameDayWeather | null;
  awayBullpen: Awaited<ReturnType<typeof mlbGetBullpenFatigue>>;
  homeBullpen: Awaited<ReturnType<typeof mlbGetBullpenFatigue>>;
  awayStats: Awaited<ReturnType<typeof mlbGetTeamSeasonStats>>;
  homeStats: Awaited<ReturnType<typeof mlbGetTeamSeasonStats>>;
  awayPitcherStats: { data: MlbPlayerSeasonStats | null; meta: Meta } | null;
  homePitcherStats: { data: MlbPlayerSeasonStats | null; meta: Meta } | null;
};

async function gatherGameInputs(
  game: MlbScheduleGame,
  dataMode: LocalModeArg | undefined,
): Promise<GameInputs> {
  const currentYear = new Date().getFullYear();
  const awayP = game.probables.find((p) => p.homeAway === "away");
  const homeP = game.probables.find((p) => p.homeAway === "home");

  type PitcherStatsResult = GameInputs["awayPitcherStats"];
  const fetchAwayPitcher: Promise<PitcherStatsResult> = awayP?.athleteId
    ? mlbGetPlayerSeasonStats(awayP.athleteId, dataMode).catch((): null => null)
    : Promise.resolve(null);
  const fetchHomePitcher: Promise<PitcherStatsResult> = homeP?.athleteId
    ? mlbGetPlayerSeasonStats(homeP.athleteId, dataMode).catch((): null => null)
    : Promise.resolve(null);

  const [awayForm, homeForm, odds, awayBullpen, homeBullpen, awayStats, homeStats,
         awayPitcherStats, homePitcherStats] =
    await Promise.all([
      mlbGetRecentGameLog(game.awayTeam.key, 5, dataMode),
      mlbGetRecentGameLog(game.homeTeam.key, 5, dataMode),
      fetchGameOdds("baseball_mlb", game.homeTeam.name, game.awayTeam.name),
      mlbGetBullpenFatigue(game.awayTeam.key, dataMode),
      mlbGetBullpenFatigue(game.homeTeam.key, dataMode),
      mlbGetTeamSeasonStats(game.awayTeam.key, currentYear, dataMode),
      mlbGetTeamSeasonStats(game.homeTeam.key, currentYear, dataMode),
      fetchAwayPitcher,
      fetchHomePitcher,
    ]);

  const lineMovement = await fetchLineMovement(
    "baseball_mlb",
    game.homeTeam.name,
    game.awayTeam.name,
    odds.homeMoneyline,
    odds.awayMoneyline,
  );

  const weather = game.venueName
    ? await fetchGameDayWeather(game.venueName, game.venueCity ?? game.venueName)
    : null;

  return { awayForm, homeForm, odds, lineMovement, weather, awayBullpen, homeBullpen, awayStats, homeStats, awayPitcherStats, homePitcherStats };
}

// ─── Fingerprint (change detection for cache invalidation) ───────────────────
function computeFingerprint(game: MlbScheduleGame, inputs: GameInputs): string {
  const awayProbable = game.probables.find((p) => p.homeAway === "away")?.name ?? "";
  const homeProbable = game.probables.find((p) => p.homeAway === "home")?.name ?? "";
  const awayLast5 = inputs.awayForm.data?.games.map((g) => g.result).join("") ?? "";
  const homeLast5 = inputs.homeForm.data?.games.map((g) => g.result).join("") ?? "";
  const roundedML =
    inputs.odds.homeMoneyline != null
      ? String(Math.round(inputs.odds.homeMoneyline / 5) * 5)
      : "null";
  const weatherKey =
    inputs.weather && !inputs.weather.isFallback
      ? `${inputs.weather.condition}_${inputs.weather.tempF}`
      : "no-weather";
  const raw = `${awayProbable}|${homeProbable}|${weatherKey}|${roundedML}|${awayLast5}|${homeLast5}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────
function buildMatchupPrompt(
  game: MlbScheduleGame,
  inputs: GameInputs,
  mode: "beginner" | "advanced",
): { prompt: string; inputsUsed: string[] } {
  const sections: string[] = [];
  const inputsUsed: string[] = [];

  const awayP = game.probables.find((p) => p.homeAway === "away");
  const homeP = game.probables.find((p) => p.homeAway === "home");

  sections.push(`Game: ${game.awayTeam.name} @ ${game.homeTeam.name}`);

  if (awayP) {
    const awayPStats = latestPitchingStats(inputs.awayPitcherStats);
    if (awayPStats) {
      sections.push(`Away starter: ${awayP.name} — ${formatPitcherStats(awayPStats)}`);
      inputsUsed.push("away_starter_name", "away_starter_stats");
    } else {
      sections.push(`Away starter: ${awayP.name} (season stats unavailable)`);
      inputsUsed.push("away_starter_name");
    }
  }
  if (homeP) {
    const homePStats = latestPitchingStats(inputs.homePitcherStats);
    if (homePStats) {
      sections.push(`Home starter: ${homeP.name} — ${formatPitcherStats(homePStats)}`);
      inputsUsed.push("home_starter_name", "home_starter_stats");
    } else {
      sections.push(`Home starter: ${homeP.name} (season stats unavailable)`);
      inputsUsed.push("home_starter_name");
    }
  }

  if (game.awayTeam.record) {
    sections.push(`${game.awayTeam.name} record: ${game.awayTeam.record.wins}-${game.awayTeam.record.losses}`);
    inputsUsed.push("away_team_record");
  }
  if (game.homeTeam.record) {
    sections.push(`${game.homeTeam.name} record: ${game.homeTeam.record.wins}-${game.homeTeam.record.losses}`);
    inputsUsed.push("home_team_record");
  }

  if (inputs.awayForm.data) {
    const results = inputs.awayForm.data.games.map((g) => g.result).join("") || "N/A";
    sections.push(`${game.awayTeam.name} last 5: ${results}`);
    inputsUsed.push("away_recent_form");
  }
  if (inputs.homeForm.data) {
    const results = inputs.homeForm.data.games.map((g) => g.result).join("") || "N/A";
    sections.push(`${game.homeTeam.name} last 5: ${results}`);
    inputsUsed.push("home_recent_form");
  }

  if (!inputs.odds.isFallback) {
    sections.push(
      `Moneyline: ${game.awayTeam.name} ${inputs.odds.awayMoneyline ?? "N/A"} / ${game.homeTeam.name} ${inputs.odds.homeMoneyline ?? "N/A"}`,
    );
    inputsUsed.push("moneyline");
    if (inputs.odds.overUnder != null) {
      sections.push(`Over/Under: ${inputs.odds.overUnder}`);
      inputsUsed.push("over_under");
    }
  }

  if (!inputs.lineMovement.isFallback) {
    sections.push(
      `Line movement: away open ${inputs.lineMovement.awayOpen} → home shift ${inputs.lineMovement.homeVigShift ?? "none"}`,
    );
    inputsUsed.push("line_movement");
  }

  if (inputs.weather && !inputs.weather.isFallback && inputs.weather.isOutdoor) {
    sections.push(
      `Weather: ${inputs.weather.condition}, ${inputs.weather.tempF}°F, wind ${inputs.weather.windMph} mph (impact: ${inputs.weather.weatherImpact})`,
    );
    inputsUsed.push("weather");
  }

  if (inputs.awayStats.data?.hitting.ops) {
    sections.push(
      `${game.awayTeam.name} offense: AVG ${inputs.awayStats.data.hitting.avg ?? "N/A"}, OPS ${inputs.awayStats.data.hitting.ops}`,
    );
    inputsUsed.push("away_batting_stats");
  }
  if (inputs.homeStats.data?.hitting.ops) {
    sections.push(
      `${game.homeTeam.name} offense: AVG ${inputs.homeStats.data.hitting.avg ?? "N/A"}, OPS ${inputs.homeStats.data.hitting.ops}`,
    );
    inputsUsed.push("home_batting_stats");
  }

  if (inputs.awayBullpen.data) {
    const fatigued = inputs.awayBullpen.data.relievers.filter(
      (r) => r.fatigue === "fatigued" || r.fatigue === "tired",
    ).length;
    if (fatigued > 0) {
      sections.push(`${game.awayTeam.name} bullpen: ${fatigued} reliever(s) fatigued`);
      inputsUsed.push("away_bullpen");
    }
  }
  if (inputs.homeBullpen.data) {
    const fatigued = inputs.homeBullpen.data.relievers.filter(
      (r) => r.fatigue === "fatigued" || r.fatigue === "tired",
    ).length;
    if (fatigued > 0) {
      sections.push(`${game.homeTeam.name} bullpen: ${fatigued} reliever(s) fatigued`);
      inputsUsed.push("home_bullpen");
    }
  }

  const modeInstruction =
    mode === "advanced"
      ? "Write a detailed paragraph analyzing this MLB matchup. Cover starting pitcher matchup, recent team form, weather impact if relevant, bullpen context, and key offensive factors. Be specific with stats. Do not mention betting."
      : "Write 2-3 sentences of plain-language matchup analysis for a casual baseball fan. Focus on the most interesting storyline. Avoid jargon. Do not mention betting.";

  const prompt = `${modeInstruction}\n\nStructured inputs:\n${sections.join("\n")}`;
  return { prompt, inputsUsed };
}

// ─── Rules-Based Fallback ─────────────────────────────────────────────────────
function buildRulesCommentary(game: MlbScheduleGame, inputs: GameInputs): string {
  const awayP = game.probables.find((p) => p.homeAway === "away")?.name ?? "TBD";
  const homeP = game.probables.find((p) => p.homeAway === "home")?.name ?? "TBD";
  const awayRec = game.awayTeam.record
    ? `${game.awayTeam.record.wins}-${game.awayTeam.record.losses}`
    : "unknown record";
  const homeRec = game.homeTeam.record
    ? `${game.homeTeam.record.wins}-${game.homeTeam.record.losses}`
    : "unknown record";
  const awayLast5 = inputs.awayForm.data?.games.map((g) => g.result).join("") || "N/A";
  const homeLast5 = inputs.homeForm.data?.games.map((g) => g.result).join("") || "N/A";
  return `${game.homeTeam.name} (${homeRec}) hosts ${game.awayTeam.name} (${awayRec}) with ${homeP} facing ${awayP}. ${game.homeTeam.name} has gone ${homeLast5} over their last 5 games; ${game.awayTeam.name} ${awayLast5}.`;
}

// ─── Advanced Inputs Section ──────────────────────────────────────────────────
function buildAdvancedInputsSection(game: MlbScheduleGame, inputs: GameInputs): Record<string, unknown> {
  return {
    awayTeamRecord: game.awayTeam.record ?? null,
    homeTeamRecord: game.homeTeam.record ?? null,
    awayLast5: inputs.awayForm.data?.games.map((g) => g.result).join("") ?? null,
    homeLast5: inputs.homeForm.data?.games.map((g) => g.result).join("") ?? null,
    awayOPS: inputs.awayStats.data?.hitting.ops ?? null,
    homeOPS: inputs.homeStats.data?.hitting.ops ?? null,
    oddsAvailable: !inputs.odds.isFallback,
    weatherAvailable: !!(inputs.weather && !inputs.weather.isFallback && inputs.weather.isOutdoor),
    weatherImpact: inputs.weather?.weatherImpact ?? null,
  };
}

// ─── Featured Game Selection (one per division, prefer both teams winning) ────
function selectFeaturedGames(games: MlbScheduleGame[]): MlbScheduleGame[] {
  const byDivision = new Map<string, MlbScheduleGame[]>();
  for (const game of games) {
    const div = MLB_DIVISION_MAP[game.homeTeam.key] ?? "Other";
    const existing = byDivision.get(div) ?? [];
    byDivision.set(div, [...existing, game]);
  }
  const featured: MlbScheduleGame[] = [];
  for (const divGames of byDivision.values()) {
    const bothWinning = divGames.find((g) => {
      const away = g.awayTeam.record;
      const home = g.homeTeam.record;
      return away && home && away.wins > away.losses && home.wins > home.losses;
    });
    featured.push(bothWinning ?? divGames[0]);
  }
  return featured.slice(0, 6);
}

// ─── GET Handler ──────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") === "advanced" ? "advanced" : "beginner";
  const teamKeyRaw = (searchParams.get("teamKey") ?? "").trim().toUpperCase();
  const cacheBust = searchParams.get("cacheBust") ?? undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);
  const dataMode = resolvedDataMode as LocalModeArg;

  try {
    const { games: allGames, meta, dateUsed } = await getTodaysSchedule(dataMode, cacheBust);
    const regularGames = allGames.filter((g) => g.gameType === "regular" || !g.gameType);

    let selectedGames: MlbScheduleGame[];
    let noTeamGame = false;

    if (teamKeyRaw) {
      const match = regularGames.find(
        (g) => g.homeTeam.key === teamKeyRaw || g.awayTeam.key === teamKeyRaw,
      );
      if (!match) {
        noTeamGame = true;
        selectedGames = [];
      } else {
        selectedGames = [match];
      }
    } else {
      selectedGames = selectFeaturedGames(regularGames);
    }

    const cacheStats = { hits: 0, misses: 0 };

    type CommentaryResult = {
      game: MlbScheduleGame;
      inputs: GameInputs;
      entry: CacheEntry;
      wasHit: boolean;
    };

    // Sequential to avoid getLastProviderUsed() race condition
    const commentaryResults: CommentaryResult[] = [];
    for (const game of selectedGames) {
      const inputs = await gatherGameInputs(game, dataMode);
      const fingerprint = computeFingerprint(game, inputs);
      const cached = getCachedEntry(game.id, fingerprint);

      if (cached) {
        cacheStats.hits++;
        commentaryResults.push({ game, inputs, entry: cached, wasHit: true });
        continue;
      }

      cacheStats.misses++;
      const { prompt, inputsUsed } = buildMatchupPrompt(game, inputs, mode);

      let text: string;
      let generatedBy: "groq" | "gemini" | "rules";

      try {
        text = await inferAnalysis(prompt, {});
        generatedBy = (getLastProviderUsed() ?? "rules") as "groq" | "gemini" | "rules";
      } catch {
        text = buildRulesCommentary(game, inputs);
        generatedBy = "rules";
      }

      const entry: CacheEntry = {
        commentary: text,
        fingerprint,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        generatedBy,
        inputsUsed,
      };
      COMMENTARY_CACHE.set(game.id, entry);
      commentaryResults.push({ game, inputs, entry, wasHit: false });
    }

    const games = commentaryResults.map(({ game, inputs, entry, wasHit }) => {
      const division = MLB_DIVISION_MAP[game.homeTeam.key] ?? "Other";
      const result: Record<string, unknown> = {
        gameId: game.id,
        awayTeam: game.awayTeam.name,
        homeTeam: game.homeTeam.name,
        gameTime: game.date,
        division,
        commentary: {
          text: entry.commentary,
          mode,
          generatedBy: entry.generatedBy,
          inputsUsed: entry.inputsUsed,
          cachedAt: wasHit ? entry.generatedAt : null,
          fingerprint: entry.fingerprint,
          isFallback: entry.generatedBy === "rules",
        },
      };
      if (mode === "advanced") {
        result.inputs = buildAdvancedInputsSection(game, inputs);
      }
      return result;
    });

    const contract = toWidgetPayload({ data: games, error: null, meta, primaryProvider: "espn" });

    return NextResponse.json({
      data: {
        dateUsed,
        games,
        noTeamGame,
        noTeamGameMessage: noTeamGame ? `No game scheduled for ${teamKeyRaw} today.` : null,
      },
      meta: { ...meta, cacheStats },
      contract,
      error: null,
    });
  } catch (err) {
    const message = "Failed to load matchup commentary";
    const fallbackMeta: Meta = {
      sourceUsed: dataMode === "fixture" ? "fixture" : "espn",
      updatedAt: new Date().toISOString(),
      requestId: randomUUID(),
      warning: message,
      notes: [`Commentary route failed before usable data could be returned: ${String(err)}`],
      dataMode: resolvedDataMode,
      dataModeEffective: dataMode === "fixture" ? "fixture" : "live",
    };
    const contract = toWidgetPayload({
      data: null,
      error: message,
      meta: fallbackMeta,
      primaryProvider: "espn",
    });
    return NextResponse.json(
      {
        data: null,
        meta: fallbackMeta,
        contract,
        error: message,
        userFacingMessage: "Matchup commentary is temporarily unavailable.",
      },
      { status: 502 },
    );
  }
}
