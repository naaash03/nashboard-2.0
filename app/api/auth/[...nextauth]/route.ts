import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/auth";
import { isCoreAuthConfigured, isDbConfigured, missingAuthVars } from "@/lib/config/env";

function authNotConfiguredResponse() {
  const dbConfigured = isDbConfigured();
  const missing = missingAuthVars();

  return NextResponse.json(
    {
      error: "Auth is not configured.",
      missingCoreAuthVars: missing,
      databaseConfigured: dbConfigured,
      hint: "Configure DATABASE_URL, NEXTAUTH_SECRET, and NEXTAUTH_URL to enable auth routes.",
    },
    { status: 501 },
  );
}

function authUnavailable(): boolean {
  return !isDbConfigured() || !isCoreAuthConfigured();
}

export async function GET(req: NextRequest) {
  if (authUnavailable()) {
    return authNotConfiguredResponse();
  }

  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  if (authUnavailable()) {
    return authNotConfiguredResponse();
  }

  return handlers.POST(req);
}