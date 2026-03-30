"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMode } from "@/app/context/ModeContext";
import { useStatExplainer } from "@/app/context/StatExplainerContext";
import { hasStatLeaderSupport } from "@/lib/stats/leaderSupport";
import type {
  StatBetterDirection,
  StatLeadersResponse,
  StatThresholdTone,
} from "@/lib/stats/types";

type LeadersState = {
  loading: boolean;
  supported: boolean;
  data: StatLeadersResponse | null;
  error: string | null;
};

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
}

function toneColor(tone: StatThresholdTone): string {
  switch (tone) {
    case "elite":
      return "#22c55e";
    case "good":
      return "#38bdf8";
    case "average":
      return "#a3a3a3";
    case "warning":
      return "#f97316";
    default:
      return "#525252";
  }
}

function tonePanelClass(tone: StatThresholdTone): string {
  switch (tone) {
    case "elite":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
    case "good":
      return "border-sky-500/30 bg-sky-500/10 text-sky-100";
    case "average":
      return "border-neutral-600 bg-neutral-800/70 text-neutral-100";
    case "warning":
      return "border-orange-500/30 bg-orange-500/10 text-orange-100";
    default:
      return "border-neutral-700 bg-neutral-900 text-white";
  }
}

function betterDirectionLabel(direction: StatBetterDirection): string {
  if (direction === "higher") return "Higher is usually better";
  if (direction === "lower") return "Lower is usually better";
  return "Context matters most";
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Updated recently";
  }

  return `Updated ${date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function CurrentLeadersSkeleton() {
  return (
    <div className="mt-3 space-y-2">
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex animate-pulse items-center gap-3 rounded-xl border border-neutral-800 bg-black/30 px-3 py-2"
        >
          <div className="h-7 w-7 rounded-full bg-neutral-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-neutral-800" />
            <div className="h-2 w-20 rounded bg-neutral-900" />
          </div>
          <div className="h-3 w-12 rounded bg-neutral-800" />
        </div>
      ))}
    </div>
  );
}

export default function StatExplainerModal() {
  const { current, closeExplainer } = useStatExplainer();
  const { mode } = useMode();
  const [ready, setReady] = useState(false);
  const [leadersState, setLeadersState] = useState<LeadersState>({
    loading: false,
    supported: false,
    data: null,
    error: null,
  });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const hasLeaderSupport = current.entry ? hasStatLeaderSupport(current.entry.key, current.entry.sport) : false;

  const thresholdWidth = useMemo(
    () => (current.entry ? 100 / current.entry.thresholds.length : 25),
    [current.entry],
  );

  useEffect(() => {
    if (!current.isOpen) {
      setReady(false);
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      setReady(true);
      closeButtonRef.current?.focus();
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeExplainer();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !panelRef.current?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !panelRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [closeExplainer, current.isOpen]);

  useEffect(() => {
    if (!current.isOpen || !current.entry) {
      setLeadersState({
        loading: false,
        supported: false,
        data: null,
        error: null,
      });
      return;
    }

    if (!hasLeaderSupport) {
      setLeadersState({
        loading: false,
        supported: false,
        data: null,
        error: null,
      });
      return;
    }

    const currentEntry = current.entry;
    const controller = new AbortController();

    setLeadersState({
      loading: true,
      supported: true,
      data: null,
      error: null,
    });

    void (async () => {
      try {
        const params = new URLSearchParams({
          statKey: currentEntry.key,
          sport: currentEntry.sport,
        });
        const response = await fetch(`/api/stats/leaders?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 404) {
          setLeadersState({
            loading: false,
            supported: false,
            data: null,
            error: null,
          });
          return;
        }

        const json = (await response.json()) as StatLeadersResponse | { error?: string };
        if (!response.ok) {
          throw new Error("error" in json ? json.error ?? "Failed to load current leaders" : "Failed to load current leaders");
        }

        setLeadersState({
          loading: false,
          supported: true,
          data: json as StatLeadersResponse,
          error: null,
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setLeadersState({
          loading: false,
          supported: true,
          data: null,
          error: "Current leaders are unavailable right now.",
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [current.entry, current.isOpen, hasLeaderSupport]);

  if (!current.isOpen || !current.entry) {
    return null;
  }

  const entry = current.entry;

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeExplainer();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`w-full max-w-[720px] rounded-2xl border border-neutral-700 transition duration-200 ${ready ? "translate-y-0 scale-100" : "translate-y-3 scale-[0.98]"}`}
        style={{
          backgroundImage: "linear-gradient(180deg, rgba(23, 23, 23, 0.98), rgba(10, 10, 10, 0.98))",
          boxShadow: "0 32px 120px rgba(0, 0, 0, 0.65)",
        }}
      >
        <div className="border-b border-neutral-800 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-neutral-400">
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-200">
                  {entry.sport}
                </span>
                <span>{betterDirectionLabel(entry.betterDirection)}</span>
              </div>
              <div>
                <h2 id={titleId} className="text-2xl font-semibold text-white">
                  {entry.displayName}
                </h2>
                <p className="mt-1 text-sm text-neutral-300">{entry.shortDescription}</p>
                {current.options?.triggerLabel && current.options.triggerLabel !== entry.displayName ? (
                  <p className="mt-1 text-xs text-neutral-500">Clicked from: {current.options.triggerLabel}</p>
                ) : null}
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              onClick={closeExplainer}
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <section className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">What is it</p>
              <p id={descriptionId} className="mt-3 text-sm leading-6 text-neutral-200">
                {entry.plainEnglishExplanation}
              </p>
            </section>

            <section className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">How it&apos;s calculated</p>
                <p className="text-xs text-neutral-400">{entry.formulaText}</p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {entry.formulaParts.map((part) => (
                  <div key={`${entry.key}-${part.label}`} className="rounded-xl border border-neutral-800 bg-black/30 p-3">
                    <p className="text-xs font-semibold text-white">{part.label}</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-400">{part.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Interpretation</p>
                <p className="text-xs text-neutral-400">{entry.leagueAverageLabel}</p>
              </div>

              <div className="mt-4 rounded-xl border border-neutral-800 bg-black/30 p-3">
                <svg viewBox="0 0 100 12" className="h-4 w-full" aria-hidden="true">
                  {entry.thresholds.map((threshold, index) => (
                    <rect
                      key={`${threshold.label}-${threshold.rangeLabel}`}
                      x={index * thresholdWidth}
                      y="0"
                      width={thresholdWidth}
                      height="12"
                      rx="1.5"
                      fill={toneColor(threshold.tone)}
                    />
                  ))}
                </svg>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {entry.thresholds.map((threshold) => (
                    <div
                      key={`${threshold.label}-${threshold.rangeLabel}-panel`}
                      className={`rounded-xl border p-3 ${tonePanelClass(threshold.tone)}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{threshold.label}</p>
                        <p className="text-[11px]">{threshold.rangeLabel}</p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-current">{threshold.interpretation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Game impact tags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.impactTags.map((tag) => (
                  <span
                    key={`${entry.key}-${tag}`}
                    className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            {leadersState.supported ? (
              <section className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Current Leaders</p>
                    <p className="mt-2 text-xs text-neutral-400">
                      {leadersState.data ? `Season ${leadersState.data.season}` : "Current-season leaderboard"}
                    </p>
                  </div>
                  {leadersState.data ? (
                    <div className="flex items-center gap-2 text-[11px]">
                      <span
                        className={`rounded-full border px-2 py-1 ${
                          leadersState.data.usedFallback
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                        }`}
                      >
                        {leadersState.data.usedFallback ? "Fallback snapshot" : "Live feed"}
                      </span>
                      <span className="text-neutral-500">{formatUpdatedAt(leadersState.data.updatedAt)}</span>
                    </div>
                  ) : null}
                </div>

                {leadersState.loading ? <CurrentLeadersSkeleton /> : null}

                {!leadersState.loading && leadersState.data?.leaders.length ? (
                  <div className="mt-3 space-y-2">
                    {leadersState.data.leaders.map((leader) => (
                      <div
                        key={`${entry.key}-${leader.rank}-${leader.playerName}-${leader.team}`}
                        className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-black/30 px-3 py-2"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-[11px] font-semibold text-neutral-200">
                          {leader.rank}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{leader.playerName}</p>
                          <p className="truncate text-[11px] text-neutral-400">{leader.team}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-cyan-200">{leader.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {!leadersState.loading && !leadersState.data?.leaders.length ? (
                  <p className="mt-3 text-sm leading-6 text-neutral-400">
                    {leadersState.error ?? "Current leaders are not available for this stat right now."}
                  </p>
                ) : null}
              </section>
            ) : null}

            {mode === "advanced" && entry.advancedNote ? (
              <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">Advanced note</p>
                <p className="mt-2 text-sm leading-6 text-cyan-50">{entry.advancedNote}</p>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
