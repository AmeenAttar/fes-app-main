import { Router, type IRouter } from "express";

import { FESCENTER_HOSTNAME, WP_API_BASE_URL, fescenterSiteHeroImgRegex } from "../lib/config";
import { decodeHtmlEntities, stripShortcodes, stripTags } from "../lib/html";
import { captureError, captureWarning } from "../lib/monitoring";

const router: IRouter = Router();

/**
 * Slug of the WordPress page whose children are individual equipment items
 * (https://fescenter.org/equipmentrepo/). Overridable so a future site
 * restructuring — the Center renaming or moving this page — is a one-line
 * env change instead of a code change.
 */
const EQUIPMENT_REPO_SLUG =
  process.env["EQUIPMENT_REPO_SLUG"]?.trim() || "equipmentrepo";

/** Equipment changes rarely; a longer TTL means fewer upstream calls. */
const CACHE_TTL_MS = 10 * 60 * 1000;
/** How long a cached catalog may still be served once refreshing starts failing. */
const STALE_MAX_MS = 24 * 60 * 60 * 1000;
/** One request comfortably covers the current ~40-item catalog; the fetch loop
 *  below still pages correctly if the catalog ever grows past this. */
const PAGE_SIZE = 100;
/** Defensive ceiling so a WordPress misconfiguration can't spin this forever. */
const MAX_PAGES = 20;

const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

export interface EquipmentParameter {
  label: string;
  value: string;
}

export interface EquipmentSummary {
  slug: string;
  name: string;
  imageUrl: string | null;
}

export interface EquipmentDetail extends EquipmentSummary {
  detailUrl: string;
  /**
   * Whatever "Label: value" pairs were found on the item's page, in the order
   * they appear. Not a fixed schema on purpose — see {@link parseEquipmentParameters}.
   */
  parameters: EquipmentParameter[];
}

interface WpRendered {
  rendered?: string;
}

interface WpPage {
  id: number;
  slug: string;
  link: string;
  title: WpRendered;
  content: WpRendered;
}

/**
 * Pulls "Label: value" pairs out of the free-text `<strong>Label</strong>:
 * value` runs the Center uses for spec sheets on each equipment page.
 *
 * This is deliberately schema-less: every `<strong>` that reads as a field
 * label (colon on either side of the tag) becomes a row, whatever its text
 * says. Label wording is already inconsistent on the live site today
 * ("Contact PI" vs "Contact Person") — a generic parser handles that for
 * free, and it means the Center can add, remove, or rename a field on their
 * website and the app picks it up with no code change.
 *
 * A `<strong>` with no colon on either side is treated as inline emphasis
 * inside a value (e.g. "...is essential" bolded mid-sentence) rather than a
 * new field, so it doesn't fracture that field's value or show up as a
 * spurious row of its own.
 */
export function parseEquipmentParameters(html: string): EquipmentParameter[] {
  const content = stripShortcodes(html);
  const strongRe = /<strong[^>]*>([\s\S]*?)<\/strong>/gi;
  const allMatches = [...content.matchAll(strongRe)];

  const labels: Array<{ index: number; end: number; label: string }> = [];
  for (const m of allMatches) {
    const inner = stripTags(m[1] ?? "");
    const labelEndsWithColon = /:\s*$/.test(inner);

    const afterStart = (m.index ?? 0) + m[0].length;
    const peek = stripTags(content.slice(afterStart, afterStart + 8));
    const nextStartsWithColon = /^\s*:/.test(peek);

    if (!labelEndsWithColon && !nextStartsWithColon) continue;

    const label = inner.replace(/:\s*$/, "").trim();
    // A real spec label is short; anything longer is almost certainly bolded
    // body text that happens to have a colon nearby.
    if (!label || label.length > 80) continue;

    labels.push({ index: m.index ?? 0, end: afterStart, label });
  }

  const params: EquipmentParameter[] = [];
  for (let i = 0; i < labels.length; i++) {
    const cur = labels[i];
    if (!cur) continue;
    const end = labels[i + 1]?.index ?? content.length;
    const rawValue = content.slice(cur.end, end);
    const value = stripTags(rawValue)
      .replace(/^:\s*/, "")
      .replace(/[​-‏﻿]/g, "")
      .trim();
    if (!value) continue;
    params.push({ label: cur.label, value });
  }
  return params;
}

