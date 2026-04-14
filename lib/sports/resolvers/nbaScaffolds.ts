import { randomUUID } from "node:crypto";
import type { Meta } from "@/lib/providers/types";
import {
  type PlayerRoleFormDemoData,
  type RestScheduleDemoData,
  type TeamMatchupDemoData,
  getNbaPlayerRoleFormDemo,
  getNbaRestScheduleSpotDemo,
  getNbaTeamMatchupProfileDemo,
} from "@/lib/providers/espn/nbaScaffolds";
import {
  type BallDontLieGame,
  type BallDontLiePlayer,
  type BallDontLiePlayerStat,
  type BallDontLieTeam,
  currentNbaSeason,
  findBestNbaPlayerMatch,
  findNbaTeamByKey,
  getNbaPlayerSeasonStats,
  getNbaTeamSeasonGames,
  getNbaTeams,
  isBallDontLieConfigured,
} from "@/lib/providers/balldontlie";

type DataMode = "auto" | "live" | "fixture";
type TrendSignal = "up" | "steady" | "down";

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isFinal(game: BallDontLieGame): boolean {
  return /final/i.test(game.status);
}

function teamSide(game: BallDontLieGame, teamId: number): "home" | "away" {
  return game.home_team.id === teamId ? "home" : "away";
}

function opponentForTeam(game: BallDontLieGame, teamId: number): BallDontLieTeam {
  return game.home_team.id === teamId ? game.visitor_team : game.home_team;
}

function teamScore(game: BallDontLieGame, teamId: number): number {
  return game.home_team.id === teamId ? game.home_team_score : game.visitor_team_score;
}

function opponentScore(game: BallDontLieGame, teamId: number): number {
  return game.home_team.id === teamId ? game.visitor_team_score : game.home_team_score;
}

function completedGames(games: BallDontLieGame[]): BallDontLieGame[] {
  return games.filter((game) => isFinal(game));
}

function upcomingGames(games: BallDontLieGame[]): BallDontLieGame[] {
  const nowMs = Date.now();
  return games.filter((game) => {
    if (isFinal(game)) {
      return false;
    }
    const gameMs = new Date(game.datetime ?? game.date).getTime();
    return Number.isFinite(gameMs) && gameMs >= nowMs - 4 * 60 * 60 * 1000;
  });
}

function buildRecord(games: BallDontLieGame[], teamId: number, limit?: number): string {
  const rows = completedGames(games)
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())
    .slice(0, limit ?? Number.MAX_SAFE_INTEGER);

  const wins = rows.filter((game) => teamScore(game, teamId) > opponentScore(game, teamId)).length;
  const losses = rows.filter((game) => teamScore(game, teamId) < opponentScore(game, teamId)).length;
  return `${wins}-${losses}`;
}

function averageOf(rows: number[]): number {
  if (rows.length === 0) {
    return 0;
  }
  return rows.reduce((sum, value) => sum + value, 0) / rows.length;
}

function averageMargin(games: BallDontLieGame[], teamId: number, limit = 10): number {
  const rows = completedGames(games)
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())
    .slice(0, limit)
    .map((game) => teamScore(game, teamId) - opponentScore(game, teamId));
  return averageOf(rows);
}

function averagePoints(games: BallDontLieGame[], teamId: number, limit = 10): number {
  const rows = completedGames(games)
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())
    .slice(0, limit)
    .map((game) => teamScore(game, teamId));
  return averageOf(rows);
}

function formatSigned(value: number, digits = 1): string {
  const fixed = value.toFixed(digits);
  return value > 0 ? `+${fixed}` : fixed;
}

