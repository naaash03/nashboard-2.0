"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StatLabel from "@/components/stats/StatLabel";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import { MLB_TEAM_OPTIONS } from "@/lib/providers/mlb/teamMap";
import type { MlbStartingPitcherMatchupData, PitcherMatchupCard } from "@/lib/sports/resolvers/mlbStartingPitcherMatchup";

type MatchupResponse = {
  data: MlbStartingPitcherMatchupData | null;
  meta?: (WidgetMeta & {
    fallbackUsed?: boolean;
    state?: "success" | "partial" | "failed";
    notes?: string[];
    warnings?: string[];
  }) | null;
  error?: string | null;
};

type MatchupSide = "away" | "home";

type BullpenDropdownData = {
  starters: Array<{ playerId: string; fullName: string }>;
  relievers: Array<{ playerId: string; fullName: string }>;
};

type PitcherMetricTile = {
  key: string;
  label: string;
  value: unknown;
  digits?: number;
  colSpan2?: boolean;
};

type PitcherNarrativeStat = {
  key: string;
  label: string;
  statKey: string;
  value: unknown;
  digits?: number;
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function toGameDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function findTeamByKey(key: string) {
  return MLB_TEAM_OPTIONS.find((team) => team.key === key.toUpperCase());
}

function parseTeamKeyFromQuery(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();

  const byKey = MLB_TEAM_OPTIONS.find((team) => team.key === upper);
  if (byKey) return byKey.key;

  const byName = MLB_TEAM_OPTIONS.find((team) => team.name.toUpperCase() === upper);
  if (byName) return byName.key;

  const keyFromSuffix = trimmed.match(/\(([A-Za-z]{2,4})\)\s*$/)?.[1]?.toUpperCase();
  if (keyFromSuffix && findTeamByKey(keyFromSuffix)) {
    return keyFromSuffix;
  }

  const byContains = MLB_TEAM_OPTIONS.find((team) => team.name.toUpperCase().includes(upper));
  return byContains?.key ?? null;
}

function metricLabel(value: unknown, digits = 2): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(digits);
  if (typeof value === "string") return value || "-";
  return "-";
}

function hasMetric(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return Number.isFinite(Number(value));
}

function isNumericPlayerId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function toNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function inningsToOuts(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const whole = Math.trunc(value);
    const fractional = Math.round((value - whole) * 10);
    if (fractional < 0 || fractional > 2) return null;
    return whole * 3 + fractional;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(".")) {
    const [wholePart, outPart] = trimmed.split(".");
    const whole = Number.parseInt(wholePart, 10);
    const outs = Number.parseInt(outPart ?? "", 10);
    if (!Number.isFinite(whole) || !Number.isFinite(outs) || outs < 0 || outs > 2) return null;
    return whole * 3 + outs;
  }
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? inningsToOuts(parsed) : null;
}

function formatInningsFromOuts(outs: number): string {
  const whole = Math.floor(outs / 3);
  const remainder = outs % 3;
  return `${whole}.${remainder}`;
}

export function buildPitcherMetricTiles(
  pitcher: PitcherMatchupCard | null,
  mode: "BEGINNER" | "ADVANCED",
): PitcherMetricTile[] {
  if (!pitcher) {
    return [];
  }

  const base: PitcherMetricTile[] = [
    { key: "era", label: "ERA", value: pitcher.era, digits: 2 },
    { key: "record", label: "W-L", value: pitcher.record, digits: 0 },
  ];

  if (mode === "BEGINNER") {
    return base;
  }

  return [
    ...base,
    { key: "whip", label: "WHIP", value: pitcher.whip, digits: 2 },
    { key: "inningsPitched", label: "IP", value: pitcher.inningsPitched, digits: 1 },
    { key: "strikeouts", label: "K", value: pitcher.strikeouts, digits: 0 },
    { key: "kPer9", label: "K/9", value: pitcher.kPer9, digits: 1 },
    { key: "bbPer9", label: "BB/9", value: pitcher.bbPer9, digits: 1 },
    { key: "hrPer9", label: "HR/9", value: pitcher.hrPer9, digits: 1 },
    { key: "opponentAvg", label: "Opp AVG", value: pitcher.opponentAvg, digits: 3, colSpan2: true },
  ].filter((tile) => hasMetric(tile.value));
}

