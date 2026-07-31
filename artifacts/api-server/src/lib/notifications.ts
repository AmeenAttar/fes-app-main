import { and, eq } from "drizzle-orm";

import { db, pushTokensTable, sentNotificationsTable } from "@workspace/db";

import { loadEvents, type EventDto } from "../routes/events";
import { NEWS_PUSH_POLL_INTERVAL_MS, processNewsPushOnce } from "./news-push";
import { logger } from "./logger";
import { sendToAllDevices } from "./push-delivery";

/** How often the scheduler re-checks the calendar. */
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Reminder windows. We send each kind exactly once per occurrence.
 * The window is checked against `event.start - now`, in minutes.
 */
const REMINDERS: Array<{
  kind: "day_before" | "hour_before";
  /** Trigger when minutes-until-event is between [minMinutes, maxMinutes]. */
  minMinutes: number;
  maxMinutes: number;
  buildBody: (event: EventDto) => { title: string; body: string };
}> = [
  {
    kind: "day_before",
    // 18 to 30 hours out — one daily check ensures we hit it once.
    minMinutes: 18 * 60,
    maxMinutes: 30 * 60,
    buildBody: (e) => ({
      title: "Tomorrow at the FES Center",
      body: `${e.title}${formatTimeSuffix(e)}`,
    }),
  },
  {
    kind: "hour_before",
    // 50 to 75 minutes out — covers any 5-minute poll within that window.
    minMinutes: 50,
    maxMinutes: 75,
    buildBody: (e) => ({
      title: "Starting in 1 hour",
      body: `${e.title}${formatTimeSuffix(e)}`,
    }),
  },
];

function formatTimeSuffix(e: EventDto): string {
  if (e.allDay) return " (all day)";
  try {
    const d = new Date(e.start);
    const time = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });
    return ` · ${time} ET`;
  } catch {
    return "";
  }
}

async function processOnce(): Promise<void> {
  let events: EventDto[];
  try {
    events = await loadEvents();
  } catch (err) {
    logger.error({ err }, "Scheduler: failed to load events");
    return;
  }

  const tokens = await db.select().from(pushTokensTable);
  if (tokens.length === 0) return;

  const now = Date.now();

  for (const event of events) {
    const startTs = new Date(event.start).getTime();
    if (Number.isNaN(startTs)) continue;
    const minutesUntil = (startTs - now) / 60000;
    if (minutesUntil <= 0) continue;

    for (const reminder of REMINDERS) {
      if (minutesUntil < reminder.minMinutes || minutesUntil > reminder.maxMinutes) {
        continue;
      }

      // Has this reminder already been sent for this occurrence?
      const occurrenceStart = new Date(event.start);
      const existing = await db
        .select({ id: sentNotificationsTable.id })
        .from(sentNotificationsTable)
        .where(
          and(
            eq(sentNotificationsTable.eventUid, event.uid),
            eq(sentNotificationsTable.occurrenceStart, occurrenceStart),
            eq(sentNotificationsTable.kind, reminder.kind),
          ),
        )
        .limit(1);

      if (existing.length > 0) continue;

      const { title, body } = reminder.buildBody(event);

      logger.info(
        { kind: reminder.kind, event: event.title, minutesUntil: Math.round(minutesUntil) },
        "Sending reminder",
      );

      await sendToAllDevices(
        {
          title,
          body,
          data: { eventUid: event.uid, occurrenceStart: occurrenceStart.toISOString() },
        },
        tokens,
      );

      try {
        await db.insert(sentNotificationsTable).values({
          eventUid: event.uid,
          occurrenceStart,
          kind: reminder.kind,
        });
      } catch {
        // Race condition with another instance — safe to ignore due to unique index.
      }
    }
  }
}

let started = false;

export function startNotificationScheduler(): void {
  if (started) return;
  started = true;

  processOnce().catch((err) => logger.error({ err }, "Initial scheduler run failed"));

  setInterval(() => {
    processOnce().catch((err) => logger.error({ err }, "Scheduler tick failed"));
  }, POLL_INTERVAL_MS);

  processNewsPushOnce().catch((err) =>
    logger.error({ err }, "Initial news push run failed"),
  );

  setInterval(() => {
    processNewsPushOnce().catch((err) => logger.error({ err }, "News push tick failed"));
  }, NEWS_PUSH_POLL_INTERVAL_MS);

  logger.info(
    {
      eventIntervalMinutes: POLL_INTERVAL_MS / 60000,
      newsIntervalHours: NEWS_PUSH_POLL_INTERVAL_MS / 3600000,
    },
    "Notification scheduler started",
  );
}
