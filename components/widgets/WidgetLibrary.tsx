"use client";

import { useEffect, useState } from "react";
import type { WidgetDefinition } from "@/lib/widgets/registry";

type Categories = {
  NFL: WidgetDefinition[];
  MLB: WidgetDefinition[];
  NBA: WidgetDefinition[];
  Utilities: WidgetDefinition[];
};

export default function WidgetLibrary({
  open,
  sport,
  onClose,
  onAddWidget,
}: {
  open: boolean;
  sport: "NFL" | "NBA" | "MLB";
  onClose: () => void;
  onAddWidget: (widgetType: string) => void;
}) {
  const [categories, setCategories] = useState<Categories>({ NFL: [], MLB: [], NBA: [], Utilities: [] });

  useEffect(() => {
    if (!open) return;
    fetch(`/api/widgets/metadata?sport=${sport}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setCategories(json.categories ?? { NFL: [], MLB: [], NBA: [], Utilities: [] }))
      .catch(() => setCategories({ NFL: [], MLB: [], NBA: [], Utilities: [] }));
  }, [open, sport]);

  if (!open) return null;

  const sections: Array<{ key: keyof Categories; label: string; items: WidgetDefinition[] }> = [
    { key: "NFL", label: "NFL", items: categories.NFL },
    { key: "MLB", label: "MLB", items: categories.MLB },
    { key: "NBA", label: "NBA", items: categories.NBA },
    { key: "Utilities", label: "Misc", items: categories.Utilities },
  ];

  const stabilityLabel: Record<NonNullable<WidgetDefinition["stability"]>, string> = {
    stable: "Stable",
    experimental: "Experimental",
    admin: "Admin",
  };
  const audienceLabel: Record<NonNullable<WidgetDefinition["audience"]>, string> = {
    beginner: "Beginner",
    advanced: "Advanced",
    mixed: "Beginner+Advanced",
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 p-4">
      <div className="mx-auto flex max-h-[calc(100vh-2rem)] max-w-3xl flex-col rounded-xl border border-neutral-700 bg-neutral-900 p-4">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-semibold">Add Widget</h2>
          <button className="rounded border border-neutral-700 px-2 py-1 text-xs" onClick={onClose} type="button">Close</button>
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-fr gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.key} className="flex min-h-0 flex-col gap-2">
              <p className="shrink-0 text-sm font-medium">{section.label}</p>
              <div className="min-h-0 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {section.items.length === 0 ? <p className="text-xs text-neutral-500">No widgets.</p> : null}
                  {section.items.map((widget) => (
                    <div key={widget.key} className="rounded border border-neutral-700 bg-neutral-950 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{widget.name}</p>
                        <div className="flex gap-1 text-[10px]">
                          {widget.stability ? (
                            <span className="rounded border border-neutral-600 px-1 py-0.5 text-neutral-300">
                              {stabilityLabel[widget.stability]}
                            </span>
                          ) : null}
                          {widget.audience ? (
                            <span className="rounded border border-neutral-700 px-1 py-0.5 text-neutral-400">
                              {audienceLabel[widget.audience]}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-neutral-400">{widget.description}</p>
                      <button type="button" className="mt-2 rounded border border-neutral-700 px-2 py-1" onClick={() => onAddWidget(widget.key)}>Add</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

