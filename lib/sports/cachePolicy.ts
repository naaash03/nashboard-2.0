export const CACHE_TTL_SECONDS = {
  slateLive: 45,
  standings: 300,
  playerProfile: 600,
  playerInsight: 240,
  teamStatus: 60,
  search: 180,
} as const;

export type CacheDomain =
  | "slate"
  | "standings"
  | "playerProfile"
  | "playerInsight"
  | "teamStatus"
  | "search";

export function ttlFor(domain: CacheDomain): number {
  switch (domain) {
    case "slate":
      return CACHE_TTL_SECONDS.slateLive;
    case "standings":
      return CACHE_TTL_SECONDS.standings;
    case "playerProfile":
      return CACHE_TTL_SECONDS.playerProfile;
    case "playerInsight":
      return CACHE_TTL_SECONDS.playerInsight;
    case "teamStatus":
      return CACHE_TTL_SECONDS.teamStatus;
    case "search":
      return CACHE_TTL_SECONDS.search;
    default:
      return CACHE_TTL_SECONDS.search;
  }
}
