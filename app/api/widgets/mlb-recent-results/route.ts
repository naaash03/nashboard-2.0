import { NextResponse } from "next/server";
import { fallbackMeta, parseWidgetParams, warnMissingContractFields } from "@/lib/api/widgetRoute";
import { mlbProvider } from "@/lib/providers/mlb";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";

export async function GET(req: Request) {
  const { searchParams, teamKey, resolvedDataMode } = parseWidgetParams(req);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(10, parseInt(limitParam, 10))) : 3;

  if (!teamKey) {
    return NextResponse.json({ error: "teamKey is required" }, { status: 400 });
  }

  try {
    const { data, meta } = await mlbProvider.getRecentResults(teamKey, limit, resolvedDataMode);
    const contract = toWidgetPayload({ data, error: null, meta, primaryProvider: "mlb" });
    warnMissingContractFields("mlb-recent-results", contract);
    return NextResponse.json({ data, meta, contract });
  } catch (error) {
    const message = "Failed to load MLB recent results";
    const meta = fallbackMeta(resolvedDataMode, `${message}: ${String(error)}`);
    const contract = toWidgetPayload({ data: null, error: message, meta, primaryProvider: "mlb" });
    return NextResponse.json({ data: null, meta, contract, error: message }, { status: 502 });
  }
}
