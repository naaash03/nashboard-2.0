
"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useMode } from "@/app/context/ModeContext";

type WatchlistItem = {
  id: string;
  name: string;
  team: string;
  position: string;
  note: string;
};

export function PlayerWatchlist() {
  const { mode } = useMode();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [position, setPosition] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isBeginner = mode === "beginner";


  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/watchlist");
        if (!res.ok) {
          throw new Error("Failed to load watchlist");
        }

        const data: WatchlistItem[] = await res.json();
        if (!cancelled) {
          setItems(data);
        }
      } catch (err) {
        console.error("Error loading watchlist:", err);
        if (!cancelled) {
          setError("Could not load watchlist right now. Try again in a moment.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !team || !position) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, team, position, note }),
      });

      if (!res.ok) {
        throw new Error("Failed to add player");
      }

      const created: WatchlistItem = await res.json();
      setItems((prev) => [created, ...prev]);


      setName("");
      setTeam("");
      setPosition("");
      setNote("");
    } catch (err) {
      console.error("Error adding player:", err);
      setError("Could not add player to watchlist. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {

    setItems((prev) => prev.filter((p) => p.id !== id));

    try {
      const res = await fetch(`/api/watchlist?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete");
      }
    } catch (err) {
      console.error("Error deleting player:", err);

      setError("Could not remove player. Refresh the page to sync.");
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-100 md:text-base">
            Player watchlist
          </h2>
          <p className="text-[11px] text-slate-400">
            {isBeginner
              ? "Track a few players you care about most. Use this to sanity-check your model against what you see on TV."
              : "Pin key edges by player so you can compare your projections vs market lines quickly."}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleAdd}
        className="mb-3 grid gap-2 text-[11px] md:grid-cols-2 xl:grid-cols-4"
      >
        <input
          className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 outline-none placeholder:text-slate-500"
          placeholder="Player name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 outline-none placeholder:text-slate-500"
          placeholder="Team"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
        />
        <input
          className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 outline-none placeholder:text-slate-500"
          placeholder="Position (QB, RB, WR...)"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
        <div className="flex gap-2 md:col-span-2 xl:col-span-1">
          <input
            className="flex-1 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 outline-none placeholder:text-slate-500"
            placeholder={isBeginner ? "Why are you watching this player?" : "Note (matchup, prop line, etc.)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="submit"
            disabled={submitting || !name || !team || !position}
            className="whitespace-nowrap rounded-md border border-emerald-500/60 bg-emerald-600/80 px-3 py-1 text-xs font-medium text-slate-950 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {submitting ? "Adding..." : "Add"}
          </button>
        </div>
      </form>

      {error && (
        <p className="mb-2 text-[11px] text-rose-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[11px] text-slate-400">Loading your watchlist...</p>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-slate-400">
          No players yet. Start by adding one or two you care about tonight.
        </p>
      ) : (
        <ul className="space-y-2 text-xs">
          {items.map((p) => (
            <li
              key={p.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">
                    {p.name}
                  </span>
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-px text-[10px] uppercase tracking-wide text-slate-300">
                    {p.position}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {p.team}
                </span>
                {p.note && (
                  <p className="mt-1 text-[11px] text-slate-300">
                    {p.note}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                className="text-[11px] text-slate-400 hover:text-rose-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

