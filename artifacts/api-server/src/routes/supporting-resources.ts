import { Router, type IRouter } from "express";

import { FESCENTER_HOSTNAME, WP_API_BASE_URL } from "../lib/config";
import { decodeHtmlEntities, stripShortcodes, stripTags } from "../lib/html";
import { captureError, captureWarning } from "../lib/monitoring";

const router: IRouter = Router();

/**
 * Slug of the WordPress page holding the contact list
 * (https://fescenter.org/supporting-resources/). Overridable so renaming or
 * moving that page is an env change rather than a code change.
 */
const SUPPORTING_RESOURCES_SLUG =
  process.env["SUPPORTING_RESOURCES_SLUG"]?.trim() || "supporting-resources";

const CACHE_TTL_MS = 10 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;

const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

export interface ResourceContact {
  name: string;
  /** Optional qualifier some entries carry, e.g. "Regulatory". */
  role?: string;
  /** Empty when the page lists a person without an address. */
  email: string;
}

export interface ResourceCategory {
  id: string;
  title: string;
  contacts: ResourceContact[];
}

interface WpPage {
  id: number;
  slug: string;
  content: { rendered?: string };
}

const EMAIL_RE = /[^\s<>"|]+@[^\s<>"|]+\.[^\s<>"|]+/;

function slugify(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  return base.length > 0 ? base : `section-${index}`;
}

/**
 * Reads the page's `<h3>` headings as sections and the `<li>` items beneath
 * each as its contacts.
 *
 * Nothing about the section list or the field layout is hard-coded: sections
 * are whatever headings exist, contacts are whatever list items follow, and
 * each item's pipe-separated parts are interpreted by shape rather than by
 * position. The address is found by looking for an email anywhere in the item
 * — a `mailto:` link or bare text — and the remaining parts become the name
 * and an optional qualifier. That already matters, since most entries read
 * "Name | email" while FDA Support Core reads "Name | Regulatory | email".
 *
 * So the Center can add, remove, rename, or reorder sections and people, and
 * add or drop that middle qualifier, with no app change.
 */
export function parseSupportingResources(html: string): ResourceCategory[] {
  const content = stripShortcodes(html);

  const headingRe = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const headings = [...content.matchAll(headingRe)];

  const categories: ResourceCategory[] = [];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    if (!heading) continue;

    const title = decodeHtmlEntities(stripTags(heading[1] ?? "")).trim();
    if (!title) continue;

    const blockStart = (heading.index ?? 0) + heading[0].length;
    const blockEnd = headings[i + 1]?.index ?? content.length;
    const block = content.slice(blockStart, blockEnd);

    const contacts: ResourceContact[] = [];
    for (const li of block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const inner = li[1] ?? "";

      // Prefer the mailto target, which is unambiguous, and fall back to any
      // address written as plain text.
      const mailto = inner.match(/href\s*=\s*["']mailto:([^"'?]+)/i);
      const text = decodeHtmlEntities(stripTags(inner));
      const email = (mailto?.[1] ?? text.match(EMAIL_RE)?.[0] ?? "").trim();

      const parts = text
        .split("|")
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && p !== email);

      const name = parts[0] ?? "";
      if (!name && !email) continue;

      const role = parts.slice(1).join(" · ");
      contacts.push({
        name: name || email,
        ...(role ? { role } : {}),
        email,
      });
    }

    if (contacts.length === 0) continue;
    categories.push({ id: slugify(title, i), title, contacts });
  }

  return categories;
}

interface CacheEntry {
  data: ResourceCategory[];
  fetchedAt: number;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<ResourceCategory[]> | null = null;

function servableStale(): ResourceCategory[] | null {
  if (cache && Date.now() - cache.fetchedAt < STALE_MAX_MS) return cache.data;
  return null;
}

async function fetchPage(): Promise<WpPage> {
  const url = new URL(`${WP_API_BASE_URL}/pages`);
  url.searchParams.set("slug", SUPPORTING_RESOURCES_SLUG);
  url.searchParams.set("_fields", "id,slug,content");

  const res = await fetch(url.toString(), { headers: REQUEST_HEADERS });
  if (!res.ok) {
    throw new Error(`Upstream WP REST returned ${res.status}`);
  }
  const json = (await res.json()) as WpPage[];
  const page = json[0];
  if (!page) {
    throw new Error(`No page found with slug "${SUPPORTING_RESOURCES_SLUG}"`);
  }
  return page;
}

async function loadResources(): Promise<ResourceCategory[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const page = await fetchPage();
      const categories = parseSupportingResources(page.content?.rendered ?? "");
      if (categories.length === 0) {
        // Parsing to nothing means the page's markup moved under us, which is
        // the kind of silent breakage that otherwise goes unnoticed.
        throw new Error("No supporting-resource sections parsed from upstream");
      }
      cache = { data: categories, fetchedAt: Date.now() };
      return categories;
    } catch (err) {
      const stale = servableStale();
      if (stale) {
        captureWarning("Supporting resources fetch failed; serving cached copy", {
          reason: err instanceof Error ? err.message : String(err),
        });
        return stale;
      }
      throw err;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

router.get("/supporting-resources", async (req, res) => {
  try {
    const categories = await loadResources();
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ categories });
  } catch (err) {
    req.log.error({ err }, "Failed to load supporting resources");
    captureError(err, { route: "supporting-resources" });
    res.status(502).json({
      error: `Unable to load supporting resources from ${FESCENTER_HOSTNAME}`,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
