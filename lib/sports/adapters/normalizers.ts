import type { Game, Player, StandingsRow, Team } from "@/lib/sports/models";
import { resolveCanonicalTeam } from "@/lib/sports/mappings/teamMap";

type UnknownObject = Record<string, unknown>;

function asObject(value: unknown): UnknownObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownObject) : null;
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

function toIso(value: unknown): string {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value > 1_000_000_000_000 ? value : value * 1000);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function deriveName(fullName: string): { firstName?: string; lastName?: string } {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return {};
  }
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function normalizeTeamFromApiSports(row: unknown, leagueInput: string): Team {
  const source = asObject(row) ?? {};
  const team = asObject(source.team) ?? source;
  return resolveCanonicalTeam({
    league: leagueInput,
    abbreviation: readString(team.code) ?? readString(team.abbreviation) ?? readString(source.teamKey),
    name: readString(team.name) ?? readString(source.displayName) ?? readString(source.teamName),
    apiSportsTeamId: readString(team.id) ?? readNumber(team.id) ?? readString(source.apiSportsTeamId),
    espnTeamId: readString(source.espnTeamId),
    logoUrl: readString(team.logo) ?? readString(source.logo),
  });
}

export function normalizeTeamFromEspn(row: unknown, leagueInput: string): Team {
  const source = asObject(row) ?? {};
  const team = asObject(source.team) ?? source;
  return resolveCanonicalTeam({
    league: leagueInput,
    abbreviation: readString(team.abbreviation) ?? readString(source.teamKey) ?? readString(source.abbreviation),
    name: readString(team.displayName) ?? readString(team.name) ?? readString(source.displayName),
    apiSportsTeamId: readString(source.apiSportsTeamId),
    espnTeamId: readString(team.id) ?? readNumber(team.id) ?? readString(source.espnTeamId),
    logoUrl: readString(source.logo),
  });
}

export function normalizePlayerFromApiSports(row: unknown, leagueInput: string): Player {
  const source = asObject(row) ?? {};
  const playerObj = asObject(source.player) ?? source;
  const stats = Array.isArray(source.statistics) ? source.statistics : [];
  const gamesStats = stats
    .map((stat) => asObject(stat))
    .map((stat) => asObject(stat?.games))
    .find((games) => Boolean(games));
  const fullName = readString(playerObj.name)
    ?? readString(source.fullName)
    ?? [readString(playerObj.firstname), readString(playerObj.lastname)].filter(Boolean).join(" ")
    ?? "Unknown Player";

  const team = normalizeTeamFromApiSports(source, leagueInput);
  const id = readString(playerObj.id) ?? readNumber(playerObj.id)?.toString() ?? readString(source.playerId) ?? `player-${fullName.toLowerCase().replace(/\s+/g, "-")}`;
  const names = deriveName(fullName);

  return {
    id: `${String(leagueInput).toLowerCase()}-${id}`,
    league: leagueInput.toUpperCase(),
    teamId: team.id,
    fullName,
    firstName: readString(playerObj.firstname) ?? names.firstName,
    lastName: readString(playerObj.lastname) ?? names.lastName,
    displayName: readString(source.displayName) ?? fullName,
    jersey: readString(source.jersey)
      ?? readString(playerObj.number)
      ?? readString(gamesStats?.number)
      ?? readNumber(source.jersey),
    position: readString(source.position) ?? readString(gamesStats?.position),
    status: readString(source.status),
    headshotUrl: readString(playerObj.photo) ?? readString(source.headshot) ?? readString(source.headshotUrl),
    providerIds: {
      apiSports: readString(playerObj.id) ?? readNumber(playerObj.id),
      espn: readString(source.espnPlayerId),
      internal: `${String(leagueInput).toLowerCase()}-${id}`,
    },
  };
}

