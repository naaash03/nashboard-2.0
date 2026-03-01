"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import {
  addGuestWatchlistTeam,
  getGuestWatchlist,
  guestWatchlistLimit,
  removeGuestWatchlistTeam,
  type GuestWatchlistItem,
} from "@/lib/guest/watchlist";

type WatchItem = GuestWatchlistItem;

type WatchlistResponse = {
  items?: WatchItem[];
  error?: string;
};

export function shouldUseServerWatchlist(props: Pick<WidgetCommonProps, "viewerMode" | "authConfigured" | "dbConfigured">): boolean {
  return props.viewerMode === "signed_in" && props.authConfigured && props.dbConfigured;
}

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function WatchlistWidget(props: WidgetCommonProps) {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [teamKey, setTeamKey] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(new Date().toISOString());
  const useServer = shouldUseServerWatchlist(props);
  const sourceLabel = useServer ? "ESPN" : "Guest";

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

  const meta: WidgetMeta = {
    sourceUsed: sourceLabel.toLowerCase(),
    updatedAt,
    requestId: useServer ? "watchlist-server" : "watchlist-guest",
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Watchlist (NFL Teams)</span>
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

      <div className="text-[10px] text-neutral-500">Updated {to12h(meta.updatedAt)} · Source {sourceLabel}</div>
      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, error, itemCount: items.length, meta })}
      >
        Report a bug
      </button>
    </div>
  );
}
