const WEATHER_BASE = "https://api.openweathermap.org/data/2.5";

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

// Redact appid from URLs before storing in health logs
function sanitizeUrl(url: string): string {
  return url.replace(/([?&]appid=)[^&]*/i, "$1[redacted]");
}

export type GameDayWeather = {
  tempF: number | null;
  condition: string | null;
  windMph: number | null;
  isOutdoor: boolean;
  weatherImpact: "none" | "low" | "moderate" | "high";
  source: "openweather" | "unavailable";
  isFallback: boolean;
  fallbackReason?: string;
};

// OpenWeather /weather response shape (partial — only fields we consume)
type OwWeatherResponse = {
  main: { temp: number };
  wind: { speed: number };
  weather: Array<{ main: string; description: string }>;
};

const FALLBACK_UNAVAILABLE: Omit<GameDayWeather, "fallbackReason"> = {
  tempF: null,
  condition: null,
  windMph: null,
  isOutdoor: false,
  weatherImpact: "none",
  source: "unavailable",
  isFallback: true,
};

// MLB venues with retractable or fixed roofs — weather is irrelevant for these
const INDOOR_VENUES = new Set([
  "tropicana field",
  "minute maid park",
  "american family field",
  "chase field",
  "marlins park",
  "loanDepot park",
  "loandepot park",
  "rogers centre",
  "t-mobile park",
  "oracle park dome",
  "globe life field",
]);

function isIndoorVenue(venue: string): boolean {
  const normalized = venue.toLowerCase().trim();
  for (const indoor of INDOOR_VENUES) {
    if (normalized.includes(indoor) || indoor.includes(normalized)) {
      return true;
    }
  }
  return false;
}

function classifyImpact(
  tempF: number,
  windMph: number,
  conditionMain: string,
): GameDayWeather["weatherImpact"] {
  const cond = conditionMain.toLowerCase();
  const hasPrecip = cond.includes("rain") || cond.includes("snow") || cond.includes("storm") || cond.includes("drizzle");
  const extremeTemp = tempF < 40 || tempF > 95;
  const highWind = windMph > 25;
  const moderateWind = windMph > 15;

  if (highWind || (hasPrecip && extremeTemp)) return "high";
  if (hasPrecip || extremeTemp || moderateWind) return "moderate";
  return "low";
}

export async function fetchGameDayWeather(
  venue: string,
  city: string,
): Promise<GameDayWeather> {
  if (isIndoorVenue(venue)) {
    return {
      tempF: null,
      condition: null,
      windMph: null,
      isOutdoor: false,
      weatherImpact: "none",
      source: "openweather",
      isFallback: false,
    };
  }

  const apiKey = process.env.OPEN_WEATHER_KEY;
  if (!apiKey) {
    return { ...FALLBACK_UNAVAILABLE, fallbackReason: "OPEN_WEATHER_KEY is not configured." };
  }

  const endpoint = "/weather";
  const params = new URLSearchParams({
    q: city,
    appid: apiKey,
    units: "imperial",
  });
  const url = `${WEATHER_BASE}${endpoint}?${params}`;
  const safeUrl = sanitizeUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = (await response.text()).slice(0, 200);
      trackError(endpoint, `OpenWeather ${response.status}: ${text}`, response.status, safeUrl);
      return { ...FALLBACK_UNAVAILABLE, fallbackReason: `OpenWeather returned ${response.status}.` };
    }

    const data = (await response.json()) as OwWeatherResponse;
    trackSuccess(endpoint, safeUrl, response.status);

    const tempF = data.main?.temp ?? null;
    const windMph = data.wind?.speed ?? null;
    const conditionMain = data.weather?.[0]?.main ?? null;
    const conditionDesc = data.weather?.[0]?.description ?? null;

    if (tempF === null || windMph === null || conditionMain === null) {
      return {
        ...FALLBACK_UNAVAILABLE,
        fallbackReason: "OpenWeather response missing expected fields.",
      };
    }

    const weatherImpact = classifyImpact(tempF, windMph, conditionMain);

    return {
      tempF,
      condition: conditionDesc ?? conditionMain,
      windMph,
      isOutdoor: true,
      weatherImpact,
      source: "openweather",
      isFallback: false,
    };
  } catch (error) {
    clearTimeout(timeout);
    const message = String(error);
    trackError(endpoint, message, undefined, safeUrl);
    return { ...FALLBACK_UNAVAILABLE, fallbackReason: `Fetch failed: ${message}` };
  }
}

export function getWeatherHealthSnapshot(): Record<string, EndpointHealth> {
  return Object.fromEntries(endpointHealth.entries());
}
