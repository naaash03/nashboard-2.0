import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { resolveNbaPlayerRoleForm } from "@/lib/sports/resolvers/nbaScaffolds";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { shapeNbaPlayerRoleForm } from "@/lib/templates/nbaPlayerRoleForm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const scenarioId = (searchParams.get("scenario") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  const resolved = resolveNbaPlayerRoleForm({
    scenarioId,
    dataMode: resolvedDataMode,
  });
  const contract = toWidgetPayload({
    data: resolved.data,
    error: null,
    meta: resolved.meta,
    primaryProvider: "espn",
    notes: ["Player role + form is currently served from curated demo scenarios."],
  });

  return NextResponse.json({
    data: shapeNbaPlayerRoleForm(resolved.data, mode),
    meta: resolved.meta,
    contract,
    error: null,
  });
}
