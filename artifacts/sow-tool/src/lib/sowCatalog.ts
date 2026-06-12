// Source of Wealth (SoW) due-diligence question catalog.
// This is the single source of truth for the interactive questionnaire content.
// Every captured answer is stored on the assessment's `data` object keyed by the
// `id` of the field/question/document below.

export interface Question {
  id: string;
  label: string;
  /** Optional richer input than a single line. */
  type?: "text" | "textarea";
}

export interface ProfileField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
}

export interface WealthCategory {
  id: string;
  name: string;
  intro: string;
  questions: Question[];
  documents: { id: string; label: string }[];
}

export interface ChecklistItem {
  id: string;
  label: string;
}

/** Top-of-file client metadata captured on the assessment record itself. */
export const reviewTypeOptions = [
  { value: "onboarding", label: "Onboarding" },
  { value: "periodic_review", label: "Periodic review" },
  { value: "trigger_event", label: "Trigger event" },
] as const;

export const riskRatingOptions = [
  { value: "standard", label: "Standard" },
  { value: "enhanced", label: "Enhanced (EDD)" },
] as const;

export const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
] as const;

// ---------------------------------------------------------------------------
// Section: Core client profile
// ---------------------------------------------------------------------------
export const profileFields: ProfileField[] = [
  { id: "profile.legalName", label: "Full legal name, any former names and date of birth", type: "textarea" },
  { id: "profile.nationality", label: "Nationality / citizenship(s) and country of birth", type: "textarea" },
  { id: "profile.residence", label: "Country of residence and tax residence(s); residential address", type: "textarea" },
  { id: "profile.occupation", label: "Current occupation, employer / business and industry", type: "textarea" },
  { id: "profile.pep", label: "Are you, or have you been, a Politically Exposed Person, or related to / closely associated with one? Provide details", type: "textarea" },
  { id: "profile.netWorth", label: "Estimated total net worth (and basis of the estimate)", type: "textarea" },
  { id: "profile.annualIncome", label: "Estimated annual income and its main components", type: "textarea" },
  { id: "profile.expectedRelationship", label: "Expected size and value of the relationship / assets to be placed with the bank", type: "textarea" },
  { id: "profile.expectedActivity", label: "Expected account activity (typical transaction types, frequency, counterparties, jurisdictions)", type: "textarea" },
  { id: "profile.purpose", label: "Purpose and intended use of the account / relationship", type: "textarea" },
  { id: "profile.proportions", label: "Which wealth categories contribute to overall wealth, and roughly in what proportion?", type: "textarea" },
];

