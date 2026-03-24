export type Sport = "NFL" | "NBA" | "MLB" | "UTILITIES";
export type Mode = "beginner" | "advanced";
export type DataSource = "espn" | "mlb" | "fixture" | "demo" | "cache";

export type Meta = {
  sourceUsed: DataSource;
  updatedAt: string;
  warning?: string;
  requestId: string;
  cacheHit?: boolean;
  cacheAgeSeconds?: number;
  endpointUrl?: string;
  upstreamStatus?: number;
  upstreamMessage?: string;
  dataMode?: "live" | "fixture";
};

export type ApiResponse<T> = {
  data: T;
  meta: Meta;
};

export type TeamRecord = {
  wins: number;
  losses: number;
};

export type SlateGame = {
  id: string;
  date: string;
  gameType?: string;
  broadcaster?: string;
  status: string;
  homeTeam: {
    key: string;
    name: string;
    record?: TeamRecord;
  };
  awayTeam: {
    key: string;
    name: string;
    record?: TeamRecord;
  };
};

export type PlayerSearchResult = {
  playerId: string;
  fullName: string;
  teamKey?: string;
  teamName?: string;
  position?: string;
  jersey?: string;
  headshotUrl?: string;
  teamLogoUrl?: string;
};

export type Player = {
  playerId: string;
  fullName: string;
  teamKey?: string;
  teamName?: string;
  position?: string;
  jersey?: string;
  heightIn?: number;
  weightLbs?: number;
  headshotUrl?: string;
  teamLogoUrl?: string;
  stats?: Record<string, number | string | null>;
};

export type RbVsDlineStats = {
  teamKey: string;
  teamName: string;
  opponentKey: string;
  opponentName: string;
  rb: {
    playerId?: string;
    fullName: string;
    attempts?: number;
    yards?: number;
    ypc?: number;
    tds?: number;
    explosiveRuns?: number;
  };
  defense: {
    rushYardsAllowed?: number;
    ypcAllowed?: number;
    rushTdsAllowed?: number;
    explosiveRunsAllowed?: number;
  };
  disclaimer: string;
};


