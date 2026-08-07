/**
 * Runtime configuration for the api-server.
 *
 * URLs that point at the FES Center website are derived from
 * `FESCENTER_BASE_URL`. The site migration off the old `/test` tier is
 * complete — production is `https://fescenter.org` and that is the default.
 * Override the env var only to point at a different tier.
 *
 * The Google Calendar iCal feed (fescalendar@fescenter.org) is intentionally
 * NOT derived from this base URL — it is hosted on `calendar.google.com`
 * and is not affected by the website migration.
 */

const DEFAULT_FESCENTER_BASE_URL = "https://fescenter.org";

function readBaseUrl(): string {
  const raw = process.env["FESCENTER_BASE_URL"]?.trim();
  if (!raw) return DEFAULT_FESCENTER_BASE_URL;
  let t = raw.replace(/\/+$/u, "");
  if (!/^https?:\/\//iu.test(t)) t = `https://${t}`;
  return t;
}

export const FESCENTER_BASE_URL = readBaseUrl();

/**
 * Parsed hostname from {@link FESCENTER_BASE_URL} — used for scrape heuristics
 * and stable error/copy strings tied to whichever site tier is configured.
 */
export const FESCENTER_HOSTNAME = (() => {
  try {
    const withScheme = /^https?:\/\//i.test(FESCENTER_BASE_URL)
      ? FESCENTER_BASE_URL
      : `https://${FESCENTER_BASE_URL}`;
    return new URL(withScheme.replace(/\/+$/u, "")).hostname;
  } catch {
    return "fescenter.org";
  }
})();

function escapeRegexHostname(hostname: string): string {
  return hostname.replace(/\./g, "\\.");
}

/** First hero-style `<img>` whose `src` is https on this hostname (typically WP uploads). */
export function fescenterSiteHeroImgRegex(): RegExp {
  const h = escapeRegexHostname(FESCENTER_HOSTNAME);
  return new RegExp(
    `<img[^>]+src="(https://${h}/[^"]+\\.(?:jpg|jpeg|png|webp))"`,
    "gi",
  );
}

/** Matches info@ inbox on this hostname (drops footer/contact boilerplate in bios). */
export function fescenterInfoEmailRegex(): RegExp {
  const h = escapeRegexHostname(FESCENTER_HOSTNAME);
  return new RegExp(`info@${h}`, "i");
}

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
