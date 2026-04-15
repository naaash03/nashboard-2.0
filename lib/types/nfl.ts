export type NflWidgetSource = "live" | "cached" | "demo";

export type NflConference = "AFC" | "NFC";
export type NflDivision = "East" | "North" | "South" | "West";

export interface NflTeamStandingRow {
  teamId: string;
  teamKey: string;
  name: string;
  abbreviation: string;
  wins: number;
  losses: number;
  ties: number;
  pct: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string;
  clinched: boolean;
  divisionLeader: boolean;
  playoffSeed: number | null;
}

export interface NflDivisionGroup {
  conference: NflConference;
  division: NflDivision;
  teams: NflTeamStandingRow[];
}

export interface NflDivisionSnapshotData {
  source: NflWidgetSource;
  season: number;
  week: number | null;
  isOffseason: boolean;
  divisions: NflDivisionGroup[];
  updatedAt: string;
}

export type NflGameStatus = "scheduled" | "in_progress" | "final" | "postponed";

export interface NflTeamRef {
  teamId: string;
  teamKey: string;
  name: string;
  abbreviation: string;
  logo: string | null;
}

export interface NflGameRef {
  gameId: string;
  status: NflGameStatus;
  date: string;
  homeTeam: NflTeamRef;
  awayTeam: NflTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  week: number;
  isPlayoff: boolean;
}

export interface NflTeamContextCardData {
  source: NflWidgetSource;
  teamKey: string;
  teamName: string;
  season: number;
  isHistoricalSeason: boolean;
  currentRecord: { wins: number; losses: number; ties: number } | null;
  currentRank: number | null;
  divisionRank: number | null;
  nextGame: NflGameRef | null;
  mostRecentGame: NflGameRef | null;
  isOffseason: boolean;
  isByeWeek: boolean;
  updatedAt: string;
}

export type NflGameResult = "W" | "L" | "T" | "BYE" | "UPCOMING";

export interface NflFormGame {
  gameId: string;
  week: number;
  result: NflGameResult;
  opponentKey: string;
  opponentName: string;
  score: string | null;
  isHome: boolean;
  opponentRecord: string | null;
  opponentWinPct: number | null;
}

export interface NflRecentFormData {
  source: NflWidgetSource;
  teamKey: string;
  teamName: string;
  season: number;
  recentGames: NflFormGame[];
  currentStreak: string;
  scheduleLabel: string;
  scheduleDifficulty: number;
  isOffseason: boolean;
  updatedAt: string;
}
