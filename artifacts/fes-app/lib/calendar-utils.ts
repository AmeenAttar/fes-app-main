import type { CalendarEvent } from "@/lib/api";

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Local calendar days this event occupies (for dots / counts). */
export function enumerateLocalDayKeysForEvent(ev: CalendarEvent): string[] {
  const keys = new Set<string>();
  const start = new Date(ev.start);
  keys.add(localDateKey(start));
  if (!ev.end) return [...keys];

  const end = new Date(ev.end);
  const startM = localMidnight(start);
  const endM = localMidnight(end);
  let cur = new Date(startM);
  let guard = 0;
  while (cur <= endM && guard++ < 400) {
    keys.add(localDateKey(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return [...keys];
}

export function buildDayEventCount(events: CalendarEvent[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const ev of events) {
    for (const k of enumerateLocalDayKeysForEvent(ev)) {
      map.set(k, (map.get(k) ?? 0) + 1);
    }
  }
  return map;
}

export function eventOccursOnLocalDay(ev: CalendarEvent, day: Date): boolean {
  const dayKey = localDateKey(day);
  return enumerateLocalDayKeysForEvent(ev).includes(dayKey);
}

export function getEventsForLocalDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  return events
    .filter((ev) => eventOccursOnLocalDay(ev, day))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export interface MonthGridCell {
  date: Date;
  inCurrentMonth: boolean;
}

/** Sunday-first week rows; includes leading/trailing days from adjacent months. */
export function getMonthGrid(year: number, month: number): MonthGridCell[] {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: MonthGridCell[] = [];

  const prevLast = new Date(year, month, 0).getDate();
  for (let i = 0; i < startPad; i++) {
    const day = prevLast - startPad + i + 1;
    cells.push({
      date: new Date(year, month - 1, day),
      inCurrentMonth: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: new Date(year, month, d),
      inCurrentMonth: true,
    });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      date: new Date(year, month + 1, next),
      inCurrentMonth: false,
    });
    next += 1;
  }
  while (cells.length < 42) {
    cells.push({
      date: new Date(year, month + 1, next),
      inCurrentMonth: false,
    });
    next += 1;
  }
  return cells;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function weekdayHeaderLabels(): readonly string[] {
  return WEEKDAY_LABELS;
}
