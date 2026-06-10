import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamKey = (searchParams.get("teamKey") ?? "").trim().toUpperCase();
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!teamKey) {
    return NextResponse.json({ error: "teamKey is required" }, { status: 400 });
  }

  const { data, meta } = await mlbProvider.getPlatoonAdvantage(teamKey, resolvedDataMode);
  const contract = toWidgetPayload({ data, error: null, meta, primaryProvider: "mlb" });
  if (process.env.NODE_ENV === "development") {
    const missing: string[] = [];
    if (contract.ok === undefined || contract.ok === null) missing.push("ok");
    if (!contract.source?.provider) missing.push("source.provider");
    if (!contract.source?.mode) missing.push("source.mode");
    if (!contract.source?.fetchedAt) missing.push("source.fetchedAt");
    if (!contract.debug?.requestId) missing.push("debug.requestId");
    if (missing.length > 0) {
      console.warn(`[contract] mlb-platoon-advantage missing fields: ${missing.join(", ")}`);
    }
  }
  return NextResponse.json({ data, meta, error: null, contract });
}
