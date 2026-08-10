import { describe, expect, it } from "vitest";

import {
  buildEventDto,
  canonicalizeHttpUrl,
  classifyActionLink,
  decodeBasicHtmlEntities,
  extractDescriptionLinks,
  htmlToText,
  normalizeCalendarHtmlForUrlExtract,
  parseRetryAfterMs,
  pruneBareEvtRootWhenSlugPresent,
  trimUrlTail,
  unfoldIcsText,
} from "./events";

/**
 * This file is the biggest single source of parsing in the codebase and it fed
 * both the events screen and the reminder scheduler with no coverage at all.
 *
 * The failure mode it guards against is not a crash. When Google changes how it
 * emits descriptions, an event still renders — it just quietly loses its RSVP
 * button, or its description arrives full of `&amp;`, and nobody reports it
 * because the screen looks fine.
 */

describe("parseRetryAfterMs", () => {
  it("reads delta-seconds", () => {
    expect(parseRetryAfterMs("120")).toBe(120_000);
    expect(parseRetryAfterMs("  30  ")).toBe(30_000);
  });

  it("accepts zero rather than treating it as absent", () => {
    expect(parseRetryAfterMs("0")).toBe(0);
  });

  it("reads an HTTP date as a delta from now", () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    const ms = parseRetryAfterMs(future);
    expect(ms).not.toBeNull();
    // Second-resolution date string, so allow a little slack.
    expect(ms!).toBeGreaterThan(50_000);
    expect(ms!).toBeLessThanOrEqual(60_000);
  });

  // A date already in the past means "retry now", not "wait a negative time" —
  // a negative back-off would be treated as no cooldown at all.
  it("clamps a past date to zero", () => {
    expect(parseRetryAfterMs(new Date(Date.now() - 60_000).toUTCString())).toBe(0);
  });

  it("returns null for absent or unparseable values", () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs("soon")).toBeNull();
    expect(parseRetryAfterMs("-5")).toBeNull();
  });
});

