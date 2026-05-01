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
