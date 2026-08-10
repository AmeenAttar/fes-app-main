import { describe, expect, it } from "vitest";

import {
  clampPage,
  clampPerPage,
  pickCategoryNames,
  pickFeaturedImage,
  toArticleResponse,
  toNewsItem,
} from "./news";

/**
 * `toNewsItem` decides what the news list shows *and* what a push notification
 * says, so a regression here reaches people's lock screens rather than just a
 * screen they chose to open.
 *
 * The pagination clamps are the API's only guard against a caller asking for
 * page -1 or 10,000 items, and WordPress's `_embedded` block is optional at
 * every level — the shapes below are all ones the live API actually returns.
 */

const post = (over: Record<string, unknown> = {}) => ({
  id: 42,
  date: "2026-02-26T10:55:56",
  link: "https://fescenter.org/news/pilot-awards/",
  title: { rendered: "Pilot Research &amp; Funding Awards" },
  excerpt: { rendered: "<p>Congratulations to&nbsp;the recipients.</p>" },
  content: { rendered: "<p>Body</p>" },
  ...over,
});

describe("clampPerPage", () => {
  it("accepts values in range", () => {
    expect(clampPerPage(5)).toBe(5);
    expect(clampPerPage("7")).toBe(7);
  });

  it("caps at the maximum", () => {
    expect(clampPerPage(1000)).toBe(20);
    expect(clampPerPage(21)).toBe(20);
  });

  // A caller sending nothing, junk, or a hostile value gets the default rather
  // than an error or an unbounded query against WordPress.
  it("falls back to the default for junk", () => {
    expect(clampPerPage(undefined)).toBe(10);
    expect(clampPerPage("abc")).toBe(10);
    expect(clampPerPage(0)).toBe(10);
    expect(clampPerPage(-5)).toBe(10);
    expect(clampPerPage(NaN)).toBe(10);
  });

  it("truncates fractions rather than passing them upstream", () => {
    expect(clampPerPage(5.9)).toBe(5);
  });
});

describe("clampPage", () => {
  it("accepts a page number", () => {
    expect(clampPage(3)).toBe(3);
    expect(clampPage("4")).toBe(4);
  });

  it("floors anything below one", () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-2)).toBe(1);
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage("abc")).toBe(1);
  });

  it("truncates fractions", () => {
    expect(clampPage(2.7)).toBe(2);
  });
});

describe("pickFeaturedImage", () => {
  it("returns the first image URL", () => {
    expect(pickFeaturedImage([{ source_url: "https://x.test/a.jpg" }])).toBe(
      "https://x.test/a.jpg",
    );
  });

  // WordPress returns an error-shaped object here when the attachment is gone,
  // and its `source_url` is absent — rendering that would give a broken image.
  it("returns null for an error entry", () => {
    expect(
      pickFeaturedImage([{ code: "rest_post_invalid_id" }]),
    ).toBeNull();
  });

  it("returns null when absent or empty", () => {
    expect(pickFeaturedImage(undefined)).toBeNull();
    expect(pickFeaturedImage([])).toBeNull();
    expect(pickFeaturedImage([{}])).toBeNull();
  });
});

describe("pickCategoryNames", () => {
  // `wp:term` is an array of arrays: categories, tags, and any custom
  // taxonomy, all mixed together.
  it("takes category names and ignores other taxonomies", () => {
    expect(
      pickCategoryNames([
        [
          { taxonomy: "category", name: "Awards" },
          { taxonomy: "post_tag", name: "ignored" },
        ],
        [{ taxonomy: "category", name: "Research" }],
      ]),
    ).toEqual(["Awards", "Research"]);
  });

  it("returns an empty array when absent or malformed", () => {
    expect(pickCategoryNames(undefined)).toEqual([]);
    expect(pickCategoryNames([])).toEqual([]);
    expect(pickCategoryNames([[{ taxonomy: "category" }]])).toEqual([]);
  });
});

describe("toNewsItem", () => {
  it("decodes entities in the title and excerpt", () => {
    const item = toNewsItem(post() as never);
    expect(item.title).toBe("Pilot Research & Funding Awards");
    expect(item.excerpt).toBe("Congratulations to the recipients.");
  });

  it("carries id, link and date through unchanged", () => {
    const item = toNewsItem(post() as never);
    expect(item.id).toBe(42);
    expect(item.link).toBe("https://fescenter.org/news/pilot-awards/");
    expect(item.date).toBe("2026-02-26T10:55:56");
  });

  it("survives a post with no embedded block", () => {
    const item = toNewsItem(post() as never);
    expect(item.featuredImageUrl).toBeNull();
    expect(item.categories).toEqual([]);
  });

  it("reads the embedded image and categories when present", () => {
    const item = toNewsItem(
      post({
        _embedded: {
          "wp:featuredmedia": [{ source_url: "https://x.test/hero.jpg" }],
          "wp:term": [[{ taxonomy: "category", name: "Awards" }]],
        },
      }) as never,
    );
    expect(item.featuredImageUrl).toBe("https://x.test/hero.jpg");
    expect(item.categories).toEqual(["Awards"]);
  });

  // A missing title would otherwise render "undefined" in the list and in a
  // notification.
  it("degrades to an empty string rather than undefined", () => {
    const item = toNewsItem({
      id: 1,
      date: "2026-01-01T00:00:00",
      link: "https://x.test",
      title: {},
      excerpt: {},
    } as never);
    expect(item.title).toBe("");
    expect(item.excerpt).toBe("");
  });
});

describe("toArticleResponse", () => {
  it("returns plain-text title and excerpt but keeps body HTML", () => {
    const a = toArticleResponse(
      post({ content: { rendered: "<p>Real <em>body</em></p>" } }) as never,
    );
    expect(a.title).toBe("Pilot Research & Funding Awards");
    expect(a.contentHtml).toBe("<p>Real <em>body</em></p>");
  });

  it("strips shortcodes from the body before it reaches the WebView", () => {
    const a = toArticleResponse(
      post({ content: { rendered: "[vc_row]<p>Body</p>[/vc_row]" } }) as never,
    );
    expect(a.contentHtml).toBe("<p>Body</p>");
  });

  // The body is rendered in a WebView with JavaScript enabled, so this is the
  // last point at which executable markup can be removed.
  it("removes scripts and inline handlers from the body", () => {
    const a = toArticleResponse(
      post({
        content: {
          rendered: `<p>ok</p><script>alert(1)</script><img src="x" onerror="alert(2)">`,
        },
      }) as never,
    );
    expect(a.contentHtml).not.toContain("<script");
    expect(a.contentHtml).not.toContain("onerror");
    expect(a.contentHtml).toContain("<p>ok</p>");
  });

  it("handles a post with no content block", () => {
    const a = toArticleResponse(post({ content: undefined }) as never);
    expect(a.contentHtml).toBe("");
  });

  it("exposes the canonical link for the open-in-browser action", () => {
    const a = toArticleResponse(post() as never);
    expect(a.canonicalLink).toBe("https://fescenter.org/news/pilot-awards/");
  });
});
