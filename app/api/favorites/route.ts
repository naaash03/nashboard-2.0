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

  const items = await prisma.favoritePlayer.findMany({
    where: { userId: viewer.userId, sport: "NFL" },
    orderBy: { createdAt: "desc" },
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
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await req.json()) as { playerId?: string; playerName?: string };
  if (!body.playerId || !body.playerName) {
    return NextResponse.json({ error: "playerId and playerName are required" }, { status: 400 });
  }

  const favorite = await prisma.favoritePlayer.create({
    data: {
      userId: viewer.userId,
      sport: "NFL",
      playerId: body.playerId,
      playerName: body.playerName,
    },
  });

  return NextResponse.json({ favorite }, { status: 201 });
}

