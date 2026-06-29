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
// Step 1 — the cold call. The only goal is to secure a meeting or virtual call,
// never to sell. The script assumes a short follow-up email was sent 1–2 days
// earlier and is organised around the four ways a call can land. It is
// client-type agnostic (no segmentation, no affiliation anchor).
// The script is reference content; the capture fields below log the outcome and
// are stored on the prospect's `data` blob like every other answer.
// ---------------------------------------------------------------------------

// Top-of-panel framing.
export const coldCallObjective =
  "The only goal of this call is to secure a meeting or virtual call — not to sell the bank, products, or your services.";

export const coldCallEmailReminder =
  "Assumes you sent a short email 1–2 days ago saying you'd follow up by phone. Lead with 'I promised I'd follow up' in every scenario — it turns a cold call into an expected one.";

export type ColdCallLine = {
  // A short sub-label for the line (e.g. "The ask").
  subLabel: string;
  // Suggested words. Bracketed tokens [Name] and [Banker] are substituted live in
  // the UI with the prospect's name and the banker.
  script: string;
  guidance: string;
};

export type ColdCallScenario = {
  id: string;
  title: string;
  lines: ColdCallLine[];
};

export const coldCallScenarios: ColdCallScenario[] = [
  {
    id: "prospect",
    title: "Through to the prospect",
    lines: [
      {
        subLabel: "Open (reference the email)",
        script:
          "Good morning [Name], this is [Banker] from the Private Bank. I sent you a short note earlier this week and promised I'd follow up with a quick call — is now a reasonable moment for two minutes?",
        guidance: "Pause and let them answer before going on.",
      },
      {
        subLabel: "Reason for the call",
        script:
          "I'll keep this brief. I look after a small number of clients, and the reason I wanted to speak to you directly rather than just email is simply to introduce myself properly — not to sell you anything today.",
        guidance: "Keep it to one or two lines; no product talk.",
      },
      {
        subLabel: "The ask",
        script:
          "What I'd genuinely value is a short, no-obligation conversation — 20 to 30 minutes, in person or by video, whichever is easier for you. Nothing to prepare and nothing to sign. Would [first option] or [second option] suit you better?",
        guidance: "Offer two specific times so the answer is when, not whether.",
      },
      {
        subLabel: "Close",
        script:
          "Perfect — I'll send a calendar note to confirm, and I look forward to speaking properly then. Thank you, [Name].",
        guidance: "Confirm in writing the same day and log the outcome below.",
      },
    ],
  },
  {
    id: "gatekeeper",
    title: "Assistant / gatekeeper",
    lines: [
      {
        subLabel: "Open",
        script:
          "Good morning, this is [Banker] from the Private Bank. I sent [Name] a short email earlier this week and promised I'd follow up with a call — may I speak with them, or is there a better time you'd suggest I try?",
        guidance: "Treat the assistant as an ally, not an obstacle.",
      },
      {
        subLabel: "If the prospect is unavailable",
        script:
          "No problem at all. Perhaps you can help me — I'm not trying to sell anything; I'd simply like to arrange a brief 20-minute introduction with [Name], in person or by video. What's the best way to get a short slot in their diary? I'm very happy to work around their availability.",
        guidance: "Make their job easy; be transparent about the purpose.",
      },
      {
        subLabel: "Lock the next step",
        script:
          "Thank you, that's really helpful. So I'm not chasing blindly — would it be best if I called you back on [day], or shall I send the details to you directly to put in front of them?",
        guidance: "Always leave with the assistant's name and a concrete next action.",
      },
    ],
  },
  {
    id: "switchboard",
    title: "Company switchboard",
    lines: [
      {
        subLabel: "Open",
        script:
          "Good morning, could you put me through to [Name]'s office, please? This is [Banker] from the Private Bank — I'm following up on an email I sent them earlier this week.",
        guidance: "Calm certainty; referencing the email signals you're expected.",
      },
      {
        subLabel: "If asked what it's regarding",
        script:
          "Of course — it's a personal follow-up to an email I sent [Name]; they're expecting my call. If they're not available, their assistant's line would be perfect.",
        guidance: "Stay specific and unflustered.",
      },
      {
        subLabel: "If they can't connect you",
        script:
          "No problem. Could you point me to the best direct line or email for their office, so I can reach them at a convenient time? I'd be grateful.",
        guidance: "Leave with a better route even if you don't get through.",
      },
    ],
  },
  {
    id: "voicemail",
    title: "Voicemail",
    lines: [
      {
        subLabel: "Message",
        script:
          "Hello [Name], this is [Banker] from the Private Bank — I sent you a short email earlier this week and promised I'd follow up with a quick call. Nothing urgent and nothing to sell; I'd simply like to arrange a brief introduction at a time that suits you. I'll try you again on [day], or feel free to reach me directly on [number]. Thank you, and I look forward to speaking.",
        guidance: "Never pitch into a voicemail; keep it short and warm.",
      },
      {
        subLabel: "Follow-through",
        script:
          "Just tried to reach you by phone as promised; happy to work around your diary.",
        guidance:
          "After the voicemail, reply to your original email with this line. Three respectful touches without ever being pushy.",
      },
    ],
  },
];

export const coldCallDeliveryNotes: string[] = [
  "One objective only: the meeting. If you're explaining products, pull back to \u201Clet's just put a time in the diary.\u201D",
  "The email is your warmth — lead with \u201CI promised I'd follow up\u201D in every scenario.",
  "Offer two specific times, never \u201Care you free sometime?\u201D",
  "Talk less, ask more, and leave every call with a concrete next step.",
  "Stay compliant and respectful: be ready to say truthfully how you got their details, and honour any do-not-contact request at once.",
];

export const coldCallCapture: ProspectField[] = [
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

// Labels use the end-to-end journey vocabulary (Identify -> Cold Call -> Brief
// -> Meet -> Onboard) so the prospect-workspace Stage control and the journey
// rail speak the same language. The stored `value`s are unchanged.
export const prospectStatuses = [
  { value: "identified", label: "Identify" },
  { value: "researching", label: "Cold Call" },
  { value: "briefed", label: "Brief" },
  { value: "outreach", label: "Meet" },
  { value: "converted", label: "Converted" },
  { value: "dormant", label: "Dormant" },
] as const;

export type ProspectStatusValue = (typeof prospectStatuses)[number]["value"];

export const prospectStatusLabel = (value: string): string =>
  prospectStatuses.find((s) => s.value === value)?.label ?? value;
