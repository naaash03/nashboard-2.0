"use client";

type SizeOption = { w: number; h: number };

type Props = {
  allowedSizes: SizeOption[];
  currentW: number;
  currentH: number;
  onSizeChange: (w: number, h: number) => void;
};

const SIZE_LABELS: Record<string, string> = {
  "1x1": "Sm",
  "2x1": "Md",
  "3x1": "Wd",
  "2x2": "Lg",
};

function SizePreview({ w, h, active }: { w: number; h: number; active: boolean }) {
  const cols = w === 3 ? "grid-cols-3" : w === 2 ? "grid-cols-2" : "grid-cols-1";
  return (
    <div
      className={`grid gap-[3px] ${cols} rounded p-1.5 transition-colors ${
        active
          ? "bg-zinc-500 text-zinc-100"
          : "bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-300"
      }`}
    >
      {Array.from({ length: w * h }).map((_, i) => (
        <div key={i} className="h-[7px] w-[7px] rounded-sm bg-current" />
      ))}
    </div>
  );
}

export default function WidgetSizePicker({ allowedSizes, currentW, currentH, onSizeChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] uppercase tracking-wide text-zinc-600">Size</span>
      <div className="flex items-center gap-1">
        {allowedSizes.map(({ w, h }) => {
          const active = currentW === w && currentH === h;
          const label = SIZE_LABELS[`${w}x${h}`] ?? `${w}x${h}`;
          return (
            <button
              key={`${w}x${h}`}
              type="button"
              onClick={() => onSizeChange(w, h)}
              title={`${label} - ${w}x${h}`}
              className="group flex flex-col items-center gap-0.5"
            >
              <SizePreview w={w} h={h} active={active} />
              <span className={`text-[9px] font-medium ${active ? "text-zinc-300" : "text-zinc-600 group-hover:text-zinc-400"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
