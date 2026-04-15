import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveDataModeFromRequest } from "@/lib/config/env";
import { mlbProvider } from "@/lib/providers/mlb";
import { fetchMlbJson, getMlbDataMode } from "@/lib/providers/mlb/client";
import type { Meta } from "@/lib/providers/types";
import { toWidgetPayload } from "@/lib/sports/resolvers/contracts";
import { shapeMlbPitcherArsenal } from "@/lib/templates/mlbPitcherArsenal";

function fallbackMeta(mode: "auto" | "live" | "fixture", warning: string): Meta {
  return {
    sourceUsed: mode === "fixture" ? "fixture" : "mlb",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    warning,
    dataMode: mode,
  };
}

function isNumericPlayerId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function isUnsupportedArsenalError(error: unknown): boolean {
  const text = String(error).toLowerCase();
  return text.includes("400")
    || text.includes("404")
    || text.includes("422")
    || text.includes("not found")
    || text.includes("invalid")
    || text.includes("pitcharsenal")
    || text.includes("pitch arsenal")
    || text.includes("unsupported")
    || text.includes("not available");
}

type MlbPitcherSearchRow = {
  playerId: string;
  fullName: string;
  teamName?: string;
  position?: string;
  isPitcher?: boolean;
};

type MlbPeopleResponse = {
  people?: Array<{
    id?: number;
    fullName?: string;
    currentTeam?: { name?: string };
    primaryPosition?: {
      abbreviation?: string;
      name?: string;
      type?: string;
    };
  }>;
};

type ResolvedPitcherInput =
  | { ok: true; playerId: string; fullName?: string; teamName?: string; position?: string }
  | { ok: false; error: string };

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]|_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPitcher(row: { position?: string; isPitcher?: boolean }): boolean {
  if (row.isPitcher === true) {
    return true;
  }
  const normalized = (row.position ?? "").trim().toUpperCase();
  return normalized === "P" || normalized === "SP" || normalized === "RP" || normalized === "CL";
}

function resolvePitcherFromCandidates(query: string, rows: MlbPitcherSearchRow[]): ResolvedPitcherInput {
  const normalizedQuery = normalizeName(query);
  const numericRows = rows.filter((row) => isNumericPlayerId(row.playerId));
  const pitcherRows = numericRows.filter((row) => isPitcher(row));

  const exactPitcher = pitcherRows.find((row) => normalizeName(row.fullName) === normalizedQuery);
  if (exactPitcher) {
    return { ok: true, playerId: exactPitcher.playerId, fullName: exactPitcher.fullName, teamName: exactPitcher.teamName, position: exactPitcher.position };
  }

  const exactAny = numericRows.find((row) => normalizeName(row.fullName) === normalizedQuery);
  if (exactAny) {
    return { ok: false, error: "Selected player is not a supported MLB pitcher for arsenal data." };
  }

  const prefixPitcher = pitcherRows.find((row) => normalizeName(row.fullName).startsWith(normalizedQuery));
  if (prefixPitcher) {
    return { ok: true, playerId: prefixPitcher.playerId, fullName: prefixPitcher.fullName, teamName: prefixPitcher.teamName, position: prefixPitcher.position };
  }

  if (numericRows.length > 0) {
    return { ok: false, error: "Selected player is not a supported MLB pitcher for arsenal data." };
  }

  return { ok: false, error: "Could not resolve a valid MLB pitcher id from the provided input." };
}

function mapIdentityPerson(row: NonNullable<MlbPeopleResponse["people"]>[number]): ResolvedPitcherInput {
  const playerId = row?.id ? String(row.id) : "";
  const fullName = row?.fullName?.trim();
  const teamName = row?.currentTeam?.name?.trim();
  const position = row?.primaryPosition?.abbreviation?.trim()
    || row?.primaryPosition?.name?.trim()
    || row?.primaryPosition?.type?.trim();

  if (!playerId) {
    return { ok: false, error: "Could not map the selected player to a valid MLB pitcher id." };
  }

  if (!isPitcher({ position })) {
    return { ok: false, error: "Selected player is not a supported MLB pitcher for arsenal data." };
  }

  return { ok: true, playerId, fullName, teamName, position };
}

