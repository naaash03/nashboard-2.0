export type GuestWatchlistItem = {
  id: string;
  teamKey: string;
  teamName: string;
  sport: "NFL";
  createdAt: string;
};

type GuestWatchlistState = {
  items: GuestWatchlistItem[];
  updatedAt: string;
};

const WATCHLIST_KEY = "nashboard:guest-watchlist:v1";
const LIMIT = 5;

const EMPTY_STATE: GuestWatchlistState = {
  items: [],
  updatedAt: new Date(0).toISOString(),
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function normalize(input: unknown): GuestWatchlistState {
  if (!input || typeof input !== "object") {
    return EMPTY_STATE;
  }

  const candidate = input as { items?: unknown; updatedAt?: unknown };
  const items = Array.isArray(candidate.items)
    ? candidate.items
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const value = item as Record<string, unknown>;
          const teamKey = String(value.teamKey ?? "").trim().toUpperCase();
          const teamName = String(value.teamName ?? "").trim();
          return {
            id: String(value.id ?? `guest-team-${Date.now()}`),
            teamKey,
            teamName,
            sport: "NFL" as const,
            createdAt: String(value.createdAt ?? new Date().toISOString()),
          };
        })
        .filter((item) => item.teamKey.length > 0 && item.teamName.length > 0)
        .slice(0, LIMIT)
    : [];

  return {
    items,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
  };
}

function persist(state: GuestWatchlistState): void {
  if (!isBrowser()) {
    return;
  }
  window.sessionStorage.setItem(WATCHLIST_KEY, JSON.stringify(state));
}

export function getGuestWatchlist(): GuestWatchlistState {
  if (!isBrowser()) {
    return EMPTY_STATE;
  }

  const raw = window.sessionStorage.getItem(WATCHLIST_KEY);
  if (!raw) {
    return EMPTY_STATE;
  }

  try {
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY_STATE;
  }
}

export function addGuestWatchlistTeam(teamKey: string, teamName: string): { state: GuestWatchlistState; error?: string } {
  const key = teamKey.trim().toUpperCase();
  const name = teamName.trim();
  const current = getGuestWatchlist();

  if (!key || !name) {
    return { state: current, error: "teamKey and teamName are required" };
  }

  if (current.items.some((item) => item.teamKey === key)) {
    return { state: current, error: "Team is already on your watchlist." };
  }

  if (current.items.length >= LIMIT) {
    return {
      state: current,
      error: "Watchlist limit reached. Remove a team before adding another.",
    };
  }

  const state: GuestWatchlistState = {
    items: [
      ...current.items,
      {
        id: `guest-team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        teamKey: key,
        teamName: name,
        sport: "NFL",
        createdAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  persist(state);
  return { state };
}

export function removeGuestWatchlistTeam(id: string): GuestWatchlistState {
  const current = getGuestWatchlist();
  const state: GuestWatchlistState = {
    items: current.items.filter((item) => item.id !== id),
    updatedAt: new Date().toISOString(),
  };
  persist(state);
  return state;
}

export function clearGuestWatchlist(): GuestWatchlistState {
  persist({ ...EMPTY_STATE, updatedAt: new Date().toISOString() });
  return getGuestWatchlist();
}

export function guestWatchlistLimit(): number {
  return LIMIT;
}
