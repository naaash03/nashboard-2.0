import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import type { Meta } from "@/lib/providers/types";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import type { WidgetPayload } from "@/lib/sports/models";

export type DataMode = "auto" | "live" | "fixture";
export type PrimaryProvider = "apiSports" | "espn" | "mlb";
export type ProviderResult<T> = { data: T; meta: Meta };

/**
 * Build a Meta object for an error/fallback response. Centralizes the
 * sourceUsed/updatedAt/requestId/dataMode shape that every widget route used
 * to redeclare inline.
 */
export function fallbackMeta(mode: DataMode, warning: string, provider: PrimaryProvider = "mlb"): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : provider,
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: mode,
  };
}

/**
 * Dev-only contract completeness check. Previously copy-pasted into ~8 routes.
 */
export function warnMissingContractFields(routeName: string, contract: WidgetPayload<unknown>): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  const missing: string[] = [];
  if (contract.ok === undefined || contract.ok === null) missing.push("ok");
  if (!contract.source?.provider) missing.push("source.provider");
  if (!contract.source?.mode) missing.push("source.mode");
  if (!contract.source?.fetchedAt) missing.push("source.fetchedAt");
  if (!contract.debug?.requestId) missing.push("debug.requestId");
  if (missing.length > 0) {
    console.warn(`[contract] ${routeName} missing fields: ${missing.join(", ")}`);
  }
}

/**
 * Shared parsing of the query params every widget route reads.
 */
export function parseWidgetParams(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode: "beginner" | "advanced" =
    (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const teamKey = (searchParams.get("teamKey") ?? "").trim().toUpperCase();
  const playerId = (searchParams.get("playerId") ?? "").trim();
  const { resolvedDataMode } = resolveDataModeFromRequest(req);
  return { searchParams, mode, cacheBust, teamKey, playerId, resolvedDataMode };
}

/**
 * Factory for the common "teamKey -> provider method -> contract" widget route.
 * Guarantees a structured response and never throws an unhandled 500: upstream
 * failures return a 502 envelope with a fallback meta + contract.
 */
export function createTeamWidgetRoute<T>(opts: {
  routeName: string;
  errorMessage: string;
  primaryProvider?: PrimaryProvider;
  provider: (teamKey: string, dataMode: DataMode) => Promise<ProviderResult<T>>;
}) {
  const primaryProvider = opts.primaryProvider ?? "mlb";
  return async function GET(req: Request) {
    const { teamKey, resolvedDataMode } = parseWidgetParams(req);

    if (!teamKey) {
      return NextResponse.json({ error: "teamKey is required" }, { status: 400 });
    }

    try {
      const { data, meta } = await opts.provider(teamKey, resolvedDataMode);
      const contract = toWidgetPayload({ data, error: null, meta, primaryProvider });
      warnMissingContractFields(opts.routeName, contract);
      return NextResponse.json({ data, meta, contract });
    } catch (error) {
      const meta = fallbackMeta(resolvedDataMode, `${opts.errorMessage}: ${String(error)}`, primaryProvider);
      const contract = toWidgetPayload({ data: null, error: opts.errorMessage, meta, primaryProvider });
      return NextResponse.json({ data: null, meta, contract, error: opts.errorMessage }, { status: 502 });
    }
  };
}
