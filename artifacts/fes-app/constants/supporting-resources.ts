export interface ResourceContact {
  name: string;
  /** Optional qualifier some entries carry on the website, e.g. "Regulatory". */
  role?: string;
  /** Empty when the website lists a person without an address. */
  email: string;
}

export interface ResourceCategory {
  id: string;
  title: string;
  contacts: ResourceContact[];
}

/**
 * Cheryl's address, confirmed August 2026. The website has published it three
 * different ways over time — `cheryl.dudek@FEScenter.org` on the project review
 * page, `cdudek@fescenter.org` in the First Tuesday calendar entry, and a
 * `fesinstitute.org` variant elsewhere. This is the one that works; both
 * contacts point here so they cannot drift apart again.
 */
const CHERYL_DUDEK = {
  name: "Cheryl Dudek",
  email: "cdudek@fescenter.org",
};

export const PROJECT_REVIEW_CONTACT = {
  blurb: "Interested in doing a project concept review?",
  cta: "Contact Cheryl Dudek",
  ...CHERYL_DUDEK,
};

/** Speaker sign-ups for First Tuesday. */
export const FIRST_TUESDAY_CONTACT = CHERYL_DUDEK;
