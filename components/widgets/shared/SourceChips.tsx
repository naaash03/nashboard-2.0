"use client";

import type { WidgetMeta } from "@/components/widgets/types";

type SourceChip = {
  label: string;
  tone?: "live" | "fixture" | "demo" | "cache" | "partial" | "neutral";
};

type Props = {
  meta?: WidgetMeta | null;
  chips?: SourceChip[];
  className?: string;
};

function sourceTone(sourceUsed?: string): SourceChip["tone"] {
  if (sourceUsed === "fixture") return "fixture";
  if (sourceUsed === "demo") return "demo";
  if (sourceUsed === "cache") return "cache";
  if (sourceUsed === "apiSports" || sourceUsed === "espn" || sourceUsed === "mlb" || sourceUsed === "balldontlie") return "live";
  return "neutral";
}

function sourceLabel(sourceUsed?: string): string {
  if (!sourceUsed) return "Unknown source";
  if (sourceUsed === "fixture") return "Fixture data";
  if (sourceUsed === "demo") return "Demo data";
  if (sourceUsed === "cache") return "Cached data";
  if (sourceUsed === "apiSports") return "API-Sports";
  if (sourceUsed === "balldontlie") return "BALLDONTLIE";
  return sourceUsed.toUpperCase();
}

function chipClass(tone: SourceChip["tone"] = "neutral"): string {
  if (tone === "live") return "border-emerald-700 bg-emerald-950/70 text-emerald-200";
  if (tone === "fixture") return "border-amber-700 bg-amber-950/70 text-amber-200";
  if (tone === "demo") return "border-orange-700 bg-orange-950/70 text-orange-200";
  if (tone === "cache") return "border-sky-700 bg-sky-950/70 text-sky-200";
  if (tone === "partial") return "border-yellow-700 bg-yellow-950/70 text-yellow-200";
  return "border-neutral-700 bg-neutral-900 text-neutral-300";
}

export default function SourceChips({ meta, chips = [], className = "" }: Props) {
  const resolved = chips.length > 0
    ? chips
    : [{ label: sourceLabel(meta?.sourceUsed), tone: sourceTone(meta?.sourceUsed) }];

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {resolved.map((chip) => (
        <span
          key={`${chip.label}-${chip.tone ?? "neutral"}`}
          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${chipClass(chip.tone)}`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}
