import { NextResponse } from "next/server";
import { fallbackMeta, warnMissingContractFields } from "@/lib/api/widgetRoute";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { getPlayoffPicture } from "@/lib/providers/espn/nba";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";

export async function GET(req: Request) {
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  try {
    const { data, meta } = await getPlayoffPicture(resolvedDataMode);
    const contract = toWidgetPayload({ data, error: null, meta, primaryProvider: "espn" });
    warnMissingContractFields("nba-playoff-picture", contract);
    return NextResponse.json({ data, meta, contract });
  } catch (error) {
    const message = "Failed to load NBA playoff picture";
    const meta = fallbackMeta(resolvedDataMode, `${message}: ${String(error)}`, "espn");
    const contract = toWidgetPayload({ data: null, error: message, meta, primaryProvider: "espn" });
    return NextResponse.json({ data: null, meta, contract, error: message }, { status: 502 });
  }
}
