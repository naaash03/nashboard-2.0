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
    return NextResponse.json({ error: "Missing widget id" }, { status: 400 });
  }

  const dashboard = await prisma.dashboard.findUnique({ where: { userId: viewer.userId } });
  if (!dashboard) {
    return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
  }

  if (dashboard.layoutLocked) {
    return NextResponse.json({ error: "Layout is locked" }, { status: 409 });
  }

  await prisma.widgetInstance.deleteMany({ where: { id, dashboardId: dashboard.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
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
    return NextResponse.json({ error: "Missing widget id" }, { status: 400 });
  }

  const dashboard = await prisma.dashboard.findUnique({ where: { userId: viewer.userId } });
  if (!dashboard) {
    return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
  }

  if (dashboard.layoutLocked) {
    return NextResponse.json({ error: "Layout is locked" }, { status: 409 });
  }

  const body = (await req.json()) as {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    mode?: "BEGINNER" | "ADVANCED";
    config?: Record<string, unknown>;
    playerId?: string;
  };

  const updated = await prisma.widgetInstance.update({
    where: { id },
    data: {
      x: body.x,
      y: body.y,
      w: body.w,
      h: body.h,
      mode: body.mode,
      config: body.config as never,
      playerId: body.playerId,
    },
  });

  return NextResponse.json({ widget: updated });
}

