export type MlbTeamEntry = {
  key: string;
  name: string;
  city: string;
  league: "AL" | "NL";
  division: "East" | "Central" | "West";
};

export const MLB_TEAMS: MlbTeamEntry[] = [
  // AL East
  { key: "NYY", name: "New York Yankees", city: "New York", league: "AL", division: "East" },
  { key: "BOS", name: "Boston Red Sox", city: "Boston", league: "AL", division: "East" },
  { key: "TBR", name: "Tampa Bay Rays", city: "St. Petersburg", league: "AL", division: "East" },
  { key: "TOR", name: "Toronto Blue Jays", city: "Toronto", league: "AL", division: "East" },
  { key: "BAL", name: "Baltimore Orioles", city: "Baltimore", league: "AL", division: "East" },
  // AL Central
  { key: "CLE", name: "Cleveland Guardians", city: "Cleveland", league: "AL", division: "Central" },
  { key: "CWS", name: "Chicago White Sox", city: "Chicago", league: "AL", division: "Central" },
  { key: "DET", name: "Detroit Tigers", city: "Detroit", league: "AL", division: "Central" },
  { key: "KCR", name: "Kansas City Royals", city: "Kansas City", league: "AL", division: "Central" },
  { key: "MIN", name: "Minnesota Twins", city: "Minneapolis", league: "AL", division: "Central" },
  // AL West
  { key: "HOU", name: "Houston Astros", city: "Houston", league: "AL", division: "West" },
  { key: "LAA", name: "Los Angeles Angels", city: "Anaheim", league: "AL", division: "West" },
  { key: "OAK", name: "Oakland Athletics", city: "Oakland", league: "AL", division: "West" },
  { key: "SEA", name: "Seattle Mariners", city: "Seattle", league: "AL", division: "West" },
  { key: "TEX", name: "Texas Rangers", city: "Arlington", league: "AL", division: "West" },
  // NL East
  { key: "ATL", name: "Atlanta Braves", city: "Atlanta", league: "NL", division: "East" },
  { key: "MIA", name: "Miami Marlins", city: "Miami", league: "NL", division: "East" },
  { key: "NYM", name: "New York Mets", city: "New York", league: "NL", division: "East" },
  { key: "PHI", name: "Philadelphia Phillies", city: "Philadelphia", league: "NL", division: "East" },
  { key: "WSN", name: "Washington Nationals", city: "Washington", league: "NL", division: "East" },
  // NL Central
  { key: "CHC", name: "Chicago Cubs", city: "Chicago", league: "NL", division: "Central" },
  { key: "CIN", name: "Cincinnati Reds", city: "Cincinnati", league: "NL", division: "Central" },
  { key: "MIL", name: "Milwaukee Brewers", city: "Milwaukee", league: "NL", division: "Central" },
  { key: "PIT", name: "Pittsburgh Pirates", city: "Pittsburgh", league: "NL", division: "Central" },
  { key: "STL", name: "St. Louis Cardinals", city: "St. Louis", league: "NL", division: "Central" },
  // NL West
  { key: "ARI", name: "Arizona Diamondbacks", city: "Phoenix", league: "NL", division: "West" },
  { key: "COL", name: "Colorado Rockies", city: "Denver", league: "NL", division: "West" },
  { key: "LAD", name: "Los Angeles Dodgers", city: "Los Angeles", league: "NL", division: "West" },
  { key: "SDP", name: "San Diego Padres", city: "San Diego", league: "NL", division: "West" },
  { key: "SFG", name: "San Francisco Giants", city: "San Francisco", league: "NL", division: "West" },
];
