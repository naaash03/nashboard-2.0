import { NextResponse } from "next/server";

const fallback = [
  {
    key: "ypc",
    label: "Yards Per Carry",
    plainDefinition: "Average rushing yards gained per rushing attempt.",
    whyItMatters: "Higher YPC often signals better efficiency and matchup fit.",
    advancedNotes: "Context matters: game script and opponent fronts can skew YPC.",
    learnMoreUrl: "https://www.espn.com/nfl/stats/team/_/stat/rushing",
  },
];

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ terms: fallback, error: "DATABASE_URL is not configured." }, { status: 500 });
  }

  const { prisma } = await import("@/lib/db/prisma");
  const terms = await prisma.glossaryTerm.findMany({ orderBy: { label: "asc" } });
  return NextResponse.json({ terms: terms.length > 0 ? terms : fallback });
}

