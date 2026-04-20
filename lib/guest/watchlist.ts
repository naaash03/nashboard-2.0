"use client";

export type GuestWatchlistItem = {
  id: string;
  sport: "NFL" | "NBA" | "MLB";
  entityType: "team" | "player";
  entityId: string;
  entityName: string;
  createdAt: string;
};

type GuestWatchlistState = {
  items: GuestWatchlistItem[];
  updatedAt: string;
};

const WATCHLIST_KEY = "nashboard:guest-watchlist:v2";
const LEGACY_KEY = "nashboard:guest-watchlist:v1";
const LIMIT = 10;

const EMPTY_STATE: GuestWatchlistState = {
  items: [],
  updatedAt: new Date(0).toISOString(),
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function normalizeSport(raw: unknown): "NFL" | "NBA" | "MLB" {
  if (raw === "NFL" || raw === "NBA" || raw === "MLB") return raw;
  return "NFL";
}

function normalizeEntityType(raw: unknown): "team" | "player" {
  return raw === "player" ? "player" : "team";
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
          // Accept both new contract (entityId/entityName) and legacy (teamKey/teamName)
          const entityId = String(value.entityId ?? value.teamKey ?? "").trim().toUpperCase();
          const entityName = String(value.entityName ?? value.teamName ?? "").trim();
          return {
            id: String(value.id ?? `guest-${Date.now()}`),
            sport: normalizeSport(value.sport),
            entityType: normalizeEntityType(value.entityType),
            entityId,
            entityName,
            createdAt: String(value.createdAt ?? new Date().toISOString()),
          };
        })
        .filter((item) => item.entityId.length > 0 && item.entityName.length > 0)
        .slice(0, LIMIT)
    : [];

  return {
    items,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
  };
}

function persist(state: GuestWatchlistState): void {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(WATCHLIST_KEY, JSON.stringify(state));
}

function migrateLegacy(): GuestWatchlistState | null {
  if (!isBrowser()) return null;
  const raw = window.sessionStorage.getItem(LEGACY_KEY);
  if (!raw) return null;
  try {
    const v1 = JSON.parse(raw) as { items?: Array<Record<string, unknown>>; updatedAt?: string };
    if (!Array.isArray(v1.items)) return null;
    const migrated: GuestWatchlistState = {
      items: v1.items
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: String(item.id ?? `guest-${Date.now()}`),
          sport: "NFL" as const,
          entityType: "team" as const,
          entityId: String(item.teamKey ?? "").trim().toUpperCase(),
          entityName: String(item.teamName ?? "").trim(),
          createdAt: String(item.createdAt ?? new Date().toISOString()),
        }))
        .filter((item) => item.entityId.length > 0 && item.entityName.length > 0)
        .slice(0, LIMIT),
      updatedAt: typeof v1.updatedAt === "string" ? v1.updatedAt : new Date().toISOString(),
    };
    persist(migrated);
    return migrated;
  } catch {
    return null;
  }
}

export function getGuestWatchlist(): GuestWatchlistState {
  if (!isBrowser()) return EMPTY_STATE;

  const raw = window.sessionStorage.getItem(WATCHLIST_KEY);
  if (!raw) {
    return migrateLegacy() ?? EMPTY_STATE;
  }

  try {
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY_STATE;
  }
}

export function addGuestWatchlistItem(
  sport: "NFL" | "NBA" | "MLB",
  entityType: "team" | "player",
  entityId: string,
  entityName: string,
): { state: GuestWatchlistState; error?: string } {
  const id = entityId.trim().toUpperCase();
  const name = entityName.trim();
  const current = getGuestWatchlist();

  if (!id || !name) {
    return { state: current, error: "entityId and entityName are required" };
  }

  const sportItems = current.items.filter((item) => item.sport === sport && item.entityType === entityType);
  if (sportItems.some((item) => item.entityId === id)) {
    return { state: current, error: "Item is already on your watchlist." };
  }

  if (sportItems.length >= LIMIT) {
    return { state: current, error: "Watchlist limit reached. Remove an item before adding another." };
  }

  const state: GuestWatchlistState = {
    items: [
      ...current.items,
      {
        id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sport,
        entityType,
        entityId: id,
        entityName: name,
        createdAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  persist(state);
  return { state };
}

export function removeGuestWatchlistItem(id: string): GuestWatchlistState {
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
