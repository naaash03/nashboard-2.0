import { NextResponse } from "next/server";
import { GET as canonicalPlayersSearch } from "@/app/api/players/search/route";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const canonicalUrl = new URL(req.url);
  canonicalUrl.pathname = "/api/players/search";
  canonicalUrl.searchParams.set("sport", "mlb");
  canonicalUrl.searchParams.set("q", (searchParams.get("q") ?? "").trim());

  const response = await canonicalPlayersSearch(new Request(canonicalUrl, {
    headers: req.headers,
    method: "GET",
  }));
  const body = await response.json();

  return NextResponse.json({
    data: body.data ?? null,
    meta: body.meta,
    error: body.error ?? null,
    contract: body.contract,
    legacyAdapter: {
      from: "/api/players/search",
      sport: "mlb",
    },
  }, { status: response.status });
}
