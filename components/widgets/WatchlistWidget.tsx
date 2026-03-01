"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SportTabs from "@/components/widgets/shared/SportTabs";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import {
  addGuestWatchlistTeam,
  getGuestWatchlist,
  guestWatchlistLimit,
  removeGuestWatchlistTeam,
  type GuestWatchlistItem,
} from "@/lib/guest/watchlist";
import type { Envelope, PlayerProfile, PlayerSearchResult, SportKey } from "@/lib/types/players";

type WatchItem = GuestWatchlistItem;

type WatchlistResponse = {
  items?: WatchItem[];
  error?: string;
};

type PlayerSearchResultMin = {
  playerId: string;
  fullName: string;
  teamName?: string;
  position?: string;
};

type PlayerWatchlistBySport = Record<SportKey, PlayerSearchResultMin[]>;

type ViewMode = "teams" | "players";

const EMPTY_PLAYER_WATCHLIST: PlayerWatchlistBySport = {
  nfl: [],
  mlb: [],
  nba: [],
};

export function shouldUseServerWatchlist(props: Pick<WidgetCommonProps, "viewerMode" | "authConfigured" | "dbConfigured">): boolean {
  return props.viewerMode === "signed_in" && props.authConfigured && props.dbConfigured;
}

function normalizeSportKey(input: unknown): SportKey {
  if (input === "mlb" || input === "nba" || input === "nfl") {
    return input;
  }
  return "nfl";
}

function normalizeViewMode(input: unknown): ViewMode {
  return input === "players" ? "players" : "teams";
}

function normalizePlayerWatchlist(input: unknown): PlayerWatchlistBySport {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const next: PlayerWatchlistBySport = {
    nfl: [],
    mlb: [],
    nba: [],
  };

  for (const sport of ["nfl", "mlb", "nba"] as const) {
    const rows = source[sport];
    if (!Array.isArray(rows)) {
      continue;
    }

    const parsedRows: PlayerSearchResultMin[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") {
        continue;
      }

      const typed = row as Record<string, unknown>;
      const playerId = typeof typed.playerId === "string" ? typed.playerId : "";
      const fullName = typeof typed.fullName === "string" ? typed.fullName : "";
      if (!playerId || !fullName) {
        continue;
      }

      const parsed: PlayerSearchResultMin = {
        playerId,
        fullName,
      };
      if (typeof typed.teamName === "string") {
        parsed.teamName = typed.teamName;
      }
      if (typeof typed.position === "string") {
        parsed.position = typed.position;
      }
      parsedRows.push(parsed);
    }

    next[sport] = parsedRows;
  }

  return next;
}

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function sportLabel(sportKey: SportKey): string {
  return sportKey.toUpperCase();
}

function uniqueByPlayerId(items: PlayerSearchResultMin[]): PlayerSearchResultMin[] {
  return items.filter((item, index, all) => all.findIndex((row) => row.playerId === item.playerId) === index);
}

