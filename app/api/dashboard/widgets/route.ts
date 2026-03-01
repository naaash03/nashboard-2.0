import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
    return NextResponse.json({ widgets: [], guest: true });
  }

  let dashboard = await prisma.dashboard.findUnique({ where: { userId: viewer.userId } });
  if (!dashboard) {
    dashboard = await prisma.dashboard.create({
      data: {
        userId: viewer.userId,
        title: `${viewer.userName}'s Dashboard`,
        shareToken: randomUUID(),
        isPrivate: true,
        shareScope: "PRIVATE",
        invitedEmails: [],
      },
    });
  }

  const widgets = await prisma.widgetInstance.findMany({
    where: { dashboardId: dashboard.id },
    orderBy: [{ y: "asc" }, { x: "asc" }],
  });

  return NextResponse.json({ widgets });
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) {
    return missingDbResponse();
  }

  const { prisma } = await import("@/lib/db/prisma");
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ error: "Sign in required to persist widgets" }, { status: 401 });
  }

  const body = (await req.json()) as {
    widgetType: string;
    sport: "NFL" | "NBA" | "MLB" | "UTILITIES";
    mode?: "BEGINNER" | "ADVANCED";
    config?: Record<string, unknown>;
    playerId?: string;
  };

  if (!body.widgetType || !body.sport) {
    return NextResponse.json({ error: "widgetType and sport are required" }, { status: 400 });
  }

  let dashboard = await prisma.dashboard.findUnique({ where: { userId: viewer.userId } });
  if (!dashboard) {
    dashboard = await prisma.dashboard.create({
      data: {
        userId: viewer.userId,
        title: `${viewer.userName}'s Dashboard`,
        shareToken: randomUUID(),
        isPrivate: true,
        shareScope: "PRIVATE",
        invitedEmails: [],
      },
    });
  }

  try {
    const count = await prisma.widgetInstance.count({ where: { dashboardId: dashboard.id } });
    const widget = await prisma.widgetInstance.create({
      data: {
        dashboardId: dashboard.id,
        widgetType: body.widgetType,
        sport: body.sport,
        mode: body.mode ?? "BEGINNER",
        config: (body.config ?? {}) as never,
        playerId: body.playerId,
        x: count % 4,
        y: Math.floor(count / 4),
        w: 1,
        h: 1,
      },
    });

    return NextResponse.json({ widget }, { status: 201 });
  } catch (error) {
    const message = String(error);
    if (message.includes("Unique constraint") || message.includes("dashboardId_widgetType_playerId")) {
      return NextResponse.json(
        { error: "This player card is already on your dashboard. Choose a different player." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to add widget" }, { status: 500 });
  }
}

