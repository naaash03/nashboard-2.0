const ODDS_BASE = "https://api.the-odds-api.com/v4";

type EndpointHealth = {
  endpoint: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;
  lastStatus?: number;
  lastUrl?: string;
};

const endpointHealth = new Map<string, EndpointHealth>();

function trackSuccess(endpoint: string, url: string, status: number): void {
  const current = endpointHealth.get(endpoint) ?? { endpoint };
  endpointHealth.set(endpoint, {
    ...current,
    endpoint,
    lastSuccessAt: new Date().toISOString(),
    lastStatus: status,
    lastUrl: url,
  });
}

function trackError(endpoint: string, message: string, status?: number, url?: string): void {
  const current = endpointHealth.get(endpoint) ?? { endpoint };
  endpointHealth.set(endpoint, {
    ...current,
    endpoint,
    lastErrorAt: new Date().toISOString(),
    lastErrorMessage: message,
    lastStatus: status,
    lastUrl: url ?? current.lastUrl,
  });
}

// Redact apiKey from URLs before storing in health logs
function sanitizeUrl(url: string): string {
  return url.replace(/([?&]apiKey=)[^&]*/i, "$1[redacted]");
}

export type MlbGameOdds = {
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  overUnder: number | null;
  source: "odds_api" | "unavailable";
  isFallback: boolean;
  fallbackReason?: string;
};

// The Odds API game shape (partial — only fields we consume)
type OddsGame = {
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
};

const FALLBACK_UNAVAILABLE: Omit<MlbGameOdds, "fallbackReason"> = {
  homeMoneyline: null,
  awayMoneyline: null,
  overUnder: null,
  source: "unavailable",
  isFallback: true,
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function teamsMatch(apiTeam: string, searchTeam: string): boolean {
  const a = normalize(apiTeam);
  const b = normalize(searchTeam);
  return a.includes(b) || b.includes(a);
}

function extractMoneylines(game: OddsGame): { home: number | null; away: number | null } {
  for (const bookmaker of game.bookmakers) {
    const h2h = bookmaker.markets.find((m) => m.key === "h2h");
    if (!h2h) continue;
    const homeOut = h2h.outcomes.find((o) => teamsMatch(game.home_team, o.name));
    const awayOut = h2h.outcomes.find((o) => teamsMatch(game.away_team, o.name));
    if (homeOut && awayOut) {
      return { home: homeOut.price, away: awayOut.price };
    }
  }
  return { home: null, away: null };
}

function extractOverUnder(game: OddsGame): number | null {
  for (const bookmaker of game.bookmakers) {
    const totals = bookmaker.markets.find((m) => m.key === "totals");
    if (!totals) continue;
    const over = totals.outcomes.find((o) => o.name === "Over");
    if (over?.point !== undefined) {
      return over.point;
    }
  }
  return null;
}

export type OddsSportSlug = "baseball_mlb" | "basketball_nba" | "americanfootball_nfl";

export async function fetchGameOdds(
  sportSlug: OddsSportSlug,
  homeTeam: string,
  awayTeam: string,
): Promise<MlbGameOdds> {
  const apiKey = process.env.THE_ODDS_KEY;
  if (!apiKey) {
    return { ...FALLBACK_UNAVAILABLE, fallbackReason: "THE_ODDS_KEY is not configured." };
  }

  const endpoint = `/sports/${sportSlug}/odds`;
  const params = new URLSearchParams({
    apiKey,
    regions: "us",
    markets: "h2h,totals",
    oddsFormat: "american",
  });
  const url = `${ODDS_BASE}${endpoint}?${params}`;
  const safeUrl = sanitizeUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = (await response.text()).slice(0, 200);
      trackError(endpoint, `Odds API ${response.status}: ${text}`, response.status, safeUrl);
      return { ...FALLBACK_UNAVAILABLE, fallbackReason: `Odds API returned ${response.status}.` };
    }

    const games = (await response.json()) as OddsGame[];
    trackSuccess(endpoint, safeUrl, response.status);

    const match = games.find(
      (g) => teamsMatch(g.home_team, homeTeam) && teamsMatch(g.away_team, awayTeam),
    );

    if (!match) {
      return {
        ...FALLBACK_UNAVAILABLE,
        fallbackReason: `No game found for ${homeTeam} vs ${awayTeam}.`,
      };
    }

    const { home, away } = extractMoneylines(match);
    const overUnder = extractOverUnder(match);

    return {
      homeMoneyline: home,
      awayMoneyline: away,
      overUnder,
      source: "odds_api",
      isFallback: false,
    };
  } catch (error) {
    clearTimeout(timeout);
    const message = String(error);
    trackError(endpoint, message, undefined, safeUrl);
    return { ...FALLBACK_UNAVAILABLE, fallbackReason: `Fetch failed: ${message}` };
  }
}

