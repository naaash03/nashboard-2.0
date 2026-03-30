export type MlbTeamOption = {
  key: string;
  name: string;
  id: number;
};

export const MLB_TEAM_MAP: Record<string, MlbTeamOption> = {
  ARI: { key: "ARI", name: "Arizona Diamondbacks", id: 109 },
  ATL: { key: "ATL", name: "Atlanta Braves", id: 144 },
  BAL: { key: "BAL", name: "Baltimore Orioles", id: 110 },
  BOS: { key: "BOS", name: "Boston Red Sox", id: 111 },
  CHC: { key: "CHC", name: "Chicago Cubs", id: 112 },
  CHW: { key: "CHW", name: "Chicago White Sox", id: 145 },
  CIN: { key: "CIN", name: "Cincinnati Reds", id: 113 },
  CLE: { key: "CLE", name: "Cleveland Guardians", id: 114 },
  COL: { key: "COL", name: "Colorado Rockies", id: 115 },
  DET: { key: "DET", name: "Detroit Tigers", id: 116 },
  HOU: { key: "HOU", name: "Houston Astros", id: 117 },
  KCR: { key: "KCR", name: "Kansas City Royals", id: 118 },
  LAA: { key: "LAA", name: "Los Angeles Angels", id: 108 },
  LAD: { key: "LAD", name: "Los Angeles Dodgers", id: 119 },
  MIA: { key: "MIA", name: "Miami Marlins", id: 146 },
  MIL: { key: "MIL", name: "Milwaukee Brewers", id: 158 },
  MIN: { key: "MIN", name: "Minnesota Twins", id: 142 },
  NYM: { key: "NYM", name: "New York Mets", id: 121 },
  NYY: { key: "NYY", name: "New York Yankees", id: 147 },
  OAK: { key: "OAK", name: "Athletics", id: 133 },
  PHI: { key: "PHI", name: "Philadelphia Phillies", id: 143 },
  PIT: { key: "PIT", name: "Pittsburgh Pirates", id: 134 },
  SDP: { key: "SDP", name: "San Diego Padres", id: 135 },
  SEA: { key: "SEA", name: "Seattle Mariners", id: 136 },
  SFG: { key: "SFG", name: "San Francisco Giants", id: 137 },
  STL: { key: "STL", name: "St. Louis Cardinals", id: 138 },
  TBR: { key: "TBR", name: "Tampa Bay Rays", id: 139 },
  TEX: { key: "TEX", name: "Texas Rangers", id: 140 },
  TOR: { key: "TOR", name: "Toronto Blue Jays", id: 141 },
  WSN: { key: "WSN", name: "Washington Nationals", id: 120 },
};

const MLB_TEAM_ALIASES: Record<string, keyof typeof MLB_TEAM_MAP> = {
  CWS: "CHW",
  KC: "KCR",
  LV: "OAK",
  SD: "SDP",
  SF: "SFG",
  TB: "TBR",
  WAS: "WSN",
  WSH: "WSN",
};

export const MLB_TEAM_OPTIONS: MlbTeamOption[] = Object.values(MLB_TEAM_MAP).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function resolveMlbTeam(teamKey: string): MlbTeamOption | null {
  const normalized = teamKey.toUpperCase();
  return MLB_TEAM_MAP[normalized] ?? MLB_TEAM_MAP[MLB_TEAM_ALIASES[normalized]] ?? null;
}
