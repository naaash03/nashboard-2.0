import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isDbConfigured } from "@/lib/config/env";
import { checkRateLimit, clientIpFromRequest } from "@/lib/security/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Registration is expensive (bcrypt) and a prime target for abuse — cap new
// account attempts per client IP.
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Account creation is unavailable because the database is not configured." },
      { status: 503 },
    );
  }

  const rate = checkRateLimit(`register:${clientIpFromRequest(req)}`, REGISTER_LIMIT, REGISTER_WINDOW_MS);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: { email?: unknown; password?: unknown; name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" && body.name.trim().length > 0 ? body.name.trim() : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const { prisma } = await import("@/lib/db/prisma");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name, passwordHash, role: "USER" },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to create account: ${String(error)}` },
      { status: 500 },
    );
  }
}
