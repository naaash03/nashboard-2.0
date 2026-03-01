import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";

function missingDbResponse() {
  return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 });
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

  const items = await prisma.watchlistTeam.findMany({
    where: { userId: viewer.userId, sport: "NFL" },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) {
    return missingDbResponse();
  }

  const { prisma } = await import("@/lib/db/prisma");
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ error: "Sign in to save watchlist teams" }, { status: 401 });
  }

  const body = (await req.json()) as { teamKey?: string; teamName?: string; sport?: string };
  if (!body.teamKey || !body.teamName) {
    return NextResponse.json({ error: "teamKey and teamName are required" }, { status: 400 });
  }

  if ((body.sport ?? "NFL") !== "NFL") {
    return NextResponse.json({ error: "Watchlist is NFL teams only for MVP" }, { status: 400 });
  }

  const count = await prisma.watchlistTeam.count({ where: { userId: viewer.userId, sport: "NFL" } });
  if (count >= 5) {
    return NextResponse.json(
      { error: "Watchlist limit reached. Remove a team before adding another." },
      { status: 409 },
    );
  }

  const created = await prisma.watchlistTeam.create({
    data: {
      userId: viewer.userId,
      sport: "NFL",
      teamKey: body.teamKey,
      teamName: body.teamName,
    },
  });

  return NextResponse.json(created, { status: 201 });
}

