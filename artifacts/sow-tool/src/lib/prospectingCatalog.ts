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

// ---------------------------------------------------------------------------
// Step 1 — the cold call. A structured talk track for the first approach.
// The script is reference content; the capture fields below log the outcome and
// are stored on the prospect's `data` blob like every other answer.
// ---------------------------------------------------------------------------
export type ColdCallStage = {
  id: string;
  stage: string;
  // Suggested words. Bracketed tokens [Name], [RM], [anchor] are substituted
  // live in the UI with the prospect's name, the RM and the captured anchor.
  script: string;
  guidance: string;
};

export const coldCallScript: ColdCallStage[] = [
  {
    id: "open",
    stage: "Open with the anchor — never truly cold",
    script:
      "Good morning [Name], this is [RM] at the Private Bank. We haven't met — I'm calling because [anchor].",
    guidance:
      "Lead with the shared affiliation in the first sentence: a mutual connection, a fund or board you both touch, an alma mater. It buys you the next thirty seconds.",
  },
  {
    id: "relevance",
    stage: "Earn the next minute",
    script:
      "I'll be brief. I work with a small number of clients in your world and, given where you are right now, I thought a short conversation could be worth your time.",
    guidance:
      "One sentence on why you're worth listening to — tied to their situation, not a product pitch. Reference something specific you know (a liquidity event, a new role).",
  },
  {
    id: "question",
    stage: "Ask a question that invites them in",
    script:
      "Before I say any more — how are you currently thinking about managing things as this next stage plays out?",
    guidance:
      "An open, homework-backed question gets them talking and signals you understand their situation. Listen more than you speak.",
  },
  {
    id: "objection",
    stage: "Handle the reflex 'no'",
    script:
      "Of course — most people I speak to already have a bank they're happy with. I'm not asking you to change anything; I'd just value the chance to offer a second perspective.",
    guidance:
      "Expect 'I already have a bank' or 'I'm not looking.' Acknowledge it, don't push. Reframe around perspective and access, not switching.",
  },
  {
    id: "ask",
    stage: "Ask for a meeting, not for business",
    script:
      "Could we put twenty minutes in the diary — a coffee, no agenda? Would the early part of next week or the one after suit you better?",
    guidance:
      "Make the ask small and specific. Offer two concrete options so the answer is a choice of when, not whether.",
  },
  {
    id: "close",
    stage: "Confirm and close the loop",
    script:
      "Excellent — I'll send a short note to confirm. Thank you, [Name], I look forward to it.",
    guidance:
      "Lock the next step, confirm in writing the same day, and log the outcome below. If they declined, capture why and a sensible time to revisit.",
  },
];

export const coldCallCapture: ProspectField[] = [
  {
    id: "coldcall.anchor",
    label: "Your opening anchor",
    hint: "The shared affiliation you'll lead with so the call isn't truly cold — drawn from the channels work below. This flows into the script above.",
    placeholder: "e.g. introduced by a mutual board member at the foundation…",
  },
  {
    id: "coldcall.outcome",
    label: "Call outcome",
    hint: "Meeting booked, call back, not now, or declined — and the date you called.",
    placeholder: "e.g. 12 Jun — meeting booked for the week of 23 Jun…",
  },
  {
    id: "coldcall.notes",
    label: "Notes & next step",
    hint: "What you learned, objections raised, and the immediate next action.",
    placeholder: "Objections, signals of interest, what to send, when to follow up…",
  },
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
