import { NextRequest, NextResponse } from "next/server";
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

  return NextResponse.json({ widgets, categories });
}

