import { fetchEspnJson, getDataMode } from "@/lib/providers/espn/client";
import type { Meta } from "@/lib/providers/types";

type ModeArg = "auto" | "live" | "fixture";
type CacheBustArg = string | number | null | undefined;

type EspnMlbScoreboard = {
  events?: Array<{
    id?: string;
    date?: string;
    season?: { type?: number };
    competitions?: Array<{
      broadcasts?: Array<{ names?: string[] }>;
      venue?: { fullName?: string; address?: { city?: string } };
      status?: { type?: { state?: string; description?: string; detail?: string } };
      competitors?: Array<{
        homeAway?: "home" | "away";
        team?: { abbreviation?: string; displayName?: string };
        records?: Array<{ summary?: string }>;
      }>;
      probables?: Array<{
        athlete?: { id?: string; fullName?: string };
        homeAway?: "home" | "away";
      }>;
    }>;
  }>;
};

export type MlbScheduleGame = {
  id: string;
  date: string;
  status: string;
  gameType?: string;
  broadcaster?: string;
  venueName?: string;
  venueCity?: string;
  awayTeam: { key: string; name: string; record?: { wins: number; losses: number } };
  homeTeam: { key: string; name: string; record?: { wins: number; losses: number } };
  probables: Array<{ homeAway: "home" | "away"; name: string; athleteId?: string }>;
};

const MLB_SCOREBOARD_ENDPOINT = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard";

function toCompactDate(dateISO: string): string {
  return dateISO.replaceAll("-", "");
}

function gameTypeFromSeasonType(type?: number): string | undefined {
  if (type === 1) return "preseason";
  if (type === 2) return "regular";
  if (type === 3) return "postseason";
  return undefined;
}

function parseRecord(summary?: string): { wins: number; losses: number } | undefined {
  if (!summary) return undefined;
  const [w, l] = summary.split("-").map((v) => Number(v.trim()));
  if (!Number.isFinite(w) || !Number.isFinite(l)) return undefined;
  return { wins: w, losses: l };
}

function normalizeScheduleGames(payload: EspnMlbScoreboard): MlbScheduleGame[] {
  return (payload.events ?? []).map((event) => {
    const competition = event.competitions?.[0];
    const away = competition?.competitors?.find((c) => c.homeAway === "away");
    const home = competition?.competitors?.find((c) => c.homeAway === "home");
    const probables = (competition?.probables ?? []).map((p) => ({
      homeAway: (p.homeAway ?? "home") as "home" | "away",
      name: p.athlete?.fullName ?? "TBD",
      athleteId: p.athlete?.id,
    }));

    return {
      id: event.id ?? `${event.date ?? "unknown"}-${away?.team?.abbreviation ?? "AWY"}-${home?.team?.abbreviation ?? "HME"}`,
      date: event.date ?? new Date().toISOString(),
      status: competition?.status?.type?.detail ?? competition?.status?.type?.description ?? "Scheduled",
      gameType: gameTypeFromSeasonType(event.season?.type),
      broadcaster: competition?.broadcasts?.[0]?.names?.[0],
      venueName: competition?.venue?.fullName,
      venueCity: competition?.venue?.address?.city,
      awayTeam: {
        key: away?.team?.abbreviation ?? "AWY",
        name: away?.team?.displayName ?? "Away",
        record: parseRecord(away?.records?.[0]?.summary),
      },
      homeTeam: {
        key: home?.team?.abbreviation ?? "HME",
        name: home?.team?.displayName ?? "Home",
        record: parseRecord(home?.records?.[0]?.summary),
      },
      probables,
    };
  });
}

export async function getTodaysSchedule(
  dataMode?: ModeArg,
  cacheBust?: CacheBustArg,
): Promise<{ games: MlbScheduleGame[]; meta: Meta; dateUsed: string }> {
  const resolved = getDataMode(dataMode);
  const dateUsed = new Date().toISOString().slice(0, 10);

  const response = await fetchEspnJson<EspnMlbScoreboard>({
    endpoint: MLB_SCOREBOARD_ENDPOINT,
    params: { dates: toCompactDate(dateUsed) },
    fixtureFile: "scoreboard.json",
    fixtureSubdir: "mlb",
    ttlSeconds: 90,
    dataMode: resolved,
    cacheBust,
  });

  return {
    games: normalizeScheduleGames(response.data),
    meta: response.meta,
    dateUsed,
  };
}
