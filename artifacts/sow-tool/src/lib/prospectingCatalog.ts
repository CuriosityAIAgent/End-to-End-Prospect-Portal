// Single source of truth for the prospecting questionnaire. Mirrors the
// "Prospecting Brief: A Systematic Approach" methodology: build the same five
// profile dimensions for every prospect, work the three channels, and answer
// the four operational questions. All notes are stored on the prospect's `data`
// blob keyed by the ids below.

export type ProspectField = {
  id: string;
  label: string;
  hint: string;
  placeholder?: string;
};

export type ProspectSection = {
  id: string;
  title: string;
  blurb: string;
  fields: ProspectField[];
};

// The five profile dimensions — "what turns a name into a route".
export const profileDimensions: ProspectSection = {
  id: "profile",
  title: "Client Profile",
  blurb:
    "Build the same profile for every prospect. The point is not the data itself but the overlaps — where two people share a former employer, a co-investment, a school, or a charity board.",
  fields: [
    {
      id: "employer",
      label: "Employer & previous employer",
      hint: "The fund, the prior shop, the spin-outs. Partners cluster; ex-colleagues from a previous firm are often the richest seam.",
      placeholder: "Current fund, prior firms, notable spin-outs and co-founders…",
    },
    {
      id: "personal",
      label: "Personal profile",
      hint: "Career history, liquidity events, age / career stage, where they sit in the wealth lifecycle.",
      placeholder: "Career arc, exits and liquidity events, stage in the wealth lifecycle…",
    },
    {
      id: "family",
      label: "Family connections",
      hint: "Spouse, siblings, the next generation, family-office structures. Wealth is rarely held by one individual in isolation.",
      placeholder: "Spouse, siblings, next generation, any family-office structure…",
    },
    {
      id: "interests",
      label: "Hobbies & interests",
      hint: "Clubs, sports, collecting — anything that creates a non-work setting for connection.",
      placeholder: "Clubs, racket sports, collecting, other common-ground settings…",
    },
    {
      id: "charity",
      label: "Charity work",
      hint: "Boards, trustee roles, galas, foundations. Philanthropy puts UHNW individuals in the same rooms and is a natural, low-pressure introduction context.",
      placeholder: "Boards, trustee roles, foundations, galas…",
    },
  ],
};

// The three channels, ranked by conversion.
export const channels: ProspectSection = {
  id: "channels",
  title: "The Three Channels",
  blurb:
    "Map a concrete route for each channel. Warm channels convert; cold should be the exception, not the engine.",
  fields: [
    {
      id: "client_referrals",
      label: "1 — Referrals from existing clients",
      hint: "Highest-conversion channel. Which existing clients sit on the same cap tables, partnerships, boards or charities as this prospect? Name them and the overlap.",
      placeholder: "Which clients overlap, and on what (co-investment, board, school)…",
    },
    {
      id: "jpm_network",
      label: "2 — JPMorgan network referral",
      hint: "Internal cross-LOB flow. Which colleague — IB / Commercial / markets / asset management — holds the relationship or advised the liquidity event?",
      placeholder: "Which internal colleague / LOB holds the relationship…",
    },
    {
      id: "cold_approach",
      label: "3 — Cold approach",
      hint: "Lowest yield. Most effective anchored to a shared affiliation — fund, deal, alma mater, board, charity, club — so there's a credible reason for the outreach.",
      placeholder: "The shared affiliation that makes this not truly cold…",
    },
  ],
};

// The four operational questions.
export const operationalQuestions: ProspectSection = {
  id: "operational",
  title: "The Four Operational Questions",
  blurb: "Turn the profile and channels into a deliberate, repeatable plan of action.",
  fields: [
    {
      id: "touchpoints",
      label: "Where are the touchpoints with current clients?",
      hint: "Map the natural, recurring moments where a referral conversation is welcome: portfolio reviews, post-transaction debriefs, year-end planning, life events, hospitality. Don't ask cold mid-relationship.",
      placeholder: "The moments where the referrer is already feeling well-served…",
    },
    {
      id: "network_source",
      label: "Where in the network can we find a referral?",
      hint: "Two passes — internally: which JPMorgan colleagues cover the adjacent funds / founders? Externally: who in the client base shares cap tables, partnerships, boards or charities with the prospect?",
      placeholder: "Internal coverage + external overlaps that surface the route…",
    },
    {
      id: "get_referral",
      label: "How do we get a referral to this prospect?",
      hint: "Make the ask specific, not general. Name the person and the overlap, give the referrer an easy mechanism (a short drafted email, a casual intro at an event), and always close the loop and thank them.",
      placeholder: "The specific, named ask and the easy mechanism to say yes…",
    },
    {
      id: "referral_quality",
      label: "What kind of referral do we want / hope for?",
      hint: "Quality over volume. Ideal: a warm, personal introduction to a named, profiled UHNW individual at or near a liquidity / life event, routed by someone whose endorsement carries weight. 'Warm name only' is an acceptable fallback.",
      placeholder: "The ideal warm, personally-vouched introduction you're targeting…",
    },
  ],
};

export const prospectingSections: ProspectSection[] = [
  profileDimensions,
  channels,
  operationalQuestions,
];

export const prospectStatuses = [
  { value: "identified", label: "Identified" },
  { value: "researching", label: "Researching" },
  { value: "briefed", label: "Briefed" },
  { value: "outreach", label: "Outreach" },
  { value: "converted", label: "Converted" },
  { value: "dormant", label: "Dormant" },
] as const;

export type ProspectStatusValue = (typeof prospectStatuses)[number]["value"];

export const prospectStatusLabel = (value: string): string =>
  prospectStatuses.find((s) => s.value === value)?.label ?? value;