/** First on-hostname photo embedded in the page, if any. */
export function pickEquipmentImage(html: string): string | null {
  const re = fescenterSiteHeroImgRegex();
  const m = re.exec(html);
  return m ? (m[1] ?? null) : null;
}

function toEquipment(page: WpPage): EquipmentDetail {
  const content = page.content?.rendered ?? "";
  return {
    slug: page.slug,
    name: decodeHtmlEntities(stripTags(page.title?.rendered ?? "")),
    imageUrl: pickEquipmentImage(content),
    detailUrl: page.link,
    parameters: parseEquipmentParameters(content),
  };
}

/** Resolves the equipment repo page's id, needed to list its children. */
async function fetchRepoPageId(): Promise<number> {
  const url = new URL(`${WP_API_BASE_URL}/pages`);
  url.searchParams.set("slug", EQUIPMENT_REPO_SLUG);
  url.searchParams.set("_fields", "id");

  const res = await fetch(url.toString(), { headers: REQUEST_HEADERS });
  if (!res.ok) {
    throw new Error(
      `Upstream WP REST returned ${res.status} looking up "${EQUIPMENT_REPO_SLUG}"`,
    );
  }
  const json = (await res.json()) as Array<{ id: number }>;
  const id = json[0]?.id;
  if (!id) {
    throw new Error(`No page found with slug "${EQUIPMENT_REPO_SLUG}"`);
  }
  return id;
}

async function fetchAllEquipmentPages(): Promise<WpPage[]> {
  const parentId = await fetchRepoPageId();

  const pages: WpPage[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(`${WP_API_BASE_URL}/pages`);
    url.searchParams.set("parent", String(parentId));
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));
    url.searchParams.set("orderby", "title");
    url.searchParams.set("order", "asc");
    url.searchParams.set("_fields", "id,slug,link,title,content");

    const res = await fetch(url.toString(), { headers: REQUEST_HEADERS });
    // WordPress 400s once you ask past the last page of results.
    if (res.status === 400 && page > 1) break;
    if (!res.ok) {
      throw new Error(`Upstream WP REST returned ${res.status} listing equipment`);
    }

    const batch = (await res.json()) as WpPage[];
    pages.push(...batch);

    const totalPages = Number(res.headers.get("x-wp-totalpages") ?? "1");
    if (page >= totalPages || batch.length === 0) break;
  }
  return pages;
}

interface CacheEntry {
  data: EquipmentDetail[];
  fetchedAt: number;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<EquipmentDetail[]> | null = null;

function servableStale(): EquipmentDetail[] | null {
  if (cache && Date.now() - cache.fetchedAt < STALE_MAX_MS) return cache.data;
  return null;
}

async function loadEquipment(): Promise<EquipmentDetail[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const pages = await fetchAllEquipmentPages();
      const items = pages.map(toEquipment);
      if (items.length === 0) {
        throw new Error("No equipment items parsed from upstream");
      }
      cache = { data: items, fetchedAt: Date.now() };
      return items;
    } catch (err) {
      const stale = servableStale();
      if (stale) {
        captureWarning("Equipment fetch failed; serving cached copy", {
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

router.get("/equipment", async (req, res) => {
  try {
    const items = await loadEquipment();
    const summaries: EquipmentSummary[] = items.map(
      ({ slug, name, imageUrl }) => ({ slug, name, imageUrl }),
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ items: summaries });
  } catch (err) {
    req.log.error({ err }, "Failed to load equipment");
    captureError(err, { route: "equipment" });
    res.status(502).json({
      error: `Unable to load equipment from ${FESCENTER_HOSTNAME}`,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/equipment/:slug", async (req, res) => {
  try {
    const slug = req.params["slug"];
    const items = await loadEquipment();
    const item = items.find((i) => i.slug === slug);
    if (!item) {
      res.status(404).json({ error: "equipment_not_found" });
      return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ equipment: item });
  } catch (err) {
    req.log.error({ err }, "Failed to load equipment detail");
    captureError(err, { route: "equipment-detail", slug: req.params["slug"] });
    res.status(502).json({
      error: `Unable to load equipment from ${FESCENTER_HOSTNAME}`,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
