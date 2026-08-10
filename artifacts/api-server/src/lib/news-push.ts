
import { db, eq, NEWS_PUSH_STATE_KEY, newsPushStateTable, pushTokensTable } from "@workspace/db";

import { WP_API_BASE_URL } from "./config";
import { stripWordPressContent } from "./html";
import { logger } from "./logger";
import { sendToAllDevices } from "./push-delivery";

const NEWS_PUSH_POLL_MS = 6 * 60 * 60 * 1000;
const FETCH_PER_PAGE = 30;

const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

interface WpPostMinimal {
  id: number;
  date: string;
  title: { rendered?: string };
}

function parseWpDateMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

async function fetchLatestPosts(): Promise<WpPostMinimal[]> {
  const url = new URL(`${WP_API_BASE_URL}/posts`);
  url.searchParams.set("per_page", String(FETCH_PER_PAGE));
  url.searchParams.set("page", "1");
  url.searchParams.set("orderby", "date");
  url.searchParams.set("order", "desc");
  url.searchParams.set("status", "publish");
  url.searchParams.set("_fields", "id,date,title");

  const res = await fetch(url.toString(), { headers: REQUEST_HEADERS });
  if (!res.ok) {
    throw new Error(`WP REST returned ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as WpPostMinimal[];
}

async function upsertLastPublishedAt(date: Date): Promise<void> {
  await db
    .insert(newsPushStateTable)
    .values({ singletonKey: NEWS_PUSH_STATE_KEY, lastPublishedAt: date })
    .onConflictDoUpdate({
      target: newsPushStateTable.singletonKey,
      set: { lastPublishedAt: date },
    });
}

export const NEWS_PUSH_POLL_INTERVAL_MS = NEWS_PUSH_POLL_MS;

export async function processNewsPushOnce(): Promise<void> {
  let posts: WpPostMinimal[];
  try {
    posts = await fetchLatestPosts();
  } catch (err) {
    // Rethrow rather than returning — see the matching note in notifications.ts.
    // A returned failure here is indistinguishable from "no new posts".
    logger.error({ err }, "News push: failed to fetch WordPress posts");
    throw err;
  }

  if (posts.length === 0) return;

  const newestPost = posts.reduce((a, b) =>
    parseWpDateMs(b.date) > parseWpDateMs(a.date) ? b : a,
  );

  const stateRows = await db
    .select()
    .from(newsPushStateTable)
    .where(eq(newsPushStateTable.singletonKey, NEWS_PUSH_STATE_KEY))
    .limit(1);

  if (stateRows.length === 0) {
    await upsertLastPublishedAt(new Date(newestPost.date));
    logger.info(
      { lastPublishedAt: newestPost.date },
      "News push: initialized cursor (no backlog notifications)",
    );
    return;
  }

  const cursorMs = stateRows[0]!.lastPublishedAt.getTime();
  const newer = posts
    .filter((p) => parseWpDateMs(p.date) > cursorMs)
    .sort((a, b) => parseWpDateMs(a.date) - parseWpDateMs(b.date));

  if (newer.length === 0) return;

  const tokens = await db.select().from(pushTokensTable);
  const maxDateMs = Math.max(...newer.map((p) => parseWpDateMs(p.date)));

  if (tokens.length > 0) {
    for (const post of newer) {
      const title = stripWordPressContent(post.title?.rendered ?? "News");
      const preview =
        title.length > 120 ? `${title.slice(0, 117).trimEnd()}…` : title;
      logger.info({ postId: post.id }, "News push: sending notification");
      await sendToAllDevices(
        {
          title: "FES Center news",
          body: preview,
          data: { newsPostId: post.id },
        },
        tokens,
      );
    }
  }

  await upsertLastPublishedAt(new Date(maxDateMs));
  logger.info(
    { count: newer.length, hadTokens: tokens.length > 0 },
    "News push: updated cursor",
  );
}