export function buildBeginnerStatLine(pitcher: PitcherMatchupCard | null): string[] {
  if (!pitcher) return [];
  const row: string[] = [];
  if (hasMetric(pitcher.era)) {
    row.push(`ERA ${metricLabel(pitcher.era, 2)}`);
  }
  if (hasMetric(pitcher.record)) {
    row.push(`W-L ${metricLabel(pitcher.record, 0)}`);
  }
  return row;
}

function buildNarrativeStats(pitcher: PitcherMatchupCard | null): PitcherNarrativeStat[] {
  if (!pitcher) return [];
  return [
    { key: "whip", label: "WHIP", statKey: "whip", value: pitcher.whip, digits: 2 },
    { key: "kPer9", label: "K/9", statKey: "k_per_9", value: pitcher.kPer9, digits: 1 },
    { key: "bbPer9", label: "BB/9", statKey: "bb_per_9", value: pitcher.bbPer9, digits: 1 },
    { key: "hrPer9", label: "HR/9", statKey: "hr_per_9", value: pitcher.hrPer9, digits: 1 },
    { key: "opponentAvg", label: "Opp AVG", statKey: "opponent_avg", value: pitcher.opponentAvg, digits: 3 },
  ].filter((stat) => hasMetric(stat.value));
}

export function buildRecentFormSummary(pitcher: PitcherMatchupCard | null): string | null {
  const starts = pitcher?.last3Starts ?? [];
  if (starts.length === 0) return null;

  let totalOuts = 0;
  let totalEarnedRuns = 0;
  let totalStrikeouts = 0;
  let countedStarts = 0;

  for (const start of starts) {
    const outs = inningsToOuts(start.innings);
    const earnedRuns = toNumeric(start.earnedRuns);
    const strikeouts = toNumeric(start.strikeouts);
    if (outs === null || earnedRuns === null) {
      continue;
    }
    totalOuts += outs;
    totalEarnedRuns += earnedRuns;
    totalStrikeouts += strikeouts ?? 0;
    countedStarts += 1;
  }

  if (countedStarts === 0 || totalOuts === 0) {
    return `Last ${starts.length} starts summary is limited.`;
  }

  const innings = totalOuts / 3;
  const era = (totalEarnedRuns * 9) / innings;
  const strikeoutPart = totalStrikeouts > 0 ? `, ${totalStrikeouts} K` : "";
  return `Last ${countedStarts}: ${formatInningsFromOuts(totalOuts)} IP, ${totalEarnedRuns} ER${strikeoutPart} (${era.toFixed(2)} ERA).`;
}

export function buildAdvancedOverview(data: MlbStartingPitcherMatchupData | null): string | null {
  if (!data) return null;
  const edge = data.edge?.overall ?? "Balanced matchup on the mound";
  const categories = data.edge?.categories ?? [];
  const decisive = categories
    .filter((category) => category.winner !== "even")
    .slice(0, 2)
    .map((category) => {
      const winner = category.winner === "away" ? data.game.awayTeam.key : data.game.homeTeam.key;
      return `${winner} leads ${category.label}`;
    });

  if (decisive.length === 0) {
    return edge;
  }

  return `${edge}. ${decisive.join(". ")}.`;
}

function hasPostedStarter(pitcher: PitcherMatchupCard | null): boolean {
  return Boolean(pitcher?.fullName);
}

export function buildMatchupSummary(data: MlbStartingPitcherMatchupData | null): string | null {
  if (!data) return null;
  const awayStarter = data.pitchers.away;
  const homeStarter = data.pitchers.home;

  if (hasPostedStarter(awayStarter) && hasPostedStarter(homeStarter)) {
    return `${data.game.awayTeam.key} starter ${metricLabel(awayStarter?.era)} ERA vs ${data.game.homeTeam.key} starter ${metricLabel(homeStarter?.era)} ERA`;
  }

  if (hasPostedStarter(awayStarter) && !hasPostedStarter(homeStarter)) {
    return `${awayStarter?.fullName ?? data.game.awayTeam.key} announced. ${data.game.homeTeam.key} starter TBD.`;
  }

  if (!hasPostedStarter(awayStarter) && hasPostedStarter(homeStarter)) {
    return `${homeStarter?.fullName ?? data.game.homeTeam.key} announced. ${data.game.awayTeam.key} starter TBD.`;
  }

  return "Probable starters not posted yet.";
}

function shouldShowBeginnerBasisLabel(label?: string): boolean {
  if (!label) return false;
  const lowered = label.toLowerCase();
  return lowered.includes("spring") || lowered.includes("limited") || lowered.includes("regular season");
}

