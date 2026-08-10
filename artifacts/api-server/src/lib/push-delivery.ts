import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";

import { db, eq, pushTokensTable, type PushToken } from "@workspace/db";

import { logger } from "./logger";

const expo = new Expo();

export async function sendToAllDevices(
  message: Omit<ExpoPushMessage, "to">,
  tokens: PushToken[],
): Promise<void> {
  const validTokens = tokens
    .map((t) => t.token)
    .filter((tok) => Expo.isExpoPushToken(tok));

  if (validTokens.length === 0) return;

  const messages: ExpoPushMessage[] = validTokens.map((to) => ({
    ...message,
    to,
    sound: "default",
    priority: "high",
  }));

  const chunks = expo.chunkPushNotifications(messages);

  /**
   * Tickets are paired with their token as each chunk returns, rather than
   * accumulated into one array and matched back by index afterwards.
   *
   * A chunk that throws contributes no tickets, so an index-based pairing
   * silently shifts every later ticket onto the wrong token — and the only
   * thing this loop does with a ticket is delete the token it believes is
   * unregistered. That deletes a working device and keeps the dead one.
   * Harmless while everyone fits in one chunk (100 messages); wrong the moment
   * there are two and the first fails.
   */
  const results: Array<{ ticket: ExpoPushTicket; token: string }> = [];
  let offset = 0;
  for (const chunk of chunks) {
    const chunkTokens = validTokens.slice(offset, offset + chunk.length);
    offset += chunk.length;
    try {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      chunkTickets.forEach((ticket, i) => {
        const token = chunkTokens[i];
        if (token) results.push({ ticket, token });
      });
    } catch (err) {
      logger.error(
        { err, chunkSize: chunk.length },
        "Failed to send push chunk",
      );
    }
  }

  for (const { ticket, token: tok } of results) {
    if (ticket.status === "error") {
      const code = ticket.details?.error;
      if (code === "DeviceNotRegistered") {
        await db
          .delete(pushTokensTable)
          .where(eq(pushTokensTable.token, tok))
          .catch(() => undefined);
        logger.info({ token: tok.slice(0, 24) + "…" }, "Removed unregistered token");
      } else {
        logger.warn({ ticket }, "Push ticket error");
      }
    }
  }
}
