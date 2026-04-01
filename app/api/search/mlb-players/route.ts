import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { resolvedDataMode } = resolveDataModeFromRequest(req);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(8, Math.max(1, Number(searchParams.get("limit") ?? "8")));

  const { data, meta } = await mlbProvider.searchPlayers(q, limit, resolvedDataMode);
  return NextResponse.json({ data, meta });
}
