import { NextResponse } from "next/server";
import { isAuthConfigured, isDbConfigured, missingAuthVars } from "@/lib/config/env";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("error") ?? "Configuration";
  const missing = missingAuthVars();
  const dbReady = isDbConfigured();
  const authReady = isAuthConfigured() && dbReady;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>NashBoard Auth Error</title></head>
<body style="font-family: Arial, sans-serif; background:#090c11; color:#edf2ff; padding:24px;">
  <h1>Sign-In is not available</h1>
  <p>Error code: <strong>${code}</strong></p>
  <p>${authReady ? "Auth is configured. Check provider settings and redirect URI." : "Auth is not configured for this environment."}</p>
  <p>Missing auth env vars: <strong>${missing.length > 0 ? missing.join(", ") : "none"}</strong></p>
  <p>DATABASE_URL configured: <strong>${dbReady ? "yes" : "no"}</strong></p>
  <p>Configure NEXTAUTH_URL to the exact base URL you use (localhost or LAN IP). Google env vars are only needed if you want Google OAuth.</p>
</body></html>`;

  return new NextResponse(html, {
    status: authReady ? 400 : 501,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