export default function WatchlistWidget(props: WidgetCommonProps) {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [teamKey, setTeamKey] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(new Date().toISOString());

  const [viewMode, setViewMode] = useState<ViewMode>(normalizeViewMode(props.config.watchlistMode));
  const [playerSportKey, setPlayerSportKey] = useState<SportKey>(normalizeSportKey(props.config.watchlistSportKey));
  const [playerWatchlist, setPlayerWatchlist] = useState<PlayerWatchlistBySport>(normalizePlayerWatchlist(props.config.playerWatchlist));
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerResults, setPlayerResults] = useState<PlayerSearchResultMin[]>([]);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [lastProfile, setLastProfile] = useState<PlayerProfile | null>(null);
  const [lastProfileMeta, setLastProfileMeta] = useState<WidgetMeta | null>(null);
  const [playersEndpoint, setPlayersEndpoint] = useState("");

  const useServer = shouldUseServerWatchlist(props);
  const sourceLabel = useServer ? "ESPN" : "Guest";

  useEffect(() => {
    setViewMode(normalizeViewMode(props.config.watchlistMode));
    setPlayerSportKey(normalizeSportKey(props.config.watchlistSportKey));
    setPlayerWatchlist(normalizePlayerWatchlist(props.config.playerWatchlist));
  }, [props.config]);

  const load = useCallback(async (): Promise<WatchItem[]> => {
    if (!useServer) {
      const local = getGuestWatchlist();
      setUpdatedAt(local.updatedAt);
      return local.items;
    }

    const res = await fetch("/api/watchlist", { cache: "no-store" });
    const json = (await res.json()) as WatchlistResponse;
    if (!res.ok) {
      throw new Error(json.error ?? "Failed to load watchlist");
    }

    setUpdatedAt(new Date().toISOString());
    return json.items ?? [];
  }, [useServer]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextItems = await load();
        if (!cancelled) {
          setItems(nextItems);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load, props.refreshTick]);

  const persistPlayerConfig = useCallback(async (
    next: {
      viewMode?: ViewMode;
      sportKey?: SportKey;
      watchlist?: PlayerWatchlistBySport;
    },
  ) => {
    const normalizedWatchlist = next.watchlist ?? playerWatchlist;
    const nextConfig = {
      ...props.config,
      watchlistMode: next.viewMode ?? viewMode,
      watchlistSportKey: next.sportKey ?? playerSportKey,
      playerWatchlist: normalizedWatchlist,
    };

    await props.onPersist({ config: nextConfig });
  }, [playerSportKey, playerWatchlist, props, viewMode]);

  async function addTeam(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const normalizedKey = teamKey.trim().toUpperCase();
    const normalizedName = teamName.trim();

    if (!normalizedKey || !normalizedName) {
      setError("teamKey and teamName are required");
      return;
    }

    if (useServer) {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamKey: normalizedKey, teamName: normalizedName, sport: "NFL" }),
      });
      const json = (await res.json()) as WatchlistResponse;
      if (!res.ok) {
        setError(json.error ?? "Failed to add team");
        return;
      }
      const nextItems = await load();
      setItems(nextItems);
    } else {
      const result = addGuestWatchlistTeam(normalizedKey, normalizedName);
      if (result.error) {
        setError(result.error);
        return;
      }
      setItems(result.state.items);
      setUpdatedAt(result.state.updatedAt);
    }

    setTeamKey("");
    setTeamName("");
  }

  async function remove(id: string) {
    if (useServer) {
      const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({ error: "Failed to remove team" }))) as { error?: string };
        setError(json.error ?? "Failed to remove team");
        return;
      }
      const nextItems = await load();
      setItems(nextItems);
      return;
    }

    const nextState = removeGuestWatchlistTeam(id);
    setItems(nextState.items);
    setUpdatedAt(nextState.updatedAt);
  }

  const runPlayerSearch = useCallback(async (value: string): Promise<PlayerSearchResultMin[]> => {
    if (value.trim().length < 3) {
      return [];
    }

    const endpointUrl = `/api/players/search?sport=${playerSportKey}&q=${encodeURIComponent(value.trim())}&dataMode=${props.dataMode}`;
    setPlayersEndpoint(endpointUrl);

    const response = await fetch(endpointUrl, { cache: "no-store" });
    const json = (await response.json()) as Envelope<PlayerSearchResult[]>;

    if (!response.ok || json.error) {
      setPlayerError(json.error?.message ?? "Player search failed.");
      return [];
    }

    setPlayerError(json.meta.warning ?? null);
    return (json.data ?? []).map((row) => ({
      playerId: row.playerId,
      fullName: row.fullName,
      teamName: row.teamName,
      position: row.position,
    }));
  }, [playerSportKey, props.dataMode]);

  useEffect(() => {
    if (viewMode !== "players") {
      return;
    }

    let cancelled = false;
    const id = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await runPlayerSearch(playerQuery);
          if (!cancelled) {
            setPlayerResults(results);
          }
        } catch (searchError) {
          if (!cancelled) {
            setPlayerError(String(searchError));
            setPlayerResults([]);
          }
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [playerQuery, runPlayerSearch, viewMode]);

  const playersForSport = useMemo(() => playerWatchlist[playerSportKey] ?? [], [playerSportKey, playerWatchlist]);

  const addPlayer = async (player: PlayerSearchResultMin) => {
    setPlayerError(null);
    if (playersForSport.some((existing) => existing.playerId === player.playerId)) {
      setPlayerError("Player is already in this sport watchlist.");
      return;
    }

    if (playersForSport.length >= 10) {
      setPlayerError("Limit reached: 10 players per sport.");
      return;
    }

    const nextWatchlist: PlayerWatchlistBySport = {
      ...playerWatchlist,
      [playerSportKey]: uniqueByPlayerId([...playersForSport, player]),
    };

    setPlayerWatchlist(nextWatchlist);
    setPlayerResults([]);
    setPlayerQuery("");
    await persistPlayerConfig({ watchlist: nextWatchlist });
  };

  const removePlayer = async (playerId: string) => {
    const nextWatchlist: PlayerWatchlistBySport = {
      ...playerWatchlist,
      [playerSportKey]: playersForSport.filter((row) => row.playerId !== playerId),
    };

    setPlayerWatchlist(nextWatchlist);
    if (lastProfile?.playerId === playerId) {
      setLastProfile(null);
      setLastProfileMeta(null);
    }
    await persistPlayerConfig({ watchlist: nextWatchlist });
  };

  const loadPlayerProfile = async (playerId: string) => {
    const endpointUrl = `/api/players/profile?sport=${playerSportKey}&playerId=${encodeURIComponent(playerId)}&dataMode=${props.dataMode}`;
    setPlayersEndpoint(endpointUrl);

    const response = await fetch(endpointUrl, { cache: "no-store" });
    const json = (await response.json()) as Envelope<PlayerProfile>;
    if (!response.ok || json.error) {
      setPlayerError(json.error?.message ?? "Failed to load player profile.");
      return;
    }

    setPlayerError(json.meta.warning ?? null);
    setLastProfile(json.data ?? null);
    setLastProfileMeta(json.meta ?? null);
  };

  const onViewModeChange = async (next: ViewMode) => {
    setViewMode(next);
    setPlayerError(null);
    await persistPlayerConfig({ viewMode: next });
  };

  const onPlayerSportChange = async (nextSportKey: SportKey) => {
    setPlayerSportKey(nextSportKey);
    setPlayerResults([]);
    setPlayerQuery("");
    setPlayerError(null);
    await persistPlayerConfig({ sportKey: nextSportKey });
  };

  const teamsMeta: WidgetMeta = {
    sourceUsed: sourceLabel.toLowerCase(),
    updatedAt,
    requestId: useServer ? "watchlist-server" : "watchlist-guest",
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Watchlist</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={props.mode}
          onChange={(event) => props.onPersist({ mode: event.target.value as "BEGINNER" | "ADVANCED" })}
          disabled={props.locked}
        >
          <option value="BEGINNER">Beginner</option>
          <option value="ADVANCED">Advanced</option>
        </select>
      </div>

      <div className="inline-flex rounded border border-neutral-700 bg-neutral-950 p-0.5">
        <button
          type="button"
          className={`rounded px-2 py-1 text-[11px] ${viewMode === "teams" ? "bg-neutral-700 text-white" : "text-neutral-300"}`}
          onClick={() => void onViewModeChange("teams")}
          disabled={props.locked}
        >
          Teams
        </button>
        <button
          type="button"
          className={`rounded px-2 py-1 text-[11px] ${viewMode === "players" ? "bg-neutral-700 text-white" : "text-neutral-300"}`}
          onClick={() => void onViewModeChange("players")}
          disabled={props.locked}
        >
          Players
        </button>
      </div>

      {viewMode === "teams" ? (
        <>
          <form className="grid grid-cols-2 gap-2" onSubmit={(event) => void addTeam(event)}>
            <input className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1" placeholder="Team key" value={teamKey} onChange={(e) => setTeamKey(e.target.value)} />
            <input className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1" placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <button className="col-span-2 rounded border border-neutral-700 px-2 py-1" type="submit">Add team</button>
          </form>
          <p className="text-neutral-400">Why it matters: your top {guestWatchlistLimit()} teams stay visible across widgets.</p>
          {error ? <p className="text-amber-300">{error}</p> : null}

          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded border border-neutral-700 bg-neutral-950 p-2">
              <span>{item.teamName} ({item.teamKey})</span>
              <button type="button" onClick={() => void remove(item.id)} disabled={props.locked}>Remove</button>
            </div>
          ))}
          {items.length === 0 ? <p className="text-neutral-500">No teams added yet.</p> : null}

          <div className="text-[10px] text-neutral-500">Updated {to12h(teamsMeta.updatedAt)} · Source {sourceLabel}</div>
        </>
      ) : (
        <>
          <SportTabs value={playerSportKey} onChange={(next) => void onPlayerSportChange(next)} disabled={props.locked} />

          <input
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            value={playerQuery}
            onChange={(event) => setPlayerQuery(event.target.value)}
            placeholder={`Search ${sportLabel(playerSportKey)} players (3+ chars)`}
            disabled={props.locked}
          />

          {playerQuery.trim().length < 3 ? <p className="text-neutral-400">Type 3+ chars to search players.</p> : null}

          {playerResults.length > 0 ? (
            <div className="max-h-40 space-y-1 overflow-auto rounded border border-neutral-700 bg-neutral-950 p-1">
              {playerResults.map((result) => (
                <div key={`${playerSportKey}-${result.playerId}`} className="flex items-center justify-between rounded px-1 py-1 hover:bg-neutral-800">
                  <span>{result.fullName} · {result.teamName ?? "-"} · {result.position ?? "-"}</span>
                  <button type="button" className="rounded border border-neutral-700 px-2 py-0.5" onClick={() => void addPlayer(result)} disabled={props.locked}>Add</button>
                </div>
              ))}
            </div>
          ) : null}

          <p className="text-neutral-400">{playersForSport.length}/10 players in {sportLabel(playerSportKey)} watchlist.</p>

          {playersForSport.length > 0 ? (
            <div className="space-y-1 rounded border border-neutral-700 bg-neutral-950 p-2">
              {playersForSport.map((player) => (
                <div key={`${playerSportKey}-watch-${player.playerId}`} className="flex items-center justify-between border-b border-neutral-800 py-1 last:border-b-0">
                  <button type="button" className="text-left text-neutral-100" onClick={() => void loadPlayerProfile(player.playerId)}>
                    {player.fullName} · {player.teamName ?? "-"}
                  </button>
                  <button type="button" onClick={() => void removePlayer(player.playerId)} disabled={props.locked}>Remove</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500">No players added for this sport yet.</p>
          )}

          {lastProfile ? (
            <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
              <p className="font-medium">{lastProfile.fullName}</p>
              <p>{lastProfile.teamName ?? "-"} · {lastProfile.position ?? "-"} #{lastProfile.jersey ?? "-"}</p>
              <p>{lastProfile.height ?? "-"} · {lastProfile.weight ?? "-"} · Age {typeof lastProfile.age === "number" ? lastProfile.age : "-"}</p>
            </div>
          ) : null}

          <div className="text-[10px] text-neutral-500">
            Updated {lastProfileMeta ? to12h(lastProfileMeta.updatedAt) : "-"} · Source {lastProfileMeta ? lastProfileMeta.sourceUsed.toUpperCase() : "-"}
          </div>

          {playerError ? <p className="text-amber-300">{playerError}</p> : null}
        </>
      )}

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({
          widgetId: props.widgetId,
          mode: viewMode,
          sportKey: playerSportKey,
          error,
          playerError,
          itemCount: items.length,
          playerCounts: {
            nfl: playerWatchlist.nfl.length,
            mlb: playerWatchlist.mlb.length,
            nba: playerWatchlist.nba.length,
          },
          playersEndpoint,
          teamsMeta,
          lastProfileMeta,
        })}
      >
        Report a bug
      </button>
    </div>
  );
}
