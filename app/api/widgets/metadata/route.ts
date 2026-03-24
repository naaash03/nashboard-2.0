import { NextResponse } from "next/server";
import { WIDGET_DEFINITIONS } from "@/lib/widgets/registry";

export async function GET() {
  const categories = {
    NFL: WIDGET_DEFINITIONS.filter((w) => w.sportCategory === "NFL"),
    MLB: WIDGET_DEFINITIONS.filter((w) => w.sportCategory === "MLB"),
    NBA: WIDGET_DEFINITIONS.filter((w) => w.sportCategory === "NBA"),
    Utilities: WIDGET_DEFINITIONS.filter((w) => w.sportCategory === "UTILITIES"),
  };

  return NextResponse.json({ widgets: WIDGET_DEFINITIONS, categories });
}

