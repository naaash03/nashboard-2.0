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

  const sections: Array<{ title: keyof Categories; items: WidgetDefinition[] }> = [
    { title: "NFL", items: categories.NFL },
    { title: "MLB", items: categories.MLB },
    { title: "NBA", items: categories.NBA },
    { title: "Utilities", items: categories.Utilities },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-black/60 p-4">
      <div className="mx-auto max-w-3xl rounded-xl border border-neutral-700 bg-neutral-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Widget</h2>
          <button className="rounded border border-neutral-700 px-2 py-1 text-xs" onClick={onClose} type="button">Close</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <p className="text-sm font-medium">{section.title}</p>
              {section.items.length === 0 ? <p className="text-xs text-neutral-500">No widgets.</p> : null}
              {section.items.map((widget) => (
                <div key={widget.key} className="rounded border border-neutral-700 bg-neutral-950 p-2 text-xs">
                  <p className="font-medium">{widget.name}</p>
                  <p className="text-neutral-400">{widget.description}</p>
                  <button type="button" className="mt-2 rounded border border-neutral-700 px-2 py-1" onClick={() => onAddWidget(widget.key)}>Add</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