export async function fetchMlbGameOdds(
  homeTeam: string,
  awayTeam: string,
): Promise<MlbGameOdds> {
  return fetchGameOdds("baseball_mlb", homeTeam, awayTeam);
}

export type LineMovement = {
  awayOpen: number | null;
  homeOpen: number | null;
  awayVigShift: string | null;
  homeVigShift: string | null;
  isFallback: boolean;
  fallbackReason?: string;
};

const FALLBACK_LINE_MOVEMENT_UNAVAILABLE = (reason: string): LineMovement => ({
  awayOpen: null,
  homeOpen: null,
  awayVigShift: null,
  homeVigShift: null,
  isFallback: true,
  fallbackReason: reason,
});

function formatShift(shift: number): string {
  return shift >= 0 ? `+${shift}` : `${shift}`;
}

// Fetches the overnight (midnight UTC today) snapshot as a proxy for opening line,
// then compares to current lines to compute line movement.
// Returns isFallback when: key absent, API error, game not in snapshot, or only one data point.
export async function fetchLineMovement(
  sportSlug: OddsSportSlug,
  homeTeam: string,
  awayTeam: string,
  currentHomeML: number | null,
  currentAwayML: number | null,
): Promise<LineMovement> {
  const apiKey = process.env.THE_ODDS_KEY;
  if (!apiKey) {
    return FALLBACK_LINE_MOVEMENT_UNAVAILABLE("THE_ODDS_KEY is not configured.");
  }

  if (currentHomeML === null || currentAwayML === null) {
    return FALLBACK_LINE_MOVEMENT_UNAVAILABLE("Current odds unavailable — cannot compute line movement.");
  }

  // Use midnight UTC today as "opening" snapshot proxy
  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);
  const dateParam = todayMidnight.toISOString().replace(".000Z", "Z");

  const endpoint = `/historical/sports/${sportSlug}/odds`;
  const params = new URLSearchParams({
    apiKey,
    date: dateParam,
    regions: "us",
    markets: "h2h",
    oddsFormat: "american",
  });
  const url = `${ODDS_BASE}${endpoint}?${params}`;
  const safeUrl = sanitizeUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = (await response.text()).slice(0, 200);
      trackError(endpoint, `Odds history ${response.status}: ${text}`, response.status, safeUrl);
      return FALLBACK_LINE_MOVEMENT_UNAVAILABLE(`Odds history API returned ${response.status}.`);
    }

    // Historical endpoint wraps games in { data: OddsGame[], timestamp: string }
    const body = (await response.json()) as { data?: OddsGame[] } | OddsGame[];
    trackSuccess(endpoint, safeUrl, response.status);

    const games: OddsGame[] = Array.isArray(body) ? body : (body.data ?? []);

    const match = games.find(
      (g) => teamsMatch(g.home_team, homeTeam) && teamsMatch(g.away_team, awayTeam),
    );

    if (!match) {
      return FALLBACK_LINE_MOVEMENT_UNAVAILABLE("Insufficient history for line movement.");
    }

    const { home: homeOpen, away: awayOpen } = extractMoneylines(match);

    if (homeOpen === null || awayOpen === null) {
      return FALLBACK_LINE_MOVEMENT_UNAVAILABLE("Insufficient history for line movement.");
    }

    const homeShift = currentHomeML - homeOpen;
    const awayShift = currentAwayML - awayOpen;

    return {
      awayOpen,
      homeOpen,
      awayVigShift: formatShift(awayShift),
      homeVigShift: formatShift(homeShift),
      isFallback: false,
    };
  } catch (error) {
    clearTimeout(timeout);
    const message = String(error);
    trackError(endpoint, message, undefined, safeUrl);
    return FALLBACK_LINE_MOVEMENT_UNAVAILABLE(`Fetch failed: ${message}`);
  }
}

export function getMlbOddsHealthSnapshot(): Record<string, EndpointHealth> {
  return Object.fromEntries(endpointHealth.entries());
}
