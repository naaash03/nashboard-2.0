import { NextRequest, NextResponse } from "next/server";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import type { Meta } from "@/lib/providers/types";
import { WIDGET_DEFINITIONS } from "@/lib/widgets/registry";

export async function GET(req: NextRequest) {
  const sportParam = (req.nextUrl.searchParams.get("sport") ?? "NFL").toUpperCase();
  const sport = ["NFL", "NBA", "MLB", "UTILITIES"].includes(sportParam) ? sportParam : "NFL";

  const widgets = WIDGET_DEFINITIONS.filter((definition) => {
    if (definition.sportCategory === "UTILITIES") return true;
    return definition.sportCategory === sport;
  });

  const categories = {
    NFL: widgets.filter((w) => w.sportCategory === "NFL"),
    MLB: widgets.filter((w) => w.sportCategory === "MLB"),
    NBA: widgets.filter((w) => w.sportCategory === "NBA"),
    Utilities: widgets.filter((w) => w.sportCategory === "UTILITIES"),
  };

  const meta: Meta = {
    sourceUsed: "cache",
    updatedAt: new Date().toISOString(),
    requestId: "widget-registry",
  };
  const contract = toWidgetPayload({
    data: widgets,
    meta,
    primaryProvider: "apiSports",
    notes: ["Widget metadata is served from the internal registry."],
  });

  return NextResponse.json({ widgets, categories, contract });
}
