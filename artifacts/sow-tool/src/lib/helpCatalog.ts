// Authored guidance for the per-section "i" helpers. Each entry is plain text
// (always shown) keyed by a stable help id. The same ids are used by
// `videoManifest` — when a video exists for the id, the SectionInfo helper
// offers a "Watch" toggle; otherwise it degrades to text-only.
//
// Content is distilled from the questionnaire and prospecting methodology
// (sowCatalog / prospectingCatalog / fileNoteCatalog). Keep it short and
// practical: what the section is for and how to work it well.

export interface HelpEntry {
  /** Heading for the helper popover. */
  title: string;
  /** One or more short paragraphs of guidance. */
  body: string[];
}

export const helpCatalog: Record<string, HelpEntry> = {
  // ----- Assessment workspace -----
  "assessment.profile": {
    title: "Client Profile",
    body: [
      "Capture who the client is and how the relationship is held: reference, banker, occupation, nationality and residence, and the overall wealth picture.",
      "This is the frame for everything that follows — the source of wealth narrative only makes sense against a clear profile. You can populate much of this directly from a meeting file note.",
    ],
  },
  "assessment.wealthCategories": {
    title: "Wealth Categories",
    body: [
      "Tick every category that contributes to the client's overall wealth footprint — employment, business ownership, investments, inheritance, and so on. Be inclusive: the goal is the whole picture, not a single transaction.",
      "Each applicable category expands into its own questions and a documentary-evidence checklist. Completion is measured only across the categories you mark applicable.",
    ],
  },
  "assessment.sourceOfFunds": {
    title: "Source of Funds",
    body: [
      "Source of wealth is how the client built their fortune over time; source of funds is the origin of the specific monies funding this transaction or account.",
      "Be concrete: amounts, the originating account or counterparty, and the paper trail that corroborates it.",
    ],
  },
  "assessment.plausibility": {
    title: "Plausibility & Corroboration",
    body: [
      "Step back and judge whether the wealth story hangs together: does the stated source plausibly produce wealth on this scale, and is it corroborated by independent evidence rather than the client's word alone?",
      "Note any gaps between what is claimed and what the documents actually show.",
    ],
  },
  "assessment.redFlags": {
    title: "Red Flags & Escalation",
    body: [
      "Record anything that raises the risk profile — opacity, unexplained third parties, high-risk jurisdictions, PEP exposure, or evasiveness — and the action taken.",
      "Flags do not automatically block onboarding, but each one must be acknowledged and, where material, escalated.",
    ],
  },
  "assessment.signOff": {
    title: "Banker Assessment & Sign-off",
    body: [
      "Summarise your overall judgement, set the risk rating, and sign off. This is the banker's accountable conclusion on the file.",
      "Sign-off should follow, not precede, a complete questionnaire and a resolved document checklist.",
    ],
  },

  // ----- Prospect workspace -----
  "prospect.profile": {
    title: "Client Profile (Prospecting)",
    body: [
      "Build the same five-dimension profile for every prospect: employer and prior firms, personal and liquidity history, family, interests, and charity work.",
      "The value is in the overlaps — a shared former employer, co-investment, school, or charity board is the route to a warm introduction.",
    ],
  },
  "prospect.channels": {
    title: "The Three Channels",
    body: [
      "Map a concrete route through each channel: client referrals (highest conversion), the internal JPMorgan network, and cold approach (the exception, never the engine).",
      "A cold approach should still be anchored to a shared affiliation so it is never truly cold.",
    ],
  },
  "prospect.operational": {
    title: "The Four Operational Questions",
    body: [
      "Turn the profile and channels into a deliberate plan: where the touchpoints with current clients are, where in the network a referral lives, how to ask for it, and what quality of referral you want.",
      "Make the ask specific and named, give the referrer an easy mechanism to say yes, and always close the loop.",
    ],
  },
  "prospect.coldCall": {
    title: "Cold Call Script",
    body: [
      "The only goal of this call is to secure a meeting or virtual call — never to sell. The script assumes you sent a short follow-up email 1–2 days earlier, and is organised around the four ways a call can land: through to the prospect, an assistant or gatekeeper, a company switchboard, or voicemail.",
      "The words personalise to the prospect and banker automatically. Log the outcome below so the journey stays current.",
    ],
  },
  "prospect.briefing": {
    title: "Pre-Meeting Briefing",
    body: [
      "An AI briefing runs a live web search and returns a summary, talking points, likely referral routes, a recommended approach, and cited sources.",
      "Treat it as preparation, not fact: read it against your own knowledge and verify anything material before the meeting.",
    ],
  },
  "prospect.convert": {
    title: "Convert to Client",
    body: [
      "When a prospect agrees to proceed, convert the file into a Source of Wealth assessment. The profile, segment, briefing, and any meeting file note carry across automatically.",
      "The assessment questionnaire then doubles as your meeting question guide for onboarding.",
    ],
  },

  // ----- Shared -----
  fileNote: {
    title: "Meeting File Note",
    body: [
      "Write a free-form note of what was discussed, then run the AI rewrite to produce a clean, professional, regulator-ready record. The coverage grid prompts what a complete meeting should touch.",
      "Mark only the topics you genuinely discussed — the enhance pass weaves confirmed details into the note, so unconfirmed ticks would put words in the client's mouth.",
    ],
  },
  journey: {
    title: "The Prospecting Journey",
    body: [
      "One continuous view of every relationship across the four steps: Brief & qualify, Approach, Meeting, and Source of Wealth. Prospects and onboarding assessments sit on the same rail as the detail pages.",
      "Each row shows where the relationship sits and the single next action it needs.",
    ],
  },
};

export function getHelp(id: string): HelpEntry | undefined {
  return helpCatalog[id];
}
