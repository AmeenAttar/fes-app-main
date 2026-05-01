/**
 * Runtime configuration for the api-server.
 *
 * URLs that point at the FES Center website are derived from
 * `FESCENTER_BASE_URL` so the imminent migration from
 * `https://fescenter.org/test` to `https://fescenter.org` is a one-line
 * env-var change with zero code edits.
 *
 * The Google Calendar iCal feed (fescalendar@fescenter.org) is intentionally
 * NOT derived from this base URL — it is hosted on `calendar.google.com`
 * and is not affected by the website migration.
 */

const DEFAULT_FESCENTER_BASE_URL = "https://fescenter.org/test";

function readBaseUrl(): string {
  const raw = process.env["FESCENTER_BASE_URL"]?.trim();
  if (!raw) return DEFAULT_FESCENTER_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export const FESCENTER_BASE_URL = readBaseUrl();

export const INVESTIGATORS_LIST_URL = `${FESCENTER_BASE_URL}/team/investigators/`;

export const WP_API_BASE_URL = `${FESCENTER_BASE_URL}/wp-json/wp/v2`;

/**
 * Cleveland FES Center geographic location, used by the /api/weather
 * route to fetch a forecast at the Cleveland VA Medical Center / CWRU
 * campus. Overridable via env so the deployment can be repointed
 * without a code change.
 */
function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const FES_LATITUDE = readNumber("FES_LATITUDE", 41.5045);
export const FES_LONGITUDE = readNumber("FES_LONGITUDE", -81.6044);
export const FES_LOCATION_LABEL =
  process.env["FES_LOCATION_LABEL"]?.trim() || "Cleveland, OH";
