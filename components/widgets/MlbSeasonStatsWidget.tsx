"use client";

import { useCallback, useEffect, useState } from "react";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type PlayerYearStats = {
  season: number;
  gamesPlayed?: number;
  avg?: string;
  hr?: number;
  rbi?: number;
  ops?: string;
  obp?: string;
  slg?: string;
  strikeOutsHitting?: number;
  baseOnBallsHitting?: number;
  stolenBases?: number;
  babip?: string;
  wins?: number;
  losses?: number;
  era?: string;
  whip?: string;
  inningsPitched?: string;
  strikeOuts?: number;
  gamesStarted?: number;
};

type PlayerSeasonStats = {
  playerId: string;
  playerName?: string;
  position?: string;
  hitting: PlayerYearStats[];
  pitching: PlayerYearStats[];
};

type TeamRecord = {
  wins: number;
  losses: number;
  pct: string;
  divisionRank?: number;
  gamesBack?: string;
};

type TeamSeasonStats = {
  teamKey: string;
  teamName: string;
  season: number;
  record: TeamRecord;
  hitting: {
    avg?: string;
    obp?: string;
    slg?: string;
    ops?: string;
    runsScored?: number;
    hr?: number;
    strikeOuts?: number;
    baseOnBalls?: number;
  };
  pitching: {
    era?: string;
    whip?: string;
    strikeOuts?: number;
    runsAllowed?: number;
    saves?: number;
    blownSaves?: number;
  };
};

