import { Router, type IRouter } from "express";

import {
  FES_LATITUDE,
  FES_LOCATION_LABEL,
  FES_LONGITUDE,
} from "../lib/config";

const router: IRouter = Router();

const UPSTREAM_URL = "https://api.open-meteo.com/v1/forecast";
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_HEADERS: Record<string, string> = { Accept: "application/json" };

interface WeatherCondition {
  condition: string;
  iconName: string;
}

/**
 * WMO weather codes -> short condition + Feather-compatible icon. Only the
 * day variant is here; night clear/partly-clear is mapped at runtime via
 * `is_day` to "moon" / "cloud".
 */
const WMO_LOOKUP: Record<number, WeatherCondition> = {
  0: { condition: "Clear", iconName: "sun" },
  1: { condition: "Mostly Clear", iconName: "sun" },
  2: { condition: "Partly Cloudy", iconName: "cloud" },
  3: { condition: "Overcast", iconName: "cloud" },
  45: { condition: "Foggy", iconName: "cloud" },
  48: { condition: "Foggy", iconName: "cloud" },
  51: { condition: "Light Drizzle", iconName: "cloud-drizzle" },
  53: { condition: "Drizzle", iconName: "cloud-drizzle" },
  55: { condition: "Heavy Drizzle", iconName: "cloud-drizzle" },
  56: { condition: "Freezing Drizzle", iconName: "cloud-drizzle" },
  57: { condition: "Freezing Drizzle", iconName: "cloud-drizzle" },
  61: { condition: "Light Rain", iconName: "cloud-rain" },
  63: { condition: "Rain", iconName: "cloud-rain" },
  65: { condition: "Heavy Rain", iconName: "cloud-rain" },
  66: { condition: "Freezing Rain", iconName: "cloud-rain" },
  67: { condition: "Freezing Rain", iconName: "cloud-rain" },
  71: { condition: "Light Snow", iconName: "cloud-snow" },
  73: { condition: "Snow", iconName: "cloud-snow" },
  75: { condition: "Heavy Snow", iconName: "cloud-snow" },
  77: { condition: "Snow Grains", iconName: "cloud-snow" },
  80: { condition: "Rain Showers", iconName: "cloud-rain" },
  81: { condition: "Rain Showers", iconName: "cloud-rain" },
  82: { condition: "Heavy Showers", iconName: "cloud-rain" },
  85: { condition: "Snow Showers", iconName: "cloud-snow" },
  86: { condition: "Snow Showers", iconName: "cloud-snow" },
  95: { condition: "Thunderstorm", iconName: "cloud-lightning" },
  96: { condition: "Thunderstorm", iconName: "cloud-lightning" },
  99: { condition: "Thunderstorm", iconName: "cloud-lightning" },
};

function lookupCondition(code: number, isDay: boolean): WeatherCondition {
  const entry = WMO_LOOKUP[code];
  if (!entry) return { condition: "Unknown", iconName: "cloud" };
  if (!isDay && (code === 0 || code === 1)) {
    return { condition: entry.condition, iconName: "moon" };
  }
  return entry;
}

interface UpcomingDay {
  date: string;
  weekday: string;
  highF: number;
  lowF: number;
  condition: string;
  iconName: string;
}

export interface WeatherResponse {
  location: { name: string; latitude: number; longitude: number };
  current: {
    tempF: number;
    feelsLikeF: number;
    humidity: number;
    windMph: number;
    windDirection: number;
    isDay: boolean;
    condition: string;
    iconName: string;
    observedAt: string;
  };
  today: { highF: number; lowF: number; sunrise: string; sunset: string };
  upcoming: UpcomingDay[];
}

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    is_day?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
}

interface CacheEntry {
  data: WeatherResponse;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

function weekdayShortFromIsoDate(iso: string): string {
  // Open-Meteo's `daily.time[i]` is YYYY-MM-DD with no time zone. Parse it
  // as local-noon to avoid off-by-one when the server is in a different TZ.
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
}

function round(n: number | undefined, fallback = 0): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function buildResponse(payload: OpenMeteoResponse): WeatherResponse {
  const current = payload.current ?? {};
  const daily = payload.daily ?? {};

  const isDay = current.is_day === 1;
  const todayCondition = lookupCondition(current.weather_code ?? 0, isDay);

  const dailyCodes = daily.weather_code ?? [];
  const dailyTimes = daily.time ?? [];
  const dailyMax = daily.temperature_2m_max ?? [];
  const dailyMin = daily.temperature_2m_min ?? [];

  const upcoming: UpcomingDay[] = [];
  for (let i = 1; i < dailyTimes.length && upcoming.length < 2; i += 1) {
    const cond = lookupCondition(dailyCodes[i] ?? 0, true);
    upcoming.push({
      date: dailyTimes[i] ?? "",
      weekday: weekdayShortFromIsoDate(dailyTimes[i] ?? ""),
      highF: round(dailyMax[i]),
      lowF: round(dailyMin[i]),
      condition: cond.condition,
      iconName: cond.iconName,
    });
  }

  return {
    location: {
      name: FES_LOCATION_LABEL,
      latitude: FES_LATITUDE,
      longitude: FES_LONGITUDE,
    },
    current: {
      tempF: round(current.temperature_2m),
      feelsLikeF: round(current.apparent_temperature),
      humidity: round(current.relative_humidity_2m),
      windMph: round(current.wind_speed_10m),
      windDirection: round(current.wind_direction_10m),
      isDay,
      condition: todayCondition.condition,
      iconName: todayCondition.iconName,
      observedAt: current.time ?? new Date().toISOString(),
    },
    today: {
      highF: round(dailyMax[0]),
      lowF: round(dailyMin[0]),
      sunrise: daily.sunrise?.[0] ?? "",
      sunset: daily.sunset?.[0] ?? "",
    },
    upcoming,
  };
}

router.get("/weather", async (req, res) => {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    res.json(cache.data);
    return;
  }

  const url = new URL(UPSTREAM_URL);
  url.searchParams.set("latitude", String(FES_LATITUDE));
  url.searchParams.set("longitude", String(FES_LONGITUDE));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m",
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "America/New_York");
  url.searchParams.set("forecast_days", "3");

  try {
    const upstream = await fetch(url.toString(), { headers: REQUEST_HEADERS });
    if (!upstream.ok) {
      throw new Error(
        `Open-Meteo returned ${upstream.status} ${upstream.statusText}`,
      );
    }
    const payload = (await upstream.json()) as OpenMeteoResponse;
    const data = buildResponse(payload);
    cache = { data, fetchedAt: Date.now() };
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch weather");
    res.status(502).json({
      error: "Unable to load weather",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
