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
 * How the short-notice reminder describes the time left.
 *
 * The reminder no longer promises a fixed lead time, because the schedule is
 * driven by an external cron that skips ticks. Saying what is actually true at
 * send time is what lets the window be wide enough to survive those gaps.
 */
export function formatLeadTime(minutesUntil: number): string {
  const m = Math.round(minutesUntil);
  if (m >= 50) return "in 1 hour";
  if (m >= 2) return `in ${m} minutes`;
  return "now";
}

/**
 * Reminder windows. We send each kind exactly once per occurrence — the unique
 * index on `sent_notifications` is what enforces that, not the window.
 *
 * The window is checked against `event.start - now`, in minutes, and exists
 * only to bound how early a reminder may go out. It is deliberately *not* sized
 * to the poll interval: an external cron drops ticks, and a window narrower
 * than the longest gap silently loses reminders rather than delaying them.
 * Widening costs nothing because the ledger already prevents repeats.
 */
const REMINDERS: Array<{
  kind: "day_before" | "hour_before";
  /** Trigger when minutes-until-event is between [minMinutes, maxMinutes]. */
  minMinutes: number;
  maxMinutes: number;
  buildBody: (
    event: EventDto,
    minutesUntil: number,
  ) => { title: string; body: string };
}> = [
  {
    kind: "day_before",
    // 18 to 30 hours out — twelve hours wide, so no realistic gap misses it.
    minMinutes: 18 * 60,
    maxMinutes: 30 * 60,
    buildBody: (e) => ({
      title: "Tomorrow at the FES Center",
      body: `${e.title}${formatTimeSuffix(e)}`,
    }),
  },
  {
    kind: "hour_before",
    // Anything from 75 minutes out until the event starts. A skipped tick now
    // delays this reminder instead of losing it, and the title says how long is
    // actually left rather than claiming an hour.
    minMinutes: 0,
    maxMinutes: 75,
    buildBody: (e, minutesUntil) => ({
      title: `Starting ${formatLeadTime(minutesUntil)}`,
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
    // Rethrow rather than returning: swallowing here would report a calendar
    // outage as a clean run all the way up to the cron's exit status.
    // `runEventsTick` logs the generic failure and captures it once.
    logger.error({ err }, "Scheduler: failed to load events");
    throw err;
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
    minutesUntil: number;
  }> = [];

  for (const event of events) {
    const startTs = eventStartMs(event.start, event.allDay);
    if (Number.isNaN(startTs)) continue;
    const minutesUntil = (startTs - now) / 60000;
    if (minutesUntil <= 0) continue;

    for (const reminder of REMINDERS) {
      // An all-day event has no start time — `eventStartMs` puts it at local
      // midnight — so a short-notice reminder would count down to midnight and
      // say "Starting now" as the day turns over. The day-before reminder is
      // the one that means anything for these.
      if (reminder.kind === "hour_before" && event.allDay) continue;

      if (
        minutesUntil < reminder.minMinutes ||
        minutesUntil > reminder.maxMinutes
      ) {
        continue;
      }
      due.push({
        event,
        reminder,
        occurrenceStart: new Date(event.start),
        minutesUntil,
      });
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

  for (const { event, reminder, occurrenceStart, minutesUntil } of due) {
    const key = ledgerKey(event.uid, occurrenceStart, reminder.kind);
    if (sentKeys.has(key)) continue;

    const { title, body } = reminder.buildBody(event, minutesUntil);

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

/**
 * Outcome of one job pass.
 *
 * `failed` exists so a caller can tell a working run from a broken one. The
 * errors are still swallowed here — one job must not abort the other, and a
 * timer has nobody to throw to — but swallowing them *without reporting* is how
 * a scheduler ends up looking healthy for months while delivering nothing.
 */
export type JobResult = "ok" | "failed" | "skipped";

async function runEventsTick(): Promise<JobResult> {
  if (eventsRunning) return "skipped";
  eventsRunning = true;
  try {
    await processOnce();
    return "ok";
  } catch (err) {
    logger.error({ err }, "Scheduler tick failed");
    captureError(err, { job: "event-reminders" });
    return "failed";
  } finally {
    eventsRunning = false;
  }
}

async function runNewsTick(): Promise<JobResult> {
  if (newsRunning) return "skipped";
  newsRunning = true;
  try {
    await processNewsPushOnce();
    return "ok";
  } catch (err) {
    logger.error({ err }, "News push tick failed");
    captureError(err, { job: "news-push" });
    return "failed";
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
  events: JobResult;
  news: JobResult;
}> {
  const [events, news] = await Promise.all([runEventsTick(), runNewsTick()]);
  return { events, news };
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
