import { describe, expect, it } from "vitest";

import { stripSiteChrome } from "./investigators";

/**
 * Shaped after the real fescenter.org markup: the Complianz banner is a
 * container of nested divs, which is why the stripper has to balance tags
 * rather than match a single element.
 */
const CONSENT_BLOCK = `
<div id="cmplz-cookiebanner-container">
  <div class="cmplz-cookiebanner">
    <div class="cmplz-header"><div class="cmplz-title">Manage Cookie Consent</div></div>
    <div class="cmplz-body">
      <p>To provide the best experiences, we use technologies like cookies.</p>
      <div class="cmplz-category"><p>The technical storage or access is strictly necessary.</p></div>
    </div>
  </div>
</div>`;

describe("stripSiteChrome", () => {
  it("removes the consent banner and everything nested in it", () => {
    const html = `<p>Real bio paragraph about the investigator.</p>${CONSENT_BLOCK}`;
    const out = stripSiteChrome(html);

    expect(out).not.toContain("Manage Cookie Consent");
    expect(out).not.toContain("technical storage or access");
    expect(out).toContain("Real bio paragraph");
  });

  it("leaves surrounding content intact on both sides", () => {
    const html = `<p>Before.</p>${CONSENT_BLOCK}<p>After.</p>`;
    const out = stripSiteChrome(html);

    expect(out).toContain("Before.");
    expect(out).toContain("After.");
    expect(out).not.toContain("cmplz-body");
  });

  it("removes the chat widget footer", () => {
    const html =
      '<p>Bio.</p><div class="chatbot-footer"><p>By chatting, you agree to our privacy policy .</p></div>';
    const out = stripSiteChrome(html);

    expect(out).not.toContain("By chatting");
    expect(out).toContain("Bio.");
  });

  it("removes several chrome containers in one pass", () => {
    const html = `<p>Bio.</p>${CONSENT_BLOCK}<div id="cmplz-manage-consent"><p>Manage consent</p></div>`;
    const out = stripSiteChrome(html);

    expect(out).not.toContain("Manage Cookie Consent");
    expect(out).not.toContain("cmplz-manage-consent");
    expect(out).toContain("Bio.");
  });

  it("is a no-op on pages with no chrome", () => {
    const html = "<p>Just a bio.</p><div class=\"content\"><p>More.</p></div>";
    expect(stripSiteChrome(html)).toBe(html);
  });

  it("drops the tail rather than leaking chrome when markup is unbalanced", () => {
    const html =
      '<p>Bio.</p><div id="cmplz-cookiebanner-container"><p>Manage Cookie Consent</p>';
    const out = stripSiteChrome(html);

    expect(out).not.toContain("Manage Cookie Consent");
    expect(out).toContain("Bio.");
  });
});