describe("htmlToText", () => {
  it("strips tags and decodes the entities Google emits", () => {
    expect(htmlToText("<p>Rehab &amp; Robotics</p>")).toBe("Rehab & Robotics");
    expect(htmlToText("a&nbsp;b")).toBe("a b");
    expect(htmlToText("&lt;tag&gt; &quot;q&quot; &#39;s&#39;")).toBe(
      "<tag> \"q\" 's'",
    );
  });

  it("collapses runs of blank lines", () => {
    expect(htmlToText("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  // Empty is meaningfully different from "a description that is whitespace":
  // the DTO treats null as "no description" and renders nothing.
  it("returns null rather than an empty string", () => {
    expect(htmlToText("")).toBeNull();
    expect(htmlToText(null)).toBeNull();
    expect(htmlToText(undefined)).toBeNull();
    expect(htmlToText("   \n  ")).toBeNull();
    expect(htmlToText("<br>")).toBeNull();
  });
});

describe("unfoldIcsText", () => {
  // RFC 5545 folds long lines with CRLF + a single space or tab. Failing to
  // unfold splits URLs in half, which is how RSVP links go missing.
  it("rejoins folded content lines", () => {
    expect(unfoldIcsText("https://evt.to/\r\n abcdef")).toBe(
      "https://evt.to/abcdef",
    );
    expect(unfoldIcsText("https://evt.to/\n\tabcdef")).toBe(
      "https://evt.to/abcdef",
    );
  });

  it("leaves genuine line breaks alone", () => {
    expect(unfoldIcsText("line one\r\nline two")).toBe("line one\r\nline two");
  });
});

describe("normalizeCalendarHtmlForUrlExtract", () => {
  // Google inserts <wbr> and zero-width spaces inside long URLs so they wrap in
  // a browser. Left in place, no URL regex matches them.
  it("removes wbr tags and zero-width spaces", () => {
    expect(
      normalizeCalendarHtmlForUrlExtract("addevent.<wbr />com/e/abc"),
    ).toBe("addevent.com/e/abc");
    expect(normalizeCalendarHtmlForUrlExtract("evt.to/&#8203;xyz")).toBe(
      "evt.to/xyz",
    );
    expect(normalizeCalendarHtmlForUrlExtract("evt.to/​xyz")).toBe(
      "evt.to/xyz",
    );
  });

  it("decodes entities and unfolds in one pass", () => {
    expect(
      normalizeCalendarHtmlForUrlExtract("https://x.test/a&amp;b=1"),
    ).toBe("https://x.test/a&b=1");
  });
});

describe("decodeBasicHtmlEntities", () => {
  it("handles named and numeric forms, case-insensitively", () => {
    expect(decodeBasicHtmlEntities("a&AMP;b")).toBe("a&b");
    expect(decodeBasicHtmlEntities("a&#38;b")).toBe("a&b");
    expect(decodeBasicHtmlEntities("&#47;&#x2F;")).toBe("//");
    expect(decodeBasicHtmlEntities("&lt;b&gt;")).toBe("<b>");
  });
});

describe("trimUrlTail", () => {
  // URLs pasted into prose collect the sentence's punctuation.
  it("strips trailing punctuation and brackets", () => {
    expect(trimUrlTail("https://x.test/a.")).toBe("https://x.test/a");
    expect(trimUrlTail("https://x.test/a),")).toBe("https://x.test/a");
    expect(trimUrlTail("  https://x.test/a;  ")).toBe("https://x.test/a");
  });

  it("does not eat meaningful path characters", () => {
    expect(trimUrlTail("https://x.test/a/b")).toBe("https://x.test/a/b");
    expect(trimUrlTail("https://x.test/a?q=1")).toBe("https://x.test/a?q=1");
  });
});

describe("canonicalizeHttpUrl", () => {
  it("passes through http and https", () => {
    expect(canonicalizeHttpUrl("https://x.test/a")).toBe("https://x.test/a");
    expect(canonicalizeHttpUrl("http://x.test/a")).toBe("http://x.test/a");
  });

  it("upgrades protocol-relative URLs", () => {
    expect(canonicalizeHttpUrl("//x.test/a")).toBe("https://x.test/a");
  });

  // Scheme-less hosts are only accepted for the RSVP providers, because
  // guessing a scheme for arbitrary text would turn prose into links.
  it("adds https for the known RSVP hosts only", () => {
    expect(canonicalizeHttpUrl("evt.to/abc")).toBe("https://evt.to/abc");
    expect(canonicalizeHttpUrl("www.evt.to/abc")).toBe("https://www.evt.to/abc");
    expect(canonicalizeHttpUrl("addevent.com/e/1")).toBe(
      "https://addevent.com/e/1",
    );
    expect(canonicalizeHttpUrl("fes.addevent.com/e/1")).toBe(
      "https://fes.addevent.com/e/1",
    );
    expect(canonicalizeHttpUrl("example.com/page")).toBeNull();
  });

  it("rejects mailto and other schemes", () => {
    expect(canonicalizeHttpUrl("mailto:a@b.test")).toBeNull();
    expect(canonicalizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalizeHttpUrl("ftp://x.test/a")).toBeNull();
  });

  it("rejects empty and malformed input", () => {
    expect(canonicalizeHttpUrl("")).toBeNull();
    expect(canonicalizeHttpUrl("   ")).toBeNull();
    expect(canonicalizeHttpUrl("https://")).toBeNull();
  });
});

describe("classifyActionLink", () => {
  it("recognises RSVP providers", () => {
    expect(classifyActionLink("evt.to", "/abc")).toBe("rsvp");
    expect(classifyActionLink("WWW.EVT.TO", "/abc")).toBe("rsvp");
    expect(classifyActionLink("addevent.com", "/e/1")).toBe("rsvp");
    expect(classifyActionLink("fes.addevent.com", "/e/1")).toBe("rsvp");
  });

  it("recognises meeting providers", () => {
    expect(classifyActionLink("meet.google.com", "/abc-defg")).toBe("meet");
    expect(classifyActionLink("cwru.zoom.us", "/j/123")).toBe("zoom");
    expect(classifyActionLink("zoom.us", "/j/123")).toBe("zoom");
  });

  // Livestream is path-dependent, not just host-dependent.
  it("recognises case.edu livestreams only on the livestream path", () => {
    expect(classifyActionLink("case.edu", "/livestream/x")).toBe("livestream");
    expect(classifyActionLink("blog.case.edu", "/livestream")).toBe("livestream");
    expect(classifyActionLink("case.edu", "/news")).toBe("other");
  });

  it("falls back to other", () => {
    expect(classifyActionLink("example.com", "/")).toBe("other");
    // Guards against a naive endsWith("evt.to") matching a lookalike host.
    expect(classifyActionLink("notevt.to", "/abc")).toBe("other");
  });
});

describe("pruneBareEvtRootWhenSlugPresent", () => {
  // A description often contains both the bare provider root and the real
  // event link. The bare one is a dead end for the user.
  it("drops the bare evt.to root when a slug link exists", () => {
    const out = pruneBareEvtRootWhenSlugPresent([
      { url: "https://evt.to/", kind: "rsvp" },
      { url: "https://evt.to/real-event", kind: "rsvp" },
    ]);
    expect(out.map((l) => l.url)).toEqual(["https://evt.to/real-event"]);
  });

  it("keeps the bare root when it is the only RSVP link", () => {
    const out = pruneBareEvtRootWhenSlugPresent([
      { url: "https://evt.to/", kind: "rsvp" },
    ]);
    expect(out.map((l) => l.url)).toEqual(["https://evt.to/"]);
  });

  it("never touches non-RSVP links", () => {
    const out = pruneBareEvtRootWhenSlugPresent([
      { url: "https://evt.to/", kind: "rsvp" },
      { url: "https://evt.to/real", kind: "rsvp" },
      { url: "https://meet.google.com/x", kind: "meet" },
    ]);
    expect(out.map((l) => l.url)).toContain("https://meet.google.com/x");
  });
});

describe("extractDescriptionLinks", () => {
  it("finds links in href attributes and in plain text", () => {
    const blob = `<a href="https://cwru.zoom.us/j/1">join</a> or visit https://example.com/info`;
    expect(extractDescriptionLinks(blob).map((l) => l.url)).toEqual([
      "https://cwru.zoom.us/j/1",
      "https://example.com/info",
    ]);
  });

  it("finds scheme-less RSVP links", () => {
    const out = extractDescriptionLinks("RSVP at evt.to/lab-meeting today");
    expect(out).toEqual([{ url: "https://evt.to/lab-meeting", kind: "rsvp" }]);
  });

  // The same URL usually appears both as an href and as the anchor's text.
  it("deduplicates a URL that appears twice", () => {
    const blob = `<a href="https://evt.to/x">https://evt.to/x</a>`;
    expect(extractDescriptionLinks(blob)).toHaveLength(1);
  });

  // Ordering is what decides which button the app shows first, and which URL
  // becomes addEventUrl.
  it("orders RSVP first, then meet, zoom, livestream, other", () => {
    const blob = [
      "https://example.com/other",
      "https://case.edu/livestream/a",
      "https://cwru.zoom.us/j/1",
      "https://meet.google.com/abc",
      "https://evt.to/rsvp",
    ].join(" ");
    expect(extractDescriptionLinks(blob).map((l) => l.kind)).toEqual([
      "rsvp",
      "meet",
      "zoom",
      "livestream",
      "other",
    ]);
  });

  it("caps the number of links", () => {
    const blob = Array.from(
      { length: 20 },
      (_, i) => `https://example.com/p${i}`,
    ).join(" ");
    expect(extractDescriptionLinks(blob).length).toBeLessThanOrEqual(6);
  });

  it("returns nothing for text with no links", () => {
    expect(extractDescriptionLinks("Bring your own lunch.")).toEqual([]);
  });

  it("ignores mailto links", () => {
    const out = extractDescriptionLinks(
      `<a href="mailto:cdudek@fescenter.org">email</a>`,
    );
    expect(out).toEqual([]);
  });
});

describe("buildEventDto", () => {
  const base = {
    id: "e1",
    uid: "uid-1",
    title: "First Tuesday",
    location: null,
    start: "2026-09-01T20:00:00.000Z",
    end: "2026-09-01T21:00:00.000Z",
    allDay: false,
  };

  it("derives description, links and addEventUrl from the raw description", () => {
    const dto = buildEventDto({
      ...base,
      rawDescription: `<p>Talk &amp; discussion.</p> RSVP: evt.to/first-tuesday`,
    });

    expect(dto.description).toBe("Talk & discussion. RSVP: evt.to/first-tuesday");
    expect(dto.addEventUrl).toBe("https://evt.to/first-tuesday");
    expect(dto.actionLinks).toEqual([
      { url: "https://evt.to/first-tuesday", kind: "rsvp" },
    ]);
  });

  // The location field carries links often enough to be worth scanning.
  it("also scans the location for links", () => {
    const dto = buildEventDto({
      ...base,
      rawDescription: undefined,
      location: "https://meet.google.com/abc-defg",
    });
    expect(dto.actionLinks.map((l) => l.kind)).toEqual(["meet"]);
  });

  // addEventUrl drives the "Add to calendar" affordance; a meeting link there
  // would send people to a video call instead of an RSVP page.
  it("leaves addEventUrl null when no RSVP link exists", () => {
    const dto = buildEventDto({
      ...base,
      rawDescription: "Join at https://cwru.zoom.us/j/1",
    });
    expect(dto.addEventUrl).toBeNull();
    expect(dto.actionLinks.map((l) => l.kind)).toEqual(["zoom"]);
  });

  it("handles an event with no description or location", () => {
    const dto = buildEventDto({ ...base, rawDescription: undefined });
    expect(dto.description).toBeNull();
    expect(dto.actionLinks).toEqual([]);
    expect(dto.addEventUrl).toBeNull();
    expect(dto.title).toBe("First Tuesday");
  });

  it("preserves the timing fields it is given", () => {
    const dto = buildEventDto({ ...base, rawDescription: undefined, allDay: true });
    expect(dto.start).toBe(base.start);
    expect(dto.end).toBe(base.end);
    expect(dto.allDay).toBe(true);
  });
});
