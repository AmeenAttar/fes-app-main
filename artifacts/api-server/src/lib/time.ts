/** The FES Center's wall-clock zone — all reminder timing is relative to it. */
export const FES_TIMEZONE = "America/New_York";

/**
 * How far `timeZone`'s wall clock sits from UTC at a given instant, in ms.
 * Positive east of Greenwich; for New York this is -4h (EDT) or -5h (EST).
 */
export function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));

  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    // Intl renders midnight as hour 24 in some ICU versions.
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asIfUtc - instant;
}

/**
 * Instant of local midnight in `timeZone` on a `YYYY-MM-DD` calendar date.
 *
 * Resolved in two passes because the offset itself depends on the instant we
 * are solving for — the first pass gets us close enough to read the correct
 * offset even on a DST boundary.
 */
export function zonedMidnightMs(dateYmd: string, timeZone: string): number {
  const [y, m, d] = dateYmd.split("-").map(Number);
  if (!y || !m || !d) return Number.NaN;

  const utcMidnight = Date.UTC(y, m - 1, d, 0, 0, 0);
  const firstPass = utcMidnight - zoneOffsetMs(utcMidnight, timeZone);
  return utcMidnight - zoneOffsetMs(firstPass, timeZone);
}

/**
 * When a reminder should be measured against.
 *
 * All-day events arrive from the iCal feed as UTC midnight, which is 8pm the
 * *previous* day in New York — so timing them off the raw value sends the
 * "tomorrow" reminder a day early. Timed events already carry a real instant.
 */
export function eventStartMs(
  isoStart: string,
  allDay: boolean,
  timeZone: string = FES_TIMEZONE,
): number {
  if (!allDay) return new Date(isoStart).getTime();
  const dateYmd = isoStart.slice(0, 10);
  const local = zonedMidnightMs(dateYmd, timeZone);
  return Number.isNaN(local) ? new Date(isoStart).getTime() : local;
}
