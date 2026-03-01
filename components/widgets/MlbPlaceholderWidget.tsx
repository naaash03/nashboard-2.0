"use client";

import type { WidgetCommonProps } from "@/components/widgets/types";

export default function MlbPlaceholderWidget(props: WidgetCommonProps & { kind: "next7" | "arsenal" }) {
  const title = props.kind === "next7" ? "MLB Next 7 Games" : "Pitcher Arsenal";
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-medium">{title}</p>
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
      <p>Data source to be added.</p>
      <p className="text-neutral-500">Updated - · Source DEMO</p>
      <button className="text-[10px] underline text-neutral-400" type="button" onClick={() => props.onReportBug({ widgetId: props.widgetId, title })}>Report a bug</button>
    </div>
  );
}

