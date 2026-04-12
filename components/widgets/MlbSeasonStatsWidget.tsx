"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StatLabel from "@/components/stats/StatLabel";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import type { RankingContext } from "@/lib/stats/rankability";

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
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let year = currentYear; year >= 2020; year -= 1) {
      years.push(year);
    }
    return years;
  }, [currentYear]);

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
  const initialTeamKey = (config.teamKey ?? "").toUpperCase();
  const [teamKey, setTeamKey] = useState<string>(initialTeamKey);
  const [teamInput, setTeamInput] = useState<string>(initialTeamKey);
  const [season, setSeason] = useState<number>(config.season ?? currentYear);
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
      setPlayerStats(null);
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
        setWarning(json.meta?.warning ?? (!json.data ? "No player season stats are available right now." : null));
      } catch (error) {
        setWarning(String(error));
      } finally {
        setLoading(false);
      }
    },
    [props.dataMode],
  );

  const loadTeamStats = useCallback(
    async (key: string, year: number) => {
      setLoading(true);
      setWarning(null);
      setTeamStats(null);
      try {
        const res = await fetch(
          `/api/widgets/mlb-season-stats?mode=team&teamKey=${encodeURIComponent(key)}&season=${year}&dataMode=${props.dataMode}`,
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
        setWarning(json.meta?.warning ?? (!json.data ? "No team season stats are available right now." : null));
      } catch (error) {
        setWarning(String(error));
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
        // Ignore search errors.
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, props.dataMode]);

  async function persistConfig(updates: Partial<typeof config>) {
    const next = { ...config, tabMode, playerId, playerName, teamKey, season, ...updates };
    await props.onPersist({ config: next });
  }

  async function applyTeamSelection() {
    const nextTeamKey = teamInput.trim().toUpperCase();
    setTeamInput(nextTeamKey);
    setTeamKey(nextTeamKey);
    setTeamStats(null);
    setMeta(null);
    setWarning(null);
    await props.onPersist({ config: { ...config, tabMode: "team", playerId, playerName, teamKey: nextTeamKey, season } });
  }

  function selectPlayer(result: PlayerSearchResult) {
    setPlayerId(result.playerId);
    setPlayerName(result.fullName);
    setSearchQuery("");
    setSearchResults([]);
    void persistConfig({ playerId: result.playerId, playerName: result.fullName });
  }

  const selectedHitting = (playerStats?.hitting ?? []).find((row) => row.season === season) ?? null;
  const selectedPitching = (playerStats?.pitching ?? []).find((row) => row.season === season) ?? null;

  const playerRankingContext: RankingContext | undefined = playerId
    ? {
        entityType: "player",
        entityId: playerId,
        entityName: playerName || playerStats?.playerName,
        season,
        sport: "MLB",
      }
    : undefined;

  const teamRankingContext: RankingContext | undefined = teamKey
    ? {
        entityType: "team",
        teamKey,
        entityName: teamStats?.teamName,
        season,
        sport: "MLB",
      }
    : undefined;

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

      {tabMode === "player" && (
        <div className="space-y-2">
          <div className="relative flex gap-2">
            <div className="relative flex-1">
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
                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded border border-neutral-700 bg-neutral-900 shadow-lg">
                  {searchResults.slice(0, 6).map((result) => (
                    <button
                      key={result.playerId}
                      type="button"
                      className="block w-full px-2 py-1 text-left hover:bg-neutral-800"
                      onClick={() => selectPlayer(result)}
                    >
                      {result.fullName}
                      {result.teamKey ? ` · ${result.teamKey}` : ""}
                      {result.position ? ` · ${result.position}` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select
              className="w-28 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
              value={season}
              onChange={(e) => {
                const nextSeason = Number.parseInt(e.target.value, 10) || currentYear;
                setSeason(nextSeason);
                void persistConfig({ season: nextSeason });
              }}
              disabled={props.locked}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {loading && <p className="text-neutral-400">Loading player stats...</p>}
          {!playerId && !loading && <p className="text-neutral-400">Search for a player name to load season stats.</p>}
          {playerId && !playerStats && !loading && !warning && <p className="text-neutral-400">No player season stats are available for this selection.</p>}

          {playerStats && !loading && (
            <div className="space-y-2">
              <p className="text-neutral-400">
                Showing {season} stats for {playerName || playerStats.playerName || playerStats.playerId}
              </p>

              {!advanced && selectedHitting && !selectedPitching && (
                <div className="rounded border border-neutral-800 bg-neutral-900/50 px-2.5 py-2 text-neutral-400">
                  Key stats: <span className="text-neutral-300">AVG</span> (batting average), <span className="text-neutral-300">HR</span> (home runs), <span className="text-neutral-300">RBI</span> (runs batted in). Higher is better for all three.
                </div>
              )}
              {!advanced && selectedPitching && !selectedHitting && (
                <div className="rounded border border-neutral-800 bg-neutral-900/50 px-2.5 py-2 text-neutral-400">
                  Key stats: <span className="text-neutral-300">ERA</span> (earned runs per 9 innings, lower is better) and <span className="text-neutral-300">K</span> (strikeouts, higher is better).
                </div>
              )}
              {!advanced && selectedHitting && selectedPitching && (
                <div className="rounded border border-neutral-800 bg-neutral-900/50 px-2.5 py-2 text-neutral-400">
                  Hitting: <span className="text-neutral-300">AVG, HR, RBI</span>. Pitching: <span className="text-neutral-300">ERA</span> (lower is better) and <span className="text-neutral-300">K</span>.
                </div>
              )}

              {selectedHitting && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">Hitting</p>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-neutral-500">
                        <th className="py-1 text-left">Year</th>
                        <th className="py-1 text-right"><StatLabel label="G" statKey="games_played" sport="MLB" mode={props.mode} /></th>
                        <th className="py-1 text-right"><StatLabel label="AVG" statKey="avg" sport="MLB" mode={props.mode} rankingContext={playerRankingContext} /></th>
                        <th className="py-1 text-right"><StatLabel label="HR" statKey="hr" sport="MLB" mode={props.mode} /></th>
                        <th className="py-1 text-right"><StatLabel label="RBI" statKey="rbi" sport="MLB" mode={props.mode} /></th>
                        {advanced && <th className="py-1 text-right"><StatLabel label="OBP" statKey="obp" sport="MLB" mode={props.mode} rankingContext={playerRankingContext} /></th>}
                        {advanced && <th className="py-1 text-right"><StatLabel label="SLG" statKey="slg" sport="MLB" mode={props.mode} rankingContext={playerRankingContext} /></th>}
                        {advanced && <th className="py-1 text-right"><StatLabel label="OPS" statKey="ops" sport="MLB" mode={props.mode} rankingContext={playerRankingContext} /></th>}
                        {advanced && <th className="py-1 text-right"><StatLabel label="BB" statKey="walks" sport="MLB" mode={props.mode} /></th>}
                        {advanced && <th className="py-1 text-right"><StatLabel label="K" statKey="strikeouts" sport="MLB" mode={props.mode} /></th>}
                        {advanced && <th className="py-1 text-right"><StatLabel label="SB" statKey="stolen_bases" sport="MLB" mode={props.mode} /></th>}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-neutral-800">
                        <td className="py-1">{selectedHitting.season}</td>
                        <td className="py-1 text-right text-neutral-400">{selectedHitting.gamesPlayed ?? "-"}</td>
                        <td className="py-1 text-right">{selectedHitting.avg ?? "-"}</td>
                        <td className="py-1 text-right">{selectedHitting.hr ?? "-"}</td>
                        <td className="py-1 text-right">{selectedHitting.rbi ?? "-"}</td>
                        {advanced && <td className="py-1 text-right text-neutral-400">{selectedHitting.obp ?? "-"}</td>}
                        {advanced && <td className="py-1 text-right text-neutral-400">{selectedHitting.slg ?? "-"}</td>}
                        {advanced && <td className="py-1 text-right text-neutral-400">{selectedHitting.ops ?? "-"}</td>}
                        {advanced && <td className="py-1 text-right text-neutral-400">{selectedHitting.baseOnBallsHitting ?? "-"}</td>}
                        {advanced && <td className="py-1 text-right text-neutral-400">{selectedHitting.strikeOutsHitting ?? "-"}</td>}
                        {advanced && <td className="py-1 text-right text-neutral-400">{selectedHitting.stolenBases ?? "-"}</td>}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {selectedPitching && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">Pitching</p>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-neutral-500">
                        <th className="py-1 text-left">Year</th>
                        <th className="py-1 text-right"><StatLabel label="G" statKey="games_played" sport="MLB" mode={props.mode} /></th>
                        <th className="py-1 text-right"><StatLabel label="ERA" statKey="era" sport="MLB" mode={props.mode} rankingContext={playerRankingContext} /></th>
                        <th className="py-1 text-right"><StatLabel label="K" statKey="strikeouts" sport="MLB" mode={props.mode} /></th>
                        {advanced && <th className="py-1 text-right"><StatLabel label="W" statKey="wins" sport="MLB" mode={props.mode} /></th>}
                        {advanced && <th className="py-1 text-right"><StatLabel label="L" statKey="losses" sport="MLB" mode={props.mode} /></th>}
                        {advanced && <th className="py-1 text-right"><StatLabel label="WHIP" statKey="whip" sport="MLB" mode={props.mode} rankingContext={playerRankingContext} /></th>}
                        {advanced && <th className="py-1 text-right"><StatLabel label="IP" statKey="innings_pitched" sport="MLB" mode={props.mode} rankingContext={playerRankingContext} /></th>}
                        {advanced && <th className="py-1 text-right"><StatLabel label="GS" statKey="games_started" sport="MLB" mode={props.mode} /></th>}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-neutral-800">
                        <td className="py-1">{selectedPitching.season}</td>
                        <td className="py-1 text-right text-neutral-400">{selectedPitching.gamesPlayed ?? "-"}</td>
                        <td className="py-1 text-right">{selectedPitching.era ?? "-"}</td>
                        <td className="py-1 text-right">{selectedPitching.strikeOuts ?? "-"}</td>
                        {advanced && <td className="py-1 text-right text-neutral-400">{selectedPitching.wins ?? "-"}</td>}
                        {advanced && <td className="py-1 text-right text-neutral-400">{selectedPitching.losses ?? "-"}</td>}
                        {advanced && <td className="py-1 text-right text-neutral-400">{selectedPitching.whip ?? "-"}</td>}
                        {advanced && <td className="py-1 text-right text-neutral-400">{selectedPitching.inningsPitched ?? "-"}</td>}
                        {advanced && <td className="py-1 text-right text-neutral-400">{selectedPitching.gamesStarted ?? "-"}</td>}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {!selectedHitting && !selectedPitching && (
                <p className="text-neutral-400">No stats found for {season}. Pick another year.</p>
              )}
            </div>
          )}
        </div>
      )}

      {tabMode === "team" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
              placeholder="Team (e.g. NYM)"
              value={teamInput}
              onChange={(e) => setTeamInput(e.target.value.toUpperCase())}
            />
            <select
              className="w-28 rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
              value={season}
              onChange={(e) => {
                const nextSeason = Number.parseInt(e.target.value, 10) || currentYear;
                setSeason(nextSeason);
                void persistConfig({ season: nextSeason });
              }}
              disabled={props.locked}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button
              className="rounded border border-neutral-700 px-2 py-1"
              type="button"
              onClick={() => void applyTeamSelection()}
              disabled={props.locked}
            >
              View
            </button>
          </div>

          {loading && <p className="text-neutral-400">Loading team stats...</p>}
          {!teamKey && !loading && <p className="text-neutral-400">Enter a team abbreviation and press View.</p>}
          {teamInput && teamInput !== teamKey && <p className="text-[10px] text-neutral-500">Press View to load {teamInput}.</p>}
          {teamKey && !teamStats && !loading && !warning && <p className="text-neutral-400">No team season stats are available for this selection.</p>}

          {teamStats && !loading && (
            <div className="space-y-2">
              <p className="font-medium">
                {teamStats.teamName} {teamStats.season}
              </p>
              {!advanced && (
                <div className="rounded border border-neutral-800 bg-neutral-900/50 px-2.5 py-2 text-neutral-400">
                  <span className="text-neutral-300">Run Diff</span> (runs scored minus runs allowed) is one of the best quick reads on team performance. Positive means more runs scored than allowed.
                </div>
              )}
              <p className="text-neutral-400">
                <StatLabel label="W-L" statKey="w_l_record" sport="MLB" mode={props.mode} rankingContext={teamRankingContext} />: {teamStats.record.wins}-{teamStats.record.losses} ({teamStats.record.pct})
                {teamStats.record.divisionRank !== undefined ? ` · Div Rank: ${teamStats.record.divisionRank}` : ""}
                {teamStats.record.gamesBack ? ` · GB: ${teamStats.record.gamesBack}` : ""}
              </p>

              <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
                <div className="mb-1.5 grid grid-cols-2 gap-x-4 text-[10px] uppercase tracking-wide text-neutral-600">
                  <span>Hitting</span>
                  <span>Pitching</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between gap-1">
                    <span className="text-neutral-400"><StatLabel label="AVG" statKey="avg" sport="MLB" mode={props.mode} /></span>
                    <span className="text-white">{teamStats.hitting.avg ?? "-"}</span>
                  </div>
                  <div className="flex justify-between gap-1">
                    <span className="text-neutral-400"><StatLabel label="ERA" statKey="era" sport="MLB" mode={props.mode} /></span>
                    <span className="text-white">{teamStats.pitching.era ?? "-"}</span>
                  </div>
                  {advanced && (
                    <div className="flex justify-between gap-1">
                      <span className="text-neutral-400"><StatLabel label="OBP" statKey="obp" sport="MLB" mode={props.mode} /></span>
                      <span className="text-white">{teamStats.hitting.obp ?? "-"}</span>
                    </div>
                  )}
                  {advanced && (
                    <div className="flex justify-between gap-1">
                      <span className="text-neutral-400"><StatLabel label="WHIP" statKey="whip" sport="MLB" mode={props.mode} /></span>
                      <span className="text-white">{teamStats.pitching.whip ?? "-"}</span>
                    </div>
                  )}
                  {advanced && (
                    <div className="flex justify-between gap-1">
                      <span className="text-neutral-400"><StatLabel label="SLG" statKey="slg" sport="MLB" mode={props.mode} /></span>
                      <span className="text-white">{teamStats.hitting.slg ?? "-"}</span>
                    </div>
                  )}
                  {advanced && (
                    <div className="flex justify-between gap-1">
                      <span className="text-neutral-400"><StatLabel label="K" statKey="strikeouts" sport="MLB" mode={props.mode} /> (pit)</span>
                      <span className="text-white">{teamStats.pitching.strikeOuts ?? "-"}</span>
                    </div>
                  )}
                  {advanced && (
                    <div className="flex justify-between gap-1">
                      <span className="text-neutral-400"><StatLabel label="OPS" statKey="ops" sport="MLB" mode={props.mode} /></span>
                      <span className="text-white">{teamStats.hitting.ops ?? "-"}</span>
                    </div>
                  )}
                  {advanced && (
                    <div className="flex justify-between gap-1">
                      <span className="text-neutral-400"><StatLabel label="Saves" statKey="saves" sport="MLB" mode={props.mode} /></span>
                      <span className="text-white">{teamStats.pitching.saves ?? "-"}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-1">
                    <span className="text-neutral-400"><StatLabel label="Runs" statKey="runs_scored" sport="MLB" mode={props.mode} /></span>
                    <span className="text-white">{teamStats.hitting.runsScored ?? "-"}</span>
                  </div>
                  <div className="flex justify-between gap-1">
                    <span className="text-neutral-400"><StatLabel label="RA" statKey="runs_allowed" sport="MLB" mode={props.mode} /></span>
                    <span className="text-white">{teamStats.pitching.runsAllowed ?? "-"}</span>
                  </div>
                  {teamStats.hitting.runsScored !== undefined && teamStats.pitching.runsAllowed !== undefined && (
                    <div className="flex justify-between gap-1">
                      <span className="text-neutral-400"><StatLabel label="Run Diff" statKey="run_differential" sport="MLB" mode={props.mode} rankingContext={teamRankingContext} /></span>
                      <span className={teamStats.hitting.runsScored - teamStats.pitching.runsAllowed >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {teamStats.hitting.runsScored - teamStats.pitching.runsAllowed >= 0 ? "+" : ""}
                        {teamStats.hitting.runsScored - teamStats.pitching.runsAllowed}
                      </span>
                    </div>
                  )}
                  {advanced && (
                    <div className="flex justify-between gap-1">
                      <span className="text-neutral-400"><StatLabel label="HR" statKey="hr" sport="MLB" mode={props.mode} /></span>
                      <span className="text-white">{teamStats.hitting.hr ?? "-"}</span>
                    </div>
                  )}
                  {advanced && (
                    <div className="flex justify-between gap-1">
                      <span className="text-neutral-400"><StatLabel label="BS" statKey="blown_saves" sport="MLB" mode={props.mode} /></span>
                      <span className="text-white">{teamStats.pitching.blownSaves ?? "-"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} · Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
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
