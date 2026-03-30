import { findStatGlossaryEntry } from "@/lib/stats/glossary";
import type { StatLeader, StatSport } from "@/lib/stats/types";

type MlbLeaderDefinition = {
  live: {
    category: string;
    statGroup: "hitting" | "pitching";
  };
  fallback: FallbackLeaderSnapshot;
};

type FallbackOnlyLeaderDefinition = {
  fallback: FallbackLeaderSnapshot;
};

export type StatLeaderDefinition = MlbLeaderDefinition | FallbackOnlyLeaderDefinition;

export type FallbackLeaderSnapshot = {
  season: number;
  updatedAt: string;
  leaders: StatLeader[];
};

const SNAPSHOT_UPDATED_AT = "2026-03-30T12:00:00.000Z";

function fallbackSnapshot(season: number, leaders: StatLeader[]): FallbackLeaderSnapshot {
  return {
    season,
    updatedAt: SNAPSHOT_UPDATED_AT,
    leaders,
  };
}

const LEADER_DEFINITIONS: Record<string, StatLeaderDefinition> = {
  "MLB:ERA": {
    live: { category: "earnedRunAverage", statGroup: "pitching" },
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Andrew Abbott", team: "Cincinnati Reds", value: "0.00" },
      { rank: 1, playerName: "Sandy Alcantara", team: "Miami Marlins", value: "0.00" },
      { rank: 1, playerName: "Grant Anderson", team: "Milwaukee Brewers", value: "0.00" },
      { rank: 1, playerName: "Hunter Brown", team: "Houston Astros", value: "0.00" },
      { rank: 1, playerName: "Garrett Crochet", team: "Boston Red Sox", value: "0.00" },
    ]),
  },
  "MLB:WHIP": {
    live: { category: "whip", statGroup: "pitching" },
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Kevin Gausman", team: "Toronto Blue Jays", value: "0.17" },
      { rank: 1, playerName: "Emerson Hancock", team: "Seattle Mariners", value: "0.17" },
      { rank: 3, playerName: "Cam Schlittler", team: "New York Yankees", value: "0.19" },
      { rank: 4, playerName: "Jacob Latz", team: "Texas Rangers", value: "0.25" },
      { rank: 5, playerName: "Michael McGreevy", team: "St. Louis Cardinals", value: "0.33" },
    ]),
  },
  "MLB:AVG": {
    live: { category: "battingAverage", statGroup: "hitting" },
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Sal Stewart", team: "Cincinnati Reds", value: ".700" },
      { rank: 2, playerName: "Christian Yelich", team: "Milwaukee Brewers", value: ".600" },
      { rank: 3, playerName: "Yandy Diaz", team: "Tampa Bay Rays", value: ".563" },
      { rank: 4, playerName: "Ben Williamson", team: "Tampa Bay Rays", value: ".556" },
      { rank: 5, playerName: "Andres Gimenez", team: "Toronto Blue Jays", value: ".545" },
    ]),
  },
  "MLB:OBP": {
    live: { category: "onBasePercentage", statGroup: "hitting" },
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Sal Stewart", team: "Cincinnati Reds", value: ".769" },
      { rank: 2, playerName: "Mike Trout", team: "Los Angeles Angels", value: ".650" },
      { rank: 3, playerName: "Christian Yelich", team: "Milwaukee Brewers", value: ".636" },
      { rank: 4, playerName: "David Hamilton", team: "Milwaukee Brewers", value: ".625" },
      { rank: 4, playerName: "Garrett Mitchell", team: "Milwaukee Brewers", value: ".625" },
    ]),
  },
  "MLB:SLG": {
    live: { category: "sluggingPercentage", statGroup: "hitting" },
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Munetaka Murakami", team: "Chicago White Sox", value: "1.333" },
      { rank: 2, playerName: "Sal Stewart", team: "Cincinnati Reds", value: "1.300" },
      { rank: 3, playerName: "Shea Langeliers", team: "Athletics", value: "1.250" },
      { rank: 3, playerName: "Brandon Lowe", team: "Pittsburgh Pirates", value: "1.250" },
      { rank: 5, playerName: "Wilyer Abreu", team: "Boston Red Sox", value: "1.077" },
    ]),
  },
  "MLB:OPS": {
    live: { category: "ops", statGroup: "hitting" },
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Sal Stewart", team: "Cincinnati Reds", value: "2.069" },
      { rank: 2, playerName: "Munetaka Murakami", team: "Chicago White Sox", value: "1.871" },
      { rank: 3, playerName: "Shea Langeliers", team: "Athletics", value: "1.788" },
      { rank: 4, playerName: "Brandon Lowe", team: "Pittsburgh Pirates", value: "1.750" },
      { rank: 5, playerName: "Mike Trout", team: "Los Angeles Angels", value: "1.573" },
    ]),
  },
  "MLB:K/9": {
    live: { category: "strikeoutsPer9Inn", statGroup: "pitching" },
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Dylan Cease", team: "Toronto Blue Jays", value: "20.25" },
      { rank: 2, playerName: "Jacob Misiorowski", team: "Milwaukee Brewers", value: "19.80" },
      { rank: 3, playerName: "Taj Bradley", team: "Minnesota Twins", value: "18.69" },
      { rank: 4, playerName: "Hunter Brown", team: "Houston Astros", value: "17.36" },
      { rank: 4, playerName: "Reid Detmers", team: "Los Angeles Angels", value: "17.36" },
    ]),
  },
  "MLB:BB/9": {
    live: { category: "walksPer9Inn", statGroup: "pitching" },
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Shane Baz", team: "Baltimore Orioles", value: "0.00" },
      { rank: 1, playerName: "AJ Blubaugh", team: "Houston Astros", value: "0.00" },
      { rank: 1, playerName: "Joe Boyle", team: "Tampa Bay Rays", value: "0.00" },
      { rank: 1, playerName: "Reid Detmers", team: "Los Angeles Angels", value: "0.00" },
      { rank: 1, playerName: "Nathan Eovaldi", team: "Texas Rangers", value: "0.00" },
    ]),
  },
  "NBA:PPG": {
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Luka Doncic", team: "LAL", value: "33.6" },
      { rank: 2, playerName: "Shai Gilgeous-Alexander", team: "OKC", value: "31.5" },
      { rank: 3, playerName: "Anthony Edwards", team: "MIN", value: "29.5" },
      { rank: 4, playerName: "Tyrese Maxey", team: "PHI", value: "29.0" },
      { rank: 5, playerName: "Jaylen Brown", team: "BOS", value: "28.6" },
    ]),
  },
  "NBA:RPG": {
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Nikola Jokic", team: "DEN", value: "12.8" },
      { rank: 2, playerName: "Karl-Anthony Towns", team: "NYK", value: "11.9" },
      { rank: 3, playerName: "Donovan Clingan", team: "POR", value: "11.8" },
      { rank: 4, playerName: "Rudy Gobert", team: "MIN", value: "11.5" },
      { rank: 5, playerName: "Victor Wembanyama", team: "SAS", value: "11.2" },
    ]),
  },
  "NBA:APG": {
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Nikola Jokic", team: "DEN", value: "10.8" },
      { rank: 2, playerName: "Cade Cunningham", team: "DET", value: "9.9" },
      { rank: 3, playerName: "Luka Doncic", team: "LAL", value: "8.3" },
      { rank: 4, playerName: "Jalen Johnson", team: "ATL", value: "8.1" },
      { rank: 5, playerName: "James Harden", team: "CLE", value: "8.0" },
    ]),
  },
  "NBA:SPG": {
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Tyrese Maxey", team: "PHI", value: "2.0" },
      { rank: 2, playerName: "Cason Wallace", team: "OKC", value: "2.0" },
      { rank: 3, playerName: "Ausar Thompson", team: "DET", value: "2.0" },
      { rank: 4, playerName: "Kawhi Leonard", team: "LAC", value: "2.0" },
      { rank: 5, playerName: "Dyson Daniels", team: "ATL", value: "1.9" },
    ]),
  },
  "NBA:BPG": {
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Victor Wembanyama", team: "SAS", value: "3.1" },
      { rank: 2, playerName: "Chet Holmgren", team: "OKC", value: "1.9" },
      { rank: 3, playerName: "Jay Huff", team: "IND", value: "1.8" },
      { rank: 4, playerName: "Evan Mobley", team: "CLE", value: "1.8" },
      { rank: 5, playerName: "Rudy Gobert", team: "MIN", value: "1.7" },
    ]),
  },
  "NBA:Win %": {
    fallback: fallbackSnapshot(2026, [
      { rank: 1, playerName: "Oklahoma City Thunder", team: "OKC", value: ".787" },
      { rank: 2, playerName: "San Antonio Spurs", team: "SAS", value: ".757" },
      { rank: 3, playerName: "Detroit Pistons", team: "DET", value: ".730" },
      { rank: 4, playerName: "Boston Celtics", team: "BOS", value: ".676" },
      { rank: 5, playerName: "New York Knicks", team: "NYK", value: ".640" },
    ]),
  },
  "NFL:YPC": {
    fallback: fallbackSnapshot(2025, [
      { rank: 1, playerName: "De'Von Achane", team: "MIA", value: "5.7" },
      { rank: 2, playerName: "Trey Benson", team: "ARI", value: "5.5" },
      { rank: 3, playerName: "Justin Fields", team: "NYJ", value: "5.4" },
      { rank: 4, playerName: "James Cook III", team: "BUF", value: "5.2" },
      { rank: 5, playerName: "Derrick Henry", team: "BAL", value: "5.2" },
    ]),
  },
  "NFL:Yards per Attempt": {
    fallback: fallbackSnapshot(2025, [
      { rank: 1, playerName: "Drake Maye", team: "NE", value: "8.9" },
      { rank: 2, playerName: "Sam Darnold", team: "SEA", value: "8.5" },
      { rank: 3, playerName: "Lamar Jackson", team: "BAL", value: "8.4" },
      { rank: 4, playerName: "Daniel Jones", team: "IND", value: "8.1" },
      { rank: 5, playerName: "Josh Allen", team: "BUF", value: "8.0" },
    ]),
  },
  "NFL:Completion %": {
    fallback: fallbackSnapshot(2025, [
      { rank: 1, playerName: "Drake Maye", team: "NE", value: "72.0%" },
      { rank: 2, playerName: "Mac Jones", team: "SF", value: "69.6%" },
      { rank: 3, playerName: "Brock Purdy", team: "SF", value: "69.4%" },
      { rank: 4, playerName: "Josh Allen", team: "BUF", value: "69.3%" },
      { rank: 5, playerName: "Kyler Murray", team: "ARI", value: "68.3%" },
    ]),
  },
  "NFL:Passer Rating": {
    fallback: fallbackSnapshot(2025, [
      { rank: 1, playerName: "Drake Maye", team: "NE", value: "113.5" },
      { rank: 2, playerName: "Matthew Stafford", team: "LAR", value: "109.2" },
      { rank: 3, playerName: "Jared Goff", team: "DET", value: "105.5" },
      { rank: 4, playerName: "Lamar Jackson", team: "BAL", value: "103.8" },
      { rank: 5, playerName: "Josh Allen", team: "BUF", value: "102.2" },
    ]),
  },
  "NFL:QBR": {
    fallback: fallbackSnapshot(2025, [
      { rank: 1, playerName: "Drake Maye", team: "NE", value: "77.1" },
      { rank: 2, playerName: "Brock Purdy", team: "SF", value: "72.8" },
      { rank: 3, playerName: "Jordan Love", team: "GB", value: "72.7" },
      { rank: 4, playerName: "Matthew Stafford", team: "LAR", value: "71.2" },
      { rank: 5, playerName: "Dak Prescott", team: "DAL", value: "70.2" },
    ]),
  },
};

function keyFor(sport: StatSport, statKey: string): string {
  return `${sport}:${statKey}`;
}

export function getStatLeaderDefinition(statKey: string, sport?: StatSport): StatLeaderDefinition | null {
  const entry = findStatGlossaryEntry(statKey, sport);
  if (!entry) {
    return null;
  }

  return LEADER_DEFINITIONS[keyFor(entry.sport, entry.key)] ?? null;
}

export function resolveStatLeaderSeason(sport: StatSport, requestedSeason?: number): number {
  if (Number.isInteger(requestedSeason) && (requestedSeason ?? 0) > 0) {
    return requestedSeason as number;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (sport === "MLB") {
    return year;
  }

  if (sport === "NBA") {
    return month >= 6 ? year + 1 : year;
  }

  return month >= 7 ? year : year - 1;
}

export function resolveFallbackLeaders(
  definition: StatLeaderDefinition,
  season: number,
): FallbackLeaderSnapshot | null {
  if (!definition.fallback) {
    return null;
  }

  if (definition.fallback.season === season) {
    return definition.fallback;
  }

  return {
    ...definition.fallback,
    season,
    leaders: [],
  };
}
