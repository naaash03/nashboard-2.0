import { NextResponse } from "next/server";
import { BUILTIN_GLOSSARY_TERMS, mergeGlossaryTerms } from "@/lib/stats/glossary";

const fallback = mergeGlossaryTerms([
  ...BUILTIN_GLOSSARY_TERMS,
  {
    sport: "NFL",
    key: "ypc",
    label: "YPC",
    aliases: ["yards per carry"],
    plainDefinition: "Yards per carry is rushing yards divided by rushing attempts.",
    whyItMatters: "It offers a quick read on rushing efficiency and explosiveness.",
    advancedNotes: "YPC can swing on a few explosive runs, so it works best alongside workload and success-rate context.",
    learnMoreUrl: "https://www.espn.com/nfl/stats/team/_/stat/rushing",
  },
]);

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ terms: fallback, warning: "DATABASE_URL is not configured." });
  }

  const { prisma } = await import("@/lib/db/prisma");
  const terms = await prisma.glossaryTerm.findMany({ orderBy: { label: "asc" } });
  return NextResponse.json({ terms: mergeGlossaryTerms(terms.length > 0 ? terms : fallback) });
}
