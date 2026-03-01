export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

function hasEnv(name: string): boolean {
  const value = process.env[name];
  return Boolean(value && value.trim().length > 0);
}

export function isCoreAuthConfigured(): boolean {
  return hasEnv("NEXTAUTH_SECRET") && hasEnv("NEXTAUTH_URL");
}

export function isGoogleConfigured(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (!id || !secret) {
    return false;
  }

  const placeholders = new Set(["your-google-client-id", "your-google-client-secret"]);
  return !placeholders.has(id.toLowerCase()) && !placeholders.has(secret.toLowerCase());
}

export function isAuthConfigured(): boolean {
  return isCoreAuthConfigured();
}

export function missingAuthVars(): string[] {
  const required = ["NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const;
  return required.filter((name) => !hasEnv(name));
}

export function appBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const envUrl = process.env.NEXTAUTH_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl;
  }

  return "http://localhost:3000";
}

export function envDefaultDataMode(): "live" | "fixture" {
  return (process.env.NASHBOARD_DATA_MODE ?? "live").toLowerCase() === "fixture" ? "fixture" : "live";
}

function parseCookieValue(cookieHeader: string | null, key: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === key) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return null;
}

export type DataModeResolution = {
  resolvedDataMode: "live" | "fixture";
  queryDataMode: "live" | "fixture" | null;
  cookieDataMode: "live" | "fixture" | null;
  envDataMode: "live" | "fixture";
};

export function resolveDataModeFromRequest(req: Request): DataModeResolution {
  const { searchParams } = new URL(req.url);
  const queryRaw = searchParams.get("dataMode");
  const queryDataMode = queryRaw === "fixture" || queryRaw === "live" ? queryRaw : null;

  const cookieRaw = parseCookieValue(req.headers.get("cookie"), "nashboard_dataMode");
  const cookieDataMode = cookieRaw === "fixture" || cookieRaw === "live" ? cookieRaw : null;

  const envDataMode = envDefaultDataMode();
  return {
    resolvedDataMode: queryDataMode ?? cookieDataMode ?? envDataMode ?? "live",
    queryDataMode,
    cookieDataMode,
    envDataMode,
  };
}