function calendarDiffDays(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function restDaysBeforeGame(previousGame: BallDontLieGame | null, nextGame: BallDontLieGame): number {
  if (!previousGame) {
    return 0;
  }
  return Math.max(0, calendarDiffDays(previousGame.date, nextGame.date) - 1);
}

function gamesInWindow(games: BallDontLieGame[], anchorDate: string, days: number): number {
  const startDate = toIsoDate(addDays(new Date(`${anchorDate}T00:00:00.000Z`), -(days - 1)));
  return games.filter((game) => game.date >= startDate && game.date <= anchorDate).length;
}

function densityLabel(countInFour: number, countInSeven: number): string {
  if (countInFour >= 3) {
    return `${countInFour} in 4 nights`;
  }
  if (countInSeven >= 4) {
    return `${countInSeven} in 7 nights`;
  }
  if (countInSeven >= 3) {
    return `${countInSeven} in 7 nights`;
  }
  return "Normal cadence";
}

function travelDescriptor(previousGame: BallDontLieGame | null, nextGame: BallDontLieGame, teamId: number): { label: string; stressScore: number } {
  if (!previousGame) {
    return { label: "No prior game in current sample", stressScore: 1 };
  }

  const wasHome = teamSide(previousGame, teamId) === "home";
  const isHome = teamSide(nextGame, teamId) === "home";

  if (wasHome && isHome) {
    return { label: "Stayed home", stressScore: 0 };
  }
  if (!wasHome && isHome) {
    return { label: "Returning home", stressScore: 1 };
  }
  if (wasHome && !isHome) {
    return { label: "Flying out after home game", stressScore: 1 };
  }
  return { label: "Road to road turnaround", stressScore: 2 };
}

function compareAdvantage(teamValue: number, opponentValue: number, lowerIsBetter = false): "team" | "opponent" | "even" {
  if (teamValue === opponentValue) {
    return "even";
  }
  if (lowerIsBetter) {
    return teamValue < opponentValue ? "team" : "opponent";
  }
  return teamValue > opponentValue ? "team" : "opponent";
}

function dedupe(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function sanitizeDemoNotes(notes: string[] | undefined): string[] {
  return (notes ?? []).filter((note) => !note.toLowerCase().includes("live enrichment is intentionally deferred"));
}

function mergeMeta(metas: Meta[], extras?: {
  warning?: string;
  warnings?: string[];
  notes?: string[];
  hydrationUsed?: boolean;
  sourceUsed?: Meta["sourceUsed"];
  dataModeEffective?: Meta["dataModeEffective"];
}): Meta {
  if (metas.length === 0) {
    return {
      sourceUsed: extras?.sourceUsed ?? "demo",
      updatedAt: new Date().toISOString(),
      requestId: randomUUID(),
      notes: dedupe(extras?.notes ?? []),
      warnings: dedupe(extras?.warnings ?? []),
      warning: extras?.warning,
      hydrationUsed: extras?.hydrationUsed,
      dataModeEffective: extras?.dataModeEffective,
      dataMode: "auto",
    };
  }

  const sorted = [...metas].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const sourceUsed = extras?.sourceUsed
    ?? (metas.some((meta) => meta.sourceUsed === "balldontlie")
      ? "balldontlie"
      : metas.every((meta) => meta.sourceUsed === "cache")
        ? "cache"
        : sorted[0].sourceUsed);
  const warning = extras?.warning ?? metas.find((meta) => meta.warning)?.warning;
  const warnings = dedupe([
    ...metas.flatMap((meta) => meta.warnings ?? []),
    ...metas.flatMap((meta) => (meta.warning ? [meta.warning] : [])),
    ...(extras?.warnings ?? []),
    ...(warning ? [warning] : []),
  ]);
  const notes = dedupe([
    ...metas.flatMap((meta) => sanitizeDemoNotes(meta.notes)),
    ...(extras?.notes ?? []),
  ]);

  return {
    ...sorted[0],
    sourceUsed,
    updatedAt: sorted[0].updatedAt,
    warning,
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: notes.length > 0 ? notes : undefined,
    hydrationUsed: extras?.hydrationUsed ?? metas.some((meta) => Boolean(meta.hydrationUsed)),
    cacheHit: metas.some((meta) => Boolean(meta.cacheHit)),
    cacheAgeSeconds: metas.reduce<number | undefined>((youngest, meta) => {
      if (typeof meta.cacheAgeSeconds !== "number") {
        return youngest;
      }
      if (typeof youngest !== "number") {
        return meta.cacheAgeSeconds;
      }
      return Math.min(youngest, meta.cacheAgeSeconds);
    }, undefined),
    dataModeEffective: extras?.dataModeEffective ?? (sourceUsed === "demo" || sourceUsed === "fixture" ? "fixture" : "live"),
  };
}

function withDemoFallback<T>(
  resolved: { data: T; meta: Meta },
  args?: { warning?: string; notes?: string[] },
): { data: T; meta: Meta } {
  return {
    data: resolved.data,
    meta: mergeMeta([resolved.meta], {
      sourceUsed: "demo",
      warning: args?.warning,
      notes: args?.notes,
      dataModeEffective: "fixture",
    }),
  };
}

function liveAvailability(dataMode: DataMode): { enabled: boolean; warning?: string } {
  if (dataMode === "fixture") {
    return { enabled: false };
  }
  if (!isBallDontLieConfigured()) {
    return {
      enabled: false,
      warning: dataMode === "live"
        ? "BALL_DONT_LIE_KEY is not configured. Using the demo-backed NBA scaffold instead."
        : undefined,
    };
  }
  return { enabled: true };
}

function playerFullName(player: BallDontLiePlayer): string {
  return `${player.first_name} ${player.last_name}`.trim();
}

function parseMinutes(raw: string | undefined): number {
  if (!raw) {
    return 0;
  }
  if (raw.includes(":")) {
    const [minutes, seconds] = raw.split(":").map((part) => Number(part));
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return 0;
    }
    return minutes + seconds / 60;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function trendFromDelta(recent: number, baseline: number, threshold: number): TrendSignal {
  if (recent >= baseline + threshold) {
    return "up";
  }
  if (recent <= baseline - threshold) {
    return "down";
  }
  return "steady";
}

function averageStat(rows: BallDontLiePlayerStat[], pick: (row: BallDontLiePlayerStat) => number): number {
  return averageOf(rows.map(pick));
}

function roleFromLiveProfile(player: BallDontLiePlayer, stats: BallDontLiePlayerStat[]): { role: string; archetype: string } {
  const position = (player.position ?? "").toUpperCase();
  const seasonAst = averageStat(stats, (row) => row.ast);
  const seasonPts = averageStat(stats, (row) => row.pts);
  const seasonReb = averageStat(stats, (row) => row.reb);

  if ((position.includes("PG") || position === "G") && seasonAst >= 6) {
    return {
      role: "Lead guard",
      archetype: "Primary organizer who creates the first advantage and carries the passing load",
    };
  }
  if (position.includes("C") || seasonReb >= 9) {
    return {
      role: "Interior anchor",
      archetype: "Paint finisher, rebound stabilizer, and interior volume source",
    };
  }
  if (seasonPts >= 20) {
    return {
      role: "Primary scorer",
      archetype: "High-volume scoring option whose role is shaped by shot creation and usage",
    };
  }
  if (seasonAst >= 4) {
    return {
      role: "Connector creator",
      archetype: "Secondary organizer who keeps the offense flowing without owning every trip",
    };
  }
  return {
    role: "Rotation scorer",
    archetype: "Supporting piece whose minutes and scoring load move with lineup need",
  };
}

function roleFromPositionOnly(player: BallDontLiePlayer): { role: string; archetype: string } {
  const position = (player.position ?? "").toUpperCase();
  if (position.includes("PG") || position === "G") {
    return {
      role: "Guard rotation context",
      archetype: "Backcourt role read based on roster position only until live game stats are enabled",
    };
  }
  if (position.includes("C")) {
    return {
      role: "Frontcourt anchor context",
      archetype: "Interior role read based on roster position only until live game stats are enabled",
    };
  }
  return {
    role: "Wing / forward context",
    archetype: "Wing/forward role read based on roster position only until live game stats are enabled",
  };
}

async function resolveLiveTeamMatchupProfile(
  base: { data: TeamMatchupDemoData; meta: Meta },
  dataMode: DataMode,
): Promise<{ data: TeamMatchupDemoData; meta: Meta }> {
  const awayTeamLookup = await findNbaTeamByKey(base.data.away.key, dataMode);
  const homeTeamLookup = await findNbaTeamByKey(base.data.home.key, dataMode);

  if (!awayTeamLookup.data || !homeTeamLookup.data) {
    return withDemoFallback(base, {
      warning: "Live matchup enrichment could not map both NBA teams, so the widget stayed on the demo matchup board.",
      notes: ["BALLDONTLIE team lookup failed for one or both matchup teams."],
    });
  }

  const season = currentNbaSeason();
  const [awaySeason, homeSeason] = await Promise.all([
    getNbaTeamSeasonGames(awayTeamLookup.data.id, season, dataMode),
    getNbaTeamSeasonGames(homeTeamLookup.data.id, season, dataMode),
  ]);

  const awayRecord = buildRecord(awaySeason.data, awayTeamLookup.data.id);
  const homeRecord = buildRecord(homeSeason.data, homeTeamLookup.data.id);
  const awayLast10 = buildRecord(awaySeason.data, awayTeamLookup.data.id, 10);
  const homeLast10 = buildRecord(homeSeason.data, homeTeamLookup.data.id, 10);
  const awayMargin = averageMargin(awaySeason.data, awayTeamLookup.data.id, 10);
  const homeMargin = averageMargin(homeSeason.data, homeTeamLookup.data.id, 10);
  const awayPoints = averagePoints(awaySeason.data, awayTeamLookup.data.id, 10);
  const homePoints = averagePoints(homeSeason.data, homeTeamLookup.data.id, 10);
  const headToHead = awaySeason.data.find((game) => {
    const opponent = opponentForTeam(game, awayTeamLookup.data!.id);
    return opponent.id === homeTeamLookup.data!.id && !isFinal(game);
  }) ?? awaySeason.data
    .filter((game) => {
      const opponent = opponentForTeam(game, awayTeamLookup.data!.id);
      return opponent.id === homeTeamLookup.data!.id && isFinal(game);
    })
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())[0];

  const context = headToHead
    ? `Live records and recent form are pulled from BALLDONTLIE. ${awayTeamLookup.data.abbreviation} and ${homeTeamLookup.data.abbreviation} also have a scheduled or recent head-to-head marker on ${formatDateLabel(headToHead.date)}.`
    : "Live records and recent form are pulled from BALLDONTLIE. The matchup pillars below remain a teachable scaffold until richer team split data is wired in.";

  return {
    data: {
      ...base.data,
      context,
      beginnerSummary:
        `${awayTeamLookup.data.full_name} enters ${awayRecord} overall and ${awayLast10} over the last 10 games. `
        + `${homeTeamLookup.data.full_name} is ${homeRecord} overall and ${homeLast10} over the same window. `
        + "The live layer updates team form context; the pillar cards stay focused on the teaching angle.",
      advancedSummary:
        `${awayTeamLookup.data.abbreviation} carries a ${formatSigned(awayMargin)} average margin and ${awayPoints.toFixed(1)} points per game over its last 10. `
        + `${homeTeamLookup.data.abbreviation} sits at ${formatSigned(homeMargin)} and ${homePoints.toFixed(1)}. `
        + "The possession-pillar board remains scaffolded because the current BALLDONTLIE path does not expose team shot-profile splits cleanly.",
      away: {
        ...base.data.away,
        key: awayTeamLookup.data.abbreviation,
        name: awayTeamLookup.data.full_name,
        record: awayRecord,
        identity: `${base.data.away.identity} · ${awayLast10} last 10`,
      },
      home: {
        ...base.data.home,
        key: homeTeamLookup.data.abbreviation,
        name: homeTeamLookup.data.full_name,
        record: homeRecord,
        identity: `${base.data.home.identity} · ${homeLast10} last 10`,
      },
      swingFactor: headToHead
        ? {
            title: `Recent meeting marker: ${formatDateLabel(headToHead.date)}`,
            summary: isFinal(headToHead)
              ? `The latest tracked meeting ended ${teamScore(headToHead, awayTeamLookup.data.id)}-${opponentScore(headToHead, awayTeamLookup.data.id)} for ${awayTeamLookup.data.abbreviation}. Use it as context, not a full predictive answer.`
              : `The next tracked meeting lands on ${formatDateLabel(headToHead.date)}. Current records and last-10 form help frame the spot before richer team split data is connected.`,
          }
        : {
            ...base.data.swingFactor,
            summary: `${base.data.swingFactor.summary} Live form context: ${awayTeamLookup.data.abbreviation} ${awayLast10} last 10, ${homeTeamLookup.data.abbreviation} ${homeLast10} last 10.`,
          },
      sourceLabel: "Live records + scaffolded matchup board",
      teachingPoints: dedupe([
        ...base.data.teachingPoints,
        "This live pass updates team records and recent form, but the matchup pillars remain scaffolded until team-level shot and turnover splits are connected.",
      ]),
    },
    meta: mergeMeta([awayTeamLookup.meta, homeTeamLookup.meta, awaySeason.meta, homeSeason.meta], {
      notes: [
        "Live team records and recent-form context are sourced from BALLDONTLIE.",
        "Matchup pillar cards remain scaffolded because deeper team split data is not wired yet.",
      ],
      hydrationUsed: true,
    }),
  };
}

async function resolveLiveRestScheduleSpot(
  base: { data: RestScheduleDemoData; meta: Meta },
  teamKey: string,
  dataMode: DataMode,
): Promise<{ data: RestScheduleDemoData; meta: Meta }> {
  const teamLookup = await findNbaTeamByKey(teamKey, dataMode);
  if (!teamLookup.data) {
    return withDemoFallback(base, {
      warning: `Unknown NBA team key '${teamKey.toUpperCase()}'. Showing the demo schedule spot instead.`,
      notes: ["BALLDONTLIE team lookup failed for the requested rest/schedule widget team."],
    });
  }

  const teamInfo = teamLookup.data;
  const season = currentNbaSeason();
  const teamSeason = await getNbaTeamSeasonGames(teamInfo.id, season, dataMode);
  const nextGame = upcomingGames(teamSeason.data)[0] ?? null;
  if (!nextGame) {
    return withDemoFallback(base, {
      warning: `No upcoming NBA game was found for ${teamInfo.abbreviation}, so the widget stayed on the demo schedule spot.`,
      notes: ["BALLDONTLIE returned no upcoming game for the requested team."],
    });
  }

  const opponent = opponentForTeam(nextGame, teamInfo.id);
  const opponentSeason = await getNbaTeamSeasonGames(opponent.id, season, dataMode);
  const previousTeamGame = completedGames(teamSeason.data)
    .filter((game) => new Date(game.datetime ?? game.date).getTime() < new Date(nextGame.datetime ?? nextGame.date).getTime())
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())[0] ?? null;
  const previousOpponentGame = completedGames(opponentSeason.data)
    .filter((game) => new Date(game.datetime ?? game.date).getTime() < new Date(nextGame.datetime ?? nextGame.date).getTime())
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())[0] ?? null;

  const teamRestDays = restDaysBeforeGame(previousTeamGame, nextGame);
  const opponentRestDays = restDaysBeforeGame(previousOpponentGame, nextGame);
  const teamCountInFour = gamesInWindow(teamSeason.data, nextGame.date, 4);
  const opponentCountInFour = gamesInWindow(opponentSeason.data, nextGame.date, 4);
  const teamCountInSeven = gamesInWindow(teamSeason.data, nextGame.date, 7);
  const opponentCountInSeven = gamesInWindow(opponentSeason.data, nextGame.date, 7);
  const teamTravel = travelDescriptor(previousTeamGame, nextGame, teamInfo.id);
  const opponentTravel = travelDescriptor(previousOpponentGame, nextGame, opponent.id);

  const restEdge = compareAdvantage(teamRestDays, opponentRestDays);
  const densityEdge = compareAdvantage(teamCountInFour, opponentCountInFour, true);
  const travelEdge = compareAdvantage(teamTravel.stressScore, opponentTravel.stressScore, true);
  const score = [restEdge, densityEdge, travelEdge].reduce((total, edge) => {
    if (edge === "team") return total + 1;
    if (edge === "opponent") return total - 1;
    return total;
  }, 0);

  const signal = score >= 2 ? "positive" : score <= -2 ? "warning" : "neutral";
  const spotLabel = signal === "positive"
    ? "Rest edge"
    : signal === "warning"
      ? teamCountInFour >= 3
        ? "Dense stretch"
        : "Stress spot"
      : "Neutral rest";
  const sitePrefix = teamSide(nextGame, teamInfo.id) === "home" ? "vs" : "@";
  const teamRecord = buildRecord(teamSeason.data, teamInfo.id);
  const opponentRecord = buildRecord(opponentSeason.data, opponent.id);

  const recentCompleted = completedGames(teamSeason.data)
    .sort((left, right) => new Date(right.datetime ?? right.date).getTime() - new Date(left.datetime ?? left.date).getTime())
    .slice(0, 2)
    .reverse();
  const upcomingTeamGames = upcomingGames(teamSeason.data);

  return {
    data: {
      ...base.data,
      team: {
        key: teamInfo.abbreviation,
        name: teamInfo.full_name,
        record: teamRecord,
      },
      opponent: {
        key: opponent.abbreviation,
        name: opponent.full_name,
        record: opponentRecord,
      },
      spotLabel,
      signal,
      context: `Live schedule read for ${teamInfo.full_name}. The featured spot is ${sitePrefix} ${opponent.full_name} on ${formatDateLabel(nextGame.date)}.`,
      beginnerSummary:
        signal === "positive"
          ? `${teamInfo.full_name} has the cleaner rest setup than ${opponent.full_name}, with ${teamRestDays} day(s) off versus ${opponentRestDays}.`
          : signal === "warning"
            ? `${teamInfo.full_name} is in the tougher schedule spot than ${opponent.full_name}, so fatigue risk matters more than usual.`
            : `This looks like a more balanced schedule spot. Neither side owns a strong rest or travel edge going into ${formatDateLabel(nextGame.date)}.`,
      advancedSummary:
        `${teamInfo.abbreviation} enters on ${teamRestDays} rest day(s), ${densityLabel(teamCountInFour, teamCountInSeven).toLowerCase()}, and a '${teamTravel.label.toLowerCase()}' travel path. `
        + `${opponent.abbreviation} is at ${opponentRestDays} rest day(s), ${densityLabel(opponentCountInFour, opponentCountInSeven).toLowerCase()}, and '${opponentTravel.label.toLowerCase()}'.`,
      factors: [
        {
          label: "Rest days",
          teamValue: `${teamRestDays} day${teamRestDays === 1 ? "" : "s"} off`,
          opponentValue: `${opponentRestDays} day${opponentRestDays === 1 ? "" : "s"} off`,
          edge: restEdge,
          takeaway:
            restEdge === "team"
              ? `${teamInfo.abbreviation} has the fresher lead-in.`
              : restEdge === "opponent"
                ? `${opponent.abbreviation} gets the cleaner recovery window.`
                : "Both teams enter on similar rest.",
          whyItMatters: "Rest edges tend to show up first in defensive legs, late-clock creation, and lineup trust.",
        },
        {
          label: "Game density",
          teamValue: densityLabel(teamCountInFour, teamCountInSeven),
          opponentValue: densityLabel(opponentCountInFour, opponentCountInSeven),
          edge: densityEdge,
          takeaway:
            densityEdge === "team"
              ? `${teamInfo.abbreviation} has the lighter game-density load.`
              : densityEdge === "opponent"
                ? `${teamInfo.abbreviation} is carrying the denser recent stretch.`
                : "Both teams are on a similar recent cadence.",
          whyItMatters: "Compressed schedules reduce treatment and practice time, which can flatten shooting legs and bench stability.",
        },
        {
          label: "Travel path",
          teamValue: teamTravel.label,
          opponentValue: opponentTravel.label,
          edge: travelEdge,
          takeaway:
            travelEdge === "team"
              ? `${teamInfo.abbreviation} has the cleaner travel setup.`
              : travelEdge === "opponent"
                ? `${opponent.abbreviation} gets the easier venue path into this game.`
                : "Travel stress looks mostly even.",
          whyItMatters: "Venue changes matter because recovery time is about routine disruption as much as miles traveled.",
        },
      ],
      recentWindow: [
        ...recentCompleted.map((game) => ({
          dateLabel: formatDateLabel(game.date),
          site: teamSide(game, teamInfo.id) === "home" ? "vs" as const : "@" as const,
          opponent: opponentForTeam(game, teamInfo.id).abbreviation,
          result: `${teamScore(game, teamInfo.id) > opponentScore(game, teamInfo.id) ? "W" : "L"} ${teamScore(game, teamInfo.id)}-${opponentScore(game, teamInfo.id)}`,
          note: `Live schedule context from BALLDONTLIE on ${game.status}.`,
        })),
        {
          dateLabel: formatDateLabel(nextGame.date),
          site: sitePrefix,
          opponent: opponent.abbreviation,
          note: "Featured live schedule spot.",
        },
      ],
      nextWindow: upcomingTeamGames.slice(1, 3).map((game) => ({
        dateLabel: formatDateLabel(game.date),
        site: teamSide(game, teamInfo.id) === "home" ? "vs" as const : "@" as const,
        opponent: opponentForTeam(game, teamInfo.id).abbreviation,
        note: "Upcoming live schedule context from BALLDONTLIE.",
      })),
      teachingPoints: [
        "The cleanest schedule reads compare rest, game density, and travel together instead of treating every back-to-back the same.",
        "This live path teaches where the hidden schedule stress sits, even before deeper rotation data is connected.",
      ],
      sourceLabel: "Live schedule context",
    },
    meta: mergeMeta([teamLookup.meta, teamSeason.meta, opponentSeason.meta], {
      notes: [
        "Rest and schedule context are sourced live from BALLDONTLIE games and team data.",
      ],
    }),
  };
}

