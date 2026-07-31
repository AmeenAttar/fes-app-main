import { Linking, Platform } from "react-native";

/**
 * Default coordinates match `artifacts/api-server/src/lib/config.ts`
 * (`FES_LATITUDE` / `FES_LONGITUDE` fallbacks).
 */
export const FES_CENTER_WEATHER_COORDS = {
  latitude: 41.5045,
  longitude: -81.6044,
} as const;

const FES_CENTER_MAP_LABEL = "Cleveland FES Center";

/**
 * Opens native weather / maps UI for the FES Center site.
 * - **iOS:** `weather://…` opens the **Weather** app (HTTPS weather.apple.com often lands in Safari with 403).
 * - **Android:** `geo:` so the user picks Maps or another geo app at this pin (no OEM-specific weather intents).
 * - **Web:** NOAA forecast page for the coordinates.
 */
export async function openSystemWeatherAt(
  latitude: number,
  longitude: number,
): Promise<void> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

  const latStr = String(latitude);
  const lonStr = String(longitude);

  if (Platform.OS === "ios") {
    const weatherApp = `weather://weather.apple.com/?lat=${latStr}&long=${lonStr}`;
    const mapsApp = `maps://maps.apple.com/?ll=${latStr},${lonStr}&q=${encodeURIComponent(FES_CENTER_MAP_LABEL)}`;
    try {
      await Linking.openURL(weatherApp);
    } catch {
      await Linking.openURL(mapsApp).catch(() => undefined);
    }
    return;
  }

  if (Platform.OS === "android") {
    const q = encodeURIComponent(`${latStr},${lonStr}(${FES_CENTER_MAP_LABEL})`);
    await Linking.openURL(`geo:${latStr},${lonStr}?q=${q}`);
    return;
  }

  const noaa = `https://forecast.weather.gov/MapClick.php?lon=${encodeURIComponent(lonStr)}&lat=${encodeURIComponent(latStr)}`;
  await Linking.openURL(noaa);
}
