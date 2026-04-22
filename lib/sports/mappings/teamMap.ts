import type { Team } from "@/lib/sports/models";
import { MLB_TEAMS } from "@/lib/providers/mlb/MLB_TEAMS";

type LeagueKey = "NFL" | "NBA" | "MLB";
type TeamMapByLeague = Record<LeagueKey, Record<string, Team>>;

function canonicalId(league: LeagueKey, abbreviation: string): string {
  return `${league.toLowerCase()}-${abbreviation.toLowerCase()}`;
}

function team(
  league: LeagueKey,
  abbreviation: string,
  name: string,
  city: string,
  providerIds: { apiSports?: string | number; espn?: string | number },
  aliases: string[],
): Team {
  return {
    id: canonicalId(league, abbreviation),
    league,
    name,
    city,
    abbreviation,
    aliases,
    providerIds: {
      ...providerIds,
      internal: canonicalId(league, abbreviation),
    },
  };
}

const MLB_VERIFIED_PROVIDER_IDS: Record<string, { apiSports?: string; espn?: string }> = {
  NYM: { apiSports: "22", espn: "25" },
  LAD: { apiSports: "15", espn: "19" },
  SEA: { apiSports: "12", espn: "12" },
};

const MLB_ALIASES: Record<string, string[]> = {
  NYY: ["yankees", "new york yankees"],
  BOS: ["red sox", "boston red sox"],
  TBR: ["rays", "tampa bay rays"],
  TOR: ["blue jays", "toronto blue jays"],
  BAL: ["orioles", "baltimore orioles"],
  CLE: ["guardians", "cleveland guardians"],
  CWS: ["white sox", "chicago white sox"],
  DET: ["tigers", "detroit tigers"],
  KCR: ["royals", "kansas city royals"],
  MIN: ["twins", "minnesota twins"],
  HOU: ["astros", "houston astros"],
  LAA: ["angels", "los angeles angels"],
  OAK: ["athletics", "oakland athletics"],
  SEA: ["mariners", "seattle mariners"],
  TEX: ["rangers", "texas rangers"],
  ATL: ["braves", "atlanta braves"],
  MIA: ["marlins", "miami marlins"],
  NYM: ["mets", "new york mets"],
  PHI: ["phillies", "philadelphia phillies"],
  WSN: ["nationals", "washington nationals"],
  CHC: ["cubs", "chicago cubs"],
  CIN: ["reds", "cincinnati reds"],
  MIL: ["brewers", "milwaukee brewers"],
  PIT: ["pirates", "pittsburgh pirates"],
  STL: ["cardinals", "st. louis cardinals"],
  ARI: ["diamondbacks", "arizona diamondbacks"],
  COL: ["rockies", "colorado rockies"],
  LAD: ["dodgers", "los angeles dodgers"],
  SDP: ["padres", "san diego padres"],
  SFG: ["giants", "san francisco giants"],
};

const MLB_TEAM_ENTRIES: Record<string, Team> = Object.fromEntries(
  MLB_TEAMS.map((t) => [
    t.key,
    team("MLB", t.key, t.name, t.city, MLB_VERIFIED_PROVIDER_IDS[t.key] ?? {}, MLB_ALIASES[t.key] ?? []),
  ]),
);

const TEAM_MAP: TeamMapByLeague = {
  NFL: {
    NYJ: team("NFL", "NYJ", "New York Jets", "New York", { apiSports: "20", espn: "20" }, ["jets", "new york jets", "ny jets"]),
    BUF: team("NFL", "BUF", "Buffalo Bills", "Buffalo", { apiSports: "4", espn: "2" }, ["bills", "buffalo bills"]),
    KC: team("NFL", "KC", "Kansas City Chiefs", "Kansas City", { apiSports: "15", espn: "12" }, ["chiefs", "kansas city chiefs"]),
  },
  NBA: {
    LAL: team("NBA", "LAL", "Los Angeles Lakers", "Los Angeles", { apiSports: "13", espn: "13" }, ["lakers", "los angeles lakers"]),
    NYK: team("NBA", "NYK", "New York Knicks", "New York", { apiSports: "24", espn: "18" }, ["knicks", "new york knicks", "new york"]),
    BOS: team("NBA", "BOS", "Boston Celtics", "Boston", { apiSports: "2", espn: "2" }, ["celtics", "boston celtics"]),
  },
  MLB: MLB_TEAM_ENTRIES,
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeLeague(value: string | undefined): LeagueKey {
  const upper = (value ?? "NFL").trim().toUpperCase();
  if (upper === "MLB" || upper === "NBA" || upper === "NFL") {
    return upper;
  }
  return "NFL";
}

export function findTeamByAbbreviation(leagueInput: string, abbreviation: string): Team | null {
  const league = normalizeLeague(leagueInput);
  const key = abbreviation.trim().toUpperCase();
  return TEAM_MAP[league][key] ?? null;
}

export function findTeamByAlias(leagueInput: string, aliasOrName: string): Team | null {
  const league = normalizeLeague(leagueInput);
  const needle = normalize(aliasOrName);
  if (!needle) {
    return null;
  }

  for (const row of Object.values(TEAM_MAP[league])) {
    const aliases = [row.abbreviation, row.name, row.city ?? "", ...(row.aliases ?? [])];
    if (aliases.some((alias) => normalize(alias) === needle)) {
      return row;
    }
  }
  return null;
}

export function findTeamByProviderId(
  leagueInput: string,
  provider: "apiSports" | "espn",
  providerId: string | number | undefined,
): Team | null {
  if (providerId === undefined || providerId === null) {
    return null;
  }
  const league = normalizeLeague(leagueInput);
  const normalizedId = String(providerId);
  for (const row of Object.values(TEAM_MAP[league])) {
    if (row.providerIds?.[provider] !== undefined && String(row.providerIds[provider]) === normalizedId) {
      return row;
    }
  }
  return null;
}

export function resolveCanonicalTeam(input: {
  league: string;
  abbreviation?: string;
  name?: string;
  apiSportsTeamId?: string | number;
  espnTeamId?: string | number;
  logoUrl?: string;
}): Team {
  const league = normalizeLeague(input.league);

  const byProvider = findTeamByProviderId(league, "apiSports", input.apiSportsTeamId)
    ?? findTeamByProviderId(league, "espn", input.espnTeamId);
  const byAbbreviation = input.abbreviation ? findTeamByAbbreviation(league, input.abbreviation) : null;
  const byAlias = input.name ? findTeamByAlias(league, input.name) : null;
  const hit = byProvider ?? byAbbreviation ?? byAlias;
  if (hit) {
    return {
      ...hit,
      logoUrl: input.logoUrl ?? hit.logoUrl,
      providerIds: {
        ...hit.providerIds,
        apiSports: input.apiSportsTeamId ?? hit.providerIds?.apiSports,
        espn: input.espnTeamId ?? hit.providerIds?.espn,
      },
    };
  }

  const abbreviation = (input.abbreviation ?? input.name ?? "TEAM")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 4) || "TEAM";
  const name = input.name?.trim() || abbreviation;
  return {
    id: canonicalId(league, abbreviation),
    league,
    name,
    abbreviation,
    providerIds: {
      apiSports: input.apiSportsTeamId,
      espn: input.espnTeamId,
      internal: canonicalId(league, abbreviation),
    },
    logoUrl: input.logoUrl,
  };
}

export function getTeamMap(): TeamMapByLeague {
  return TEAM_MAP;
}
