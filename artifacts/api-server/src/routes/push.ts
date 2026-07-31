import { Router } from "express";
import { z } from "zod/v4";
import { eq, sql } from "drizzle-orm";
import { Expo } from "expo-server-sdk";

import { db, pushTokensTable } from "@workspace/db";
import { requireApiToken } from "../lib/security";

const router = Router();

// Writes to the token registry: unauthenticated, these let anyone flood the
// push fan-out or silently unsubscribe a device they can name.
router.use("/push-tokens", requireApiToken);

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]),
});

router.post("/push-tokens", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }
    const { token, platform } = parsed.data;

    if (!Expo.isExpoPushToken(token)) {
      res.status(400).json({ error: "Not a valid Expo push token" });
      return;
    }

    await db
      .insert(pushTokensTable)
      .values({ token, platform })
      .onConflictDoUpdate({
        target: pushTokensTable.token,
        set: { platform, updatedAt: sql`now()` },
      });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to register push token");
    next(err);
  }
});

router.delete("/push-tokens/:token", async (req, res, next) => {
  try {
    const token = req.params.token;
    if (!token) {
      res.status(400).json({ error: "Missing token" });
      return;
    }
    await db.delete(pushTokensTable).where(eq(pushTokensTable.token, token));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove push token");
    next(err);
  }
});

export const pushRouter = router;