export function normalizePlayerFromEspn(row: unknown, leagueInput: string): Player {
  const source = asObject(row) ?? {};
  const athlete = asObject(source.athlete) ?? source;
  const fullName = readString(athlete.fullName) ?? readString(athlete.displayName) ?? readString(source.fullName) ?? "Unknown Player";
  const names = deriveName(fullName);
  const team = resolveCanonicalTeam({
    league: leagueInput,
    abbreviation: readString(source.teamAbbr) ?? readString(source.teamKey) ?? readString(asObject(athlete.team)?.abbreviation),
    name: readString(source.teamName) ?? readString(asObject(athlete.team)?.displayName),
    espnTeamId: readString(source.espnTeamId),
    apiSportsTeamId: readString(source.apiSportsTeamId),
    logoUrl: readString(source.teamLogoUrl),
  });
  const playerId = readString(athlete.id) ?? readString(source.playerId) ?? `player-${fullName.toLowerCase().replace(/\s+/g, "-")}`;

  return {
    id: `${String(leagueInput).toLowerCase()}-${playerId}`,
    league: leagueInput.toUpperCase(),
    teamId: team.id,
    fullName,
    firstName: readString(athlete.firstName) ?? names.firstName,
    lastName: readString(athlete.lastName) ?? names.lastName,
    displayName: readString(athlete.displayName) ?? fullName,
    jersey: readString(athlete.jersey) ?? readString(source.jersey),
    position: readString(source.position) ?? readString(asObject(athlete.position)?.abbreviation),
    status: readString(source.status),
    headshotUrl: readString(asObject(athlete.headshot)?.href) ?? readString(source.headshot) ?? readString(source.headshotUrl),
    providerIds: {
      apiSports: readString(source.apiSportsPlayerId),
      espn: readString(athlete.id) ?? readString(source.playerId),
      internal: `${String(leagueInput).toLowerCase()}-${playerId}`,
    },
  };
}

export function normalizeGameFromApiSports(row: unknown, leagueInput: string): Game {
  const source = asObject(row) ?? {};
  const teams = asObject(source.teams);
  const home = asObject(teams?.home);
  const away = asObject(teams?.away) ?? asObject(teams?.visitors);
  const homeTeam = normalizeTeamFromApiSports({ team: home }, leagueInput);
  const awayTeam = normalizeTeamFromApiSports({ team: away }, leagueInput);
  const status = asObject(source.status);
  const date = asObject(source.date);
  const scores = asObject(source.scores);
  const homeScore = readNumber(asObject(scores?.home)?.total) ?? readNumber(asObject(scores?.home)?.points);
  const awayScore = readNumber(asObject(scores?.away)?.total) ?? readNumber(asObject(scores?.away)?.points)
    ?? readNumber(asObject(scores?.visitors)?.total);
  const gameId = readString(source.id) ?? readNumber(source.id)?.toString() ?? `${homeTeam.abbreviation}-${awayTeam.abbreviation}-${toIso(date?.start ?? source.date)}`;

  return {
    id: `${String(leagueInput).toLowerCase()}-${gameId}`,
    league: leagueInput.toUpperCase(),
    season: readString(asObject(source.league)?.season) ?? readNumber(asObject(source.league)?.season),
    startTime: toIso(date?.start ?? date?.timestamp ?? source.date),
    timezone: readString(date?.timezone),
    status: (readString(status?.short) ?? "scheduled").toLowerCase(),
    displayStatus: readString(status?.long) ?? readString(status?.short),
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeScore,
    awayScore,
    venue: readString(asObject(source.venue)?.name),
    sourceMeta: {
      provider: "apiSports",
      providerGameId: readString(source.id) ?? readNumber(source.id),
    },
  };
}

