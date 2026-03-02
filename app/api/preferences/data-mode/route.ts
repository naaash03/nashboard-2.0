import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";

function keyFor(userId: string): string {
  return createHash("sha256").update(userId).digest("hex");
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ mode: "auto", persisted: false, error: "DB not configured" });
  }

  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ mode: "auto", persisted: false });
  }

  const { prisma } = await import("@/lib/db/prisma");
  const row = await prisma.cachedResponse.findUnique({
    where: {
      provider_endpoint_paramsHash: {
        provider: "ui",
        endpoint: "data-mode",
        paramsHash: keyFor(viewer.userId),
      },
    },
  });

  const payload = row?.payload as { mode?: "auto" | "live" | "fixture" } | undefined;
  const mode = payload?.mode === "fixture" || payload?.mode === "live" || payload?.mode === "auto"
    ? payload.mode
    : "auto";
  return NextResponse.json({ mode, persisted: Boolean(row) });
}

export async function PUT(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await req.json()) as { mode?: "auto" | "live" | "fixture" };
  const mode = body.mode === "fixture" || body.mode === "live" || body.mode === "auto" ? body.mode : "auto";

  const { prisma } = await import("@/lib/db/prisma");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 3600 * 1000);

  await prisma.cachedResponse.upsert({
    where: {
      provider_endpoint_paramsHash: {
        provider: "ui",
        endpoint: "data-mode",
        paramsHash: keyFor(viewer.userId),
      },
    },
    update: {
      payload: { mode } as never,
      fetchedAt: now,
      expiresAt,
      sourceUsed: "CACHE",
      requestId: `pref-${viewer.userId}`,
    },
    create: {
      provider: "ui",
      endpoint: "data-mode",
      paramsHash: keyFor(viewer.userId),
      payload: { mode } as never,
      fetchedAt: now,
      expiresAt,
      sourceUsed: "CACHE",
      requestId: `pref-${viewer.userId}`,
    },
  });

  return NextResponse.json({ mode, persisted: true });
}

