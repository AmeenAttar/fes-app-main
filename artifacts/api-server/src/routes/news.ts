import { Router, type IRouter } from "express";

import { FESCENTER_HOSTNAME, WP_API_BASE_URL } from "../lib/config";
import {
  stripDangerousMarkup,
  stripShortcodes,
  stripWordPressContent,
} from "../lib/html";

const router: IRouter = Router();

const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 20;
const CACHE_TTL_MS = 5 * 60 * 1000;

const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

export interface NewsItem {
  id: number;
  title: string;
  excerpt: string;
  link: string;
  date: string;
  featuredImageUrl: string | null;
  categories: string[];
}

export interface NewsPageResponse {
  items: NewsItem[];
  page: number;
  totalPages: number;
  total: number;
}

interface WpRendered {
  rendered?: string;
}

interface WpEmbeddedTerm {
  taxonomy?: string;
  name?: string;
}

interface WpFeaturedMedia {
  source_url?: string;
  code?: string;
}

interface WpPost {
  id: number;
  date: string;
  link: string;
  title: WpRendered;
  excerpt: WpRendered;
  content?: WpRendered;
  _embedded?: {
    "wp:featuredmedia"?: WpFeaturedMedia[];
    "wp:term"?: WpEmbeddedTerm[][];
  };
}

interface CacheEntry {
  data: NewsPageResponse;
  fetchedAt: number;
}

const pageCache = new Map<string, CacheEntry>();

export interface NewsArticleResponse {
  id: number;
  title: string;
  excerpt: string;
  /** Sanitized snippet of post body for optional native preview elsewhere. */
  contentHtml: string;
  date: string;
  canonicalLink: string;
  featuredImageUrl: string | null;
  categories: string[];
}

interface DetailCacheEntry {
  data: NewsArticleResponse;
  fetchedAt: number;
}

const detailCache = new Map<number, DetailCacheEntry>();

function toArticleResponse(post: WpPost): NewsArticleResponse {
  const rawHtml = stripShortcodes(post.content?.rendered ?? "");
  return {
    id: post.id,
    title: stripWordPressContent(post.title?.rendered ?? ""),
    excerpt: stripWordPressContent(post.excerpt?.rendered ?? ""),
    contentHtml: stripDangerousMarkup(rawHtml),
    date: post.date,
    canonicalLink: post.link,
    featuredImageUrl: pickFeaturedImage(post._embedded?.["wp:featuredmedia"]),
    categories: pickCategoryNames(post._embedded?.["wp:term"]),
  };
}

function clampPerPage(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PER_PAGE;
  return Math.min(Math.floor(n), MAX_PER_PAGE);
}

function clampPage(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function pickFeaturedImage(media: WpFeaturedMedia[] | undefined): string | null {
  if (!media || media.length === 0) return null;
  const first = media[0];
  if (!first || first.code) return null;
  return typeof first.source_url === "string" ? first.source_url : null;
}

function pickCategoryNames(
  termGroups: WpEmbeddedTerm[][] | undefined,
): string[] {
  if (!termGroups) return [];
  const names: string[] = [];
  for (const group of termGroups) {
    for (const term of group) {
      if (term.taxonomy === "category" && typeof term.name === "string") {
        names.push(term.name);
      }
    }
  }
  return names;
}

function toNewsItem(post: WpPost): NewsItem {
  return {
    id: post.id,
    title: stripWordPressContent(post.title?.rendered ?? ""),
    excerpt: stripWordPressContent(post.excerpt?.rendered ?? ""),
    link: post.link,
    date: post.date,
    featuredImageUrl: pickFeaturedImage(post._embedded?.["wp:featuredmedia"]),
    categories: pickCategoryNames(post._embedded?.["wp:term"]),
  };
}

router.get("/news", async (req, res) => {
  const page = clampPage(req.query["page"]);
  const perPage = clampPerPage(req.query["perPage"]);
  const cacheKey = `${page}:${perPage}`;

  const cached = pageCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "private, no-store");
    res.json(cached.data);
    return;
  }

  const url = new URL(`${WP_API_BASE_URL}/posts`);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("_embed", "true");
  url.searchParams.set(
    "_fields",
    "id,date,link,title,excerpt,_links,_embedded",
  );

  try {
    const upstream = await fetch(url.toString(), { headers: REQUEST_HEADERS });

    // WordPress returns 400 with code "rest_post_invalid_page_number" once we
    // ask for a page beyond the last one. Treat that as an empty page rather
    // than an error so infinite scroll terminates cleanly.
    if (upstream.status === 400) {
      const body: NewsPageResponse = {
        items: [],
        page,
        totalPages: page - 1,
        total: 0,
      };
      pageCache.set(cacheKey, { data: body, fetchedAt: Date.now() });
      res.setHeader("Cache-Control", "private, no-store");
      res.json(body);
      return;
    }

    if (!upstream.ok) {
      throw new Error(
        `Upstream WP REST returned ${upstream.status} ${upstream.statusText}`,
      );
    }

    const totalPages = Number(upstream.headers.get("x-wp-totalpages") ?? "0");
    const total = Number(upstream.headers.get("x-wp-total") ?? "0");
    const posts = (await upstream.json()) as WpPost[];

    const body: NewsPageResponse = {
      items: posts.map(toNewsItem),
      page,
      totalPages: Number.isFinite(totalPages) ? totalPages : 0,
      total: Number.isFinite(total) ? total : 0,
    };

    pageCache.set(cacheKey, { data: body, fetchedAt: Date.now() });
    res.setHeader("Cache-Control", "private, no-store");
    res.json(body);
  } catch (err) {
    req.log.error({ err, url: url.toString() }, "Failed to fetch news");
    res.status(502).json({
      error: `Unable to load news from ${FESCENTER_HOSTNAME}`,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/news/:postId", async (req, res) => {
  const rawId = req.params["postId"];
  if (!rawId || !/^\d+$/.test(rawId)) {
    res.status(404).json({ error: "news_not_found" });
    return;
  }
  const postId = Number(rawId);

  const cached = detailCache.get(postId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ article: cached.data });
    return;
  }

  const url = new URL(`${WP_API_BASE_URL}/posts/${postId}`);
  url.searchParams.set("_embed", "true");
  url.searchParams.set(
    "_fields",
    "id,date,link,title,excerpt,content,_links,_embedded",
  );

  try {
    const upstream = await fetch(url.toString(), { headers: REQUEST_HEADERS });

    if (upstream.status === 404) {
      res.status(404).json({ error: "news_not_found" });
      return;
    }

    if (!upstream.ok) {
      throw new Error(
        `Upstream WP REST returned ${upstream.status} ${upstream.statusText}`,
      );
    }

    const post = (await upstream.json()) as WpPost;
    const article = toArticleResponse(post);
    detailCache.set(postId, { data: article, fetchedAt: Date.now() });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ article });
  } catch (err) {
    req.log.error({ err, url: url.toString() }, "Failed to fetch news detail");
    res.status(502).json({
      error: `Unable to load article from ${FESCENTER_HOSTNAME}`,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
