"use client";

import { useCallback, useEffect, useState } from "react";
import StatLabel from "@/components/stats/StatLabel";
import SourceChips from "@/components/widgets/shared/SourceChips";
import type { WidgetCommonProps, WidgetMeta } from "@/components/widgets/types";
import type { NflDivisionSnapshotUi } from "@/lib/templates/nflDivisionSnapshot";

type DivisionSnapshotResponse = {
  data?: NflDivisionSnapshotUi;
  meta?: WidgetMeta;
  error?: string | null;
};

type ConferenceFilter = "ALL" | "AFC" | "NFC";
type DivisionFilter = "ALL" | "East" | "North" | "South" | "West";

function to12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function recordLabel(wins: number, losses: number, ties: number): string {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

function streakClass(streak: string): string {
  if (streak.startsWith("W")) return "border-emerald-700 bg-emerald-950 text-emerald-300";
  if (streak.startsWith("L")) return "border-red-800 bg-red-950 text-red-300";
  return "border-neutral-700 bg-neutral-900 text-neutral-400";
}

export default function NflDivisionSnapshotWidget(props: WidgetCommonProps) {
  const configuredConference = typeof props.config.conference === "string" ? props.config.conference.toUpperCase() : "ALL";
  const configuredDivision = typeof props.config.division === "string" ? props.config.division : "ALL";
  const [conference, setConference] = useState<ConferenceFilter>(configuredConference === "AFC" || configuredConference === "NFC" ? configuredConference : "ALL");
  const [division, setDivision] = useState<DivisionFilter>(configuredDivision === "East" || configuredDivision === "North" || configuredDivision === "South" || configuredDivision === "West" ? configuredDivision : "ALL");
  const [data, setData] = useState<NflDivisionSnapshotUi | null>(null);
  const [meta, setMeta] = useState<WidgetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const advanced = props.mode === "ADVANCED";

  useEffect(() => {
    setConference(configuredConference === "AFC" || configuredConference === "NFC" ? configuredConference : "ALL");
    setDivision(configuredDivision === "East" || configuredDivision === "North" || configuredDivision === "South" || configuredDivision === "West" ? configuredDivision : "ALL");
  }, [configuredConference, configuredDivision]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      mode: props.mode.toLowerCase(),
      dataMode: props.dataMode,
      cacheBust: String(props.refreshTick),
    });
    if (conference !== "ALL") params.set("conference", conference);
    if (division !== "ALL") params.set("division", division);
    const url = `/api/widgets/nfl-division-snapshot?${params.toString()}`;
    setEndpoint(url);
    setLoading(true);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as DivisionSnapshotResponse;
      if (!response.ok) throw new Error(json.error ?? "Failed to load NFL division snapshot");
      setData(json.data ?? null);
      setMeta(json.meta ?? null);
      setError(json.error ?? null);
    } catch (loadError) {
      setData(null);
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }, [conference, division, props.dataMode, props.mode, props.refreshTick]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">NFL Division Snapshot</span>
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

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wide text-neutral-500" htmlFor={`${props.widgetId}-division-conference`}>Conference</label>
          <select
            id={`${props.widgetId}-division-conference`}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            value={conference}
            onChange={(event) => {
              const next = event.target.value as ConferenceFilter;
              setConference(next);
              void props.onPersist({ config: { ...props.config, conference: next === "ALL" ? "" : next } });
            }}
            disabled={props.locked}
          >
            <option value="ALL">All</option>
            <option value="AFC">AFC</option>
            <option value="NFC">NFC</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wide text-neutral-500" htmlFor={`${props.widgetId}-division-name`}>Division</label>
          <select
            id={`${props.widgetId}-division-name`}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            value={division}
            onChange={(event) => {
              const next = event.target.value as DivisionFilter;
              setDivision(next);
              void props.onPersist({ config: { ...props.config, division: next === "ALL" ? "" : next } });
            }}
            disabled={props.locked}
          >
            <option value="ALL">All</option>
            <option value="East">East</option>
            <option value="North">North</option>
            <option value="South">South</option>
            <option value="West">West</option>
          </select>
        </div>
      </div>

      {loading ? <p className="text-neutral-400">Loading division snapshot...</p> : null}
      {error ? <p className="text-amber-300">{error}</p> : null}
      {meta?.warning ? <p className="text-amber-300">{meta.warning}</p> : null}

      {data ? (
        <div className="space-y-2">
          {!advanced ? (
            <div className="rounded border border-blue-800 bg-blue-950/35 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-300">What to watch</p>
              <p className="mt-1 text-neutral-300">
                Start with the division leader, then look for teams with a hot streak or a close record gap.
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-neutral-100">{data.title}</p>
                <p className="mt-1 text-neutral-400">{data.summary}</p>
              </div>
              <span className="rounded border border-amber-700 bg-amber-950 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-300">
                {data.source === "demo" ? "Demo" : data.source === "cached" ? "Cached" : "Live"}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {data.divisions.map((group) => (
              <div key={`${group.conference}-${group.division}`} className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium text-neutral-100">{group.conference} {group.division}</p>
                  {data.seasonLabel ? <span className="text-[10px] uppercase tracking-wide text-neutral-500">{data.seasonLabel}</span> : null}
                </div>
                <div className="space-y-1.5">
                  {group.teams.map((team, index) => {
                    const pointDiff = team.pointsFor - team.pointsAgainst;
                    return (
                      <div key={`${group.conference}-${group.division}-${team.teamKey}`} className="rounded border border-neutral-800 bg-neutral-900/60 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-neutral-100">
                              <span className="mr-1.5 text-neutral-500">{index + 1}.</span>
                              {team.name}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                              <span>
                                <StatLabel label="W" statKey="wins_record" sport="NFL" mode={props.mode} /> {team.wins}
                              </span>
                              <span>
                                <StatLabel label="L" statKey="losses_record" sport="NFL" mode={props.mode} /> {team.losses}
                              </span>
                              {team.ties > 0 || advanced ? (
                                <span>
                                  <StatLabel label="T" statKey="ties" sport="NFL" mode={props.mode} /> {team.ties}
                                </span>
                              ) : null}
                              <span>
                                <StatLabel label="Streak" statKey="streak" sport="NFL" mode={props.mode} /> {team.streak}
                              </span>
                            </div>
                            {!advanced ? (
                              <p className="mt-1 text-[11px] text-neutral-500">{recordLabel(team.wins, team.losses, team.ties)}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {team.divisionLeader ? <span className="rounded border border-emerald-700 bg-emerald-950 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">Leader</span> : null}
                            {team.clinched ? (
                              <span className="rounded border border-blue-700 bg-blue-950 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                                <StatLabel label="Clinched" statKey="clinched" sport="NFL" mode={props.mode} />
                              </span>
                            ) : null}
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${streakClass(team.streak)}`}>{team.streak}</span>
                          </div>
                        </div>
                        {advanced ? (
                          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-neutral-400">
                            <div className="rounded border border-neutral-800 bg-neutral-950/70 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                                <StatLabel label="Pct" statKey="win_pct" sport="NFL" mode={props.mode} />
                              </p>
                              <p className="mt-1 text-neutral-200">{(team.pct * 100).toFixed(1)}%</p>
                            </div>
                            <div className="rounded border border-neutral-800 bg-neutral-950/70 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                                <StatLabel label="PF" statKey="points_for" sport="NFL" mode={props.mode} />
                              </p>
                              <p className="mt-1 text-neutral-200">{team.pointsFor}</p>
                            </div>
                            <div className="rounded border border-neutral-800 bg-neutral-950/70 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                                <StatLabel label="PA" statKey="points_against" sport="NFL" mode={props.mode} />
                              </p>
                              <p className="mt-1 text-neutral-200">{team.pointsAgainst}</p>
                            </div>
                            <div className="rounded border border-neutral-800 bg-neutral-950/70 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-neutral-500">Diff</p>
                              <p className="mt-1 text-neutral-200">{pointDiff > 0 ? `+${pointDiff}` : pointDiff}</p>
                            </div>
                            <div className="rounded border border-neutral-800 bg-neutral-950/70 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                                <StatLabel label="Playoff Seed" statKey="playoff_seed" sport="NFL" mode={props.mode} />
                              </p>
                              <p className="mt-1 text-neutral-200">{team.playoffSeed ?? "-"}</p>
                            </div>
                            <div className="rounded border border-neutral-800 bg-neutral-950/70 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                                <StatLabel label="Clinched" statKey="clinched" sport="NFL" mode={props.mode} />
                              </p>
                              <p className="mt-1 text-neutral-200">{team.clinched ? "Yes" : "No"}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-500">
        <span>Updated {meta ? to12h(meta.updatedAt) : "-"}</span>
        <SourceChips meta={meta} />
      </div>

      <button
        type="button"
        className="text-[10px] text-neutral-400 underline"
        onClick={() => props.onReportBug({ widgetId: props.widgetId, endpoint, meta, conference, division })}
      >
        Report a bug
      </button>
    </div>
  );
}
