"use client";

type TabItem = {
  key: string;
  label: string;
};

type TabsRowProps = {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  size?: "sm" | "md";
  disabled?: boolean;
};

export default function TabsRow({
  items,
  value,
  onChange,
  size = "sm",
  disabled = false,
}: TabsRowProps) {
  const pad = size === "md" ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-[11px]";

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-flex min-w-full gap-1 rounded border border-neutral-700 bg-neutral-950 p-1">
        {items.map((item) => {
          const active = item.key === value;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              disabled={disabled}
              className={`shrink-0 rounded ${pad} ${active ? "bg-neutral-700 text-white" : "text-neutral-300 hover:bg-neutral-800"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
