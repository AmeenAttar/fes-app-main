import { describe, expect, it } from "vitest";

import {
  decodeHtmlEntities,
  stripDangerousMarkup,
  stripShortcodes,
  stripTags,
  stripWordPressContent,
} from "./html";

/**
 * These run over every news title, excerpt and article body. A regression here
 * shows up as `&amp;` in a headline or a stray `[vc_row]` in an excerpt —
 * cosmetic, visible to every user, and reported by nobody.
 */

describe("decodeHtmlEntities", () => {
  it("decodes the named entities WordPress emits", () => {
    expect(decodeHtmlEntities("Rehab &amp; Robotics")).toBe("Rehab & Robotics");
    expect(decodeHtmlEntities("&lt;tag&gt;")).toBe("<tag>");
    expect(decodeHtmlEntities("a&nbsp;b")).toBe("a b");
    expect(decodeHtmlEntities("&hellip;")).toBe("…");
    expect(decodeHtmlEntities("&mdash;&ndash;")).toBe("—–");
  });

  it("decodes decimal and hex numeric entities", () => {
    expect(decodeHtmlEntities("&#38;")).toBe("&");
    expect(decodeHtmlEntities("&#x26;")).toBe("&");
    expect(decodeHtmlEntities("&#8217;")).toBe("’");
  });

  // Smart quotes are the most common thing in a WordPress headline.
  it("decodes curly quotes", () => {
    expect(decodeHtmlEntities("&lsquo;a&rsquo;")).toBe("'a'");
    expect(decodeHtmlEntities("&ldquo;a&rdquo;")).toBe("“a”");
  });

  // Leaving an unknown entity alone is better than emitting an empty string:
  // the text stays readable and the gap is obvious.
  it("leaves unknown entities untouched", () => {
    expect(decodeHtmlEntities("&notanentity;")).toBe("&notanentity;");
  });

  it("handles text with no entities", () => {
    expect(decodeHtmlEntities("plain text")).toBe("plain text");
    expect(decodeHtmlEntities("")).toBe("");
  });
});

describe("stripShortcodes", () => {
  it("removes WPBakery opening and closing shortcodes", () => {
    expect(stripShortcodes("[vc_row][vc_column]Hi[/vc_column][/vc_row]")).toBe(
      "Hi",
    );
  });

  it("removes shortcodes carrying attributes", () => {
    expect(stripShortcodes('[caption id="x" align="left"]Photo[/caption]')).toBe(
      "Photo",
    );
  });

  // Square brackets in prose are not shortcodes.
  it("leaves bracketed prose alone", () => {
    expect(stripShortcodes("see [1] and [2]")).toBe("see [1] and [2]");
  });
});

describe("stripTags", () => {
  it("removes tags, decodes entities and collapses whitespace", () => {
    expect(stripTags("<p>Hello   <b>world</b></p>")).toBe("Hello world");
    expect(stripTags("<p>a &amp; b</p>")).toBe("a & b");
  });

  // Tags become a space, not nothing — otherwise "<b>a</b><b>b</b>" reads "ab".
  it("does not run adjacent words together", () => {
    expect(stripTags("<span>one</span><span>two</span>")).toBe("one two");
  });

  it("trims and handles empty input", () => {
    expect(stripTags("   <p>  x  </p>   ")).toBe("x");
    expect(stripTags("")).toBe("");
  });
});

describe("stripWordPressContent", () => {
  it("removes shortcodes and tags together", () => {
    expect(
      stripWordPressContent("[vc_row]<p>FES &amp; Robotics</p>[/vc_row]"),
    ).toBe("FES & Robotics");
  });
});

/**
 * A hedge rather than a sanitiser — the article body renders in a WebView with
 * JavaScript enabled, and regexes cannot parse HTML. These cases pin the
 * obvious vectors so a compromised WordPress account or a careless paste does
 * not sail straight through.
 */
describe("stripDangerousMarkup", () => {
  it("removes closed script blocks", () => {
    expect(stripDangerousMarkup("<p>a</p><script>alert(1)</script><p>b</p>")).toBe(
      "<p>a</p><p>b</p>",
    );
    expect(stripDangerousMarkup('<SCRIPT SRC="x.js"></SCRIPT>')).toBe("");
  });

  // An unterminated tag previously survived intact, because the original
  // pattern required a closing tag to match.
  it("removes an unclosed script tag and everything after it", () => {
    expect(stripDangerousMarkup("<p>a</p><script>alert(1)")).toBe("<p>a</p>");
  });

  it("removes inline event handlers, quoted or bare", () => {
    expect(stripDangerousMarkup(`<img src="x.png" onerror="alert(1)">`)).toBe(
      `<img src="x.png">`,
    );
    expect(stripDangerousMarkup(`<div onclick='steal()'>x</div>`)).toBe(
      `<div>x</div>`,
    );
    expect(stripDangerousMarkup(`<body onload=alert(1)>`)).toBe(`<body>`);
    expect(stripDangerousMarkup(`<a ONMOUSEOVER="x()">l</a>`)).toBe(`<a>l</a>`);
  });

  it("removes javascript: and data: URLs", () => {
    expect(stripDangerousMarkup(`<a href="javascript:alert(1)">x</a>`)).toBe(
      `<a>x</a>`,
    );
    expect(stripDangerousMarkup(`<a href=' javascript:x()'>x</a>`)).toBe(
      `<a>x</a>`,
    );
    expect(stripDangerousMarkup(`<iframe src="data:text/html,<b>x</b>">`)).toBe(
      `<iframe>`,
    );
  });

  // Removing iframes would break legitimate YouTube and Vimeo embeds, which
  // real articles use.
  it("keeps ordinary embeds and links intact", () => {
    const ok = `<iframe src="https://www.youtube.com/embed/abc" allowfullscreen></iframe>`;
    expect(stripDangerousMarkup(ok)).toBe(ok);

    const link = `<a href="https://fescenter.org/news/1">Read more</a>`;
    expect(stripDangerousMarkup(link)).toBe(link);
  });

  // "on" appears inside plenty of legitimate attribute names and content.
  it("does not mangle attributes that merely start with on", () => {
    const html = `<p class="one" data-only="x">online</p>`;
    expect(stripDangerousMarkup(html)).toBe(html);
  });

  it("leaves clean markup unchanged", () => {
    const html = `<h2>Title</h2><p>Body with <em>emphasis</em>.</p>`;
    expect(stripDangerousMarkup(html)).toBe(html);
  });
});
