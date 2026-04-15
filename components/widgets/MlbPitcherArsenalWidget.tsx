"use client";

import { useCallback, useEffect, useState } from "react";
import StatLabel from "@/components/stats/StatLabel";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";

type ArsenalPitch = {
  type: string;
  usagePct?: number;
  velocityMph?: number;
};

type ArsenalResponse = {
  data: {
    playerId: string;
    playerName?: string;
    pitches: ArsenalPitch[];
  } | null;
  meta?: WidgetMeta;
  error?: string | null;
};

type PlayerSearchResponse = {
  data?: Array<{
    playerId: string;
    fullName: string;
    teamName?: string;
    position?: string;
    isPitcher?: boolean;
  }>;
  error?: {
    message?: string;
  };
};

type ResolvedPitcherSelection = {
  playerId: string;
  fullName?: string;
  teamName?: string;
  position?: string;
  isPitcher?: boolean;
};

type PitcherSearchResolution = {
  selection: ResolvedPitcherSelection | null;
  reason?: "NOT_PITCHER" | "NO_MATCH";
};

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatPct(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatMph(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)} mph`;
}

function isNumericPlayerId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function sortArsenalPitches(pitches: ArsenalPitch[]): ArsenalPitch[] {
  return [...pitches].sort((left, right) => {
    const usageDelta = (right.usagePct ?? -1) - (left.usagePct ?? -1);
    if (usageDelta !== 0) {
      return usageDelta;
    }

    const velocityDelta = (right.velocityMph ?? -1) - (left.velocityMph ?? -1);
    if (velocityDelta !== 0) {
      return velocityDelta;
    }

    return left.type.localeCompare(right.type);
  });
}

function pitchUsageTier(usagePct?: number): "featured" | "core" | "support" | "situational" | "tracked" {
  if (typeof usagePct !== "number" || Number.isNaN(usagePct)) {
    return "tracked";
  }
  if (usagePct >= 25) {
    return "featured";
  }
  if (usagePct >= 15) {
    return "core";
  }
  if (usagePct >= 8) {
    return "support";
  }
  return "situational";
}

export function describePitchRole(pitch: ArsenalPitch, usageRank: number): string {
  switch (pitchUsageTier(pitch.usagePct)) {
    case "featured":
      return usageRank === 1 ? "Primary weapon" : "Featured offering";
    case "core":
      return "Core secondary";
    case "support":
      return "Regular mix piece";
    case "situational":
      return "Situational look";
    case "tracked":
    default:
      return "Tracked offering";
  }
}

export function describePitchTakeaway(pitch: ArsenalPitch, usageRank: number): string {
  const velocitySentence = typeof pitch.velocityMph === "number"
    ? ` Average velocity sits around ${pitch.velocityMph.toFixed(1)} mph.`
    : "";

  switch (pitchUsageTier(pitch.usagePct)) {
    case "featured":
      return usageRank === 1
        ? `This is the foundation of the mix and the first pitch hitters have to solve.${velocitySentence}`
        : `This pitch still carries major workload inside the arsenal.${velocitySentence}`;
    case "core":
      return `A real secondary pitch used often enough to shape counts and sequencing.${velocitySentence}`;
    case "support":
      return `A regular change-of-pace option that helps keep the arsenal from getting predictable.${velocitySentence}`;
    case "situational":
      return `Used more selectively as a matchup or surprise look rather than a constant driver of the mix.${velocitySentence}`;
    case "tracked":
    default:
      return "Tracked in the live arsenal feed, but usage share is not available from upstream yet.";
  }
}

function describeArsenalSummary(playerName: string, pitches: ArsenalPitch[], advanced: boolean): string {
  if (pitches.length === 0) {
    return `${playerName} does not have tracked pitch mix rows from the current upstream feed yet.`;
  }

  const primaryPitch = pitches[0];
  const primaryClause = typeof primaryPitch?.usagePct === "number"
    ? `${primaryPitch.type} leads the mix at ${formatPct(primaryPitch.usagePct)}`
    : `${primaryPitch.type} is the first tracked offering in the live mix`;
  const velocityCount = pitches.filter((pitch) => typeof pitch.velocityMph === "number").length;

  if (!advanced) {
    return `${playerName} currently shows ${pitches.length} tracked pitches. ${primaryClause}.`;
  }

  return `${playerName} currently shows ${pitches.length} tracked pitches. ${primaryClause}, and average velocity is available on ${velocityCount}/${pitches.length} offerings.`;
}

function describeArsenalCoverage(pitches: ArsenalPitch[]): string {
  const velocityCount = pitches.filter((pitch) => typeof pitch.velocityMph === "number").length;
  if (velocityCount === 0) {
    return "Current upstream arsenal coverage is usage-only for this pitcher. Whiff, run value, and movement metrics are not available on this feed.";
  }
  if (velocityCount === pitches.length) {
    return "Current upstream arsenal coverage includes mix share and average velocity. Whiff, run value, and movement metrics are not available on this feed.";
  }
  return `Current upstream arsenal coverage includes mix share and partial average velocity (${velocityCount}/${pitches.length} pitches). Whiff, run value, and movement metrics are not available on this feed.`;
}

export function normalizePitcherSearchName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]|_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPitcherCandidate(row: { position?: string; isPitcher?: boolean }): boolean {
  if (row.isPitcher === true) {
    return true;
  }

  const normalizedPosition = (row.position ?? "").trim().toUpperCase();
  return normalizedPosition === "P" || normalizedPosition === "SP" || normalizedPosition === "RP" || normalizedPosition === "CL";
}

export function resolvePitcherSearchResult(
  query: string,
  rows: Array<{ playerId: string; fullName: string; teamName?: string; position?: string; isPitcher?: boolean }>,
): PitcherSearchResolution {
  if (rows.length === 0) {
    return { selection: null, reason: "NO_MATCH" };
  }

  const normalizedQuery = normalizePitcherSearchName(query);
  const numericRows = rows.filter((row) => isNumericPlayerId(row.playerId));
  const pitcherRows = numericRows.filter((row) => isPitcherCandidate(row));
  const toSelection = (row: { playerId: string; fullName: string; teamName?: string; position?: string; isPitcher?: boolean }): ResolvedPitcherSelection => ({
    playerId: row.playerId,
    fullName: row.fullName,
    teamName: row.teamName,
    position: row.position,
    isPitcher: row.isPitcher,
  });

  const exactPitcher = pitcherRows.find((row) => normalizePitcherSearchName(row.fullName) === normalizedQuery);
  if (exactPitcher) {
    return { selection: toSelection(exactPitcher) };
  }

  const exactAny = numericRows.find((row) => normalizePitcherSearchName(row.fullName) === normalizedQuery);
  if (exactAny) {
    return { selection: null, reason: "NOT_PITCHER" };
  }

  const prefixPitcher = pitcherRows.find((row) => normalizePitcherSearchName(row.fullName).startsWith(normalizedQuery));
  if (prefixPitcher) {
    return { selection: toSelection(prefixPitcher) };
  }

  const prefixAny = numericRows.find((row) => normalizePitcherSearchName(row.fullName).startsWith(normalizedQuery));
  if (prefixAny) {
    return { selection: null, reason: "NOT_PITCHER" };
  }

  const firstPitcher = pitcherRows[0];
  if (firstPitcher) {
    return { selection: toSelection(firstPitcher) };
  }

  return { selection: null, reason: "NOT_PITCHER" };
}

export function resolvePitcherSelectionFromSearch(
  query: string,
  rows: Array<{ playerId: string; fullName: string; teamName?: string; position?: string; isPitcher?: boolean }>,
): ResolvedPitcherSelection | null {
  return resolvePitcherSearchResult(query, rows).selection;
}

function safeMessage(message?: string | null): string | null {
  if (!message) return null;
  const lowered = message.toLowerCase();
  if (lowered.includes("supported mlb pitcher")) return message;
  if (lowered.includes("could not map")) return message;
  if (lowered.includes("could not resolve a valid mlb pitcher")) return message;
  if (lowered.includes("pitch arsenal not available")) return "Pitch arsenal not available from upstream for this pitcher yet.";
  if (lowered.includes("invalid")) return "Could not load pitcher arsenal for this pitcher id.";
  if (lowered.includes("failed")) return "Failed to load pitcher arsenal.";
  return "Failed to load pitcher arsenal.";
}

function safeWarning(message?: string): string | null {
  if (!message) return null;
  const lowered = message.toLowerCase();
  if (lowered.includes("pitch arsenal not available")) {
    return "Pitch arsenal not available from upstream for this pitcher yet.";
  }
  if (lowered.includes("upstream failure")) {
    return "MLB data warning. Use Report a bug for diagnostics.";
  }
  return message;
}

export default function MlbPitcherArsenalWidget(props: WidgetCommonProps) {
  const advanced = props.mode === "ADVANCED";
  const configuredPlayerName = typeof props.config.playerName === "string" ? props.config.playerName.trim() : "";
  const [inputPlayerRef, setInputPlayerRef] = useState<string>(String(props.config.playerId ?? ""));
  const [activePlayerId, setActivePlayerId] = useState<string>(isNumericPlayerId(String(props.config.playerId ?? "")) ? String(props.config.playerId ?? "") : "");
  const [selectedPitcher, setSelectedPitcher] = useState<ResolvedPitcherSelection | null>(
    isNumericPlayerId(String(props.config.playerId ?? ""))
      ? {
        playerId: String(props.config.playerId ?? ""),
        fullName: configuredPlayerName || undefined,
      }
      : null,
  );
  const [data, setData] = useState<ArsenalResponse["data"]>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  const resolvePitcherSelection = useCallback(async (raw: string): Promise<PitcherSearchResolution> => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { selection: null, reason: "NO_MATCH" };
    }
    if (isNumericPlayerId(trimmed)) {
      return {
        selection: {
          playerId: trimmed,
          fullName: selectedPitcher?.playerId === trimmed ? selectedPitcher.fullName : undefined,
        },
      };
    }
    if (trimmed.length < 3) {
      return { selection: null, reason: "NO_MATCH" };
    }
    const url = `/api/search/mlb-players?q=${encodeURIComponent(trimmed)}&limit=8&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
    const response = await fetch(url, { cache: "no-store" });
    const json = (await response.json()) as PlayerSearchResponse;
    const rows = Array.isArray(json.data) ? json.data : [];
    return resolvePitcherSearchResult(trimmed, rows);
  }, [props.dataMode, props.refreshTick, selectedPitcher?.fullName, selectedPitcher?.playerId]);

  const load = useCallback(async (playerId: string) => {
    if (!isNumericPlayerId(playerId)) {
      setData(null);
      setMeta(null);
      setError("Enter an MLB pitcher name or numeric playerId.");
      return;
    }

    const mode = props.mode.toLowerCase();
    const url = `/api/widgets/mlb-pitcher-arsenal?playerId=${encodeURIComponent(playerId)}&mode=${mode}&dataMode=${props.dataMode}&cacheBust=${props.refreshTick}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as ArsenalResponse;
      if (!response.ok) {
        throw new Error(safeMessage(json.error) ?? "Failed to load pitcher arsenal.");
      }
      setData(json.data ?? null);
      setMeta(json.meta ?? null);
      setError(safeMessage(json.error) ?? null);
      if (json.data?.playerId) {
        setSelectedPitcher((previous) => ({
          playerId: json.data?.playerId ?? previous?.playerId ?? playerId,
          fullName: json.data?.playerName ?? previous?.fullName,
        }));
      }
    } catch {
      setError("Failed to load pitcher arsenal.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [props.dataMode, props.mode, props.refreshTick]);

  useEffect(() => {
    const configured = String(props.config.playerId ?? "");
    if (configured !== inputPlayerRef) {
      setInputPlayerRef(configured);
    }

    if (!configured) {
      setActivePlayerId("");
      setSelectedPitcher(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const resolved = await resolvePitcherSelection(configured);
      if (cancelled) {
        return;
      }
      if (resolved.selection) {
        setActivePlayerId(resolved.selection.playerId);
        setSelectedPitcher(resolved.selection);
      } else if (resolved.reason === "NOT_PITCHER") {
        setError("Selected player is not a supported MLB pitcher for arsenal data.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.config.playerId, resolvePitcherSelection]);

  useEffect(() => {
    if (!activePlayerId) {
      return;
    }
    void load(activePlayerId);
  }, [activePlayerId, load, props.refreshTick]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = inputPlayerRef.trim();
    const resolved = await resolvePitcherSelection(normalized);
    if (!resolved.selection) {
      setError(
        resolved.reason === "NOT_PITCHER"
          ? "Selected player is not a supported MLB pitcher for arsenal data."
          : "Could not resolve a valid MLB pitcher id from that input.",
      );
      setData(null);
      return;
    }
    setActivePlayerId(resolved.selection.playerId);
    setSelectedPitcher(resolved.selection);
    setError(null);
    setInputPlayerRef(resolved.selection.fullName ?? normalized);
    await props.onPersist({
      config: {
        ...props.config,
        playerId: resolved.selection.playerId,
        playerName: resolved.selection.fullName,
      },
    });
  };

  const displayName = data?.playerName ?? selectedPitcher?.fullName ?? "MLB pitcher";
  const sortedPitches = data ? sortArsenalPitches(data.pitches) : [];
  const primaryPitch = sortedPitches[0];
  const title = data ? `${displayName} Pitch Arsenal` : "MLB Pitcher Arsenal";
  const summary = data ? describeArsenalSummary(displayName, sortedPitches, advanced) : null;

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="text-[11px] text-neutral-500">
            {summary ?? "Load a pitcher to see the live pitch mix this feed currently tracks."}
          </p>
        </div>
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

      <form className="flex gap-2" onSubmit={(event) => void onSubmit(event)}>
        <input
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
          value={inputPlayerRef}
          onChange={(event) => setInputPlayerRef(event.target.value)}
          placeholder="MLB pitcher name or playerId (example: 669203)"
          disabled={props.locked}
        />
        <button type="submit" className="rounded border border-neutral-700 px-2 py-1" disabled={props.locked}>Load</button>
      </form>

      {selectedPitcher ? (
        <p className="text-[11px] text-neutral-400">
          {selectedPitcher.fullName
            ? `Selected pitcher: ${selectedPitcher.fullName} (${selectedPitcher.playerId})`
            : `Selected pitcher id: ${selectedPitcher.playerId}`}
        </p>
      ) : null}

      {loading ? <p className="text-neutral-300">Loading pitcher arsenal...</p> : null}
      {error ? <p className="text-amber-300">{error}</p> : null}

      {!loading && !error && data === null ? (
        <p className="text-neutral-400">Pitch arsenal not available yet for this player.</p>
      ) : null}

      {data ? (
        <div className="space-y-2 rounded border border-neutral-700 bg-neutral-950 p-3">
          <div className="rounded border border-neutral-800 bg-neutral-900/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-neutral-100">{displayName}</p>
                <p className="text-[11px] text-neutral-400">
                  {sortedPitches.length} tracked pitches
                  {primaryPitch ? ` • Primary mix leader: ${primaryPitch.type}` : ""}
                </p>
              </div>
              <span className="rounded border border-neutral-700 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-neutral-400">
                {advanced ? "Advanced" : "Beginner"}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-neutral-500">
              {advanced
                ? describeArsenalCoverage(sortedPitches)
                : "Beginner view keeps the mix readable: pitch name, usage share, and a short role takeaway."}
            </p>
          </div>

          {sortedPitches.map((pitch, index) => (
            <div key={pitch.type} className="rounded border border-neutral-800 bg-neutral-900/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-100">{pitch.type}</p>
                  <p className="text-[11px] text-sky-200">{describePitchRole(pitch, index + 1)}</p>
                </div>
                <div className="text-right">
                  <StatLabel
                    label="Usage %"
                    statKey="pitch_usage_pct"
                    sport="MLB"
                    mode={props.mode}
                    className="text-[10px] uppercase tracking-[0.14em] text-neutral-500"
                  />
                  <p className="mt-1 font-semibold text-neutral-100">{formatPct(pitch.usagePct)}</p>
                </div>
              </div>

              <div className="mt-2 h-1.5 rounded-full bg-neutral-900">
                <div
                  className="h-full rounded-full bg-sky-400/80"
                  style={{ width: `${Math.max(6, Math.min(100, pitch.usagePct ?? 0))}%` }}
                />
              </div>

              <p className="mt-2 text-[11px] leading-5 text-neutral-400">{describePitchTakeaway(pitch, index + 1)}</p>

              {advanced ? (
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded border border-neutral-800 bg-neutral-950/70 p-2">
                    <StatLabel
                      label="Velocity"
                      statKey="velocity_mph"
                      sport="MLB"
                      mode={props.mode}
                      className="text-[10px] uppercase tracking-[0.14em] text-neutral-500"
                    />
                    <p className="mt-1 font-medium text-neutral-100">{formatMph(pitch.velocityMph)}</p>
                  </div>
                  <div className="rounded border border-neutral-800 bg-neutral-950/70 p-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">Mix rank</p>
                    <p className="mt-1 font-medium text-neutral-100">#{index + 1}</p>
                  </div>
                  <div className="rounded border border-neutral-800 bg-neutral-950/70 p-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">Coverage</p>
                    <p className="mt-1 font-medium text-neutral-100">
                      {typeof pitch.velocityMph === "number" ? "Usage + velo" : "Usage only"}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          {sortedPitches.length === 0 ? <p className="text-neutral-400">No pitch data available.</p> : null}
        </div>
      ) : null}

      {safeWarning(meta?.warning) ? <p className="text-amber-300">{safeWarning(meta?.warning)}</p> : null}
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
          warnings: meta?.warning,
          endpointUrl: meta?.endpointUrl,
          playerId: activePlayerId,
        })}
      >
        Report a bug
      </button>
    </div>
  );
}
