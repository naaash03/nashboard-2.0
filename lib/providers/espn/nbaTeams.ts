// ESPN NBA team ids keyed by canonical abbreviation. These match the ESPN
// scoreboard/standings/schedule team ids used across the unofficial API.
export const NBA_TEAM_ESPN_IDS: Record<string, number> = {
  ATL: 1, BOS: 2, NOP: 3, CHI: 4, CLE: 5, DAL: 6, DEN: 7,
  DET: 8, GSW: 9, HOU: 10, IND: 11, LAC: 12, LAL: 13,
  MIA: 14, MIL: 15, MIN: 16, BKN: 17, NYK: 18, ORL: 19,
  PHI: 20, PHX: 21, POR: 22, SAC: 23, SAS: 24, OKC: 25,
  UTA: 26, WAS: 27, TOR: 28, MEM: 29, CHA: 30,
};

export function espnTeamIdForKey(teamKey: string): number | undefined {
  return NBA_TEAM_ESPN_IDS[teamKey.trim().toUpperCase()];
}
