import {
  type DataMode,
  type DataModeResolution,
  resolveDataModeFromRequest as resolveDataModeFromRequestShared,
} from "@/lib/dataMode";

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

export function envDefaultDataMode(): DataMode {
  return "auto";
}

export function resolveDataModeFromRequest(req: Request): DataModeResolution {
  return resolveDataModeFromRequestShared(req);
}
