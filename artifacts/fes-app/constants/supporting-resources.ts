export interface ResourceContact {
  name: string;
  email: string;
}

export interface ResourceCategory {
  id: string;
  title: string;
  contacts: ResourceContact[];
}

export const SUPPORTING_RESOURCES: ResourceCategory[] = [
  {
    id: "budgets-purchasing",
    title: "Budgets / Purchasing",
    contacts: [{ name: "Shantay Hill", email: "shill@FEScenter.org" }],
  },
  {
    id: "medical-illustration",
    title: "Medical Illustration",
    contacts: [{ name: "Erika Woodrum, CMI", email: "ewoodrum@FEScenter.org" }],
  },
  {
    id: "communications",
    title: "Communications / Media Relations",
    contacts: [
      { name: "Mary Buckett", email: "mbuckett@FEScenter.org" },
      { name: "Erika Woodrum, CMI", email: "ewoodrum@FEScenter.org" },
    ],
  },
  {
    id: "event-planning",
    title: "Event Planning",
    contacts: [
      { name: "Mary Buckett", email: "mbuckett@FEScenter.org" },
      { name: "Erika Woodrum, CMI", email: "ewoodrum@FEScenter.org" },
    ],
  },
  {
    id: "technical-writing",
    title: "Technical Writing",
    contacts: [{ name: "Rebecca Polito", email: "rebecca.polito@va.gov" }],
  },
  {
    id: "fda-support",
    title: "FDA Support Core",
    contacts: [
      {
        name: "Jenna Arlow, MS, CCRC",
        email: "Regulatory/FDASupportCore@uhhospitals.org",
      },
    ],
  },
  {
    id: "tech-design",
    title: "Technical Design and Development",
    contacts: [{ name: "James Uhlir", email: "jpu2@case.edu" }],
  },
  {
    id: "stats",
    title: "Statistical Support",
    contacts: [{ name: "Jiayang Sun, PhD", email: "jsun@case.edu" }],
  },
  {
    id: "industrial",
    title: "Industrial Collaborations",
    contacts: [{ name: "Andrew Cornwell, PhD", email: "asc12@case.edu" }],
  },
];

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
