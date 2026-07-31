/**
 * Error shape shared by every route, so clients get one predictable envelope
 * (`{ error, message }`) instead of Express's default HTML page — which leaks
 * the stack trace and absolute server paths.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** Stable machine-readable code, e.g. `events_unavailable`. */
    readonly code: string,
    /** Safe to show a user; never include upstream internals here. */
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 502 — an upstream we depend on failed. */
export function upstreamError(code: string, message: string): ApiError {
  return new ApiError(502, code, message);
}

/** 503 — temporarily unavailable and worth retrying (rate limits, missing config). */
export function unavailableError(code: string, message: string): ApiError {
  return new ApiError(503, code, message);
}
