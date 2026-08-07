import { inArray, lt } from "drizzle-orm";

import { db, pushTokensTable, sentNotificationsTable } from "@workspace/db";

import { loadEvents, type EventDto } from "../routes/events";
import { NEWS_PUSH_POLL_INTERVAL_MS, processNewsPushOnce } from "./news-push";
import { logger } from "./logger";
import { captureError } from "./monitoring";
import { sendToAllDevices } from "./push-delivery";
import { eventStartMs, FES_TIMEZONE } from "./time";

/** How often the scheduler re-checks the calendar. */
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Past occurrences can never fire again, so the dedupe ledger only needs enough
 * history to cover the widest reminder window. Without this it grows forever.
 */
const LEDGER_RETENTION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const PRUNE_EVERY_MS = 24 * 60 * 60 * 1000;

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
      timeZone: FES_TIMEZONE,
    });
    return ` · ${time} ET`;
  } catch {
    return "";
  }
}

function ledgerKey(uid: string, occurrenceStart: Date, kind: string): string {
  return `${uid}|${occurrenceStart.toISOString()}|${kind}`;
}

let lastPrunedAt = 0;

/** Drops ledger rows for occurrences too old to ever fire again. */
async function pruneLedger(): Promise<void> {
  if (Date.now() - lastPrunedAt < PRUNE_EVERY_MS) return;
  lastPrunedAt = Date.now();
  try {
    await db
      .delete(sentNotificationsTable)
      .where(
        lt(sentNotificationsTable.sentAt, new Date(Date.now() - LEDGER_RETENTION_MS)),
      );
  } catch (err) {
    logger.warn({ err }, "Scheduler: ledger prune failed");
  }
}

async function processOnce(): Promise<void> {
  let events: EventDto[];
  try {
    events = await loadEvents();
  } catch (err) {
    logger.error({ err }, "Scheduler: failed to load events");
    captureError(err, { job: "event-reminders" });
    return;
  }

  const tokens = await db.select().from(pushTokensTable);
  if (tokens.length === 0) return;

  const now = Date.now();

  // Collect everything due first, so the ledger can be checked in one query
  // instead of one per event × reminder.
  const due: Array<{
    event: EventDto;
    reminder: (typeof REMINDERS)[number];
    occurrenceStart: Date;
  }> = [];

  for (const event of events) {
    const startTs = eventStartMs(event.start, event.allDay);
    if (Number.isNaN(startTs)) continue;
    const minutesUntil = (startTs - now) / 60000;
    if (minutesUntil <= 0) continue;

    for (const reminder of REMINDERS) {
      if (
        minutesUntil < reminder.minMinutes ||
        minutesUntil > reminder.maxMinutes
      ) {
        continue;
      }
      due.push({ event, reminder, occurrenceStart: new Date(event.start) });
    }
  }

  if (due.length === 0) {
    await pruneLedger();
    return;
  }

  const uids = [...new Set(due.map((d) => d.event.uid))];
  const alreadySent = await db
    .select({
      eventUid: sentNotificationsTable.eventUid,
      occurrenceStart: sentNotificationsTable.occurrenceStart,
      kind: sentNotificationsTable.kind,
    })
    .from(sentNotificationsTable)
    .where(inArray(sentNotificationsTable.eventUid, uids));

  const sentKeys = new Set(
    alreadySent.map((r) => ledgerKey(r.eventUid, r.occurrenceStart, r.kind)),
  );

  for (const { event, reminder, occurrenceStart } of due) {
    const key = ledgerKey(event.uid, occurrenceStart, reminder.kind);
    if (sentKeys.has(key)) continue;

    const { title, body } = reminder.buildBody(event);

    logger.info(
      { kind: reminder.kind, event: event.title },
      "Sending reminder",
    );

    await sendToAllDevices(
      {
        title,
        body,
        data: {
          eventUid: event.uid,
          occurrenceStart: occurrenceStart.toISOString(),
        },
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
      // Race with another instance — the unique index makes this safe to ignore.
    }
    sentKeys.add(key);
  }

  await pruneLedger();
}

let started = false;
let eventsTimer: NodeJS.Timeout | null = null;
let newsTimer: NodeJS.Timeout | null = null;
/** Guards against a slow tick overlapping the next one. */
let eventsRunning = false;
let newsRunning = false;

/** @returns false when skipped because the previous run is still going. */
async function runEventsTick(): Promise<boolean> {
  if (eventsRunning) return false;
  eventsRunning = true;
  try {
    await processOnce();
    return true;
  } catch (err) {
    logger.error({ err }, "Scheduler tick failed");
    captureError(err, { job: "event-reminders" });
    return true;
  } finally {
    eventsRunning = false;
  }
}

/** @returns false when skipped because the previous run is still going. */
async function runNewsTick(): Promise<boolean> {
  if (newsRunning) return false;
  newsRunning = true;
  try {
    await processNewsPushOnce();
    return true;
  } catch (err) {
    logger.error({ err }, "News push tick failed");
    captureError(err, { job: "news-push" });
    return true;
  } finally {
    newsRunning = false;
  }
}

/**
 * One pass of both jobs, for callers that drive the schedule themselves.
 *
 * Free hosting tiers suspend an idle service, and a suspended process runs no
 * timers — so on those hosts the in-process interval below silently stops
 * delivering reminders. Exposing a single pass lets an external cron
 * (see `.github/workflows/scheduler.yml`) own the cadence instead, which both
 * makes delivery reliable and keeps the service from idling.
 *
 * Safe to run concurrently with the internal timer: event reminders dedupe on
 * the `sent_notifications` unique index and news push advances a stored cursor,
 * so a doubled run repeats work rather than re-notifying anyone.
 */
export async function runSchedulerOnce(): Promise<{
  events: "ran" | "skipped";
  news: "ran" | "skipped";
}> {
  const [events, news] = await Promise.all([runEventsTick(), runNewsTick()]);
  return {
    events: events ? "ran" : "skipped",
    news: news ? "ran" : "skipped",
  };
}

/** Stops both timers so the process can exit cleanly. */
export function stopNotificationScheduler(): void {
  if (eventsTimer) clearInterval(eventsTimer);
  if (newsTimer) clearInterval(newsTimer);
  eventsTimer = null;
  newsTimer = null;
  started = false;
}

/**
 * Set `INTERNAL_SCHEDULER=off` on hosts that suspend an idle service, and let
 * an external cron drive `POST /api/tasks/run` instead. Left on, the timers and
 * the endpoint coexist safely — they just duplicate work.
 */
const INTERNAL_SCHEDULER_ENABLED =
  (process.env["INTERNAL_SCHEDULER"] ?? "on").trim().toLowerCase() !== "off";

export function startNotificationScheduler(): void {
  if (started) return;
  started = true;

  if (!INTERNAL_SCHEDULER_ENABLED) {
    logger.info(
      "Internal scheduler disabled; expecting external POST /api/tasks/run",
    );
    return;
  }

  void runEventsTick();
  eventsTimer = setInterval(() => void runEventsTick(), POLL_INTERVAL_MS);

  void runNewsTick();
  newsTimer = setInterval(() => void runNewsTick(), NEWS_PUSH_POLL_INTERVAL_MS);

  logger.info(
    {
      eventIntervalMinutes: POLL_INTERVAL_MS / 60000,
      newsIntervalHours: NEWS_PUSH_POLL_INTERVAL_MS / 3600000,
    },
    "Notification scheduler started",
  );
}