type PlayerSearchResult = {
  playerId: string;
  fullName: string;
  teamKey?: string;
  position?: string;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function MlbSeasonStatsWidget(props: WidgetCommonProps) {
  const config = props.config as {
    tabMode?: "player" | "team";
    playerId?: string;
    playerName?: string;
    teamKey?: string;
    season?: number;
  };

  const [tabMode, setTabMode] = useState<"player" | "team">(config.tabMode ?? "player");
  const [playerId, setPlayerId] = useState<string>(config.playerId ?? "");
  const [playerName, setPlayerName] = useState<string>(config.playerName ?? "");
  const [teamKey, setTeamKey] = useState<string>(config.teamKey ?? "");
  const [season, setSeason] = useState<number>(config.season ?? new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);

  const [playerStats, setPlayerStats] = useState<PlayerSeasonStats | null>(null);
  const [teamStats, setTeamStats] = useState<TeamSeasonStats | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const advanced = props.mode === "ADVANCED";

  const loadPlayerStats = useCallback(
    async (pid: string) => {
      setLoading(true);
      setWarning(null);
      try {
        const res = await fetch(
          `/api/widgets/mlb-season-stats?mode=player&playerId=${encodeURIComponent(pid)}&dataMode=${props.dataMode}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as {
          data?: PlayerSeasonStats | null;
          meta?: WidgetMeta;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Failed to load player stats");
        setPlayerStats(json.data ?? null);
        setMeta(json.meta ?? null);
      } catch (err) {
        setWarning(String(err));
      } finally {
        setLoading(false);
      }
    },
    [props.dataMode],
  );

  const loadTeamStats = useCallback(
    async (key: string, yr: number) => {
      setLoading(true);
      setWarning(null);
      try {
        const res = await fetch(
          `/api/widgets/mlb-season-stats?mode=team&teamKey=${encodeURIComponent(key)}&season=${yr}&dataMode=${props.dataMode}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as {
          data?: TeamSeasonStats | null;
          meta?: WidgetMeta;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Failed to load team stats");
        setTeamStats(json.data ?? null);
        setMeta(json.meta ?? null);
      } catch (err) {
        setWarning(String(err));
      } finally {
        setLoading(false);
      }
    },
    [props.dataMode],
  );

  useEffect(() => {
    if (tabMode === "player" && playerId) {
      void loadPlayerStats(playerId);
    }
  }, [tabMode, playerId, loadPlayerStats, props.refreshTick]);

  useEffect(() => {
    if (tabMode === "team" && teamKey) {
      void loadTeamStats(teamKey, season);
    }
  }, [tabMode, teamKey, season, loadTeamStats, props.refreshTick]);

  // Player search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/mlb-players?q=${encodeURIComponent(searchQuery)}&dataMode=${props.dataMode}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { data?: PlayerSearchResult[] };
        if (!cancelled) setSearchResults(json.data ?? []);
      } catch {
        // Swallow search errors
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, props.dataMode]);

  async function persistConfig(updates: Partial<typeof config>) {
    const next = { ...config, tabMode, playerId, playerName, teamKey, season, ...updates };
    await props.onPersist({ config: next });
  }

  function selectPlayer(result: PlayerSearchResult) {
    setPlayerId(result.playerId);
    setPlayerName(result.fullName);
    setSearchQuery("");
    setSearchResults([]);
    void persistConfig({ playerId: result.playerId, playerName: result.fullName });
  }

  // Get last 3 hitting seasons (most recent first)
  const recentHitting = [...(playerStats?.hitting ?? [])]
    .sort((a, b) => b.season - a.season)
    .slice(0, 3);

  // Get last 3 pitching seasons (most recent first)
  const recentPitching = [...(playerStats?.pitching ?? [])]
    .sort((a, b) => b.season - a.season)
    .slice(0, 3);

  const hasPitching = recentPitching.length > 0;
  const hasHitting = recentHitting.length > 0;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Season Stats</span>
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

      {/* Tab toggle */}
      <div className="flex gap-1">
        <button
          type="button"
          className={`flex-1 rounded border px-2 py-1 ${
            tabMode === "player"
              ? "border-blue-500 bg-blue-950 text-blue-200"
              : "border-neutral-700 bg-neutral-950"
          }`}
          onClick={() => {
            setTabMode("player");
            void persistConfig({ tabMode: "player" });
          }}
          disabled={props.locked}
        >
          Player
        </button>
        <button
          type="button"
          className={`flex-1 rounded border px-2 py-1 ${
            tabMode === "team"
              ? "border-blue-500 bg-blue-950 text-blue-200"
              : "border-neutral-700 bg-neutral-950"
          }`}
          onClick={() => {
            setTabMode("team");
            void persistConfig({ tabMode: "team" });
          }}
          disabled={props.locked}
        >
          Team
        </button>
      </div>

      {warning && <p className="text-amber-300">{warning}</p>}

      {/* Player Tab */}
      {tabMode === "player" && (
        <div className="space-y-2">
          <div className="relative">
            <input
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
              placeholder="Search player name..."
              value={searchQuery || playerName}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPlayerName("");
              }}
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded border border-neutral-700 bg-neutral-900 shadow-lg">
                {searchResults.slice(0, 6).map((r) => (
                  <button
                    key={r.playerId}
                    type="button"
                    className="block w-full px-2 py-1 text-left hover:bg-neutral-800"
                    onClick={() => selectPlayer(r)}
                  >
                    {r.fullName}
                    {r.teamKey ? ` · ${r.teamKey}` : ""}
                    {r.position ? ` · ${r.position}` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && <p className="text-neutral-400">Loading stats...</p>}

          {playerStats && !loading && (
            <div className="space-y-2">
              {hasHitting && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500">Hitting</p>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-neutral-500">
                        <th className="py-0.5 text-left">Year</th>
                        <th className="py-0.5 text-right">G</th>
                        <th className="py-0.5 text-right">AVG</th>
                        <th className="py-0.5 text-right">HR</th>
                        <th className="py-0.5 text-right">RBI</th>
                        {advanced && <th className="py-0.5 text-right">OBP</th>}
                        {advanced && <th className="py-0.5 text-right">SLG</th>}
                        {advanced && <th className="py-0.5 text-right">OPS</th>}
                        {advanced && <th className="py-0.5 text-right">BB</th>}
                        {advanced && <th className="py-0.5 text-right">K</th>}
                        {advanced && <th className="py-0.5 text-right">SB</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {recentHitting.map((row) => (
                        <tr key={row.season} className="border-t border-neutral-800">
                          <td className="py-0.5">{row.season}</td>
                          <td className="py-0.5 text-right text-neutral-400">{row.gamesPlayed ?? "-"}</td>
                          <td className="py-0.5 text-right">{row.avg ?? "-"}</td>
                          <td className="py-0.5 text-right">{row.hr ?? "-"}</td>
                          <td className="py-0.5 text-right">{row.rbi ?? "-"}</td>
                          {advanced && <td className="py-0.5 text-right text-neutral-400">{row.obp ?? "-"}</td>}
                          {advanced && <td className="py-0.5 text-right text-neutral-400">{row.slg ?? "-"}</td>}
                          {advanced && <td className="py-0.5 text-right text-neutral-400">{row.ops ?? "-"}</td>}
                          {advanced && <td className="py-0.5 text-right text-neutral-400">{row.baseOnBallsHitting ?? "-"}</td>}
                          {advanced && <td className="py-0.5 text-right text-neutral-400">{row.strikeOutsHitting ?? "-"}</td>}
                          {advanced && <td className="py-0.5 text-right text-neutral-400">{row.stolenBases ?? "-"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {advanced && (
                    <p className="text-[10px] text-neutral-600">Note: WAR, wRC+, OPS+ not available in free MLB Stats API</p>
                  )}
                </div>
              )}

              {hasPitching && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500">Pitching</p>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-neutral-500">
                        <th className="py-0.5 text-left">Year</th>
                        <th className="py-0.5 text-right">G</th>
                        <th className="py-0.5 text-right">ERA</th>
                        <th className="py-0.5 text-right">K</th>
                        {advanced && <th className="py-0.5 text-right">W</th>}
                        {advanced && <th className="py-0.5 text-right">L</th>}
                        {advanced && <th className="py-0.5 text-right">WHIP</th>}
                        {advanced && <th className="py-0.5 text-right">IP</th>}
                        {advanced && <th className="py-0.5 text-right">GS</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {recentPitching.map((row) => (
                        <tr key={row.season} className="border-t border-neutral-800">
                          <td className="py-0.5">{row.season}</td>
                          <td className="py-0.5 text-right text-neutral-400">{row.gamesPlayed ?? "-"}</td>
                          <td className="py-0.5 text-right">{row.era ?? "-"}</td>
                          <td className="py-0.5 text-right">{row.strikeOuts ?? "-"}</td>
                          {advanced && <td className="py-0.5 text-right text-neutral-400">{row.wins ?? "-"}</td>}
                          {advanced && <td className="py-0.5 text-right text-neutral-400">{row.losses ?? "-"}</td>}
                          {advanced && <td className="py-0.5 text-right text-neutral-400">{row.whip ?? "-"}</td>}
                          {advanced && <td className="py-0.5 text-right text-neutral-400">{row.inningsPitched ?? "-"}</td>}
                          {advanced && <td className="py-0.5 text-right text-neutral-400">{row.gamesStarted ?? "-"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!hasHitting && !hasPitching && (
                <p className="text-neutral-400">No stats found for this player.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Team Tab */}
      {tabMode === "team" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
              placeholder="Team (e.g. NYM)"
              value={teamKey}
              onChange={(e) => setTeamKey(e.target.value.toUpperCase())}
            />
            <input
              className="w-16 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
              placeholder="Year"
              type="number"
              value={season}
              onChange={(e) => setSeason(parseInt(e.target.value, 10) || new Date().getFullYear())}
            />
            <button
              className="rounded border border-neutral-700 px-2 py-1"
              type="button"
              onClick={() => {
                void loadTeamStats(teamKey, season);
                void persistConfig({ teamKey, season });
              }}
              disabled={props.locked}
            >
              Go
            </button>
          </div>

          {loading && <p className="text-neutral-400">Loading team stats...</p>}

          {teamStats && !loading && (
            <div className="space-y-2">
              <p className="font-medium">
                {teamStats.teamName} {teamStats.season}
              </p>
              <p className="text-neutral-400">
                {teamStats.record.wins}-{teamStats.record.losses} ({teamStats.record.pct})
                {teamStats.record.divisionRank !== undefined
                  ? ` · Div Rank: ${teamStats.record.divisionRank}`
                  : ""}
                {teamStats.record.gamesBack ? ` · GB: ${teamStats.record.gamesBack}` : ""}
              </p>

              <div className="rounded border border-neutral-800 bg-neutral-950 p-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">Hitting</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span>AVG: <span className="text-white">{teamStats.hitting.avg ?? "-"}</span></span>
                  <span>ERA: <span className="text-white">{teamStats.pitching.era ?? "-"}</span></span>
                  {advanced && <span>OBP: <span className="text-white">{teamStats.hitting.obp ?? "-"}</span></span>}
                  {advanced && <span>WHIP: <span className="text-white">{teamStats.pitching.whip ?? "-"}</span></span>}
                  {advanced && <span>SLG: <span className="text-white">{teamStats.hitting.slg ?? "-"}</span></span>}
                  {advanced && <span>K (pit): <span className="text-white">{teamStats.pitching.strikeOuts ?? "-"}</span></span>}
                  {advanced && <span>OPS: <span className="text-white">{teamStats.hitting.ops ?? "-"}</span></span>}
                  {advanced && <span>Saves: <span className="text-white">{teamStats.pitching.saves ?? "-"}</span></span>}
                  <span>Runs: <span className="text-white">{teamStats.hitting.runsScored ?? "-"}</span></span>
                  <span>RA: <span className="text-white">{teamStats.pitching.runsAllowed ?? "-"}</span></span>
                  {advanced && <span>HR: <span className="text-white">{teamStats.hitting.hr ?? "-"}</span></span>}
                  {advanced && <span>BS: <span className="text-white">{teamStats.pitching.blownSaves ?? "-"}</span></span>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source{" "}
        {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>
      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, meta, warning })}
      >
        Report a bug
      </button>
    </div>
  );
}
