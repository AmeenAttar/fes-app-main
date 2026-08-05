import { describe, expect, it } from "vitest";

import { parseEquipmentParameters, pickEquipmentImage } from "./equipment";

/** Shaped after the real fescenter.org equipmentrepo markup. */
const KINARM_HTML = `
<div class="wp-block-image"><figure class="aligncenter"><img decoding="async" loading="lazy" src="https://fescenter.org/wp-content/uploads/2020/05/KINARM.png" alt="" class="wp-image-1"/></figure></div>
<p class="wp-block-paragraph"><strong>Availability</strong>: Available<br><strong>Location</strong>: B-E238   <br><strong>Contact PI:</strong>   Ahlam Salameh, PhD <br><strong>Contact Email:</strong> <a href="mailto:asalameh@fescenter.org">asalameh@fescenter.org</a><br><strong>Vendor</strong>: BKIN Technologies Ltd<br><strong>Pertinent Capabilities:</strong> Bilateral KINARM Exoskeleton with a KINARM Gaze-Tracker.</p>
`;

describe("parseEquipmentParameters", () => {
  it("extracts label/value pairs regardless of colon placement", () => {
    const params = parseEquipmentParameters(KINARM_HTML);
    expect(params).toEqual([
      { label: "Availability", value: "Available" },
      { label: "Location", value: "B-E238" },
      { label: "Contact PI", value: "Ahlam Salameh, PhD" },
      { label: "Contact Email", value: "asalameh@fescenter.org" },
      { label: "Vendor", value: "BKIN Technologies Ltd" },
      {
        label: "Pertinent Capabilities",
        value: "Bilateral KINARM Exoskeleton with a KINARM Gaze-Tracker.",
      },
    ]);
  });

  it("doesn't fracture a value on inline emphasis with no colon", () => {
    // Real case from srm-cycle-ergometer: "cycle ergometer" is bolded
    // mid-sentence inside the Pertinent Capabilities value, not a new field.
    const html = `<p><strong>Vendor</strong>: SRM Inc.<br><strong>Pertinent Capabilities</strong>: A state-of-the-art <strong>cycle ergometer </strong>is essential for testing.</p>`;
    const params = parseEquipmentParameters(html);
    expect(params).toEqual([
      { label: "Vendor", value: "SRM Inc." },
      {
        label: "Pertinent Capabilities",
        value: "A state-of-the-art cycle ergometer is essential for testing.",
      },
    ]);
  });

  it("tolerates label wording changing between items", () => {
    // Some pages say "Contact PI", others "Contact Person" — both are real
    // fields and both should come through, under whatever name is on the page.
    const html = `<p><strong>Contact Person:</strong> Elizabeth Hardin, PhD</p>`;
    expect(parseEquipmentParameters(html)).toEqual([
      { label: "Contact Person", value: "Elizabeth Hardin, PhD" },
    ]);
  });

  it("picks up a field added on the website with no app changes", () => {
    // The parser has no fixed field list, so a brand-new label just works.
    const html = `<p><strong>Serial Number:</strong> XJ-4471<br><strong>Warranty Expires:</strong> 2027-01-01</p>`;
    expect(parseEquipmentParameters(html)).toEqual([
      { label: "Serial Number", value: "XJ-4471" },
      { label: "Warranty Expires", value: "2027-01-01" },
    ]);
  });

  it("drops a field the website removes, with no error", () => {
    const html = `<p><strong>Availability</strong>: Available<br><strong>Vendor</strong>: Biodex</p>`;
    expect(parseEquipmentParameters(html)).toEqual([
      { label: "Availability", value: "Available" },
      { label: "Vendor", value: "Biodex" },
    ]);
  });

  it("returns an empty list rather than throwing on unstructured content", () => {
    expect(parseEquipmentParameters("<p>Just a plain description.</p>")).toEqual([]);
  });

  it("skips a strong tag with an empty value", () => {
    const html = `<p><strong>Notes:</strong> <br><strong>Vendor</strong>: Biodex</p>`;
    expect(parseEquipmentParameters(html)).toEqual([
      { label: "Vendor", value: "Biodex" },
    ]);
  });
});

describe("pickEquipmentImage", () => {
  it("finds the first on-hostname photo", () => {
    expect(pickEquipmentImage(KINARM_HTML)).toBe(
      "https://fescenter.org/wp-content/uploads/2020/05/KINARM.png",
    );
  });

  it("returns null when the page has no matching image", () => {
    expect(pickEquipmentImage("<p>No photo here.</p>")).toBeNull();
  });
});
