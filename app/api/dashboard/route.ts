import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";

type ShareScope = "PRIVATE" | "LINK_VIEW" | "INVITED_EMAILS";

function defaultTitle(name: string): string {
  return `${name}'s Dashboard`;
}

function missingDbResponse() {
  return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 });
}

export async function GET(req: Request) {
  if (!process.env.DATABASE_URL) {
    return missingDbResponse();
  }

  const { prisma } = await import("@/lib/db/prisma");
  const { searchParams } = new URL(req.url);
  const shareToken = searchParams.get("shareToken");

  if (shareToken) {
    const shared = await prisma.dashboard.findUnique({
      where: { shareToken },
      include: { widgetInstances: { orderBy: [{ y: "asc" }, { x: "asc" }] } },
    });

    if (!shared || shared.shareScope === "PRIVATE") {
      return NextResponse.json({ error: "Shared dashboard not found" }, { status: 404 });
    }

    return NextResponse.json({ dashboard: shared, widgets: shared.widgetInstances, viewOnly: true });
  }

  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({
      dashboard: {
        id: "guest-dashboard",
        title: "Guest Dashboard",
        layoutLocked: false,
        isPrivate: true,
        shareScope: "PRIVATE",
      },
      widgets: [],
      guest: true,
    });
  }

  let dashboard = await prisma.dashboard.findUnique({ where: { userId: viewer.userId } });
  if (!dashboard) {
    dashboard = await prisma.dashboard.create({
      data: {
        userId: viewer.userId,
        title: defaultTitle(viewer.userName),
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

  return NextResponse.json({ dashboard, widgets, guest: false });
}

export async function PATCH(req: Request) {
  if (!process.env.DATABASE_URL) {
    return missingDbResponse();
  }

  const { prisma } = await import("@/lib/db/prisma");
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await req.json()) as {
    layoutLocked?: boolean;
    shareScope?: ShareScope;
    inviteEmail?: string;
  };

  let dashboard = await prisma.dashboard.findUnique({ where: { userId: viewer.userId } });
  if (!dashboard) {
    dashboard = await prisma.dashboard.create({
      data: {
        userId: viewer.userId,
        title: defaultTitle(viewer.userName),
        shareToken: randomUUID(),
        isPrivate: true,
        shareScope: "PRIVATE",
        invitedEmails: [],
      },
    });
  }

  const invitedEmails = Array.isArray(dashboard.invitedEmails) ? (dashboard.invitedEmails as string[]) : [];
  const nextInvites = body.inviteEmail
    ? Array.from(new Set([...invitedEmails, body.inviteEmail.trim().toLowerCase()])).filter(Boolean)
    : invitedEmails;

  const updated = await prisma.dashboard.update({
    where: { id: dashboard.id },
    data: {
      layoutLocked: typeof body.layoutLocked === "boolean" ? body.layoutLocked : dashboard.layoutLocked,
      shareScope: body.shareScope ?? dashboard.shareScope,
      invitedEmails: nextInvites,
    },
  });

  return NextResponse.json({ dashboard: updated });
}

export async function DELETE() {
  if (!process.env.DATABASE_URL) {
    return missingDbResponse();
  }

  const { prisma } = await import("@/lib/db/prisma");
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ ok: true, guest: true });
  }

  const dashboard = await prisma.dashboard.findUnique({ where: { userId: viewer.userId } });
  if (!dashboard) {
    return NextResponse.json({ ok: true });
  }

  await prisma.widgetInstance.deleteMany({ where: { dashboardId: dashboard.id } });
  return NextResponse.json({ ok: true });
}

