import { randomUUID } from "node:crypto";

import { logger } from "./logger";

/**
 * Error reporting to Sentry over its HTTP envelope API.
 *
 * Deliberately not `@sentry/node`: this server is bundled by esbuild with every
 * dependency externalised, and the SDK drags in a deep OpenTelemetry tree that
 * would each need to become a direct dependency. The envelope endpoint is a
 * stable documented contract and everything needed fits in one file with no
 * dependencies at all.
 *
 * Unset `SENTRY_DSN` and every function here is a no-op, so local development
 * and any deployment without a DSN behave exactly as before.
 *
 * This exists because the codebase's real failure mode is silence: the scrapers
 * degrade to wrong-but-valid data, and a stale Sheets key or a rate-limited
 * calendar only reaches stdout. The guards are worth having only if something
 * is watching them.
 */

interface ParsedDsn {
  envelopeUrl: string;
  publicKey: string;
}

function parseDsn(raw: string): ParsedDsn | null {
  try {
    // https://<publicKey>@<host>/<projectId>
    const url = new URL(raw);
    const projectId = url.pathname.replace(/^\/+/u, "");
    if (!url.username || !projectId) return null;
    return {
      envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: url.username,
    };
  } catch {
    return null;
  }
}

const DSN_RAW = process.env["SENTRY_DSN"]?.trim() ?? "";
const ENVIRONMENT = process.env["NODE_ENV"] ?? "development";
let dsn: ParsedDsn | null = null;

export function initMonitoring(): void {
  if (!DSN_RAW) {
    logger.info(
      "Sentry not configured (SENTRY_DSN unset) — errors log locally only",
    );
    return;
  }
  dsn = parseDsn(DSN_RAW);
  if (!dsn) {
    logger.warn("SENTRY_DSN is set but could not be parsed — monitoring disabled");
    return;
  }
  logger.info({ environment: ENVIRONMENT }, "Sentry monitoring enabled");
}

type Level = "error" | "warning";

interface SentryEvent {
  event_id: string;
  timestamp: number;
  platform: "node";
  level: Level;
  environment: string;
  server_name?: string;
  extra?: Record<string, unknown>;
  message?: { formatted: string };
  exception?: {
    values: Array<{ type: string; value: string; stacktrace?: { frames: [] } }>;
  };
}

/** Fire-and-forget: reporting must never delay or fail a request. */
function send(event: SentryEvent): void {
  if (!dsn) return;
  const header = JSON.stringify({
    event_id: event.event_id,
    sent_at: new Date().toISOString(),
  });
  const item = JSON.stringify({ type: "event" });
  const body = `${header}\n${item}\n${JSON.stringify(event)}\n`;

  void fetch(dsn.envelopeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth": [
        "Sentry sentry_version=7",
        `sentry_key=${dsn.publicKey}`,
        "sentry_client=fes-api/1.0",
      ].join(", "),
    },
    body,
  }).catch((err) => {
    // Never let the reporter become the outage.
    logger.debug({ err }, "Failed to deliver event to Sentry");
  });
}

function baseEvent(level: Level, extra?: Record<string, unknown>): SentryEvent {
  return {
    event_id: randomUUID().replace(/-/gu, ""),
    timestamp: Date.now() / 1000,
    platform: "node",
    level,
    environment: ENVIRONMENT,
    ...(extra ? { extra } : {}),
  };
}

export function captureError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (!dsn) return;
  const error = err instanceof Error ? err : new Error(String(err));
  send({
    ...baseEvent("error", {
      ...context,
      // Frames aren't parsed into Sentry's structured format; the raw stack is
      // more useful here than an empty stacktrace object.
      stack: error.stack ?? "(no stack)",
    }),
    exception: {
      values: [{ type: error.name || "Error", value: error.message }],
    },
  });
}

/**
 * For conditions that aren't exceptions but shouldn't pass unnoticed — an
 * investigator page that parses to nothing, a feed served from stale cache.
 */
export function captureWarning(
  message: string,
  context?: Record<string, unknown>,
): void {
  if (!dsn) return;
  send({
    ...baseEvent("warning", context),
    message: { formatted: message },
  });
}

/** Nothing is queued — sends are already in flight — so this is a formality. */
export async function flushMonitoring(): Promise<void> {
  return Promise.resolve();
}