export function normalizeGameFromEspn(row: unknown, leagueInput: string): Game {
  const source = asObject(row) ?? {};
  const competition = asObject((Array.isArray(source.competitions) ? source.competitions[0] : null));
  const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
  const homeCompetitor = asObject(competitors.find((item) => asObject(item)?.homeAway === "home"));
  const awayCompetitor = asObject(competitors.find((item) => asObject(item)?.homeAway === "away"));
  const homeTeamObj = asObject(homeCompetitor?.team);
  const awayTeamObj = asObject(awayCompetitor?.team);
  const homeTeam = normalizeTeamFromEspn({
    team: homeTeamObj,
    abbreviation: readString(homeTeamObj?.abbreviation),
    displayName: readString(homeTeamObj?.displayName),
    espnTeamId: readString(homeTeamObj?.id),
  }, leagueInput);
  const awayTeam = normalizeTeamFromEspn({
    team: awayTeamObj,
    abbreviation: readString(awayTeamObj?.abbreviation),
    displayName: readString(awayTeamObj?.displayName),
    espnTeamId: readString(awayTeamObj?.id),
  }, leagueInput);
  const statusObj = asObject(source.status);
  const statusType = asObject(statusObj?.type);
  const gameId = readString(source.id) ?? `${homeTeam.abbreviation}-${awayTeam.abbreviation}-${toIso(source.date)}`;

  return {
    id: `${String(leagueInput).toLowerCase()}-${gameId}`,
    league: leagueInput.toUpperCase(),
    season: readNumber(asObject(source.season)?.year) ?? readString(asObject(source.season)?.year),
    startTime: toIso(source.date),
    status: (readString(statusType?.state) ?? readString(statusType?.name) ?? "scheduled").toLowerCase(),
    displayStatus: readString(statusType?.detail) ?? readString(statusType?.description),
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeScore: readNumber(homeCompetitor?.score),
    awayScore: readNumber(awayCompetitor?.score),
    venue: readString(asObject(asObject(competition?.venue)?.fullAddress)?.city),
    sourceMeta: {
      provider: "espn",
      providerGameId: readString(source.id),
    },
  };
}

export function normalizeStandingsRowFromApiSports(row: unknown, leagueInput: string): StandingsRow {
  const source = asObject(row) ?? {};
  const team = normalizeTeamFromApiSports(source, leagueInput);
  const all = asObject(source.all);
  const league = asObject(source.league);
  const standings = asObject(league?.standings);
  return {
    teamId: team.id,
    league: leagueInput.toUpperCase(),
    rank: readNumber(standings?.position),
    wins: readNumber(all?.win),
    losses: readNumber(all?.lose),
    pct: readString(all?.percentage) ?? readNumber(all?.percentage),
    gb: readString(source.gamesBehind),
    division: readString(standings?.group) ?? readString(standings?.division),
    conference: readString(standings?.conference),
    streak: readString(all?.streak),
  };
}

export function normalizeStandingsRowFromEspn(row: unknown, leagueInput: string): StandingsRow {
  const source = asObject(row) ?? {};
  const team = normalizeTeamFromEspn(asObject(source.team) ?? source, leagueInput);
  const stats = Array.isArray(source.stats) ? source.stats : [];
  const findStat = (...keys: string[]): UnknownObject | null => {
    for (const stat of stats) {
      const typed = asObject(stat);
      if (!typed) {
        continue;
      }
      const candidates = [
        readString(typed.name)?.toLowerCase(),
        readString(typed.type)?.toLowerCase(),
        readString(typed.abbreviation)?.toLowerCase(),
      ].filter(Boolean) as string[];
      if (candidates.some((candidate) => keys.includes(candidate))) {
        return typed;
      }
    }
    return null;
  };

  const wins = findStat("wins", "w");
  const losses = findStat("losses", "l");
  const pct = findStat("winpercent", "pct", "wpct");
  const rank = findStat("rank", "seed", "playoffseed");
  const gb = findStat("gamesbehind", "gb");
  const streak = findStat("streak", "strk");

  return {
    teamId: team.id,
    league: leagueInput.toUpperCase(),
    rank: readNumber(rank?.value) ?? readNumber(rank?.displayValue),
    wins: readNumber(wins?.value),
    losses: readNumber(losses?.value),
    pct: readNumber(pct?.value) ?? readString(pct?.displayValue),
    gb: readNumber(gb?.value) ?? readString(gb?.displayValue),
    streak: readString(streak?.displayValue),
  };
}
