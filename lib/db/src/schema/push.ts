import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";

/**
 * Expo push tokens registered by mobile devices. We upsert by `token` so
 * re-registering the same device updates `updated_at` rather than duplicating.
 */
export const pushTokensTable = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  platform: text("platform").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPushTokenSchema = createInsertSchema(pushTokensTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokensTable.$inferSelect;

/**
 * Tracks which event reminder notifications have already been sent so the
 * scheduler doesn't re-fire them on every poll.
 */
export const sentNotificationsTable = pgTable(
  "sent_notifications",
  {
    id: serial("id").primaryKey(),
    eventUid: text("event_uid").notNull(),
    occurrenceStart: timestamp("occurrence_start", { withTimezone: true }).notNull(),
    kind: text("kind").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqOccurrence: uniqueIndex("sent_notifications_uniq").on(
      table.eventUid,
      table.occurrenceStart,
      table.kind,
    ),
  }),
);

export type SentNotification = typeof sentNotificationsTable.$inferSelect;
