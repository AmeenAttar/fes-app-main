import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { eq } from "drizzle-orm";

import { db, pushTokensTable, type PushToken } from "@workspace/db";

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
  const tickets: ExpoPushTicket[] = [];
  for (const chunk of chunks) {
    try {
      const result = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...result);
    } catch (err) {
      logger.error({ err }, "Failed to send push chunk");
    }
  }

  for (let i = 0; i < tickets.length; i += 1) {
    const ticket = tickets[i];
    const tok = validTokens[i];
    if (!ticket || !tok) continue;
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
