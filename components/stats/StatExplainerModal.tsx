"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStatExplainer } from "@/components/stats/StatExplainerProvider";
import type { GlossaryDirection, GlossarySport, GlossaryTier } from "@/lib/stats/glossary";
import { isRankable, type RankingContext } from "@/lib/stats/rankability";

const SPORT_LABELS: Record<GlossarySport, string> = {
  ALL: "Multi-sport",
  NFL: "NFL",
  NBA: "NBA",
  MLB: "MLB",
  UTILITIES: "Utilities",
};

function DetailPill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${className}`}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-neutral-500">
      {children}
    </p>
  );
}

function getShellTone(sport: GlossarySport): string {
  switch (sport) {
    case "MLB":
      return "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_36%),linear-gradient(180deg,rgba(22,28,39,0.98),rgba(9,12,17,0.98))]";
    case "NBA":
      return "bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_36%),linear-gradient(180deg,rgba(22,28,39,0.98),rgba(9,12,17,0.98))]";
    case "NFL":
      return "bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.14),transparent_36%),linear-gradient(180deg,rgba(22,28,39,0.98),rgba(9,12,17,0.98))]";
    case "UTILITIES":
      return "bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_36%),linear-gradient(180deg,rgba(22,28,39,0.98),rgba(9,12,17,0.98))]";
    default:
      return "bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.12),transparent_36%),linear-gradient(180deg,rgba(22,28,39,0.98),rgba(9,12,17,0.98))]";
  }
}

function getSportPillTone(sport: GlossarySport): string {
  switch (sport) {
    case "MLB":
      return "border-sky-400/20 bg-sky-400/10 text-sky-100";
    case "NBA":
      return "border-amber-400/20 bg-amber-400/10 text-amber-100";
    case "NFL":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
    case "UTILITIES":
      return "border-cyan-400/20 bg-cyan-400/10 text-cyan-100";
    default:
      return "border-white/10 bg-white/[0.06] text-neutral-200";
  }
}

function getDirectionMeta(direction?: GlossaryDirection): {
  label: string;
  className: string;
} | null {
  switch (direction) {
    case "HIGHER_IS_BETTER":
      return {
        label: "Higher is usually better",
        className: "border-sky-400/20 bg-sky-400/10 text-sky-100",
      };
    case "LOWER_IS_BETTER":
      return {
        label: "Lower is usually better",
        className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
      };
    case "CONTEXT_DEPENDENT":
      return {
        label: "Context matters",
        className: "border-amber-400/20 bg-amber-400/10 text-amber-100",
      };
    default:
      return null;
  }
}

const TIER_COLOR_MAP: Record<GlossaryTier["color"], { card: string; bar: string }> = {
  green: { card: "bg-emerald-500/15 border-emerald-400/20", bar: "bg-emerald-500/70" },
  blue:  { card: "bg-sky-500/15 border-sky-400/20",         bar: "bg-sky-500/70" },
  gray:  { card: "bg-white/[0.05] border-white/10",         bar: "bg-neutral-500/60" },
  amber: { card: "bg-amber-500/15 border-amber-400/20",     bar: "bg-amber-500/70" },
  red:   { card: "bg-red-500/12 border-red-400/20",         bar: "bg-red-500/60" },
};

const TIER_TEXT_MAP: Record<GlossaryTier["color"], string> = {
  green: "text-emerald-100",
  blue:  "text-sky-100",
  gray:  "text-neutral-300",
  amber: "text-amber-100",
  red:   "text-red-100",
};

// ---------------------------------------------------------------------------
// Contextual ranking section — progressive, additive, no blocking
// ---------------------------------------------------------------------------

type LeaderEntry = {
  rank: number;
  name: string;
  entityId: string;
  value: string;
  isCurrentSubject: boolean;
};

type RankingData = {
  rank: number | null;
  total: number;
  scopeLabel: string;
  qualifierText: string;
  leaderboard: LeaderEntry[];
  /** Subject's stat value from the live leaders list, returned by /api/stat-ranking. */
  subjectValue?: string;
};

function RankingSection({
  context,
  statKey,
  sport,
}: {
  context: RankingContext;
  statKey: string;
  sport: string;
}) {
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const season = context.season ?? new Date().getFullYear();
    const params = new URLSearchParams({
      statKey,
      sport,
      entityType: context.entityType,
      season: String(season),
    });
    if (context.entityId) params.set("entityId", context.entityId);
    if (context.teamKey) params.set("teamKey", context.teamKey);

    void fetch(`/api/stat-ranking?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { rankable?: boolean } & Partial<RankingData>) => {
        if (json.rankable) {
          setData(json as RankingData);
        }
      })
      .catch(() => {
        /* silently omit — explainer still works without ranking */
      })
      .finally(() => setLoading(false));
  }, [statKey, sport, context.entityType, context.entityId, context.teamKey, context.season]);

  if (loading) {
    return (
      <section className="rounded-2xl bg-white/3 px-4 py-4 ring-1 ring-white/6">
        <SectionLabel>Where they rank</SectionLabel>
        <p className="mt-3 text-[11px] text-neutral-500">Loading rankings…</p>
      </section>
    );
  }

  if (!data) return null;

  const subjectNotInTop10 =
    data.rank !== null && data.rank > 10 && Boolean(context.entityName);

  return (
    <section className="rounded-2xl bg-white/3 px-4 py-4 ring-1 ring-white/6">
      <div className="flex items-baseline justify-between gap-4">
        <SectionLabel>Where they rank</SectionLabel>
        <span className="shrink-0 text-[11px] text-neutral-400">
          {data.scopeLabel}
        </span>
      </div>

      {data.rank !== null && (
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl font-bold text-white">#{data.rank}</span>
          <span className="text-[11px] text-neutral-400">of {data.total}</span>
          {data.subjectValue !== undefined && (
            <span className="ml-auto font-mono text-sm font-semibold text-sky-300">
              {data.subjectValue}
            </span>
          )}
        </div>
      )}
      <p className="mt-1 text-[11px] text-neutral-500">{data.qualifierText}</p>

      {data.leaderboard.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Top 10
          </p>
          {data.leaderboard.map((entry) => (
            <div
              key={entry.entityId}
              className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] ${
                entry.isCurrentSubject
                  ? "bg-sky-400/15 font-medium text-white ring-1 ring-sky-400/25"
                  : "bg-white/[0.03] text-neutral-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 text-right font-mono ${
                    entry.isCurrentSubject ? "text-sky-400" : "text-neutral-500"
                  }`}
                >
                  {entry.rank}
                </span>
                <span>{entry.name}</span>
              </div>
              <span className="font-mono">{entry.value}</span>
            </div>
          ))}

          {/* Show subject below the leaderboard if they ranked outside top 10 */}
          {subjectNotInTop10 && (
            <>
              <div className="flex items-center justify-center py-0.5">
                <span className="text-[11px] text-neutral-600">···</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-sky-400/15 px-2.5 py-1.5 text-[11px] font-medium text-white ring-1 ring-sky-400/25">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-right font-mono text-sky-400">
                    {data.rank}
                  </span>
                  <span>{context.entityName}</span>
                </div>
                <span className="font-mono">
                  {data.subjectValue ?? (context.statValue !== undefined ? String(context.statValue) : "")}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default function StatExplainerModal() {
  const context = useStatExplainer();
  const activeTerm = context?.activeTerm ?? null;
  const closeExplainer = context?.closeExplainer;
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!activeTerm || !closeExplainer) {
      return;
    }

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeExplainer();
      }
    };

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeTerm, closeExplainer]);

  if (!activeTerm || !closeExplainer) {
    return null;
  }

  const { term, mode, rankingContext } = activeTerm;
  const directionMeta = getDirectionMeta(term.direction);
  const hasAdvancedContext = mode === "ADVANCED" && Boolean(term.advancedNotes);

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      onClick={() => closeExplainer()}
    >
      <div className="flex min-h-full items-start justify-center sm:py-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="stat-explainer-title"
          aria-describedby="stat-explainer-description"
          className={`my-4 w-full max-w-[46rem] max-h-[calc(100vh-3rem)] overflow-y-auto overscroll-contain rounded-[28px] border border-white/10 text-white shadow-[0_28px_120px_rgba(0,0,0,0.72)] ring-1 ring-white/6 [scrollbar-gutter:stable] ${getShellTone(term.sport)}`}
          onClick={(event) => event.stopPropagation()}
        >
          {/* Sticky header */}
          <div className="sticky top-0 z-10 border-b border-white/8 bg-[linear-gradient(180deg,rgba(11,13,18,0.94),rgba(11,13,18,0.78))] px-5 pb-4 pt-5 backdrop-blur-xl sm:px-6 sm:pb-5 sm:pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <DetailPill className={getSportPillTone(term.sport)}>
                    {SPORT_LABELS[term.sport]}
                  </DetailPill>
                  {directionMeta ? (
                    <DetailPill className={directionMeta.className}>{directionMeta.label}</DetailPill>
                  ) : null}
                  {hasAdvancedContext ? (
                    <DetailPill className="border-white/10 bg-white/[0.06] text-neutral-200">
                      Advanced context
                    </DetailPill>
                  ) : null}
                </div>
                <h2
                  id="stat-explainer-title"
                  className="mt-3 text-[1.7rem] font-semibold tracking-tight text-white sm:text-[1.95rem]"
                >
                  {term.label}
                </h2>
                <p
                  id="stat-explainer-description"
                  className="mt-2 max-w-2xl text-sm leading-6 text-neutral-200 sm:text-[0.95rem]"
                >
                  {term.plainDefinition}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close stat explainer"
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-neutral-200 transition hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                onClick={() => closeExplainer()}
              >
                Close
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-3 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">

            {/* WHY IT MATTERS */}
            <section className="rounded-2xl bg-white/4.5 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-white/6">
              <SectionLabel>Why it matters</SectionLabel>
              <p className="mt-3 text-sm leading-7 text-neutral-100">{term.whyItMatters}</p>
            </section>

            {/* HOW IT'S CALCULATED */}
            {term.calculation ? (
              <section className="rounded-2xl bg-white/3 px-4 py-4 ring-1 ring-white/6">
                <div className="flex items-baseline justify-between gap-4">
                  <SectionLabel>How it&rsquo;s calculated</SectionLabel>
                  <span className="shrink-0 font-mono text-[11px] text-neutral-400">
                    {term.calculation.formula}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {term.calculation.components.map((component) => (
                    <div
                      key={component.name}
                      className="min-w-32 flex-1 rounded-xl bg-white/5 px-3 py-3 ring-1 ring-white/8"
                    >
                      <p className="text-[11px] font-semibold text-white">{component.name}</p>
                      <p className="mt-1 text-[11px] leading-5 text-neutral-400">{component.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* INTERPRETATION */}
            {term.tiers && term.tiers.length > 0 ? (
              <section className="rounded-2xl bg-white/3 px-4 py-4 ring-1 ring-white/6">
                <div className="flex items-baseline justify-between gap-4">
                  <SectionLabel>Interpretation</SectionLabel>
                  {term.leagueAverage ? (
                    <span className="shrink-0 text-[11px] text-neutral-400">{term.leagueAverage}</span>
                  ) : null}
                </div>
                {/* Tier spectrum bar */}
                <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full">
                  {term.tiers.map((tier) => (
                    <div key={tier.label} className={`flex-1 ${TIER_COLOR_MAP[tier.color].bar}`} />
                  ))}
                </div>
                {/* Tier cards */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {term.tiers.map((tier) => (
                    <div
                      key={tier.label}
                      className={`rounded-xl border px-3 py-3 ${TIER_COLOR_MAP[tier.color].card}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`text-[11px] font-semibold ${TIER_TEXT_MAP[tier.color]}`}>
                          {tier.label}
                        </p>
                        <span className={`shrink-0 text-[11px] font-medium opacity-80 ${TIER_TEXT_MAP[tier.color]}`}>
                          {tier.range}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-neutral-400">{tier.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* ADVANCED NOTE */}
            {hasAdvancedContext ? (
              <section className="rounded-2xl bg-white/3 px-4 py-4 ring-1 ring-white/6">
                <SectionLabel>Advanced note</SectionLabel>
                <p className="mt-3 text-sm leading-6 text-neutral-300">{term.advancedNotes}</p>
              </section>
            ) : null}

            {/* GAME IMPACT TAGS */}
            {term.tags && term.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {term.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-neutral-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {/* WHERE THEY RANK — only mounts when subject context exists and stat is rankable.
                rankingContext.sport takes priority over term.sport for multi-sport glossary
                terms (e.g. w_l_record has sport "ALL" but registry entry is "w_l_record:MLB"). */}
            {rankingContext && isRankable(term.key, rankingContext.sport ?? term.sport, rankingContext.entityType) ? (
              <RankingSection
                context={rankingContext}
                statKey={term.key}
                sport={rankingContext.sport ?? term.sport}
              />
            ) : null}

            {/* Footer: Learn more only */}
            {term.learnMoreUrl ? (
              <div className="flex justify-end border-t border-white/8 pt-4">
                <a
                  href={term.learnMoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-white/8 hover:text-white"
                >
                  Learn more
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
