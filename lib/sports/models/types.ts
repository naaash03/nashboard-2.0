export type League = {
  key: string;
  name: string;
  sport: string;
  season?: string | number;
};

export type ProviderIds = {
  apiSports?: string | number;
  espn?: string | number;
  internal?: string;
};

export type Team = {
  id: string;
  league: string;
  name: string;
  city?: string;
  abbreviation: string;
  aliases?: string[];
  providerIds?: ProviderIds;
  logoUrl?: string;
};

export type Player = {
  id: string;
  league: string;
  teamId?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  jersey?: string | number;
  position?: string;
  status?: string;
  headshotUrl?: string;
  providerIds?: ProviderIds;
};

export type GameSourceMeta = {
  provider: string;
  providerGameId?: string | number;
  fetchedAt?: string;
  stale?: boolean;
};

export type Game = {
  id: string;
  league: string;
  season?: string | number;
  startTime: string;
  timezone?: string;
  status: string;
  displayStatus?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  sourceMeta?: GameSourceMeta;
};

export type StandingsRow = {
  teamId: string;
  league: string;
  rank?: number;
  wins?: number;
  losses?: number;
  pct?: number | string;
  gb?: number | string;
  conference?: string;
  division?: string;
  streak?: string;
};

export type PlayerInsight = {
  playerId: string;
  league: string;
  stats: Record<string, unknown>;
  advanced?: Record<string, unknown>;
  recent?: Record<string, unknown>;
  season?: Record<string, unknown>;
  liveContext?: Record<string, unknown>;
  sourceMeta?: {
    provider: string;
    stale?: boolean;
    fetchedAt?: string;
  };
};

export type TeamStatus = {
  teamId: string;
  league: string;
  nextGame?: Game;
  lastGame?: Game;
  todayGame?: Game;
  record?: string;
  streak?: string;
  injuries?: Array<Record<string, unknown>>;
  sourceMeta?: {
    provider: string;
    stale?: boolean;
    fetchedAt?: string;
  };
};

export type WidgetPayload<T> = {
  ok: boolean;
  data: T | null;
  error?: string | null;
  source: {
    provider: string;
    mode: string;
    fallbackUsed: boolean;
    stale?: boolean;
    fetchedAt?: string;
  };
  debug?: {
    notes?: string[];
    requestId?: string;
  };
};