function resolveBeginnerBasisLabel(data: MlbStartingPitcherMatchupData | null): string | null {
  if (!data) return null;
  const away = data.pitchers.away?.statsBasisLabel;
  const home = data.pitchers.home?.statsBasisLabel;
  if (away && home && away === home && shouldShowBeginnerBasisLabel(away)) {
    return away;
  }
  if (shouldShowBeginnerBasisLabel(away)) return away ?? null;
  if (shouldShowBeginnerBasisLabel(home)) return home ?? null;
  return null;
}

function safeMatchupError(message?: string | null): string {
  if (!message) return "Failed to load pitching matchup";
  const lowered = message.toLowerCase();
  if (lowered.includes("no upcoming")) return "No upcoming MLB game found";
  if (lowered.includes("teamkey is required")) return "Select an MLB team to load matchup data.";
  return "Failed to load pitching matchup";
}

function safeMatchupWarning(message?: string): string | null {
  if (!message) return null;
  const lowered = message.toLowerCase();
  if (
    lowered.includes("configured season")
    || lowered.includes("inferred")
    || lowered.includes("schedule window")
    || lowered.includes("time zone")
    || lowered.includes("timezone")
    || lowered.includes("cache")
    || lowered.includes("diagnostic")
    || lowered.includes("endpoint")
  ) {
    return null;
  }
  if (lowered.includes("no upcoming mlb game")) return "No upcoming MLB game found";
  if (lowered.includes("probable starter")) return "Probable starters are not fully posted yet.";
  if (lowered.includes("upstream")) return "MLB data warning. Use Report a bug for diagnostics.";
  return message;
}

function edgeLabelForWinner(winner: MatchupSide | "even", game: MlbStartingPitcherMatchupData["game"]): string {
  if (winner === "away") return game.awayTeam.key;
  if (winner === "home") return game.homeTeam.key;
  return "Even";
}

function categoryWinner(
  matchup: MlbStartingPitcherMatchupData | null,
  categoryLabel: "K/9" | "BB/9" | "Recent Form (3-start ERA)",
): string {
  if (!matchup?.edge?.categories || matchup.edge.categories.length === 0) {
    return "Even";
  }
  const found = matchup.edge.categories.find((row) => row.label === categoryLabel);
  if (!found) return "Even";
  return edgeLabelForWinner(found.winner, matchup.game);
}

function formatSplitsBlock(splits: Record<string, string | number> | undefined): Array<{ label: string; value: string }> {
  if (!splits) return [];
  return Object.entries(splits).map(([key, value]) => ({ label: key, value: metricLabel(value, 2) }));
}

