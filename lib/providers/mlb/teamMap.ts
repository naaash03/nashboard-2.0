export type MlbTeamOption = {
  key: string;
  name: string;
  id: number;
};

export const MLB_TEAM_MAP: Record<string, MlbTeamOption> = {
  ATL: { key: "ATL", name: "Atlanta Braves", id: 144 },
  BOS: { key: "BOS", name: "Boston Red Sox", id: 111 },
  CHC: { key: "CHC", name: "Chicago Cubs", id: 112 },
  HOU: { key: "HOU", name: "Houston Astros", id: 117 },
  LAD: { key: "LAD", name: "Los Angeles Dodgers", id: 119 },
  NYM: { key: "NYM", name: "New York Mets", id: 121 },
  NYY: { key: "NYY", name: "New York Yankees", id: 147 },
  PHI: { key: "PHI", name: "Philadelphia Phillies", id: 143 },
  SD: { key: "SD", name: "San Diego Padres", id: 135 },
  SF: { key: "SF", name: "San Francisco Giants", id: 137 },
  SEA: { key: "SEA", name: "Seattle Mariners", id: 136 },
  STL: { key: "STL", name: "St. Louis Cardinals", id: 138 },
  TB: { key: "TB", name: "Tampa Bay Rays", id: 139 },
  TEX: { key: "TEX", name: "Texas Rangers", id: 140 },
  TOR: { key: "TOR", name: "Toronto Blue Jays", id: 141 },
};

export const MLB_TEAM_OPTIONS: MlbTeamOption[] = Object.values(MLB_TEAM_MAP).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function resolveMlbTeam(teamKey: string): MlbTeamOption | null {
  return MLB_TEAM_MAP[teamKey.toUpperCase()] ?? null;
}
