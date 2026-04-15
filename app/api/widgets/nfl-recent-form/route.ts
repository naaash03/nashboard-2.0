import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { resolveNflRecentForm } from "@/lib/sports/resolvers/nflWidgets";
import { shapeNflRecentForm } from "@/lib/templates/nflRecentForm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const teamKey = (searchParams.get("teamKey") ?? "").trim().toUpperCase() || undefined;
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  const resolved = await resolveNflRecentForm({
    teamKey,
    dataMode: resolvedDataMode,
    cacheBust,
  });
  const contract = toWidgetPayload({
    data: resolved.data,
    error: null,
    meta: resolved.meta,
    primaryProvider: "espn",
    notes: ["NFL recent form uses ESPN team schedules plus opponent record lookups when available, and falls back to a demo trend card if needed."],
  });

  return NextResponse.json({
    data: shapeNflRecentForm(resolved.data, mode),
    meta: resolved.meta,
    contract,
    error: null,
  });
}
