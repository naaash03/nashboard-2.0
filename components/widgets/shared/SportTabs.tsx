"use client";

import type { SportKey } from "@/lib/types/players";

const TABS: Array<{ key: SportKey; label: string }> = [
  { key: "nfl", label: "NFL" },
  { key: "mlb", label: "MLB" },
  { key: "nba", label: "NBA" },
];

export default function SportTabs({
  value,
  onChange,
  disabled,
}: {
  value: SportKey;
  onChange: (next: SportKey) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded border border-neutral-700 bg-neutral-950 p-0.5">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          disabled={disabled}
          className={`rounded px-2 py-1 text-[11px] ${value === tab.key ? "bg-neutral-700 text-white" : "text-neutral-300"}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
