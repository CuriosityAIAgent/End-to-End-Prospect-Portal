// ============================================================================
// Source-of-Wealth evidence reference
//
// How good private banks frame Source-of-Wealth: per wealth category, the
// corroborating documents they expect and the questions they ask. This grounds
// the prep generator so its questions + anticipated answers read like a senior
// banker, not a generic model — and so the "suggested answer" is paired with
// the evidence that would actually corroborate it.
//
// First-pass curated reference. Intended to be periodically refreshed/verified
// through the same research+verification pipeline (deepResearch → verify).
// ============================================================================

export interface SowCategoryReference {
  id: string;
  label: string;
  /** What a private bank is trying to establish for this category. */
  establishes: string;
  /** Documents that corroborate wealth from this source. */
  expectedEvidence: string[];
  /** Question patterns a banker would ask. */
  questionPatterns: string[];
}

export const SOW_EVIDENCE_REFERENCE: SowCategoryReference[] = [
  {
    id: "employment",
    label: "Employment income",
    establishes: "Salary/earnings over a career consistent with accumulated wealth.",
    expectedEvidence: ["Employment contracts / offer letters", "Payslips", "Tax returns", "Employer reference"],
    questionPatterns: [
      "What roles and employers built the bulk of the earned income, and over what period?",
      "What was the approximate seniority / compensation band at peak?",
    ],
  },
  {
    id: "compensation",
    label: "Variable compensation (bonus / equity / carry)",
    establishes: "Bonuses, stock, RSUs, options, carried interest as a wealth driver.",
    expectedEvidence: ["Bonus statements", "Equity/option award & vesting schedules", "Carried-interest / LP agreements", "Brokerage statements on vested stock"],
    questionPatterns: [
      "What portion of wealth came from variable pay vs. base salary?",
      "Is there carried interest or fund economics, and from which vehicle?",
    ],
  },
  {
    id: "business_ownership",
    label: "Business ownership",
    establishes: "Value held in privately-owned operating businesses.",
    expectedEvidence: ["Company accounts / financials", "Cap table / shareholding register", "Companies House / registry filings", "Dividend statements"],
    questionPatterns: [
      "What businesses are owned, what stake, and what is the basis for the valuation?",
      "Are holdings direct or via a holding company / trust?",
    ],
  },
  {
    id: "business_sale",
    label: "Business sale / exit",
    establishes: "A liquidity event from selling a business or shareholding.",
    expectedEvidence: ["Sale & purchase agreement", "Completion statement", "Proceeds bank credit", "Press coverage of the transaction"],
    questionPatterns: [
      "What was sold, to whom, when, and for what consideration (cash vs. earn-out vs. stock)?",
      "How were net proceeds distributed across owners / trusts?",
    ],
  },
  {
    id: "investments",
    label: "Investment growth",
    establishes: "Wealth grown through investment portfolios.",
    expectedEvidence: ["Brokerage / custody statements", "Fund statements", "Capital-gains tax filings"],
    questionPatterns: ["What is the investment track record and time horizon?", "Which custodians/managers hold the assets?"],
  },
  {
    id: "inheritance",
    label: "Inheritance",
    establishes: "Wealth received from an estate.",
    expectedEvidence: ["Will / grant of probate", "Estate distribution statement", "Solicitor letter", "Inheritance-tax filing"],
    questionPatterns: ["From whom was the inheritance received, when, and approximately how much?", "Was it received directly or into a trust?"],
  },
  {
    id: "gifts",
    label: "Gifts",
    establishes: "Wealth received as a gift (often intra-family).",
    expectedEvidence: ["Deed of gift", "Donor's source-of-wealth evidence", "Bank transfer records"],
    questionPatterns: ["Who made the gift, what relationship, and what was its origin?"],
  },
  {
    id: "real_estate",
    label: "Real estate",
    establishes: "Wealth held in or realised from property.",
    expectedEvidence: ["Title deeds / Land Registry entries", "Sale completion statements", "Rental income statements", "Valuation reports"],
    questionPatterns: ["What properties are held, where, and how were they financed?", "Are any held via a company, SPV or trust?"],
  },
  {
    id: "trusts",
    label: "Trusts & foundations",
    establishes:
      "Wealth held in or distributed from trusts/foundations — the structure UHNW wealth most often sits in, and the one generic search misses. Establish settlor, trustees, beneficiaries, the assets settled and the ORIGINAL source of those assets.",
    expectedEvidence: [
      "Trust deed / foundation charter",
      "Letter of wishes",
      "Trustee / administrator confirmation",
      "Schedule of trust assets and the source-of-wealth of the settlor",
      "Charity / foundation registry filing (Charity Commission, IRS 990-PF)",
    ],
    questionPatterns: [
      "Who is the settlor, who are the trustees and beneficiaries, and in which jurisdiction is the trust/foundation established?",
      "What assets were settled into the structure, when, and what was the original source of that wealth (before it entered the trust)?",
      "Is the prospect a settlor, trustee, beneficiary, or protector — and what is the expected distribution pattern?",
    ],
  },
  {
    id: "savings_pensions",
    label: "Savings & pensions",
    establishes: "Accumulated savings and pension/retirement wealth.",
    expectedEvidence: ["Pension statements", "Savings account statements"],
    questionPatterns: ["What is the pension/savings position and how was it built?"],
  },
  {
    id: "divorce",
    label: "Divorce settlement",
    establishes: "Wealth received via a matrimonial settlement.",
    expectedEvidence: ["Consent order / settlement agreement", "Solicitor confirmation"],
    questionPatterns: ["What was the settlement, when finalised, and how were assets transferred?"],
  },
  {
    id: "windfall",
    label: "Windfall",
    establishes: "One-off windfalls (lottery, prize, legal award).",
    expectedEvidence: ["Award/prize confirmation", "Bank credit record"],
    questionPatterns: ["What was the windfall, its source, and when received?"],
  },
  {
    id: "crypto",
    label: "Digital assets",
    establishes: "Wealth from cryptocurrency / digital assets.",
    expectedEvidence: ["Exchange statements", "Wallet/transaction history", "Capital-gains filings"],
    questionPatterns: ["Which assets, acquired when, and how were fiat on/off-ramps handled?"],
  },
];

/** Compact reference block for grounding the prep prompt. */
export function sowEvidencePromptBlock(): string {
  return SOW_EVIDENCE_REFERENCE.map((c) => {
    return [
      `${c.label} [${c.id}] — ${c.establishes}`,
      `  Questions: ${c.questionPatterns.join(" | ")}`,
      `  Evidence: ${c.expectedEvidence.join("; ")}`,
    ].join("\n");
  }).join("\n\n");
}
