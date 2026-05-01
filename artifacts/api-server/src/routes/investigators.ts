import { Router, type IRouter } from "express";
import { INVESTIGATORS_LIST_URL } from "../lib/config";
import { decodeHtmlEntities, stripTags } from "../lib/html";

const router: IRouter = Router();

const SOURCE_URL = INVESTIGATORS_LIST_URL;
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

interface Investigator {
  slug: string;
  name: string;
  photoUrl: string | null;
  detailUrl: string;
}

interface InvestigatorDetail extends Investigator {
  title: string | null;
  bio: string[];
  heroImageUrl: string | null;
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const listCache = new Map<string, CacheEntry<Investigator[]>>();
const detailCache = new Map<string, CacheEntry<InvestigatorDetail>>();

function extractSlug(detailUrl: string): string {
  const m = detailUrl.match(/\/([^/]+)\/?$/);
  return m ? m[1] : detailUrl;
}

function parseInvestigators(html: string): Investigator[] {
  const results: Investigator[] = [];
  const personRegex = /<div class="person">([\s\S]*?)<\/div>/g;
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = personRegex.exec(html)) !== null) {
    const block = match[1];

    const linkMatch = block.match(/<div class="person-name">\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    const imgMatch = block.match(/<img[^>]+class="peoplephoto"[^>]+src="([^"]+)"/);

    if (!linkMatch) continue;

    const detailUrl = linkMatch[1];
    const rawName = decodeHtmlEntities(linkMatch[2]).trim();
    const slug = extractSlug(detailUrl);

    if (seen.has(slug)) continue;
    seen.add(slug);

    results.push({
      slug,
      name: rawName,
      photoUrl: imgMatch ? imgMatch[1] : null,
      detailUrl,
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

function parseInvestigatorDetail(
  html: string,
  base: Investigator,
): InvestigatorDetail {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const pageTitle = titleMatch
    ? decodeHtmlEntities(titleMatch[1])
        .replace(/\s*[–-]\s*Cleveland FES Center\s*$/i, "")
        .trim()
    : base.name;

  // Hero image: first uploaded image that isn't a logo, favicon, or icon
  const imgRegex = /<img[^>]+src="(https:\/\/fescenter\.org\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi;
  let heroImageUrl: string | null = null;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const url = imgMatch[1];
    if (/logo|favicon|icon/i.test(url)) continue;
    heroImageUrl = url;
    break;
  }
  if (!heroImageUrl) heroImageUrl = base.photoUrl;

  // Bio paragraphs from <p> tags inside the page; filter out footer/contact text
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
  const bio: string[] = [];
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(html)) !== null) {
    const text = stripTags(pMatch[1]);
    if (text.length < 30) continue;
    if (/Cleveland FES Center Operations/i.test(text)) continue;
    if (/info@fescenter\.org/i.test(text)) continue;
    if (/^Copyright/i.test(text)) continue;
    if (/All Rights Reserved/i.test(text)) continue;
    if (bio.includes(text)) continue;
    bio.push(text);
  }

  // First paragraph is often the academic title
  let title: string | null = null;
  if (bio.length > 0 && bio[0].length < 220 && /\b(Professor|Director|Chief|Chairman|Chair|Associate|Assistant|Fellow|Lecturer|Investigator|Scientist|Engineer|Resident|Coordinator|Specialist)\b/i.test(bio[0])) {
    title = bio.shift() ?? null;
  }

  return {
    ...base,
    name: pageTitle || base.name,
    title,
    bio,
    heroImageUrl,
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) {
    throw new Error(`Upstream fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

router.get("/investigators", async (req, res) => {
  try {
    const cached = listCache.get(SOURCE_URL);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      res.json({ investigators: cached.data, cached: true });
      return;
    }

    const html = await fetchHtml(SOURCE_URL);
    const investigators = parseInvestigators(html);

    if (investigators.length === 0) {
      throw new Error("No investigators parsed from upstream HTML");
    }

    listCache.set(SOURCE_URL, { data: investigators, fetchedAt: Date.now() });
    res.json({ investigators, cached: false });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch investigators");
    res.status(502).json({
      error: "Unable to load investigators from fescenter.org",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/investigators/:slug", async (req, res) => {
  try {
    const slug = req.params["slug"];

    // Make sure we have the list (so we can resolve the detail URL & base info)
    let list = listCache.get(SOURCE_URL);
    if (!list || Date.now() - list.fetchedAt >= CACHE_TTL_MS) {
      const html = await fetchHtml(SOURCE_URL);
      const parsed = parseInvestigators(html);
      list = { data: parsed, fetchedAt: Date.now() };
      listCache.set(SOURCE_URL, list);
    }

    const base = list.data.find((p) => p.slug === slug);
    if (!base) {
      res.status(404).json({ error: "Investigator not found" });
      return;
    }

    const cached = detailCache.get(slug);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      res.json({ investigator: cached.data, cached: true });
      return;
    }

    const html = await fetchHtml(base.detailUrl);
    const detail = parseInvestigatorDetail(html, base);
    detailCache.set(slug, { data: detail, fetchedAt: Date.now() });
    res.json({ investigator: detail, cached: false });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch investigator detail");
    res.status(502).json({
      error: "Unable to load investigator detail from fescenter.org",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
