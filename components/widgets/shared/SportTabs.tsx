"use client";

import TabsRow from "@/components/widgets/shared/TabsRow";
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
    <TabsRow
      items={TABS}
      value={value}
      onChange={(next) => onChange(next as SportKey)}
      disabled={disabled}
      size="sm"
    />
  );
}
