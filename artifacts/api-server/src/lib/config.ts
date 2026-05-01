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
