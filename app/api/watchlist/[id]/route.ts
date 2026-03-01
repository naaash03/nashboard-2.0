import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";

function missingDbResponse() {
  return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id?: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return missingDbResponse();
  }

  const { prisma } = await import("@/lib/db/prisma");
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing watchlist id" }, { status: 400 });
  }

  await prisma.watchlistTeam.deleteMany({ where: { id, userId: viewer.userId } });
  return NextResponse.json({ ok: true });
}

