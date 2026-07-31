import { describe, expect, it } from "vitest";

import { eventStartMs, FES_TIMEZONE, zonedMidnightMs } from "./time";

describe("zonedMidnightMs", () => {
  it("resolves midnight during daylight time (UTC-4)", () => {
    const ms = zonedMidnightMs("2026-08-04", FES_TIMEZONE);
    expect(new Date(ms).toISOString()).toBe("2026-08-04T04:00:00.000Z");
  });

  it("resolves midnight during standard time (UTC-5)", () => {
    const ms = zonedMidnightMs("2026-01-15", FES_TIMEZONE);
    expect(new Date(ms).toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });

  it("handles the spring-forward date, when local midnight still precedes the jump", () => {
    // DST begins 2am on 2026-03-08; midnight that day is still EST.
    const ms = zonedMidnightMs("2026-03-08", FES_TIMEZONE);
    expect(new Date(ms).toISOString()).toBe("2026-03-08T05:00:00.000Z");
  });

  it("returns NaN for an unparseable date", () => {
    expect(Number.isNaN(zonedMidnightMs("nonsense", FES_TIMEZONE))).toBe(true);
  });
});

describe("eventStartMs", () => {
  it("passes timed events through unchanged", () => {
    const iso = "2026-08-04T20:00:00.000Z";
    expect(eventStartMs(iso, false)).toBe(Date.parse(iso));
  });

  it("shifts all-day events to local midnight, not UTC midnight", () => {
    // The bug this guards: the feed gives UTC midnight, which is 8pm ET the
    // day before — so a "tomorrow" reminder went out a day early.
    const shifted = eventStartMs("2026-08-04T00:00:00.000Z", true);
    expect(new Date(shifted).toISOString()).toBe("2026-08-04T04:00:00.000Z");
    expect(shifted).toBeGreaterThan(Date.parse("2026-08-04T00:00:00.000Z"));
  });

  it("moves the day-before window out of the small hours", () => {
    const raw = Date.parse("2026-08-04T00:00:00.000Z");
    const fixed = eventStartMs("2026-08-04T00:00:00.000Z", true);
    expect(fixed - raw).toBe(4 * 60 * 60 * 1000); // EDT is UTC-4

    // The window opens 30h before the start. Untreated that was 2pm ET two days
    // out and could still be open at 2am; corrected it opens at 6pm and closes
    // by 6am. The practical effect is a four-hour shift, not a whole day.
    const etHour = (d: Date) =>
      Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: FES_TIMEZONE,
          hour: "numeric",
          hour12: false,
        }).format(d),
      );
    const THIRTY_HOURS = 30 * 60 * 60 * 1000;

    expect(etHour(new Date(raw - THIRTY_HOURS))).toBe(14);
    expect(etHour(new Date(fixed - THIRTY_HOURS))).toBe(18);
  });

  it("falls back to the raw timestamp when the date cannot be read", () => {
    const iso = "not-a-date";
    expect(Number.isNaN(eventStartMs(iso, true))).toBe(true);
  });
});
