import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { resolveNbaPlayerRoleForm } from "@/lib/sports/resolvers/nbaScaffolds";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { shapeNbaPlayerRoleForm } from "@/lib/templates/nbaPlayerRoleForm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const scenarioId = (searchParams.get("scenario") ?? "").trim() || undefined;
  const playerName = (searchParams.get("playerName") ?? "").trim() || undefined;
  const playerTeamKey = (searchParams.get("playerTeamKey") ?? "").trim() || undefined;
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  const resolved = await resolveNbaPlayerRoleForm({
    scenarioId,
    playerName,
    playerTeamKey,
    dataMode: resolvedDataMode,
    cacheBust,
  });
  const src = resolved.meta.sourceUsed;
  const primaryProvider = (src === "apiSports" || src === "espn" || src === "mlb" || src === "balldontlie" ? src : "balldontlie") as const;
  const contract = toWidgetPayload({
    data: resolved.data,
    error: null,
    meta: resolved.meta,
    primaryProvider,
    notes: [
      resolved.data.sourceDetail,
      "Player lookup and box-score form use BALLDONTLIE as the primary live path, with API-Sports NBA as the fallback identity/season-context layer before the widget drops to demo.",
    ],
  });

  return NextResponse.json({
    data: shapeNbaPlayerRoleForm(resolved.data, mode),
    meta: resolved.meta,
    contract,
    error: null,
  });
}