async function resolveLivePlayerRoleForm(
  base: { data: PlayerRoleFormDemoData; meta: Meta },
  args: { playerName: string; playerTeamKey?: string; dataMode: DataMode },
): Promise<{ data: PlayerRoleFormDemoData; meta: Meta }> {
  const playerMatch = await findBestNbaPlayerMatch(args.playerName, {
    teamKey: args.playerTeamKey,
    dataMode: args.dataMode,
  });

  if (!playerMatch.data) {
    return withDemoFallback(base, {
      warning: `No live NBA player match was found for '${args.playerName}'. Showing the demo player profile instead.`,
      notes: ["BALLDONTLIE player search returned no match for the requested name."],
    });
  }

  const livePlayer = playerMatch.data;
  const team = livePlayer.team;

  try {
    const [statsResponse, teamsResponse] = await Promise.all([
      getNbaPlayerSeasonStats(livePlayer.id, {
        season: currentNbaSeason(),
        dataMode: args.dataMode,
      }),
      getNbaTeams(args.dataMode),
    ]);

    if (statsResponse.data.length === 0) {
      throw new Error("BALLDONTLIE returned no player stat rows for the selected player.");
    }

    const recent = statsResponse.data.slice(0, 5);
    const seasonPts = averageStat(statsResponse.data, (row) => row.pts);
    const recentPts = averageStat(recent, (row) => row.pts);
    const seasonAst = averageStat(statsResponse.data, (row) => row.ast);
    const recentAst = averageStat(recent, (row) => row.ast);
    const seasonReb = averageStat(statsResponse.data, (row) => row.reb);
    const recentReb = averageStat(recent, (row) => row.reb);
    const seasonMin = averageStat(statsResponse.data, (row) => parseMinutes(row.min));
    const recentMin = averageStat(recent, (row) => parseMinutes(row.min));
    const form = recentPts >= seasonPts + 2.5 ? "hot" : recentPts <= seasonPts - 2.5 ? "cool" : "steady";
    const role = roleFromLiveProfile(livePlayer, statsResponse.data);
    const teamById = new Map(teamsResponse.data.map((row) => [row.id, row]));
    const livePosition = livePlayer.position || base.data.player.position;
    const positionForRole = livePosition.toUpperCase();

    return {
      data: {
        ...base.data,
        player: {
          fullName: playerFullName(livePlayer),
          teamKey: team?.abbreviation ?? args.playerTeamKey ?? base.data.player.teamKey,
          teamName: team?.full_name ?? base.data.player.teamName,
          position: livePosition,
          role: role.role,
          archetype: role.archetype,
        },
        form,
        context: `Live player lookup and current-season game stats are sourced from BALLDONTLIE for ${playerFullName(livePlayer)}.`,
        beginnerSummary:
          `${playerFullName(livePlayer)} is now running through a live role + form read. `
          + `Recent scoring sits at ${recentPts.toFixed(1)} points versus a ${seasonPts.toFixed(1)} season baseline, which frames the current form signal.`,
        advancedSummary:
          `${playerFullName(livePlayer)} carries ${seasonPts.toFixed(1)} PTS, ${seasonAst.toFixed(1)} AST, `
          + `and ${seasonMin.toFixed(1)} MIN on the season, versus ${recentPts.toFixed(1)}, ${recentAst.toFixed(1)}, and ${recentMin.toFixed(1)} over the latest five-game window.`,
        metrics: [
          {
            label: "Scoring load",
            seasonValue: `${seasonPts.toFixed(1)} PTS`,
            recentValue: `${recentPts.toFixed(1)} PTS`,
            trend: trendFromDelta(recentPts, seasonPts, 2),
            takeaway: "Scoring volume helps separate a true usage lift from a short hot-shooting stretch.",
          },
          {
            label: positionForRole.includes("C") ? "Rebounding load" : "Playmaking load",
            seasonValue: positionForRole.includes("C")
              ? `${seasonReb.toFixed(1)} REB`
              : `${seasonAst.toFixed(1)} AST`,
            recentValue: positionForRole.includes("C")
              ? `${recentReb.toFixed(1)} REB`
              : `${recentAst.toFixed(1)} AST`,
            trend: positionForRole.includes("C")
              ? trendFromDelta(recentReb, seasonReb, 1)
              : trendFromDelta(recentAst, seasonAst, 1),
            takeaway: "Supporting metrics show whether the role shift is just scoring or a broader change in responsibility.",
          },
          {
            label: "Minutes",
            seasonValue: `${seasonMin.toFixed(1)} MIN`,
            recentValue: `${recentMin.toFixed(1)} MIN`,
            trend: trendFromDelta(recentMin, seasonMin, 2),
            takeaway: "Minutes are the cleanest proxy for lineup trust when a player is healthy and active.",
          },
        ],
        roleSignals: [
          {
            label: "Role tag",
            value: role.role,
            explanation: "This label is inferred from current-season scoring, passing, rebounding, and position context.",
          },
          {
            label: "Team context",
            value: team?.abbreviation ?? args.playerTeamKey ?? "-",
            explanation: "Team context helps anchor the role read when similar player names exist across seasons.",
          },
          {
            label: "Recent form",
            value: form === "hot" ? "Above baseline" : form === "cool" ? "Below baseline" : "Near baseline",
            explanation: "Form is measured against the season baseline rather than a single-game spike.",
          },
        ],
        recentGames: recent.slice(0, 3).map((row) => {
          const playerTeamId = row.team?.id ?? livePlayer.team?.id ?? livePlayer.team_id ?? 0;
          const opponentId = row.game.home_team_id === playerTeamId ? row.game.visitor_team_id : row.game.home_team_id;
          const opponentTeam = teamById.get(opponentId);
          return {
            dateLabel: formatDateLabel(row.game.date),
            opponent: opponentTeam?.abbreviation ?? `Team ${opponentId}`,
            line: `${row.pts} PTS, ${row.ast} AST, ${row.reb} REB`,
            roleNote: `${parseMinutes(row.min).toFixed(1)} minutes from the live BALLDONTLIE game log.`,
          };
        }),
        teachingPoints: [
          "Live role reads get more trustworthy when recent production is compared to the season baseline instead of raw game highs.",
          "Minutes and secondary stats help explain whether a scoring spike came from a real role change or just shot variance.",
        ],
        sourceLabel: "Live player form",
      },
      meta: mergeMeta([playerMatch.meta, statsResponse.meta, teamsResponse.meta], {
        notes: [
          "Player lookup and current-season game stats are sourced live from BALLDONTLIE.",
        ],
      }),
    };
  } catch (error) {
    const fallbackRole = roleFromPositionOnly(livePlayer);
    return {
      data: {
        ...base.data,
        player: {
          fullName: playerFullName(livePlayer),
          teamKey: team?.abbreviation ?? args.playerTeamKey ?? base.data.player.teamKey,
          teamName: team?.full_name ?? base.data.player.teamName,
          position: livePlayer.position || base.data.player.position,
          role: fallbackRole.role,
          archetype: fallbackRole.archetype,
        },
        form: "steady",
        context: `Live BALLDONTLIE player lookup found ${playerFullName(livePlayer)}, but the current key did not expose game stats for a full recent-form read.`,
        beginnerSummary:
          `${playerFullName(livePlayer)} was found live on ${team?.full_name ?? "an NBA roster"}, but recent-form numbers are unavailable on the current BALLDONTLIE plan.`,
        advancedSummary:
          `The live path resolved ${playerFullName(livePlayer)} through BALLDONTLIE's player directory, but the stats endpoint was unavailable for this key. `
          + "The widget stays honest by showing roster context without inventing recent production trends.",
        metrics: [
          {
            label: "Live data status",
            seasonValue: "Player profile found",
            recentValue: "Game stats unavailable",
            trend: "steady",
            takeaway: "The current key can verify roster identity, but not recent box-score form.",
          },
          {
            label: "Position",
            seasonValue: livePlayer.position || "-",
            recentValue: team?.abbreviation ?? args.playerTeamKey ?? "-",
            trend: "steady",
            takeaway: "Position and team context help frame the role, but not the current form signal.",
          },
          {
            label: "Next upgrade",
            seasonValue: "Enable BALLDONTLIE stats",
            recentValue: "Reload this player",
            trend: "steady",
            takeaway: "A richer role + form read needs live minutes and box-score trends.",
          },
        ],
        roleSignals: [
          {
            label: "Roster context",
            value: fallbackRole.role,
            explanation: "This is a roster-level role read based on position only.",
          },
          {
            label: "Team",
            value: team?.abbreviation ?? args.playerTeamKey ?? "-",
            explanation: "The live player directory still confirms current team context.",
          },
          {
            label: "Data gap",
            value: "Stats tier unavailable",
            explanation: "The current BALLDONTLIE key does not expose the player game-log data needed for form trends.",
          },
        ],
        recentGames: [],
        teachingPoints: [
          "Roster context and form are different things. A player can be identified live without the stats access needed to measure recent trend.",
          "This honest fallback keeps the widget usable while showing exactly what the current data tier cannot support yet.",
        ],
        sourceLabel: "Live player lookup",
      },
      meta: mergeMeta([playerMatch.meta], {
        warning: String(error),
        notes: [
          "BALLDONTLIE player lookup succeeded, but the game-stats endpoint was unavailable for the current key.",
        ],
      }),
    };
  }
}

