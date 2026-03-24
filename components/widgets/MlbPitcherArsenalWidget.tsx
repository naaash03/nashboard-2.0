"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type SearchResult = {
  playerId: string;
  fullName: string;
  teamKey?: string;
  position?: string;
};

type PitchEntry = {
  type: string;
  usagePct?: number;
  velocityMph?: number;
  spinRpm?: number;
};

type SeasonStats = {
  era?: string;
  whip?: string;
  inningsPitched?: string;
  strikeOuts?: number;
  wins?: number;
  losses?: number;
  gamesStarted?: number;
};

type ArsenalData = {
  playerId: string;
  playerName?: string;
  season: number;
  pitches: PitchEntry[];
  seasonStats?: SeasonStats;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function MlbPitcherArsenalWidget(props: WidgetCommonProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string>(
    (props.config.playerId as string) ?? "",
  );
  const [selectedName, setSelectedName] = useState<string>(
    (props.config.playerName as string) ?? "",
  );
  const [data, setData] = useState<ArsenalData | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced player search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetch(
        `/api/search/mlb-players?q=${encodeURIComponent(query)}&dataMode=${props.dataMode}`,
        { cache: "no-store" },
      )
        .then((r) => r.json())
        .then((j) => setResults((j as { data?: SearchResult[] }).data ?? []));
    }, 250);
  }, [query, props.dataMode]);

  const loadArsenal = useCallback(
    async (pid: string) => {
      const res = await fetch(
        `/api/widgets/mlb-pitcher-arsenal?playerId=${encodeURIComponent(pid)}&dataMode=${props.dataMode}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        data?: ArsenalData | null;
        meta?: WidgetMeta;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load arsenal");
      return { data: json.data ?? null, meta: json.meta ?? null };
    },
    [props.dataMode],
  );

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await loadArsenal(selectedId);
        if (!cancelled) {
          setData(result.data);
          setMeta(result.meta);
          setWarning(null);
        }
      } catch (error) {
        if (!cancelled) setWarning(String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, loadArsenal, props.refreshTick]);

  function selectPlayer(r: SearchResult) {
    setSelectedId(r.playerId);
    setSelectedName(r.fullName);
    setQuery("");
    setResults([]);
    void props.onPersist({
      config: { ...props.config, playerId: r.playerId, playerName: r.fullName },
    });
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Pitcher Arsenal</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={props.mode}
          onChange={(e) =>
            void props.onPersist({ mode: e.target.value as "BEGINNER" | "ADVANCED" })
          }
          disabled={props.locked}
        >
          <option value="BEGINNER">Beginner</option>
          <option value="ADVANCED">Advanced</option>
        </select>
      </div>

      <div className="relative">
        <input
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          placeholder="Search pitcher name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-10 rounded border border-neutral-700 bg-neutral-900">
            {results.map((r) => (
              <button
                key={r.playerId}
                type="button"
                className="block w-full px-2 py-1 text-left hover:bg-neutral-800"
                onClick={() => selectPlayer(r)}
              >
                {r.fullName}
                {r.teamKey ? ` (${r.teamKey})` : ""}
                {r.position ? ` · ${r.position}` : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedName && !data && (
        <p className="text-neutral-400">Selected: {selectedName}</p>
      )}
      {warning && <p className="text-amber-300">{warning}</p>}

      {data && (
        <div className="space-y-1">
          <p className="font-medium">
            {selectedName || data.playerId} · {data.season}
          </p>
          {data.seasonStats && (
            <p className="text-neutral-400">
              {data.seasonStats.wins ?? "-"}W-{data.seasonStats.losses ?? "-"}L ·{" "}
              {data.seasonStats.era ?? "-"} ERA · {data.seasonStats.strikeOuts ?? "-"} K ·{" "}
              {data.seasonStats.inningsPitched ?? "-"} IP
            </p>
          )}
          <div className="space-y-1">
            {data.pitches.map((pitch) => (
              <div
                key={pitch.type}
                className="rounded border border-neutral-700 bg-neutral-950 p-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{pitch.type}</span>
                  <span>
                    {pitch.usagePct !== undefined ? `${pitch.usagePct}%` : "-"}
                  </span>
                </div>
                {props.mode === "ADVANCED" && (
                  <div className="flex gap-3 text-neutral-400">
                    {pitch.velocityMph !== undefined && (
                      <span>{pitch.velocityMph} mph</span>
                    )}
                    {pitch.spinRpm !== undefined && (
                      <span>{pitch.spinRpm} rpm</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source{" "}
        {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>
      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() =>
          props.onReportBug({ widgetId: props.widgetId, meta, warning, selectedId })
        }
      >
        Report a bug
      </button>
    </div>
  );
}
