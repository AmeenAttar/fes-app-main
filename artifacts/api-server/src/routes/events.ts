import { Router } from "express";
import ical from "node-ical";

const router = Router();

// NOTE: This is the public Google Calendar iCal feed (calendar.google.com),
// not the FES Center website. It is intentionally NOT derived from
// FESCENTER_BASE_URL and is unaffected by the website migration.
const ICS_URL =
  "https://calendar.google.com/calendar/ical/fescalendar%40fescenter.org/public/basic.ics";

const CACHE_TTL_MS = 5 * 60 * 1000;
const HORIZON_DAYS = 365;
const MAX_EVENTS = 100;
/** Max actionable URL buttons surfaced per event (deduped). */
const MAX_ACTION_LINKS = 6;

export type ActionLinkKind = "rsvp" | "meet" | "zoom" | "livestream" | "other";

export interface EventActionLink {
  url: string;
  kind: ActionLinkKind;
}

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
  /** Google Calendar web link when available (iCal source does not provide this). */
  htmlLink: string | null;
  /**
   * AddEvent / evt.to landing page for RSVP — mirrors first RSVP entry in {@link actionLinks}.
   */
  addEventUrl: string | null;
  /** Classified http(s) links from description + location (RSVP first when sorted). */
  actionLinks: EventActionLink[];
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
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || null;
}

function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#34;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#47;/gi, "/")
    .replace(/&#x2F;/gi, "/");
}

/** RFC 5545: unfold content lines (newline + single space/tab continuation). */
function unfoldIcsText(s: string): string {
  return s.replace(/\r?\n[ \t]/g, "");
}

/**
 * Google Calendar HTML often inserts <wbr> inside long URLs; ICS may still contain
 * folded lines. Normalize before regex — otherwise "addevent.<wbr />com" never matches.
 */
function normalizeCalendarHtmlForUrlExtract(s: string): string {
  let t = decodeBasicHtmlEntities(s);
  t = unfoldIcsText(t);
  t = t.replace(/<wbr\s*\/?>/gi, "");
  t = t.replace(/&#8203;|&#x200B;/gi, "");
  t = t.replace(/\u200b/g, "");
  return t;
}

/** Strip wrapping punctuation from the end of a URL fragment (plain text URLs). */
function trimUrlTail(s: string): string {
  return s.trim().replace(/\)+$/u, "").replace(/[.,;:]+$/u, "").trim();
}

/**
 * Canonicalize http(s) URL or scheme-less evt.to / addevent.com hosts.
 */