export async function resolveNbaTeamMatchupProfile(args: {
  scenarioId?: string;
  dataMode: DataMode;
}) {
  const base = getNbaTeamMatchupProfileDemo(args.scenarioId, args.dataMode);
  const live = liveAvailability(args.dataMode);
  if (!live.enabled) {
    return live.warning
      ? withDemoFallback(base, {
          warning: live.warning,
          notes: ["The NBA matchup profile stayed on the scaffold because BALLDONTLIE was not available."],
        })
      : base;
  }

  try {
    return await resolveLiveTeamMatchupProfile(base, args.dataMode);
  } catch (error) {
    return withDemoFallback(base, {
      warning: `Live matchup enrichment failed, so the widget fell back to the demo board. ${String(error)}`,
      notes: ["BALLDONTLIE live matchup enrichment failed during resolver execution."],
    });
  }
}

export async function resolveNbaRestScheduleSpot(args: {
  scenarioId?: string;
  teamKey?: string;
  dataMode: DataMode;
}) {
  const base = getNbaRestScheduleSpotDemo(args.scenarioId, args.dataMode);
  const live = liveAvailability(args.dataMode);
  const requestedTeamKey = args.teamKey?.trim().toUpperCase();

  if (!requestedTeamKey) {
    return base;
  }

  if (!live.enabled) {
    return withDemoFallback(base, {
      warning: live.warning ?? `BALL_DONT_LIE_KEY is not configured, so live schedule data is unavailable for ${requestedTeamKey}. Showing the demo schedule spot instead.`,
      notes: ["The NBA rest/schedule widget stayed on the scaffold because BALLDONTLIE was not available."],
    });
  }

  try {
    return await resolveLiveRestScheduleSpot(base, requestedTeamKey, args.dataMode);
  } catch (error) {
    return withDemoFallback(base, {
      warning: `Live schedule enrichment failed for ${requestedTeamKey}, so the widget fell back to the demo spot. ${String(error)}`,
      notes: ["BALLDONTLIE live rest/schedule enrichment failed during resolver execution."],
    });
  }
}

