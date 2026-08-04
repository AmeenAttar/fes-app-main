import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

import type { CalendarEvent } from "./api";

export type AddToCalendarResult =
  | { status: "saved" }
  | { status: "canceled" }
  | { status: "unsupported"; message: string }
  | { status: "error"; message: string };

/** Trailing "· 4:00 PM" style detail the calendar entry already shows itself. */
function cleanDescription(raw: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/​/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Notes for the calendar entry. The Zoom link matters most here — it is what
 * someone actually needs when the reminder fires, and burying it in a wall of
 * scraped description text makes it hard to find on a lock screen.
 */
function buildNotes(event: CalendarEvent): string {
  const parts: string[] = [];

  const links = event.actionLinks ?? [];
  const joinable = links.filter(
    (l) => l.kind === "zoom" || l.kind === "meet" || l.kind === "livestream",
  );
  const rsvp = links.filter((l) => l.kind === "rsvp");

  if (joinable.length > 0) {
    parts.push(joinable.map((l) => `Join: ${l.url}`).join("\n"));
  }
  if (rsvp.length > 0) {
    parts.push(rsvp.map((l) => `RSVP: ${l.url}`).join("\n"));
  }

  const description = cleanDescription(event.description);
  if (description) parts.push(description);

  parts.push("Added from the Cleveland FES Center app.");
  return parts.join("\n\n");
}

/** First joinable link, so the entry gets a tappable URL field on iOS. */
function primaryUrl(event: CalendarEvent): string | undefined {
  const links = event.actionLinks ?? [];
  const preferred =
    links.find((l) => l.kind === "zoom") ??
    links.find((l) => l.kind === "meet") ??
    links.find((l) => l.kind === "livestream") ??
    links.find((l) => l.kind === "rsvp");
  return preferred?.url ?? event.addEventUrl ?? undefined;
}

/**
 * Hands the event to the OS calendar editor, pre-filled.
 *
 * Deliberately the system dialog rather than writing directly: the user picks
 * which calendar it lands in, sees exactly what is being saved, and can edit it
 * first. It also means the app never needs full calendar read access.
 */
export async function addEventToCalendar(
  event: CalendarEvent,
): Promise<AddToCalendarResult> {
  if (Platform.OS === "web") {
    return {
      status: "unsupported",
      message: "Adding to a calendar isn’t available on the web.",
    };
  }

  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) {
    return { status: "error", message: "This event has no valid start time." };
  }

  // Fall back to an hour when the feed omits an end, which it does for some
  // entries; a zero-length calendar event is worse than a reasonable guess.
  const end =
    event.end && !Number.isNaN(new Date(event.end).getTime())
      ? new Date(event.end)
      : new Date(start.getTime() + 60 * 60 * 1000);

  const url = primaryUrl(event);

  try {
    const result = await Calendar.createEventInCalendarAsync({
      title: event.title,
      startDate: start,
      endDate: end,
      allDay: event.allDay,
      location: event.location ?? undefined,
      notes: buildNotes(event),
      ...(url ? { url } : {}),
    });

    // Android always reports "done" — it can't tell us whether the user saved.
    if (result.action === "canceled") return { status: "canceled" };
    return { status: "saved" };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Couldn’t open the calendar editor.",
    };
  }
}
