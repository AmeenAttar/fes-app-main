import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The only destructive thing this module does is delete a token it believes is
 * unregistered. Pairing a ticket with the wrong token therefore does not just
 * mislead a log line — it removes a working device from every future
 * notification and keeps the dead one. These tests pin the pairing.
 */

const sendPushNotificationsAsync = vi.fn();
const deleted: string[] = [];

vi.mock("expo-server-sdk", () => {
  class FakeExpo {
    static isExpoPushToken(t: string) {
      return typeof t === "string" && t.startsWith("ExponentPushToken[");
    }
    // Real chunk limit is 100; 2 keeps the fixtures readable.
    chunkPushNotifications(messages: unknown[]) {
      const out: unknown[][] = [];
      for (let i = 0; i < messages.length; i += 2) out.push(messages.slice(i, i + 2));
      return out;
    }
    sendPushNotificationsAsync(chunk: unknown[]) {
      return sendPushNotificationsAsync(chunk);
    }
  }
  return { Expo: FakeExpo };
});

vi.mock("@workspace/db", () => ({
  db: {
    delete: () => ({
      where: (token: string) => {
        deleted.push(token);
        return Promise.resolve();
      },
    }),
  },
  pushTokensTable: { token: "token" },
  eq: (_column: unknown, value: unknown) => value,
}));

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { sendToAllDevices } = await import("./push-delivery");

const tok = (n: number) => ({ token: `ExponentPushToken[dev${n}]` }) as never;
const ok = { status: "ok" as const, id: "x" };
const gone = {
  status: "error" as const,
  message: "not registered",
  details: { error: "DeviceNotRegistered" as const },
};

beforeEach(() => {
  sendPushNotificationsAsync.mockReset();
  deleted.length = 0;
});

describe("sendToAllDevices", () => {
  it("deletes exactly the token whose ticket reported DeviceNotRegistered", async () => {
    sendPushNotificationsAsync.mockResolvedValueOnce([ok, gone]);

    await sendToAllDevices({ title: "t", body: "b" }, [tok(1), tok(2)]);

    expect(deleted).toEqual(["ExponentPushToken[dev2]"]);
  });

  /**
   * The regression this module was carrying: a throwing chunk contributes no
   * tickets, so index-based pairing shifted every later ticket one chunk to the
   * left and deleted a device that was working fine.
   */
  it("keeps pairing correct when an earlier chunk throws", async () => {
    sendPushNotificationsAsync
      .mockRejectedValueOnce(new Error("network died")) // dev1, dev2
      .mockResolvedValueOnce([ok, gone]); // dev3, dev4

    await sendToAllDevices({ title: "t", body: "b" }, [
      tok(1),
      tok(2),
      tok(3),
      tok(4),
    ]);

    // dev4 is the one Expo reported. Index-based pairing would have said dev2.
    expect(deleted).toEqual(["ExponentPushToken[dev4]"]);
  });

  it("leaves every token in place when a chunk fails outright", async () => {
    sendPushNotificationsAsync.mockRejectedValue(new Error("network died"));

    await sendToAllDevices({ title: "t", body: "b" }, [tok(1), tok(2)]);

    expect(deleted).toEqual([]);
  });

  // A transient send error is not evidence the device is gone.
  it("does not delete on non-DeviceNotRegistered ticket errors", async () => {
    sendPushNotificationsAsync.mockResolvedValueOnce([
      { status: "error", message: "rate limited", details: { error: "MessageRateExceeded" } },
      ok,
    ]);

    await sendToAllDevices({ title: "t", body: "b" }, [tok(1), tok(2)]);

    expect(deleted).toEqual([]);
  });

  it("skips malformed tokens without sending", async () => {
    await sendToAllDevices({ title: "t", body: "b" }, [
      { token: "not-a-push-token" } as never,
    ]);

    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });
});
