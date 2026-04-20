import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";

const VALID_SPORTS = ["NFL", "NBA", "MLB"] as const;
type WatchlistSport = typeof VALID_SPORTS[number];

function missingDbResponse() {
  return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 });
}

function toContractItem(row: {
  id: string;
  sport: string;
  entityType: string;
  teamKey: string;
  teamName: string;
  apiSportsTeamId?: string | null;
  espnTeamId?: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    sport: row.sport,
    entityType: row.entityType,
    entityId: row.teamKey,
    entityName: row.teamName,
    apiSportsTeamId: row.apiSportsTeamId ?? null,
    espnTeamId: row.espnTeamId ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return missingDbResponse();
  }

  const { prisma } = await import("@/lib/db/prisma");
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ items: [], guest: true });
  }

  const rows = await prisma.watchlistTeam.findMany({
    where: { userId: viewer.userId },
    orderBy: [{ sport: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ items: rows.map(toContractItem) });
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) {
    return missingDbResponse();
  }

  const { prisma } = await import("@/lib/db/prisma");
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ error: "Sign in to save watchlist items" }, { status: 401 });
  }

  const body = (await req.json()) as {
    sport?: string;
    entityType?: string;
    entityId?: string;
    entityName?: string;
    // Legacy field aliases kept for backward compat
    teamKey?: string;
    teamName?: string;
    apiSportsTeamId?: string;
    espnTeamId?: string;
  };

  const sport = ((body.sport ?? "NFL") as string).toUpperCase() as WatchlistSport;
  const entityType = body.entityType ?? "team";
  const entityId = (body.entityId ?? body.teamKey ?? "").trim().toUpperCase();
  const entityName = (body.entityName ?? body.teamName ?? "").trim();

  if (!entityId || !entityName) {
    return NextResponse.json({ error: "entityId and entityName are required" }, { status: 400 });
  }

  if (!VALID_SPORTS.includes(sport)) {
    return NextResponse.json({ error: `Unsupported sport: ${sport}. Must be NFL, NBA, or MLB.` }, { status: 400 });
  }

  const count = await prisma.watchlistTeam.count({
    where: { userId: viewer.userId, sport, entityType },
  });
  if (count >= 10) {
    return NextResponse.json(
      { error: "Watchlist limit reached for this sport. Remove an item before adding another." },
      { status: 409 },
    );
  }

  try {
    const created = await prisma.watchlistTeam.create({
      data: {
        userId: viewer.userId,
        sport,
        entityType,
        teamKey: entityId,
        teamName: entityName,
        apiSportsTeamId: typeof body.apiSportsTeamId === "string" ? body.apiSportsTeamId : null,
        espnTeamId: typeof body.espnTeamId === "string" ? body.espnTeamId : null,
      },
    });

    return NextResponse.json({ item: toContractItem(created) }, { status: 201 });
  } catch (error) {
    const message = String(error);
    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "This item is already on your watchlist." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to add watchlist item" }, { status: 500 });
  }
}
