import { describe, expect, it } from "vitest";

import { parseSupportingResources } from "./supporting-resources";

/** Shaped after the real fescenter.org/supporting-resources markup. */
const PAGE_HTML = `
<div class="wpb-content-wrapper"><p>[vc_row][vc_column][vc_column_text css=&#8221;&#8221;]</p>
<h2>Supporting Resources</h2>
<h3>Budgets / Purchasing</h3>
<ul>
<li>Shantay Hill | <a href="mailto:shill@FEScenter.org">shill@FEScenter.org</a></li>
</ul>
<h3>Communications / Media Relations</h3>
<ul>
<li>Mary Buckett | <a href="mailto:mbuckett@FEScenter.org">mbuckett@FEScenter.org</a></li>
<li>Erika Woodrum, CMI | <a href="mailto:ewoodrum@FEScenter.org">ewoodrum@FEScenter.org</a></li>
</ul>
<h3>FDA Support Core</h3>
<ul>
<li>Jenna Arlow, MS, CCRC | Regulatory | <a href="mailto:FDASupportCore@uhhospitals.org">FDASupportCore@uhhospitals.org</a></li>
</ul>
<p>[/vc_column_text][/vc_column][/vc_row]</p>
</div>`;

describe("parseSupportingResources", () => {
  it("reads each h3 as a section with its list items as contacts", () => {
    const categories = parseSupportingResources(PAGE_HTML);
    expect(categories.map((c) => c.title)).toEqual([
      "Budgets / Purchasing",
      "Communications / Media Relations",
      "FDA Support Core",
    ]);
    expect(categories[0]?.contacts).toEqual([
      { name: "Shantay Hill", email: "shill@FEScenter.org" },
    ]);
  });

  it("keeps several contacts under one section", () => {
    const categories = parseSupportingResources(PAGE_HTML);
    expect(categories[1]?.contacts).toEqual([
      { name: "Mary Buckett", email: "mbuckett@FEScenter.org" },
      { name: "Erika Woodrum, CMI", email: "ewoodrum@FEScenter.org" },
    ]);
  });

  it("picks up the optional middle qualifier when an entry has one", () => {
    const categories = parseSupportingResources(PAGE_HTML);
    expect(categories[2]?.contacts[0]).toEqual({
      name: "Jenna Arlow, MS, CCRC",
      role: "Regulatory",
      email: "FDASupportCore@uhhospitals.org",
    });
  });

  it("ignores the h2 page title, taking only h3 sections", () => {
    const titles = parseSupportingResources(PAGE_HTML).map((c) => c.title);
    expect(titles).not.toContain("Supporting Resources");
  });

  it("picks up a section added to the page with no app change", () => {
    const html = `${PAGE_HTML}<h3>Grant Writing</h3><ul><li>New Person | <a href="mailto:new@fescenter.org">new@fescenter.org</a></li></ul>`;
    const categories = parseSupportingResources(html);
    expect(categories.at(-1)).toEqual({
      id: "grant-writing",
      title: "Grant Writing",
      contacts: [{ name: "New Person", email: "new@fescenter.org" }],
    });
  });

  it("handles a bare email with no mailto link", () => {
    const html = `<h3>Statistics</h3><ul><li>Jane Doe | jane@case.edu</li></ul>`;
    expect(parseSupportingResources(html)[0]?.contacts).toEqual([
      { name: "Jane Doe", email: "jane@case.edu" },
    ]);
  });

  it("keeps a contact listed without an address", () => {
    const html = `<h3>Front Desk</h3><ul><li>Reception</li></ul>`;
    expect(parseSupportingResources(html)[0]?.contacts).toEqual([
      { name: "Reception", email: "" },
    ]);
  });

  it("drops a section whose list is empty", () => {
    const html = `<h3>Vacant</h3><ul></ul><h3>Staffed</h3><ul><li>A | a@b.co</li></ul>`;
    expect(parseSupportingResources(html).map((c) => c.title)).toEqual([
      "Staffed",
    ]);
  });

  it("returns an empty list rather than throwing on unrelated markup", () => {
    expect(parseSupportingResources("<p>Nothing here.</p>")).toEqual([]);
  });
});