function canonicalizeHttpUrl(candidate: string): string | null {
  let raw = trimUrlTail(candidate);
  if (!raw) return null;

  if (raw.startsWith("//")) raw = `https:${raw}`;
  else if (/^mailto:/i.test(raw)) return null;

  let u = raw;
  if (!/^https?:\/\//i.test(u)) {
    const low = u.toLowerCase();
    if (/^(evt\.to\/|www\.evt\.to\/)/i.test(u)) u = `https://${u}`;
    else if (/^addevent\.com\/|^www\.addevent\.com\//i.test(u)) u = `https://${u}`;
    else if (/^[\w.-]+\.addevent\.com(\/|$)/i.test(u)) u = `https://${u}`;
    else return null;
  }

  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function classifyActionLink(host: string, pathname: string): ActionLinkKind {
  const h = host.toLowerCase();
  const p = pathname.toLowerCase();
  if (h === "evt.to" || h === "www.evt.to" || h.endsWith(".addevent.com") || h === "addevent.com") {
    return "rsvp";
  }
  if (h === "meet.google.com") return "meet";
  if (h.endsWith("zoom.us")) return "zoom";
  if ((h.endsWith(".case.edu") || h === "case.edu") && p.includes("/livestream")) {
    return "livestream";
  }
  return "other";
}

const KIND_RANK: Record<ActionLinkKind, number> = {
  rsvp: 0,
  meet: 1,
  zoom: 2,
  livestream: 3,
  other: 4,
};

/** Drop bare `evt.to/` RSVP when the description also has `evt.to/<slug>`. */
function pruneBareEvtRootWhenSlugPresent(
  links: EventActionLink[],
): EventActionLink[] {
  const evtHosts = new Set(["evt.to", "www.evt.to"]);
  const evtPaths = links
    .filter((l) => {
      if (l.kind !== "rsvp") return false;
      try {
        const u = new URL(l.url);
        return evtHosts.has(u.hostname.toLowerCase());
      } catch {
        return false;
      }
    })
    .map((l) => {
      try {
        return (
          new URL(l.url).pathname.replace(/\/+$/u, "") || ""
        ).toLowerCase();
      } catch {
        return "";
      }
    })
    .filter((p) => p.length > 0);
  if (evtPaths.length === 0) return links;
  return links.filter((l) => {
    if (l.kind !== "rsvp") return true;
    try {
      const u = new URL(l.url);
      if (!evtHosts.has(u.hostname.toLowerCase())) return true;
      const p = u.pathname.replace(/\/+$/u, "") || "";
      return p.length > 0;
    } catch {
      return true;
    }
  });
}

/** Collect deduped, classified http(s) links from normalized HTML/description text. */
function extractDescriptionLinks(normalizedBlob: string): EventActionLink[] {
  const seen = new Map<string, EventActionLink>();

  const tryAdd = (rawFragment: string) => {
    const url = canonicalizeHttpUrl(rawFragment);
    if (!url) return;
    let host: string;
    let pathname: string;
    try {
      const o = new URL(url);
      host = o.hostname;
      pathname = o.pathname;
    } catch {
      return;
    }
    const kind = classifyActionLink(host, pathname);
    if (!seen.has(url)) seen.set(url, { url, kind });
  };

  const hrefRe = /\bhref\s*=\s*["']([^"'>\s]+)["']/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hrefRe.exec(normalizedBlob)) !== null) {
    tryAdd(hm[1] ?? "");
  }

  const httpPlain = /\bhttps?:\/\/[^\s"'<>)\]]+/gi;
  while ((hm = httpPlain.exec(normalizedBlob)) !== null) {
    tryAdd(hm[0] ?? "");
  }

  const schemelessEvt = /\b(?:www\.)?evt\.to\/[^\s"'<>)\],]+/gi;
  while ((hm = schemelessEvt.exec(normalizedBlob)) !== null) {
    tryAdd(hm[0] ?? "");
  }

  const schemelessAe =
    /\b(?:www\.)?addevent\.com\/[^\s"'<>)\],]+|\b[\w.-]+\.addevent\.com\/[^\s"'<>)\],]+/gi;
  while ((hm = schemelessAe.exec(normalizedBlob)) !== null) {
    tryAdd(hm[0] ?? "");
  }

  const pruned = pruneBareEvtRootWhenSlugPresent([...seen.values()]);
  pruned.sort((a, b) => {
    const r = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (r !== 0) return r;
    return a.url.localeCompare(b.url);
  });

  return pruned.slice(0, MAX_ACTION_LINKS);
}

function buildEventDto(input: {
  id: string;
  uid: string;
  title: string;
  rawDescription: string | undefined;
  location: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
}): EventDto {
  const blobParts: string[] = [];
  if (input.rawDescription) blobParts.push(input.rawDescription);
  if (input.location) blobParts.push(input.location);
  const normBlob = normalizeCalendarHtmlForUrlExtract(blobParts.join("\n"));
  const actionLinks = extractDescriptionLinks(normBlob);
  const addEventUrl = actionLinks.find((l) => l.kind === "rsvp")?.url ?? null;

  return {
    id: input.id,
    uid: input.uid,
    title: input.title,
    description: htmlToText(input.rawDescription),
    location: input.location,
    start: input.start,
    end: input.end,
    allDay: input.allDay,
    htmlLink: null,
    addEventUrl,
    actionLinks,
  };
}

async function loadEventsFromIcsUncached(): Promise<EventDto[]> {
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
  horizon.setDate(horizon.getDate() + HORIZON_DAYS);

  const events: EventDto[] = [];

  for (const key of Object.keys(parsed)) {
    const e = parsed[key];
    if (!e || e.type !== "VEVENT") continue;

    const start = e.start instanceof Date ? e.start : new Date(e.start as never);
    const end = e.end instanceof Date ? e.end : e.end ? new Date(e.end as never) : null;
    if (isNaN(start.getTime())) continue;

    const allDay = (e.datetype as string | undefined) === "date";
    const rawDescription = e.description as string | undefined;
    const location = (e.location as string | undefined) ?? null;

    if (!e.rrule) {
      if (start < now || start > horizon) continue;
      const uid = String(e.uid ?? `${start.toISOString()}-${e.summary ?? ""}`);
      events.push(
        buildEventDto({
          id: uid,
          uid,
          title: String(e.summary ?? "Untitled"),
          rawDescription,
          location,
          start: start.toISOString(),
          end: end ? end.toISOString() : null,
          allDay,
        }),
      );
      continue;
    }

    try {
      const occurrences: Date[] = e.rrule.between(now, horizon, true);
      const durationMs = end ? end.getTime() - start.getTime() : 0;
      for (const occ of occurrences) {
        const exdates = (e.exdate ?? {}) as Record<string, Date>;
        const exKey = occ.toISOString().substring(0, 10);
        const isExcluded = Object.keys(exdates).some(
          (k) => exdates[k]?.toISOString().substring(0, 10) === exKey,
        );
        if (isExcluded) continue;

        const uid = String(e.uid ?? "");
        events.push(
          buildEventDto({
            id: `${uid}_${occ.toISOString()}`,
            uid,
            title: String(e.summary ?? "Untitled"),
            rawDescription,
            location,
            start: occ.toISOString(),
            end: durationMs ? new Date(occ.getTime() + durationMs).toISOString() : null,
            allDay,
          }),
        );
      }
    } catch {
      // ignore broken rrule
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events.slice(0, MAX_EVENTS);
}

export async function loadEvents(): Promise<EventDto[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return cache.data;
  }

  const fromIcs = await loadEventsFromIcsUncached();
  cache = { ts: Date.now(), data: fromIcs };
  return fromIcs;
}

function decodeRouteEventId(raw: string | undefined): string {
  if (raw === undefined || raw === "") return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
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

router.get("/events/:eventId", async (req, res, next) => {
  try {
    const raw = req.params["eventId"];
    const eventId = decodeRouteEventId(raw);
    if (!eventId) {
      res.status(400).json({ error: "missing_event_id" });
      return;
    }
    const events = await loadEvents();
    const event = events.find((e) => e.id === eventId);
    if (!event) {
      res.status(404).json({ error: "event_not_found" });
      return;
    }
    res.json({ event });
  } catch (err) {
    req.log.error({ err }, "Failed to load event");
    next(err);
  }
});

export const eventsRouter = router;
