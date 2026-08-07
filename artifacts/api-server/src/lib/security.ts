import type { NextFunction, Request, Response } from "express";
import type { CorsOptions } from "cors";

import { logger } from "./logger";

/**
 * Comma-separated origin allowlist. Native apps send no `Origin` header at all,
 * so restricting this costs the mobile client nothing — it only shuts out
 * browsers on other sites.
 */
const ALLOWED_ORIGINS = (process.env["ALLOWED_ORIGINS"] ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/u, ""))
  .filter(Boolean);

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // No Origin: native app, curl, or a same-origin request. Always allowed.
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.length === 0) return callback(null, true);
    const normalized = origin.replace(/\/+$/u, "");
    if (ALLOWED_ORIGINS.includes(normalized)) return callback(null, true);
    return callback(null, false);
  },
};

/**
 * Shared secret the mobile client sends as `Authorization: Bearer <token>`.
 *
 * This is deliberately modest: the secret ships inside the IPA, so anyone who
 * unpacks the binary can read it. What it does buy is removing the drive-by
 * case — a stranger who finds the API domain can no longer flood `push_tokens`
 * or unsubscribe devices. Real per-user auth would need an identity system the
 * app does not have.
 */
const API_TOKEN = process.env["API_AUTH_TOKEN"]?.trim() ?? "";

export function requireApiToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!API_TOKEN) {
    // Unset means "not enforcing" so local dev and existing deploys keep working.
    return next();
  }
  const header = req.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "").trim();
  if (provided && provided === API_TOKEN) return next();

  req.log?.warn({ path: req.path }, "Rejected unauthenticated request");
  res.status(401).json({
    error: "unauthorized",
    message: "This endpoint requires a valid API token.",
  });
}

/** For routes that must refuse to run unauthenticated rather than fall open. */
export function isApiTokenConfigured(): boolean {
  return API_TOKEN.length > 0;
}

export function logSecurityConfig(): void {
  logger.info(
    {
      corsAllowlist: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : "all origins",
      apiTokenEnforced: API_TOKEN.length > 0,
    },
    "Security configuration",
  );
}