function PitcherCard({
  side,
  pitcher,
  mode,
}: {
  side: MatchupSide;
  pitcher: PitcherMatchupCard | null;
  mode: "BEGINNER" | "ADVANCED";
}) {
  if (!pitcher) {
    return (
      <div className="flex h-full min-h-[126px] flex-col justify-center rounded border border-dashed border-neutral-700 bg-neutral-950 p-3">
        <p className="text-[11px] uppercase tracking-wide text-neutral-400">{side === "away" ? "Away Starter" : "Home Starter"}</p>
        <p className="mt-2 text-neutral-300">Probable starter not posted yet.</p>
        <p className="text-[10px] text-neutral-500">We will update this side when the probable starter is listed.</p>
      </div>
    );
  }

  const last3 = pitcher.last3Starts ?? [];
  const homeSplitRows = formatSplitsBlock(pitcher.homeAwaySplits?.home);
  const awaySplitRows = formatSplitsBlock(pitcher.homeAwaySplits?.away);
  const vsLeftRows = formatSplitsBlock(pitcher.handednessSplits?.vsLeft);
  const vsRightRows = formatSplitsBlock(pitcher.handednessSplits?.vsRight);
  const gameLogRows = pitcher.gameLogMiniSummary ?? [];
  const metricTiles = buildPitcherMetricTiles(pitcher, mode);
  const narrativeStats = buildNarrativeStats(pitcher);
  const recentFormSummary = buildRecentFormSummary(pitcher);
  const hasAdvancedMetrics = mode !== "ADVANCED" || metricTiles.length > 0;
  const beginnerStatLine = buildBeginnerStatLine(pitcher);

  return (
    <div className="h-full rounded border border-neutral-700 bg-neutral-950 p-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{side === "away" ? "Away Starter" : "Home Starter"}</p>
      <div className="mt-2 flex items-center gap-2">
        {pitcher.headshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pitcher.headshotUrl}
            alt={`${pitcher.fullName} headshot`}
            className="h-10 w-10 rounded-full border border-neutral-700 object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 text-[10px] text-neutral-400">N/A</div>
        )}
        <div>
          <p className="font-medium">{pitcher.fullName}</p>
          <p className="text-[11px] text-neutral-400">
            {pitcher.handedness ? `Throws ${pitcher.handedness}` : "Handedness -"}
          </p>
          {mode === "ADVANCED" && pitcher.statsBasisLabel ? <p className="text-[10px] text-neutral-400">{pitcher.statsBasisLabel}</p> : null}
        </div>
      </div>

      {mode === "BEGINNER" ? (
        beginnerStatLine.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-300">
            {hasMetric(pitcher.era) ? (
              <p><StatLabel label="ERA" statKey="era" sport="MLB" mode={mode} /> {metricLabel(pitcher.era, 2)}</p>
            ) : null}
            {hasMetric(pitcher.record) ? (
              <p><StatLabel label="W-L" statKey="w_l_record" sport="MLB" mode={mode} /> {metricLabel(pitcher.record, 0)}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-neutral-300">No posted stat line yet.</p>
        )
      ) : null}

      {mode !== "ADVANCED" ? null : (
        <div className="mt-3 space-y-2 text-[11px] text-neutral-300">
          <p>
            {hasMetric(pitcher.record) ? (
              <>
                <StatLabel label="W-L" statKey="w_l_record" sport="MLB" mode={mode} /> {metricLabel(pitcher.record, 0)}
              </>
            ) : (
              "Record -"
            )}
            {" · "}
            {hasMetric(pitcher.era) ? (
              <>
                <StatLabel label="ERA" statKey="era" sport="MLB" mode={mode} /> {metricLabel(pitcher.era, 2)}
              </>
            ) : (
              "ERA -"
            )}
            {hasMetric(pitcher.inningsPitched) ? (
              <>
                {" · "}
                <StatLabel label="IP" statKey="innings_pitched" sport="MLB" mode={mode} /> {metricLabel(pitcher.inningsPitched, 1)}
              </>
            ) : null}
            {hasMetric(pitcher.strikeouts) ? (
              <>
                {" · "}
                <StatLabel label="K" statKey="strikeouts" sport="MLB" mode={mode} /> {metricLabel(pitcher.strikeouts, 0)}
              </>
            ) : null}
          </p>

          {narrativeStats.length > 0 ? (
            <p>
              {narrativeStats.map((stat, index) => (
                <span key={stat.key}>
                  {index > 0 ? " · " : ""}
                  <StatLabel label={stat.label} statKey={stat.statKey} sport="MLB" mode={mode} /> {metricLabel(stat.value, stat.digits ?? 2)}
                </span>
              ))}
            </p>
          ) : null}

          {recentFormSummary ? <p>{recentFormSummary}</p> : null}
          {pitcher.confidenceNote ? <p className="text-amber-300">{pitcher.confidenceNote}</p> : null}
          {pitcher.statsBasisLabel ? <p className="text-[10px] text-neutral-400">{pitcher.statsBasisLabel}</p> : null}
        </div>
      )}

      {mode !== "ADVANCED" ? null : (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          {metricTiles.map((tile) => (
            <div key={tile.key} className={`rounded border border-neutral-800 px-2 py-1 ${tile.colSpan2 ? "col-span-2" : ""}`}>
              <StatLabel label={tile.label} statKey={tile.key} sport="MLB" mode={mode} />: {metricLabel(tile.value, tile.digits ?? 2)}
            </div>
          ))}
        </div>
      )}
      {mode === "ADVANCED" && !hasAdvancedMetrics ? <p className="mt-3 text-[11px] text-neutral-400">Advanced season stat splits are not posted yet.</p> : null}

      {mode === "ADVANCED" && last3.length > 0 ? (
        <div className="mt-3 rounded border border-neutral-800 p-2">
          <p className="text-[11px] font-medium">Last 3 Starts</p>
          <div className="mt-1 space-y-1 text-[11px] text-neutral-300">
            {last3.map((start, index) => (
              <p key={`${start.date ?? "na"}-${start.opponent ?? "opp"}-${index}`}>
                {(start.date ?? "-")} vs {start.opponent ?? "-"} | <StatLabel label="IP" statKey="innings_pitched" sport="MLB" mode={mode} /> {start.innings ?? "-"} | <StatLabel label="ER" statKey="earned_runs" sport="MLB" mode={mode} /> {metricLabel(start.earnedRuns, 0)} | <StatLabel label="K" statKey="strikeouts" sport="MLB" mode={mode} /> {metricLabel(start.strikeouts, 0)}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {mode === "ADVANCED" && (homeSplitRows.length > 0 || awaySplitRows.length > 0) ? (
        <div className="mt-3 rounded border border-neutral-800 p-2 text-[11px]">
          <p className="font-medium">Home / Away Splits</p>
          {homeSplitRows.length > 0 ? (
            <p className="mt-1 text-neutral-300">
              Home: {homeSplitRows.map((row) => (
                <span key={`home-${row.label}`} className="mr-2 inline-block">
                  <StatLabel label={row.label} sport="MLB" mode={mode} />: {row.value}
                </span>
              ))}
            </p>
          ) : null}
          {awaySplitRows.length > 0 ? (
            <p className="mt-1 text-neutral-300">
              Away: {awaySplitRows.map((row) => (
                <span key={`away-${row.label}`} className="mr-2 inline-block">
                  <StatLabel label={row.label} sport="MLB" mode={mode} />: {row.value}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "ADVANCED" && (vsLeftRows.length > 0 || vsRightRows.length > 0) ? (
        <div className="mt-3 rounded border border-neutral-800 p-2 text-[11px]">
          <p className="font-medium">Handedness Splits</p>
          {vsLeftRows.length > 0 ? (
            <p className="mt-1 text-neutral-300">
              vs L: {vsLeftRows.map((row) => (
                <span key={`left-${row.label}`} className="mr-2 inline-block">
                  <StatLabel label={row.label} sport="MLB" mode={mode} />: {row.value}
                </span>
              ))}
            </p>
          ) : null}
          {vsRightRows.length > 0 ? (
            <p className="mt-1 text-neutral-300">
              vs R: {vsRightRows.map((row) => (
                <span key={`right-${row.label}`} className="mr-2 inline-block">
                  <StatLabel label={row.label} sport="MLB" mode={mode} />: {row.value}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "ADVANCED" && gameLogRows.length > 0 ? (
        <div className="mt-3 rounded border border-neutral-800 p-2 text-[11px]">
          <p className="font-medium">Season Game Log Summary</p>
          <p className="mt-1 text-neutral-300">{gameLogRows.join(" | ")}</p>
        </div>
      ) : null}

    </div>
  );
}

export default function MlbStartingPitcherMatchupWidget(props: WidgetCommonProps) {
  const [teamQuery, setTeamQuery] = useState("");
  const [activeTeamKey, setActiveTeamKey] = useState<string>(String(props.config.teamKey ?? "NYM").toUpperCase());
  const [selectedGameId, setSelectedGameId] = useState<string>(String(props.config.gameId ?? ""));
  const [selectedPitcherId, setSelectedPitcherId] = useState<string>(
    isNumericPlayerId(String(props.config.pitcherId ?? "")) ? String(props.config.pitcherId ?? "") : "",
  );
  const [selectedPitcherName, setSelectedPitcherName] = useState<string>(String(props.config.pitcherName ?? ""));
  const [bullpenData, setBullpenData] = useState<BullpenDropdownData | null>(null);
  const [bullpenLoading, setBullpenLoading] = useState(false);
  const [data, setData] = useState<MlbStartingPitcherMatchupData | null>(null);
  const [meta, setMeta] = useState<MatchupResponse["meta"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    const configTeamKey = String(props.config.teamKey ?? "NYM").toUpperCase();
    if (configTeamKey !== activeTeamKey) {
      setActiveTeamKey(configTeamKey);
    }
    const option = findTeamByKey(configTeamKey);
    setTeamQuery(option ? `${option.name} (${option.key})` : configTeamKey);
  }, [props.config.teamKey, activeTeamKey]);

  useEffect(() => {
    const configGameId = String(props.config.gameId ?? "");
    if (configGameId !== selectedGameId) {
      setSelectedGameId(configGameId);
    }
  }, [props.config.gameId, selectedGameId]);

  useEffect(() => {
    const configPitcherId = isNumericPlayerId(String(props.config.pitcherId ?? ""))
      ? String(props.config.pitcherId ?? "")
      : "";
    if (configPitcherId !== selectedPitcherId) {
      setSelectedPitcherId(configPitcherId);
      setSelectedPitcherName(String(props.config.pitcherName ?? ""));
    }
  }, [props.config.pitcherId, props.config.pitcherName, selectedPitcherId]);

  const matchingTeams = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    if (!q) return MLB_TEAM_OPTIONS.slice(0, 8);
    return MLB_TEAM_OPTIONS
      .filter((team) => team.name.toLowerCase().includes(q) || team.key.toLowerCase().includes(q))
      .slice(0, 8);
  }, [teamQuery]);

  const loadBullpen = useCallback(async (key: string) => {
    if (!key) return;
    setBullpenLoading(true);
    try {
      const res = await fetch(
        `/api/widgets/mlb-bullpen-fatigue?teamKey=${encodeURIComponent(key)}&dataMode=${props.dataMode}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        data?: { starters: Array<{ playerId: string; fullName: string }>; relievers: Array<{ playerId: string; fullName: string }> } | null;
      };
      if (json.data) {
        setBullpenData({
          starters: json.data.starters.map((p) => ({ playerId: p.playerId, fullName: p.fullName })),
          relievers: json.data.relievers.map((p) => ({ playerId: p.playerId, fullName: p.fullName })),
        });
      } else {
        setBullpenData(null);
      }
    } catch {
      setBullpenData(null);
    } finally {
      setBullpenLoading(false);
    }
  }, [props.dataMode]);

  useEffect(() => {
    if (props.mode === "ADVANCED" && activeTeamKey) {
      void loadBullpen(activeTeamKey);
    }
  }, [activeTeamKey, props.mode, loadBullpen]);

  const load = useCallback(async () => {
    const mode = props.mode.toLowerCase();
    const params = new URLSearchParams({
      sport: "mlb",
      teamKey: activeTeamKey,
      mode,
      dataMode: props.dataMode,
      cacheBust: String(props.refreshTick),
    });
    if (selectedGameId) {
      params.set("gameId", selectedGameId);
    }
    if (props.mode === "ADVANCED" && selectedPitcherId) {
      params.set("pitcherId", selectedPitcherId);
    }
    const url = `/api/widgets/mlb-starting-pitcher-matchup?${params.toString()}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as MatchupResponse;
      setMeta(json.meta ?? null);
      setData(json.data ?? null);
      setError(json.error ? safeMatchupError(json.error) : null);
      if (!response.ok && !json.data) {
        throw new Error(safeMatchupError(json.error));
      }
    } catch (loadError) {
      setError(safeMatchupError(String(loadError)));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedPitcherId, activeTeamKey, selectedGameId, props.mode, props.dataMode, props.refreshTick]);

  useEffect(() => {
    void load();
  }, [load, props.refreshTick]);

  const applyTeam = async (nextTeamKey: string) => {
    if (!nextTeamKey) return;
    const option = findTeamByKey(nextTeamKey);
    setActiveTeamKey(nextTeamKey);
    setSelectedGameId("");
    setSelectedPitcherId("");
    setSelectedPitcherName("");
    setBullpenData(null);
    setTeamQuery(option ? `${option.name} (${option.key})` : nextTeamKey);
    await props.onPersist({
      config: {
        ...props.config,
        teamKey: nextTeamKey,
        gameId: "",
        pitcherId: "",
        pitcherName: "",
      },
    });
  };

  const onSubmitTeamSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const resolved = parseTeamKeyFromQuery(teamQuery);
    if (!resolved) {
      setError("Select a valid MLB team.");
      return;
    }
    await applyTeam(resolved);
  };

  const onGameChange = async (nextGameId: string) => {
    setSelectedGameId(nextGameId);
    await props.onPersist({
      config: {
        ...props.config,
        teamKey: activeTeamKey,
        gameId: nextGameId,
        pitcherId: selectedPitcherId,
        pitcherName: selectedPitcherName,
      },
    });
  };

  const onPitcherDropdownChange = async (pitcherId: string) => {
    let pitcherName = "";
    if (pitcherId) {
      const allOptions = [
        ...(data?.pitchers.away?.playerId ? [{ playerId: data.pitchers.away.playerId, fullName: data.pitchers.away.fullName }] : []),
        ...(data?.pitchers.home?.playerId ? [{ playerId: data.pitchers.home.playerId, fullName: data.pitchers.home.fullName }] : []),
        ...(bullpenData?.starters ?? []),
        ...(bullpenData?.relievers ?? []),
      ];
      pitcherName = allOptions.find((p) => p.playerId === pitcherId)?.fullName ?? "";
    }
    setSelectedPitcherId(pitcherId);
    setSelectedPitcherName(pitcherName);
    await props.onPersist({
      config: {
        ...props.config,
        teamKey: activeTeamKey,
        gameId: selectedGameId,
        pitcherId,
        pitcherName,
      },
    });
  };

  const probableStarterOptions = useMemo(() => {
    if (!data) return [];
    const opts: Array<{ playerId: string; label: string }> = [];
    if (data.pitchers.away?.playerId) {
      opts.push({ playerId: data.pitchers.away.playerId, label: `${data.pitchers.away.fullName} (Away Starter)` });
    }
    if (data.pitchers.home?.playerId) {
      opts.push({ playerId: data.pitchers.home.playerId, label: `${data.pitchers.home.fullName} (Home Starter)` });
    }
    return opts;
  }, [data]);

  const stateBanner = (() => {
    if (loading) return "Loading matchup...";
    if (error) return "Failed to load pitching matchup";
    if (!data) return "No upcoming MLB game found";
    if (data.state === "partial") return "Game found, probable starters not posted yet";
    return null;
  })();

  const matchupSummary = buildMatchupSummary(data);
  const advancedOverview = props.mode === "ADVANCED" ? buildAdvancedOverview(data) : null;
  const beginnerBasisLabel = props.mode === "BEGINNER" ? resolveBeginnerBasisLabel(data) : null;
  const pitcherSelectionLabel = data?.pitcherSelection.label
    ?? (selectedPitcherId ? "Custom pitcher selection" : "Upcoming probable starter baseline");
  const gameContextLabel = data?.gameContext.label ?? "Upcoming game context";

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">MLB Starting Pitcher Matchup</span>
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

      <form className="space-y-1" onSubmit={(event) => void onSubmitTeamSearch(event)}>
        <label className="block">
          <span className="mb-1 block text-neutral-400">Team Search</span>
          <div className="flex gap-2">
            <input
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
              value={teamQuery}
              onChange={(event) => setTeamQuery(event.target.value)}
              placeholder="Search MLB team (example: Mets or NYM)"
              disabled={props.locked}
            />
            <button type="submit" className="rounded border border-neutral-700 px-2 py-1" disabled={props.locked}>Apply</button>
          </div>
        </label>
        <div className="flex flex-wrap gap-1">
          {matchingTeams.map((team) => (
            <button
              key={team.key}
              type="button"
              className={`rounded border px-2 py-1 text-[10px] ${team.key === activeTeamKey ? "border-emerald-600 text-emerald-300" : "border-neutral-700 text-neutral-300"}`}
              onClick={() => void applyTeam(team.key)}
              disabled={props.locked}
            >
              {team.name} ({team.key})
            </button>
          ))}
        </div>
      </form>

      {props.mode === "ADVANCED" && data?.selectableGames && data.selectableGames.length > 0 ? (
        <label className="block">
          <span className="mb-1 block text-neutral-400">Game Context</span>
          <select
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            value={selectedGameId || data.game.gameId}
            onChange={(event) => void onGameChange(event.target.value)}
            disabled={props.locked}
          >
            {data.selectableGames.map((option) => (
              <option key={option.gameId} value={option.gameId}>{option.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      {props.mode === "ADVANCED" ? (
        <div className="rounded border border-neutral-700 bg-neutral-950 p-2 text-[11px]">
          <p className="text-neutral-300">Pitcher source: {pitcherSelectionLabel}</p>
          <p className="mt-1 text-neutral-400">Game context: {gameContextLabel}</p>
          {selectedPitcherId ? (
            <p className="mt-1 text-neutral-400">
              Selected: {selectedPitcherName || data?.pitcherSelection?.selectedPitcherName || "Player"} ({selectedPitcherId})
            </p>
          ) : (
            <p className="mt-1 text-neutral-400">Using the tracked team&apos;s probable starter baseline.</p>
          )}
        </div>
      ) : null}

      {props.mode === "ADVANCED" ? (
        <div className="space-y-1">
          <label className="block">
            <span className="mb-1 block text-neutral-400">Pitcher Selection</span>
            <select
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
              value={selectedPitcherId}
              onChange={(event) => void onPitcherDropdownChange(event.target.value)}
              disabled={props.locked || bullpenLoading}
            >
              <option value="">— Probable starter baseline —</option>
              {probableStarterOptions.length > 0 ? (
                <optgroup label="Probable Starters">
                  {probableStarterOptions.map((opt) => (
                    <option key={opt.playerId} value={opt.playerId}>{opt.label}</option>
                  ))}
                </optgroup>
              ) : null}
              {bullpenData && bullpenData.starters.length > 0 ? (
                <optgroup label={`${activeTeamKey} Rotation`}>
                  {bullpenData.starters.map((p) => (
                    <option key={p.playerId} value={p.playerId}>{p.fullName}</option>
                  ))}
                </optgroup>
              ) : null}
              {bullpenData && bullpenData.relievers.length > 0 ? (
                <optgroup label={`${activeTeamKey} Bullpen`}>
                  {bullpenData.relievers.map((p) => (
                    <option key={p.playerId} value={p.playerId}>{p.fullName}</option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          {bullpenLoading && <p className="text-[10px] text-neutral-500">Loading pitcher list...</p>}
          {!bullpenLoading && !bullpenData && activeTeamKey && (
            <p className="text-[10px] text-neutral-500">Pitcher list unavailable — dropdown shows probable starters only.</p>
          )}
        </div>
      ) : null}

      {stateBanner ? (
        <p className={`${loading ? "text-neutral-300" : error ? "text-amber-300" : data?.state === "partial" ? "text-amber-300" : "text-neutral-400"}`}>
          {stateBanner}
        </p>
      ) : null}

      {data ? (
        <div className="space-y-3 rounded border border-neutral-700 bg-neutral-900/40 p-2">
          <div className="rounded border border-neutral-700 bg-neutral-950 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {data.game.awayTeam.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.game.awayTeam.logoUrl} alt={`${data.game.awayTeam.name} logo`} className="h-6 w-6 object-contain" />
                ) : null}
                <p className="font-medium">{data.game.awayTeam.key}</p>
                <span className="text-neutral-500">at</span>
                <p className="font-medium">{data.game.homeTeam.key}</p>
                {data.game.homeTeam.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.game.homeTeam.logoUrl} alt={`${data.game.homeTeam.name} logo`} className="h-6 w-6 object-contain" />
                ) : null}
              </div>
              <p className="text-[11px] text-neutral-400">{toGameDateTime(data.game.gameTime)}</p>
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">Venue: {data.game.venue ?? "-"}</p>
            {matchupSummary ? <p className="mt-1 text-[11px] text-neutral-300">{matchupSummary}</p> : null}
            {advancedOverview ? <p className="mt-1 text-[11px] text-neutral-300">{advancedOverview}</p> : null}
          </div>

          <div className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-2">
            <PitcherCard side="away" pitcher={data.pitchers.away} mode={props.mode} />
            <PitcherCard side="home" pitcher={data.pitchers.home} mode={props.mode} />
          </div>

          <div className="rounded border border-neutral-700 bg-neutral-950 p-2 text-[11px]">
            {props.mode === "ADVANCED" ? (
              <div className="space-y-1">
                <p className="font-medium">{data.edge?.overall ?? "Edge: neutral"}</p>
                <p>Strikeout edge: {categoryWinner(data, "K/9")}</p>
                <p>Control edge: {categoryWinner(data, "BB/9")}</p>
                <p>Recent form edge: {categoryWinner(data, "Recent Form (3-start ERA)")}</p>
              </div>
            ) : (
              <p className="font-medium">{data.edge?.beginnerSummary ?? data.edge?.overall ?? "Edge: neutral"}</p>
            )}
          </div>
          {beginnerBasisLabel ? <p className="text-[10px] text-neutral-400">{beginnerBasisLabel}</p> : null}
        </div>
      ) : null}

      {props.mode === "ADVANCED" && (data?.notes ?? []).length > 0 ? (
        <div className="rounded border border-neutral-700 bg-neutral-950 p-2 text-[10px] text-neutral-400">
          {(data?.notes ?? []).slice(0, 2).map((note, index) => (
            <p key={`${note}-${index}`}>{note}</p>
          ))}
        </div>
      ) : null}

      {safeMatchupWarning(meta?.warning) ? <p className="text-amber-300">{safeMatchupWarning(meta?.warning)}</p> : null}
      <div className="text-[10px] text-neutral-500">
        Updated {meta ? to12h(meta.updatedAt) : "-"} - Source {meta ? meta.sourceUsed.toUpperCase() : "-"}
      </div>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({
          widgetId: props.widgetId,
          endpoint,
          meta,
          teamKey: activeTeamKey,
          gameId: selectedGameId || data?.game.gameId,
          state: data?.state ?? meta?.state,
          notes: meta?.notes,
          userNotes: data?.notes,
          warnings: meta?.warnings ?? meta?.warning,
        })}
      >
        Report a bug
      </button>
    </div>
  );
}