// ---------------------------------------------------------------------------
// Section: Wealth categories
// ---------------------------------------------------------------------------
export const wealthCategories: WealthCategory[] = [
  {
    id: "employment",
    name: "Employment Income",
    intro:
      "Salary, bonus and equity compensation. For clients whose wealth derives primarily from employment, including executives and senior professionals.",
    questions: [
      { id: "employment.q1", label: "What is your current occupation, job title and seniority level?" },
      { id: "employment.q2", label: "Name of current employer, industry/sector, and country of employment." },
      { id: "employment.q3", label: "How long have you been with this employer, and what is your employment history over the past 10–15 years?" },
      { id: "employment.q4", label: "What is your current annual gross base salary?" },
      { id: "employment.q5", label: "What additional remuneration do you receive (bonus, commission, carried interest, profit share)? Typical and most recent amounts." },
      { id: "employment.q6", label: "Do you receive equity-based compensation (stock options, RSUs, performance shares)? Describe the plan, vesting and amounts realised." },
      { id: "employment.q7", label: "Have you exercised options or sold vested shares? When, and what were the proceeds?" },
      { id: "employment.q8", label: "Approximately what proportion of your total wealth comes from accumulated employment income over your career?" },
      { id: "employment.q9", label: "Have you accumulated savings or investments from net salary over time? Describe how." },
    ],
    documents: [
      { id: "employment.d1", label: "Recent payslips (typically last 3–6 months)." },
      { id: "employment.d2", label: "Employment contract or offer letter stating remuneration." },
      { id: "employment.d3", label: "Most recent annual tax return / tax assessment." },
      { id: "employment.d4", label: "Bonus award letters or remuneration statements." },
      { id: "employment.d5", label: "Equity / share plan award and vesting statements; brokerage statements for share sales." },
      { id: "employment.d6", label: "Employer reference or confirmation letter (where remuneration is exceptional)." },
    ],
  },
  {
    id: "business",
    name: "Business Ownership / Self-Employment",
    intro:
      "Company profits and distributions. For founders, owner-managers, partners and professionals drawing income from a business they own.",
    questions: [
      { id: "business.q1", label: "Name(s) of the business(es), legal form, country of incorporation and registration number." },
      { id: "business.q2", label: "What does the business do? Describe its activities, products/services and main markets." },
      { id: "business.q3", label: "What is your ownership percentage and role (founder, director, partner, shareholder)?" },
      { id: "business.q4", label: "When was the business established, and how was it originally funded?" },
      { id: "business.q5", label: "What is the approximate annual turnover and net profit of the business?" },
      { id: "business.q6", label: "How do you extract value — salary, dividends, partner drawings, director's loan, retained earnings?" },
      { id: "business.q7", label: "What dividend or distribution amounts have you received over the past 3–5 years?" },
      { id: "business.q8", label: "Who are the other owners / shareholders / beneficial owners?" },
      { id: "business.q9", label: "Is the business regulated or licensed? By whom?" },
      { id: "business.q10", label: "Does the business operate in, or have counterparties in, any higher-risk jurisdictions?" },
      { id: "business.q11", label: "What is the estimated current value of your stake, and on what basis?" },
    ],
    documents: [
      { id: "business.d1", label: "Audited or management financial statements (last 2–3 years)." },
      { id: "business.d2", label: "Certificate of incorporation / company registry extract showing ownership." },
      { id: "business.d3", label: "Shareholder register or cap table; partnership agreement where relevant." },
      { id: "business.d4", label: "Business and personal tax returns." },
      { id: "business.d5", label: "Dividend vouchers / distribution statements." },
      { id: "business.d6", label: "Business bank statements (where appropriate)." },
      { id: "business.d7", label: "Independent valuation, accountant's letter, or auditor confirmation." },
    ],
  },
  {
    id: "businessSale",
    name: "Sale of a Business or Company",
    intro: "For clients whose wealth arises from a liquidity event — full or partial sale of a business.",
    questions: [
      { id: "businessSale.q1", label: "What business was sold, and what was your ownership stake prior to sale?" },
      { id: "businessSale.q2", label: "When did the sale complete, and who was the acquirer?" },
      { id: "businessSale.q3", label: "What was the total transaction value and your personal net proceeds after tax and fees?" },
      { id: "businessSale.q4", label: "Was the consideration cash, shares, earn-out, or a combination? Describe the structure." },
      { id: "businessSale.q5", label: "Were proceeds paid in instalments or deferred? What is the schedule?" },
      { id: "businessSale.q6", label: "Which advisers were involved (corporate finance, legal, accounting)?" },
      { id: "businessSale.q7", label: "Where are the proceeds currently held, and how were they received?" },
      { id: "businessSale.q8", label: "Have applicable taxes (e.g. capital gains) been settled or provided for?" },
    ],
    documents: [
      { id: "businessSale.d1", label: "Sale and purchase agreement (SPA) / completion statement." },
      { id: "businessSale.d2", label: "Solicitor's or accountant's letter confirming net proceeds." },
      { id: "businessSale.d3", label: "Bank statements evidencing receipt of proceeds." },
      { id: "businessSale.d4", label: "Press releases or public filings relating to the transaction (where available)." },
      { id: "businessSale.d5", label: "Tax computation or clearance relating to the gain." },
    ],
  },
  {
    id: "investments",
    name: "Investment & Portfolio Gains",
    intro: "For clients whose wealth has grown materially through investing — securities, funds, private equity, venture, or trading.",
    questions: [
      { id: "investments.q1", label: "Describe your investment activity — asset classes, strategy and time horizon." },
      { id: "investments.q2", label: "What was your initial investment capital, and where did that originate?" },
      { id: "investments.q3", label: "Which institutions or platforms hold your investments?" },
      { id: "investments.q4", label: "What returns or realised gains have you generated, and over what period?" },
      { id: "investments.q5", label: "Do you hold private equity, venture, or pre-IPO positions? Describe." },
      { id: "investments.q6", label: "Are you a professional investor, fund manager, or do you receive carried interest?" },
      { id: "investments.q7", label: "How are investment gains evidenced and taxed?" },
    ],
    documents: [
      { id: "investments.d1", label: "Brokerage / custodian / portfolio statements (current and historic)." },
      { id: "investments.d2", label: "Contract notes or realised gains reports." },
      { id: "investments.d3", label: "Fund subscription and redemption confirmations." },
      { id: "investments.d4", label: "Tax returns reflecting investment income and gains." },
      { id: "investments.d5", label: "Evidence of the original source of seed capital." },
    ],
  },
  {
    id: "inheritance",
    name: "Inheritance",
    intro: "For wealth received from the estate of a deceased person.",
    questions: [
      { id: "inheritance.q1", label: "From whom did you inherit, and what was your relationship to the deceased?" },
      { id: "inheritance.q2", label: "When did the inheritance occur (date of death / date of distribution)?" },
      { id: "inheritance.q3", label: "What was the value and composition of what you received (cash, property, securities, business interests)?" },
      { id: "inheritance.q4", label: "What was the deceased's source of wealth / occupation?" },
      { id: "inheritance.q5", label: "Who administered the estate (executor, solicitor, probate court)?" },
      { id: "inheritance.q6", label: "Are there other beneficiaries, and is the estate fully distributed?" },
      { id: "inheritance.q7", label: "Where are the inherited assets currently held?" },
    ],
    documents: [
      { id: "inheritance.d1", label: "Grant of probate / letters of administration." },
      { id: "inheritance.d2", label: "Copy of the will." },
      { id: "inheritance.d3", label: "Solicitor's / executor's letter confirming the distribution and amount." },
      { id: "inheritance.d4", label: "Estate accounts." },
      { id: "inheritance.d5", label: "Bank statements evidencing receipt." },
      { id: "inheritance.d6", label: "Where relevant, evidence of the deceased's source of wealth." },
    ],
  },
  {
    id: "gifts",
    name: "Gifts",
    intro: "For wealth received as a gift from a living person.",
    questions: [
      { id: "gifts.q1", label: "Who gave the gift, and what is your relationship to them?" },
      { id: "gifts.q2", label: "What was the amount or nature of the gift, and when was it given?" },
      { id: "gifts.q3", label: "What is the donor's own source of wealth / occupation?" },
      { id: "gifts.q4", label: "What was the reason or occasion for the gift?" },
      { id: "gifts.q5", label: "Is the gift one-off or recurring? Are further gifts expected?" },
      { id: "gifts.q6", label: "Is the donor a Politically Exposed Person (PEP) or connected to one?" },
    ],
    documents: [
      { id: "gifts.d1", label: "Signed gift letter / deed of gift from the donor." },
      { id: "gifts.d2", label: "Evidence of the donor's source of wealth." },
      { id: "gifts.d3", label: "Bank statements showing the transfer from donor to client." },
      { id: "gifts.d4", label: "Identification of the donor where the gift is material." },
    ],
  },
  {
    id: "realEstate",
    name: "Real Estate / Property",
    intro: "For wealth held in or realised from property — residential, commercial or development.",
    questions: [
      { id: "realEstate.q1", label: "Describe the properties you own (location, type, approximate value)." },
      { id: "realEstate.q2", label: "How and when were the properties acquired, and how was the purchase funded?" },
      { id: "realEstate.q3", label: "Are properties owned outright or mortgaged? State outstanding borrowing." },
      { id: "realEstate.q4", label: "Do you receive rental income? How much, and from how many properties?" },
      { id: "realEstate.q5", label: "Have you sold any property recently? State proceeds and use of funds." },
      { id: "realEstate.q6", label: "Are properties held personally or via a company / trust / SPV?" },
    ],
    documents: [
      { id: "realEstate.d1", label: "Title deeds / land registry extracts." },
      { id: "realEstate.d2", label: "Completion statements for purchases or sales." },
      { id: "realEstate.d3", label: "Rental agreements and rent statements." },
      { id: "realEstate.d4", label: "Mortgage statements / redemption figures." },
      { id: "realEstate.d5", label: "Independent valuations." },
      { id: "realEstate.d6", label: "Tax returns reflecting rental income or capital gains." },
    ],
  },
  {
    id: "savings",
    name: "Accumulated Savings, Pensions & Retirement",
    intro: "For wealth built up gradually over a working lifetime, including pensions and long-term savings.",
    questions: [
      { id: "savings.q1", label: "Over what period was this wealth accumulated, and from what underlying income?" },
      { id: "savings.q2", label: "What pension or retirement arrangements do you hold (occupational, personal, state)?" },
      { id: "savings.q3", label: "Have you taken any lump-sum pension withdrawals? State amounts." },
      { id: "savings.q4", label: "What long-term savings or deposit balances do you hold, and where?" },
      { id: "savings.q5", label: "Can you demonstrate the link between historic income and current balances?" },
    ],
    documents: [
      { id: "savings.d1", label: "Pension statements and lump-sum payment confirmations." },
      { id: "savings.d2", label: "Long-term savings / deposit account statements." },
      { id: "savings.d3", label: "Historic tax returns demonstrating income over time." },
    ],
  },
  {
    id: "settlement",
    name: "Divorce or Legal Settlement",
    intro: "For wealth received through a matrimonial settlement, court award or legal compensation.",
    questions: [
      { id: "settlement.q1", label: "What is the nature of the settlement (divorce, litigation, compensation)?" },
      { id: "settlement.q2", label: "When was it concluded, and what amount did you receive?" },
      { id: "settlement.q3", label: "Was the settlement court-ordered or by private agreement?" },
      { id: "settlement.q4", label: "What was the counterparty's source of wealth (in a matrimonial context)?" },
      { id: "settlement.q5", label: "Which legal advisers acted for you?" },
    ],
    documents: [
      { id: "settlement.d1", label: "Court order / consent order / settlement agreement." },
      { id: "settlement.d2", label: "Solicitor's letter confirming the award and net amount." },
      { id: "settlement.d3", label: "Bank statements evidencing receipt." },
    ],
  },
  {
    id: "windfall",
    name: "Windfalls — Lottery, Prizes, Royalties & IP",
    intro: "For wealth from one-off windfalls or income from creative / intellectual property rights.",
    questions: [
      { id: "windfall.q1", label: "What is the source of the windfall (lottery, prize, royalties, licensing, IP sale)?" },
      { id: "windfall.q2", label: "When was it received, and what amount?" },
      { id: "windfall.q3", label: "Who is the paying organisation or counterparty?" },
      { id: "windfall.q4", label: "For royalties / IP, describe the underlying work and the licensing arrangements." },
      { id: "windfall.q5", label: "Is this a one-off or a recurring income stream?" },
    ],
    documents: [
      { id: "windfall.d1", label: "Official confirmation from the awarding body (e.g. lottery operator)." },
      { id: "windfall.d2", label: "Royalty / licensing statements and agreements." },
      { id: "windfall.d3", label: "Bank statements evidencing receipt." },
    ],
  },
  {
    id: "trust",
    name: "Trusts, Foundations & Holding Structures",
    intro: "Where wealth is held through, or distributed from, a trust, foundation or holding structure.",
    questions: [
      { id: "trust.q1", label: "Describe the structure (trust, foundation, holding company) and its jurisdiction." },
      { id: "trust.q2", label: "Who is the settlor, and what was the original source of the settled assets?" },
      { id: "trust.q3", label: "Who are the trustees / administrators and the beneficiaries?" },
      { id: "trust.q4", label: "What is your role and entitlement (settlor, beneficiary, protector)?" },
      { id: "trust.q5", label: "What distributions have you received, and on what basis?" },
      { id: "trust.q6", label: "Why was the structure established?" },
    ],
    documents: [
      { id: "trust.d1", label: "Trust deed / foundation charter / structure chart." },
      { id: "trust.d2", label: "Letter from trustees confirming your interest and distributions." },
      { id: "trust.d3", label: "Evidence of the settlor's original source of wealth." },
      { id: "trust.d4", label: "Identification of trustees, settlor and beneficial owners." },
    ],
  },
  {
    id: "crypto",
    name: "Cryptocurrency & Digital Assets",
    intro: "Where wealth derives from holding, trading or mining of digital assets.",
    questions: [
      { id: "crypto.q1", label: "Which digital assets do you hold or have you held, and on which exchanges / wallets?" },
      { id: "crypto.q2", label: "How did you originally acquire them (purchase with fiat, mining, earned, airdrop)?" },
      { id: "crypto.q3", label: "What fiat capital did you originally invest, and from what source?" },
      { id: "crypto.q4", label: "What gains have you realised, and how were they converted to fiat?" },
      { id: "crypto.q5", label: "Through which regulated exchanges or institutions did funds flow?" },
      { id: "crypto.q6", label: "How are these holdings and gains evidenced and taxed?" },
    ],
    documents: [
      { id: "crypto.d1", label: "Exchange account statements and transaction history." },
      { id: "crypto.d2", label: "Records linking fiat on-ramp / off-ramp to the client's bank account." },
      { id: "crypto.d3", label: "Blockchain transaction references where appropriate." },
      { id: "crypto.d4", label: "Tax returns reflecting digital-asset gains." },
      { id: "crypto.d5", label: "Evidence of the original fiat source of capital." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Section: Source of funds for the specific funding / transaction
// ---------------------------------------------------------------------------
export const sourceOfFundsQuestions: Question[] = [
  { id: "sof.q1", label: "What is the exact amount and currency being deposited / transferred?" },
  { id: "sof.q2", label: "From which account and institution are the funds being sent? In whose name is that account?" },
  { id: "sof.q3", label: "Are the funds coming directly from the client, or via a third party? If third party, why?" },
  { id: "sof.q4", label: "Which of the client's wealth sources do these specific funds derive from?" },
  { id: "sof.q5", label: "What is the method of transfer (wire, cheque, securities transfer, in specie)?" },
  { id: "sof.q6", label: "From / through which jurisdiction(s) are the funds originating?" },
  { id: "sof.q7", label: "Will further deposits follow? Describe the expected pattern." },
];

export const sourceOfFundsDocuments: ChecklistItem[] = [
  { id: "sof.d1", label: "Bank statements showing the funds in the originating account." },
  { id: "sof.d2", label: "Evidence linking the funds to the underlying source (e.g. sale completion statement, dividend voucher)." },
  { id: "sof.d3", label: "Where a third party is involved, identification and rationale for their involvement." },
];

// ---------------------------------------------------------------------------
// Section: Plausibility & corroboration assessment
// ---------------------------------------------------------------------------
export const plausibilityChecks: ChecklistItem[] = [
  { id: "plaus.1", label: "Stated wealth is consistent with the client's age, profession, and career history." },
  { id: "plaus.2", label: "Documents independently corroborate the client's verbal explanation." },
  { id: "plaus.3", label: "The timeline makes sense (e.g. wealth accumulated before or after key life events)." },
  { id: "plaus.4", label: "The total wealth is explained, not only a portion of it; gaps identified and addressed." },
  { id: "plaus.5", label: "Amounts are proportionate to the known economics of the stated source." },
  { id: "plaus.6", label: "Documents are authentic, recent, and from independent / reliable sources." },
  { id: "plaus.7", label: "Foreseeable taxes have been addressed, consistent with the client's residence." },
];

// ---------------------------------------------------------------------------
// Section: Red flags & escalation triggers
// ---------------------------------------------------------------------------
export const redFlags: ChecklistItem[] = [
  { id: "flag.1", label: "Reluctance, evasiveness, or repeated failure to provide evidence." },
  { id: "flag.2", label: "Explanations that are vague, inconsistent, or change over time." },
  { id: "flag.3", label: "Wealth that is disproportionate to the client's known profile or age." },
  { id: "flag.4", label: "Documents that appear altered, incomplete, or cannot be independently verified." },
  { id: "flag.5", label: "Funds routed through multiple unrelated parties or high-risk jurisdictions without rationale." },
  { id: "flag.6", label: "Unexplained third-party involvement in funding." },
  { id: "flag.7", label: "Adverse media, sanctions, or law-enforcement connections identified in screening." },
  { id: "flag.8", label: "Undisclosed PEP status, or connections to PEPs revealed during enquiry." },
  { id: "flag.9", label: "Pressure to complete quickly or to waive standard requirements." },
];

// ---------------------------------------------------------------------------
// Section: Banker's assessment & sign-off
// ---------------------------------------------------------------------------
export const signOffFields: ProfileField[] = [
  { id: "signoff.summary", label: "Summary of overall source of wealth", type: "textarea" },
  { id: "signoff.primarySources", label: "Primary source(s) and approximate proportions", type: "textarea" },
  { id: "signoff.sof", label: "Source of funds for this relationship / transaction", type: "textarea" },
  { id: "signoff.documentsVerified", label: "Documents obtained and verified", type: "textarea" },
  { id: "signoff.gaps", label: "Outstanding items / gaps and plan to resolve", type: "textarea" },
  { id: "signoff.screening", label: "Screening results (PEP / sanctions / adverse media)", type: "textarea" },
  {
    id: "signoff.conclusion",
    label: "Plausibility conclusion",
    type: "select",
    options: ["Satisfactory", "Requires escalation"],
  },
  { id: "signoff.rmName", label: "Relationship manager (name)", type: "text" },
  { id: "signoff.reviewerName", label: "Reviewing manager / team head (name)", type: "text" },
  { id: "signoff.complianceName", label: "Compliance / MLRO (name, if EDD)", type: "text" },
];

// ---------------------------------------------------------------------------
// Section: Master document checklist
// ---------------------------------------------------------------------------
export const masterChecklist: ChecklistItem[] = [
  { id: "master.id", label: "Identification & proof of address" },
  { id: "master.payslips", label: "Payslips / employment contract" },
  { id: "master.tax", label: "Tax returns / assessments" },
  { id: "master.financials", label: "Company financial statements" },
  { id: "master.registry", label: "Registry extract / shareholder register" },
  { id: "master.dividends", label: "Dividend / distribution vouchers" },
  { id: "master.spa", label: "Business sale agreement (SPA) / completion statement" },
  { id: "master.brokerage", label: "Brokerage / portfolio statements" },
  { id: "master.probate", label: "Grant of probate / will / executor letter" },
  { id: "master.gift", label: "Gift letter / deed of gift" },
  { id: "master.property", label: "Property title deeds / completion statements" },
  { id: "master.pension", label: "Pension / savings statements" },
  { id: "master.court", label: "Court / settlement order" },
  { id: "master.trust", label: "Trust deed / structure chart" },
  { id: "master.crypto", label: "Crypto exchange statements" },
  { id: "master.bank", label: "Bank statements evidencing funds" },
];

/** Document checklist states used across the app. */
export const documentStates = ["not_applicable", "outstanding", "received", "verified"] as const;
export type DocumentState = (typeof documentStates)[number];
