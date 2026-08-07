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

// The event job short-circuits before touching the ledger when there are no
// registered devices, so an empty token list is enough to exercise the happy path.
vi.mock("@workspace/db", () => ({
  db: { select: () => ({ from: async () => [] }) },
  pushTokensTable: {},
  sentNotificationsTable: {},
}));

vi.mock("./monitoring", () => ({ captureError: vi.fn() }));

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { runSchedulerOnce } = await import("./notifications");

beforeEach(() => {
  loadEvents.mockReset().mockResolvedValue([]);
  processNewsPushOnce.mockReset().mockResolvedValue(undefined);
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
