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

export const PROJECT_REVIEW_CONTACT = {
  blurb: "Interested in doing a project concept review?",
  cta: "Contact Cheryl Dudek",
  name: "Cheryl Dudek",
  email: "cheryl.dudek@FEScenter.org",
};

/**
 * Speaker sign-ups for First Tuesday. Separate from
 * {@link PROJECT_REVIEW_CONTACT} because the address differs: this one matches
 * what the Center publishes in the calendar entry for the meeting.
 */
export const FIRST_TUESDAY_CONTACT = {
  name: "Cheryl Dudek",
  email: "cdudek@fescenter.org",
};
