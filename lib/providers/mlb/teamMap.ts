import { MLB_TEAMS } from "./MLB_TEAMS";

export type MlbTeamOption = {
  key: string;
  name: string;
  id: number;
};

const MLB_STATS_API_IDS: Record<string, number> = {
  NYY: 147, BOS: 111, TBR: 139, TOR: 141, BAL: 110,
  CLE: 114, CWS: 145, DET: 116, KCR: 118, MIN: 142,
  HOU: 117, LAA: 108, OAK: 133, SEA: 136, TEX: 140,
  ATL: 144, MIA: 146, NYM: 121, PHI: 143, WSN: 120,
  CHC: 112, CIN: 113, MIL: 158, PIT: 134, STL: 138,
  ARI: 109, COL: 115, LAD: 119, SDP: 135, SFG: 137,
};

export const MLB_TEAM_MAP: Record<string, MlbTeamOption> = Object.fromEntries(
  MLB_TEAMS.map((t) => [t.key, { key: t.key, name: t.name, id: MLB_STATS_API_IDS[t.key] ?? 0 }]),
);

export const MLB_TEAM_OPTIONS: MlbTeamOption[] = Object.values(MLB_TEAM_MAP).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function resolveMlbTeam(teamKey: string): MlbTeamOption | null {
  return MLB_TEAM_MAP[teamKey.toUpperCase()] ?? null;
}
