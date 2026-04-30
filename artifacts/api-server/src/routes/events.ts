import { Router } from "express";
import ical from "node-ical";

const router = Router();

// NOTE: This is the public Google Calendar iCal feed (calendar.google.com),
// not the FES Center website. It is intentionally NOT derived from
// FESCENTER_BASE_URL and is unaffected by the website migration.
const ICS_URL =
  "https://calendar.google.com/calendar/ical/fescalendar%40fescenter.org/public/basic.ics";
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface EventDto {
  id: string;
  /** Stable per-event UID from the source calendar (no occurrence suffix). */
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
  htmlLink: string | null;
}

let cache: { ts: number; data: EventDto[] } | null = null;

function htmlToText(s: string | undefined | null): string | null {
  if (!s) return null;
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || null;
}

async function loadEvents(): Promise<EventDto[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return cache.data;
  }

  const res = await fetch(ICS_URL, {
    headers: { "User-Agent": "Mozilla/5.0 FES-App" },
  });
  if (!res.ok) {
    throw new Error(`Calendar fetch failed: ${res.status}`);
  }
  const text = await res.text();

  const parsed = ical.sync.parseICS(text);
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 365);

  const events: EventDto[] = [];

  for (const key of Object.keys(parsed)) {
    const e = parsed[key];
    if (!e || e.type !== "VEVENT") continue;

    const start = e.start instanceof Date ? e.start : new Date(e.start as never);
    const end = e.end instanceof Date ? e.end : e.end ? new Date(e.end as never) : null;
    if (isNaN(start.getTime())) continue;

    const allDay = (e.datetype as string | undefined) === "date";

    // Handle non-recurring events
    if (!e.rrule) {
      if (start < now || start > horizon) continue;
      const uid = String(e.uid ?? `${start.toISOString()}-${e.summary ?? ""}`);
      events.push({
        id: uid,
        uid,
        title: String(e.summary ?? "Untitled"),
        description: htmlToText(e.description as string | undefined),
        location: (e.location as string | undefined) ?? null,
        start: start.toISOString(),
        end: end ? end.toISOString() : null,
        allDay,
        htmlLink: null,
      });
      continue;
    }

    // Handle recurring events: expand within window
    try {
      const occurrences: Date[] = e.rrule.between(now, horizon, true);
      const durationMs = end ? end.getTime() - start.getTime() : 0;
      for (const occ of occurrences) {
        // Skip cancelled / overridden occurrences
        const exdates = (e.exdate ?? {}) as Record<string, Date>;
        const exKey = occ.toISOString().substring(0, 10);
        const isExcluded = Object.keys(exdates).some(
          (k) => exdates[k]?.toISOString().substring(0, 10) === exKey,
        );
        if (isExcluded) continue;

        const uid = String(e.uid ?? "");
        events.push({
          id: `${uid}_${occ.toISOString()}`,
          uid,
          title: String(e.summary ?? "Untitled"),
          description: htmlToText(e.description as string | undefined),
          location: (e.location as string | undefined) ?? null,
          start: occ.toISOString(),
          end: durationMs ? new Date(occ.getTime() + durationMs).toISOString() : null,
          allDay,
          htmlLink: null,
        });
      }
    } catch {
      // ignore broken rrule
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  const trimmed = events.slice(0, 100);
  cache = { ts: Date.now(), data: trimmed };
  return trimmed;
}

router.get("/events", async (req, res, next) => {
  try {
    const events = await loadEvents();
    res.json({ events });
  } catch (err) {
    req.log.error({ err }, "Failed to load events");
    next(err);
  }
});

export const eventsRouter = router;
export { loadEvents };
