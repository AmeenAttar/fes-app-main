import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Both jobs deliberately catch their own errors, so a broken run and a healthy
 * one produce the same logs and the same HTTP status unless `runSchedulerOnce`
 * reports the difference. These tests pin that reporting: without it the cron
 * stays green forever while nothing is delivered, which is the exact failure
 * shape this project keeps running into.
 */

const loadEvents = vi.fn();
const processNewsPushOnce = vi.fn();

vi.mock("../routes/events", () => ({
  loadEvents: () => loadEvents(),
}));

vi.mock("./news-push", () => ({
  NEWS_PUSH_POLL_INTERVAL_MS: 3_600_000,
  processNewsPushOnce: () => processNewsPushOnce(),
}));

const PUSH_TOKENS = { _t: "push_tokens" };
const SENT = { _t: "sent_notifications" };

/** Devices currently registered. Empty means the job stops before the ledger. */
let tokenRows: unknown[] = [];
/** Rows the dedupe ledger should report as already sent. */
let ledgerRows: unknown[] = [];
const inserted: unknown[] = [];

/** Awaitable *and* chainable, because the real query builder is both. */
function result(rows: unknown[]) {
  const p = Promise.resolve(rows) as Promise<unknown[]> & {
    where: () => Promise<unknown[]>;
  };
  p.where = () => Promise.resolve(rows);
  return p;
}

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: (t: unknown) => result(t === PUSH_TOKENS ? tokenRows : ledgerRows),
    }),
    insert: () => ({
      values: (v: unknown) => {
        inserted.push(v);
        return Promise.resolve();
      },
    }),
    delete: () => ({ where: () => Promise.resolve() }),
  },
  pushTokensTable: PUSH_TOKENS,
  sentNotificationsTable: SENT,
}));

// The mock tables carry no real columns, so the operators only need to be callable.
vi.mock("drizzle-orm", () => ({ inArray: () => ({}), lt: () => ({}) }));

const sendToAllDevices = vi.fn();
vi.mock("./push-delivery", () => ({
  sendToAllDevices: (...args: unknown[]) => sendToAllDevices(...args),
}));

vi.mock("./monitoring", () => ({ captureError: vi.fn() }));

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { runSchedulerOnce, formatLeadTime } = await import("./notifications");

/** An event `minutesFromNow` in the future, in the shape loadEvents returns. */
function eventIn(minutesFromNow: number, title = "Lab meeting") {
  const start = new Date(Date.now() + minutesFromNow * 60_000);
  return {
    uid: `uid-${minutesFromNow}`,
    title,
    start: start.toISOString(),
    allDay: false,
  };
}

/** Titles of every push the run attempted. */
function sentTitles(): string[] {
  return sendToAllDevices.mock.calls.map(
    (c) => (c[0] as { title: string }).title,
  );
}

beforeEach(() => {
  loadEvents.mockReset().mockResolvedValue([]);
  processNewsPushOnce.mockReset().mockResolvedValue(undefined);
  sendToAllDevices.mockReset().mockResolvedValue(undefined);
  tokenRows = [];
  ledgerRows = [];
  inserted.length = 0;
});

describe("runSchedulerOnce", () => {
  it("reports ok when both jobs succeed", async () => {
    await expect(runSchedulerOnce()).resolves.toEqual({
      events: "ok",
      news: "ok",
    });
  });

  it("reports the failing job without hiding it behind a success", async () => {
    loadEvents.mockRejectedValue(new Error("calendar upstream 429"));

    await expect(runSchedulerOnce()).resolves.toEqual({
      events: "failed",
      news: "ok",
    });
  });

  it("reports both failures independently", async () => {
    loadEvents.mockRejectedValue(new Error("calendar down"));
    processNewsPushOnce.mockRejectedValue(new Error("wordpress down"));

    await expect(runSchedulerOnce()).resolves.toEqual({
      events: "failed",
      news: "failed",
    });
  });

  // One job throwing must not take the other down with it — a flaky calendar
  // feed should never stop news notifications.
  it("still runs the news job when the events job throws", async () => {
    loadEvents.mockRejectedValue(new Error("calendar down"));

    await runSchedulerOnce();

    expect(processNewsPushOnce).toHaveBeenCalledOnce();
  });
});

describe("formatLeadTime", () => {
  it("rounds the near-hour range up to an hour", () => {
    expect(formatLeadTime(75)).toBe("in 1 hour");
    expect(formatLeadTime(60)).toBe("in 1 hour");
    expect(formatLeadTime(50)).toBe("in 1 hour");
  });

  it("states the real figure once it is meaningfully under an hour", () => {
    expect(formatLeadTime(49)).toBe("in 49 minutes");
    expect(formatLeadTime(12)).toBe("in 12 minutes");
    expect(formatLeadTime(2)).toBe("in 2 minutes");
  });

  // "in 1 minutes" and "in 0 minutes" both read as bugs to a user.
  it("collapses the last minute to 'now'", () => {
    expect(formatLeadTime(1.4)).toBe("now");
    expect(formatLeadTime(0.2)).toBe("now");
  });
});

/**
 * The whole point of the wide window: an external cron drops ticks, so the
 * reminder has to survive arriving late rather than being skipped. The old
 * 50–75 minute window was sized for a 5-minute in-process timer and silently
 * lost any event that passed through it between two ticks.
 */
describe("short-notice reminder", () => {
  beforeEach(() => {
    tokenRows = [{ token: "ExponentPushToken[abc]", platform: "ios" }];
  });

  it("sends at a full hour out with the hour wording", async () => {
    loadEvents.mockResolvedValue([eventIn(62)]);

    await runSchedulerOnce();

    expect(sentTitles()).toEqual(["Starting in 1 hour"]);
  });

  // This is the case the old window dropped entirely.
  it("still sends when the tick lands long after the hour mark", async () => {
    loadEvents.mockResolvedValue([eventIn(20)]);

    await runSchedulerOnce();

    expect(sentTitles()).toEqual(["Starting in 20 minutes"]);
  });

  it("does not send for an event beyond the window", async () => {
    loadEvents.mockResolvedValue([eventIn(200)]);

    await runSchedulerOnce();

    expect(sentTitles()).toEqual([]);
  });

  it("does not send for an event that already started", async () => {
    loadEvents.mockResolvedValue([eventIn(-10)]);

    await runSchedulerOnce();

    expect(sentTitles()).toEqual([]);
  });

  // The widened window only works because the ledger, not the window, is what
  // guarantees once-per-occurrence.
  it("skips an occurrence the ledger already recorded", async () => {
    const event = eventIn(20);
    loadEvents.mockResolvedValue([event]);
    ledgerRows = [
      {
        eventUid: event.uid,
        occurrenceStart: new Date(event.start),
        kind: "hour_before",
      },
    ];

    await runSchedulerOnce();

    expect(sentTitles()).toEqual([]);
  });

  // An all-day event sits at local midnight, so counting down to it would
  // announce "Starting now" as the date rolls over.
  it("leaves all-day events to the day-before reminder", async () => {
    loadEvents.mockResolvedValue([{ ...eventIn(20), allDay: true }]);

    await runSchedulerOnce();

    expect(sentTitles()).toEqual([]);
  });

  it("records what it sent so the next tick does not repeat it", async () => {
    loadEvents.mockResolvedValue([eventIn(20)]);

    await runSchedulerOnce();

    expect(inserted).toEqual([
      expect.objectContaining({ kind: "hour_before" }),
    ]);
  });
});