async function lookupMlbPitcherIdentity(playerId: string, dataMode: "auto" | "live" | "fixture", cacheBust?: string): Promise<ResolvedPitcherInput> {
  const resolved = getMlbDataMode(dataMode);
  if (resolved === "fixture") {
    return { ok: true, playerId };
  }

  try {
    const response = await fetchMlbJson<MlbPeopleResponse>({
      endpoint: `/people/${encodeURIComponent(playerId)}`,
      ttlSeconds: 300,
      dataMode: resolved,
      cacheBust,
    });
    const person = response.data.people?.[0];
    if (!person) {
      return { ok: false, error: "Could not map the selected player to a valid MLB pitcher id." };
    }
    return mapIdentityPerson(person);
  } catch (error) {
    const text = String(error).toLowerCase();
    if (isUnsupportedArsenalError(text)) {
      return { ok: false, error: "Could not map the selected player to a valid MLB pitcher id." };
    }
    throw error;
  }
}

async function resolvePitcherInput(input: string, dataMode: "auto" | "live" | "fixture", cacheBust?: string): Promise<ResolvedPitcherInput> {
  if (isNumericPlayerId(input)) {
    return lookupMlbPitcherIdentity(input.trim(), dataMode, cacheBust);
  }

  const envelope = await mlbProvider.searchPlayers(input, 8, dataMode);
  return resolvePitcherFromCandidates(input, envelope.data ?? []);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const playerRef = (searchParams.get("playerId") ?? "").trim();
  const mode = (searchParams.get("mode") ?? "beginner").toLowerCase() === "advanced" ? "advanced" : "beginner";
  const cacheBust = (searchParams.get("cacheBust") ?? "").trim() || undefined;
  const { resolvedDataMode } = resolveDataModeFromRequest(req);

  if (!playerRef) {
    const error = "playerId is required";
    const meta = fallbackMeta(resolvedDataMode, error);
    return NextResponse.json({
      data: null,
      meta,
      contract: toWidgetPayload({
        data: null,
        error,
        meta,
        primaryProvider: "mlb",
      }),
      error,
    }, { status: 400 });
  }

  try {
    const resolvedPitcher = await resolvePitcherInput(playerRef, resolvedDataMode, cacheBust);
    if (!resolvedPitcher.ok) {
      const error = resolvedPitcher.error;
      const meta = fallbackMeta(resolvedDataMode, error);
      return NextResponse.json({
        data: null,
        meta,
        contract: toWidgetPayload({
          data: null,
          error,
          meta,
          primaryProvider: "mlb",
        }),
        error,
      }, { status: 400 });
    }

    const providerResult = await mlbProvider.getPitcherArsenal(resolvedPitcher.playerId, resolvedDataMode, cacheBust);
    const shaped = providerResult.data ? shapeMlbPitcherArsenal(providerResult.data, mode) : null;

    return NextResponse.json({
      data: shaped,
      meta: providerResult.meta,
      contract: toWidgetPayload({
        data: providerResult.data
          ? {
            playerId: `mlb-${providerResult.data.playerId}`,
            league: "MLB",
            stats: { pitches: providerResult.data.pitches },
            sourceMeta: {
              provider: providerResult.meta.sourceUsed,
              fetchedAt: providerResult.meta.updatedAt,
              stale: providerResult.meta.sourceUsed === "cache",
            },
          }
          : null,
        error: null,
        meta: providerResult.meta,
        primaryProvider: "mlb",
      }),
      error: null,
    });
  } catch (error) {
    if (isUnsupportedArsenalError(error)) {
      const warning = "Pitch arsenal is not available from MLB Stats API for this pitcher id.";
      const meta = fallbackMeta(resolvedDataMode, warning);
      return NextResponse.json({
        data: null,
        meta,
        contract: toWidgetPayload({
          data: null,
          error: null,
          meta,
          primaryProvider: "mlb",
        }),
        error: null,
      });
    }

    const message = "Failed to load MLB pitcher arsenal";
    const meta = fallbackMeta(resolvedDataMode, `MLB pitcher arsenal upstream failure: ${String(error)}`);
    return NextResponse.json({
      data: null,
      meta,
      contract: toWidgetPayload({
        data: null,
        error: message,
        meta,
        primaryProvider: "mlb",
      }),
      error: message,
    }, { status: 502 });
  }
}
