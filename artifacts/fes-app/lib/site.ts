/** Default matches api-server `FESCENTER_BASE_URL` before production cutover. */
const DEFAULT_ORIGIN = "https://fescenter.org/test";

function normalizedOrigin(): string {
  const raw = process.env.EXPO_PUBLIC_FESCENTER_BASE_URL?.trim();
  if (!raw) return DEFAULT_ORIGIN;
  const base = raw.replace(/\/+$/u, "");
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return base;
  }
  return `https://${base}`;
}

/** Public website origin — keep aligned with deployed `FESCENTER_BASE_URL` on the api-server. */
export const FESCENTER_SITE_ORIGIN = normalizedOrigin();

/** Hostname only; UI copy (“View on {hostname}”). */
export const FESCENTER_SITE_HOSTNAME = (() => {
  try {
    return new URL(FESCENTER_SITE_ORIGIN).hostname;
  } catch {
    return "fescenter.org";
  }
})();
