import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/config/env";

type CookieDomainDecision = {
  strategy: "host_only" | "explicit_domain";
  cookieDomain: string | null;
  reason: string;
};

function resolveProtocol(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const url = new URL(req.url);
  if (url.protocol === "https:") return "https";
  return "http";
}

function buildCookieDomainDecision(host: string): CookieDomainDecision {
  const explicitCookieDomain = process.env.NEXTAUTH_COOKIE_DOMAIN?.trim();
  if (explicitCookieDomain) {
    return {
      strategy: "explicit_domain",
      cookieDomain: explicitCookieDomain,
      reason: "Using NEXTAUTH_COOKIE_DOMAIN from environment.",
    };
  }

  return {
    strategy: "host_only",
    cookieDomain: null,
    reason: `No cookie domain override set; cookies stay scoped to the exact hostname (${host}).`,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const originHeader = req.headers.get("origin");
  const resolvedBaseUrl = process.env.NEXTAUTH_URL?.trim() || `${resolveProtocol(req)}://${host}`;
  const cookieDomainDecision = buildCookieDomainDecision(host);

  return NextResponse.json({
    request: {
      host,
      originHeader,
      url: req.url,
    },
    resolvedBaseUrl,
    appBaseUrlFallback: appBaseUrl(),
    cookieDomainDecision,
    notes: [
      "Use the same hostname for UI and API requests in local dev.",
      "Cookies from localhost are not sent to 192.168.x.x, and vice versa.",
    ],
  });
}