export async function resolveNbaPlayerRoleForm(args: {
  scenarioId?: string;
  playerName?: string;
  playerTeamKey?: string;
  dataMode: DataMode;
}) {
  const base = getNbaPlayerRoleFormDemo(args.scenarioId, args.dataMode);
  const live = liveAvailability(args.dataMode);
  const requestedPlayerName = args.playerName?.trim();

  if (!requestedPlayerName) {
    return base;
  }

  if (!live.enabled) {
    return withDemoFallback(base, {
      warning: live.warning ?? `BALL_DONT_LIE_KEY is not configured, so live player data is unavailable for ${requestedPlayerName}. Showing the demo player card instead.`,
      notes: ["The NBA player-role widget stayed on the scaffold because BALLDONTLIE was not available."],
    });
  }

  try {
    return await resolveLivePlayerRoleForm(base, {
      playerName: requestedPlayerName,
      playerTeamKey: args.playerTeamKey?.trim().toUpperCase() || undefined,
      dataMode: args.dataMode,
    });
  } catch (error) {
    return withDemoFallback(base, {
      warning: `Live player enrichment failed for ${requestedPlayerName}, so the widget fell back to the demo profile. ${String(error)}`,
      notes: ["BALLDONTLIE live player-role enrichment failed during resolver execution."],
    });
  }
}
