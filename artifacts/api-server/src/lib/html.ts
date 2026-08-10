/**
 * Small HTML/WordPress text helpers shared by the api-server scraping and
 * REST proxy routes. Kept regex-only to avoid pulling in a full DOM parser.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "'",
  rsquo: "'",
  ldquo: "\u201C",
  rdquo: "\u201D",
  laquo: "«",
  raquo: "»",
  copy: "©",
  reg: "®",
  trade: "™",
  middot: "·",
  bull: "•",
};

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_m, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => NAMED_ENTITIES[name] ?? m);
}

/** Removes WPBakery / generic shortcodes like `[vc_row]` and `[/vc_column]`. */
export function stripShortcodes(input: string): string {
  return input.replace(/\[\/?[a-zA-Z][^\]]*\]/g, "");
}

/** Strips HTML tags, decodes entities, collapses whitespace. */
export function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Plain-text version of WordPress rendered content (excerpts, titles). */
export function stripWordPressContent(html: string): string {
  return stripTags(stripShortcodes(html));
}

/**
 * Reduce the executable surface of WordPress HTML before it is handed to a
 * WebView.
 *
 * This is a hedge, not a sanitiser. Regexes cannot parse HTML, and anything
 * relying on this for untrusted input is relying on the wrong thing — the
 * article body renders in a WebView with JavaScript enabled, so a determined
 * author of a post on fescenter.org can still find a way through. What it does
 * buy is that the obvious vectors do not survive a compromised WordPress
 * account or a careless paste from another site.
 *
 * `<iframe>` is deliberately left alone: WordPress posts legitimately embed
 * YouTube and Vimeo, and stripping those would break real articles to defend
 * against an author who could simply publish the payload another way.
 */
export function stripDangerousMarkup(html: string): string {
  return (
    html
      // Closed script blocks, then any unclosed `<script` and everything after
      // it — an unterminated tag would otherwise slip straight through.
      .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
      .replace(/<script\b[\s\S]*$/gi, "")
      // Inline handlers: onclick=, onerror=, onload=… quoted or bare.
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
      .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
      // javascript: and data: URLs in the attributes that navigate or load.
      .replace(
        /\s(href|src|xlink:href)\s*=\s*"\s*(?:javascript|data):[^"]*"/gi,
        "",
      )
      .replace(
        /\s(href|src|xlink:href)\s*=\s*'\s*(?:javascript|data):[^']*'/gi,
        "",
      )
  );
}
