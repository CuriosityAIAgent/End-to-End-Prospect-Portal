# Prospect Intel — Rupert Feedback v2 (spec + build plan)

Source: recorded feedback from Rupert (SME banker, originator of the idea), his
written "Systematic Approach to Prospecting", the SoW form, and his
`Prospecting-Tool-comments.docx` (cold email / follow-up / call scripts +
meeting-note fact-find). This document is the single source of truth for the v2
changes. **Nothing here overrides Rupert's intent — it captures it.**

Target repo: this one (`End-to-End-Prospect-Portal`). Branch: `feat/rupert-feedback-v2`.

---

## 1. The core reframe

The portal becomes a **top-to-bottom prospecting workflow on one page**, in the
order a banker actually works a prospect:

1. **Plan of action** (new, top) — a tailored one-liner ("best route here is a
   warm intro via the shared PE network; else cold email") sitting above the
   fixed 2-step framework (① name → brief → qualify; ② approach via referral or
   cold). Acts as a lightweight stage tracker (Brief ✓ → Approach → Meeting).
2. **Brief** — overall summary + a **qualitative narrative readout** (how the
   wealth was built, career arc, current standing). Leads with story, not a
   dossier. The qualifier (>$25M?) lives here.
3. **Referral pointers** — broad suggestions/directions only (LinkedIn + web),
   NOT a bank-network integration. See §5.
4. **Warm-vs-cold decision** — explicit banker-clicked branch.
5. **Cold approach** — Rupert's email / follow-up / call scripts (see §6).
6. **Meeting stage → file note → Source of Wealth** — the existing
   prospect→assessment handoff, made explicit in the flow.

### Locked decisions
- **No new API connections.** No Preqin / PitchBook / Connect / go-iq / 23Wall.
  Everything runs off the existing **DataForSEO + Jina** search. Anything we
  can't support is **phased out**, not built.
- **Currency: USD** everywhere (override of the earlier GBP default).
- **Net worth = a qualification gate, not a range.** The only question at this
  stage is "is this person worth more than **$25M**?" Ranges like
  "$25M–$300M" are useless — too wide, low information.
- **Referral stays broad** — pointers/directions, no integration.
- **Carry table is ours** (built in this repo, §4), not waiting on Rupert's.
- Build order: ship the unambiguous wins first (gate ✅, page restructure,
  qualitative brief), spec/iterate the carry model + referral pointers.

---

## 2. Net-worth → $25M qualification gate  ✅ SHIPPED (this branch)

**Rule:** compare the internally-computed total range against the $25M bar.
- `above` — range low ≥ $25M (clears the bar even conservatively) → "Qualifies"
- `borderline` — bar sits inside the range → "Borderline — confirm in meeting"
- `below` — range high < $25M → "Below the bar"

The range is **kept internally** (it still drives the gate and the SoW
questions) but is **no longer shown** in the UI. The verdict + a one-line
rationale + confidence + the assumption ledger ("how we got there") are shown.

Implementation:
- `lib/research-pipeline/src/types.ts` — `Qualification`, `QualificationVerdict`,
  `WealthEstimate.qualification?`.
- `lib/research-pipeline/src/estimate/compute.ts` — `QUALIFY_THRESHOLD =
  25_000_000`, pure `qualify(total, threshold)` classifier.
- `lib/research-pipeline/src/estimate/wealthEstimate.ts` — `withQualification()`
  applied to the FINAL estimate (post-reconcile/escalation); estimator prompt now
  instructs USD presentation; GBP fallbacks → USD.
- `artifacts/sow-tool/src/components/prospect-prep-panel.tsx` —
  `WealthEstimatePanel` shows the gate; range removed; back-compat fallback
  derives the verdict for packs generated before the gate existed.

---

## 3. Brief → qualitative  (TODO)

- Add a **lead narrative** block (3–5 sentences of prose) at the very top of the
  read: how the wealth was built → career arc → where they sit now. Goal: an
  engaging opener the banker uses to start the meeting.
- Demote Companies-House-granular noise (the "Pack & Fred" co-owned-flat class
  of detail) OUT of the front brief into the collapsible evidence/SoW layer.
- Prompt change: tell the model the GOAL ("produce an engaging narrative a banker
  uses to open the meeting"), not "fill these sections".
- Files: `lib/research-pipeline/src/write/prepSchema.ts` (read spec),
  `artifacts/api-server/src/routes/prospects.ts` (prep instructions), the
  `ReadSection` in `prospect-prep-panel.tsx`.

---

## 4. Financial-sponsors carry model + OUR carry table  ✅ CORE SHIPPED (branch feat/carry-model)

Implemented: `estimate/carry.ts` (carry-points table + `carryNetRange()` pure
calculator + `carryPointsForTier()`); `types.ts` `Band`/`CarrySpec` +
`AssumptionLine.carry?`; the estimator prompt now instructs structured carry
lines for financial sponsors (model supplies fund size + seniority tier, CODE
computes the dollar value — never the model); `parseLedger` materialises the
carry `amount` from the spec; `compute.ts` counts carry_equity amount lines
toward total; the estimate panel shows the carry workings as a conversation hook.
Unit-checked against Rupert's Tower Brook example (4.5%/$3bn/2× → ~$21M/fund).
**Follow-up:** make the carry inputs *editable* in the UI (recompute + persist) —
currently the workings are shown read-only. Original spec below.



For PE / hedge-fund prospects, wealth is best estimated from carried interest.
This becomes the primary estimation path for the financial-sponsor segment and
the justification for the gate. **Shown to the banker and editable** — it doubles
as a conversation hook ("you were at X ~12 yrs, likely ~$Z of carry").

### Formula (per fund, summed across the career)
```
personal_net_carry =
    fund_size
  × (gross_multiple − 1)        // profit multiple over invested capital
  × carry_pool_rate             // GP share of profits, default 20%
  × personal_carry_pct          // the individual's slice of the GP pool
  × (1 − carry_tax_rate)        // carry tax, default 22%
```

### OUR carry-points table  (ASSUMPTIONS — validate with Rupert/client)
| Seniority / tenure | Personal carry points | Notes |
|---|---|---|
| Founder / Managing Partner | 15–30% | Holds the lion's share of the GP pool |
| Senior Partner (15+ yrs) | 4–6% | Rupert: Tower Brook = 4.5% on a $3bn fund |
| Partner (10–15 yrs) | 2–4% | |
| Principal / Partner-track (6–10 yrs) | 1–2% | Rupert: "joined ~10 yrs ago ≈ 5%" upper end |
| VP / mid (3–6 yrs) | 0.25–1% | |
| Associate / junior (<3 yrs) | 0–0.25% | Often no carry |
| Lateral sign-on grant | +0.25–0.5% on a mature fund | Rupert's hedge-fund-hire example |

Defaults: `gross_multiple` 2.0x (band 1.5–2.5x); `carry_pool_rate` 20%;
`carry_tax_rate` 22% (Rupert: "taxed at 20–24%").

### Worked example (sanity-check vs Rupert)
Patrick, Tower Brook, 4.5% carry, ~$3bn fund, ~2x:
`3bn × 1 × 0.20 × 0.045 × (1−0.22) ≈ $21M net per fund`; across ~3 fund vintages
in 12 yrs ≈ **$60–80M net** — in the ballpark of Rupert's "~$100M over 12 years"
(his figure is pre-tax / higher-multiple). Good enough as an editable estimate.

Inputs (`fund_size`, `gross_multiple`) come from **targeted web searches only**
(no Preqin) — best-effort, flagged as assumptions, confirmed in the meeting.

Implementation sketch: add a `carry_equity` estimation helper that, when the
segment is a financial sponsor and fund/tenure signals exist, builds carry lines
from this table; surface the workings in the estimate panel as editable
assumptions.

---

## 5. Referral pointers (scoped down)  (TODO)

Broad **pointers and directions** only — we are NOT building the bank-network
integration (that's the long-term "plug into the bank's network" goal).
- Run a light web/LinkedIn search for plausible shared-network names/firms and
  surface them as *ideas* for the banker to chase.
- Provide click-to-open LinkedIn / Google search queries the banker runs himself.
- "Integrated tools" that don't exist yet are **omitted** (not shown as
  "coming soon").
- Channels framing (from Rupert's systematic approach), in priority order:
  ① client referral → ② JPM internal network → ③ cold, anchored to a shared
  affiliation (fund, deal, alma mater, board, charity, club).

---

## 6. Cold approach — Rupert's templates (verbatim) + brevity rule  (TODO)

**Brevity rule: the ONLY goal is to secure a 30-minute meeting.** No pitch, no
wordiness. Keep email bodies tight (≤ ~4 sentences). Keep 3 variants
(news-hook / warm / direct) but make each lean.

### Cold email (Rupert)
> Subject: JP Morgan Private Bank
> Dear David,
> Hope this email finds you well.
> I am a senior client advisor at JP Morgan Private Bank in London and focus on
> working with financial executives and sponsors.
> JP Morgan has built strong relationships with partners and leading private
> equity firms globally, and we're always keen to learn more from those shaping
> the industry. I would welcome the chance to introduce our services, hear about
> your current priorities, and explore whether we can add value to your
> situation. We work with clients who have a variety of priorities, offering
> advice on wealth management, estate planning, structuring, and tailored lending
> solutions. We also provide best-in-class access to diversified investments,
> capital markets, and alternative assets.
> Even if you are well served, we are often a strong complement to existing
> relationships, offering perspectives and opportunities unique to our platform.
> Please let me know if there is a convenient time in the next few weeks for an
> introductory call or meeting.
> Kind regards, Rupert

### Follow-up email (Rupert)
> Dear David,
> I wanted to follow up on my email from last week regarding JP Morgan Private
> Bank and how we work with financial executives and sponsors. As we start the
> new year, it's an ideal time to review priorities and explore new
> opportunities, and I believe a brief conversation could be mutually beneficial.
> I appreciate how busy things can be, so I'll look to drop you a line in the next
> few days to see if we might connect.
> Best regards, Rupert

### Call approach (Rupert)
**Goal:** get a meeting with the prospect.
**How (routes):** direct number → assistant → employer switchboard (ask for
client) → employer switchboard (ask for assistant).
**What to say:**
1. *Through to client:* "Hello, my name is Rupert Watkins, I'm calling from JP
   Morgan Private Bank where I work as a client advisor. (I dropped you an email
   earlier in the week so thought I'd drop you a line.) We look after clients in
   financial services, specifically Hedge Funds / Private Equity. I think you'd be
   really interested in hearing how we could help — could we put 30 minutes in the
   diary over the next couple of weeks?"
2. *Through to assistant:* introduce, reference the email, ask to arrange a 30-min
   meeting / to email the client and copy the assistant.
3. *Through to switchboard:* ask to be put through to the client / their
   assistant / voicemail.
4. *Voicemail:* same as (1), close with a callback number + JPM email.

Note: "Hedge Funds / Private Equity" is segment-swappable. Templates are
gold-standard structure to MATCH (not just shorten).

---

## 7. Meeting-note fact-find → Source of Wealth  (TODO)

"Move to meeting stage" generates the tailored fact-find question set; the file
note the banker writes after the meeting feeds the SoW stage (existing
prospect→assessment handoff). Standard fact-find (from Rupert's doc + SoW form):

- **Income** — Salary, Bonus, Carry, Co-invest
- **Expenditure** — Annual expenditure
- **Assets** — Liquid assets, investible assets, investment assets, carried
  interest, co-invest, primary residence
- **Liabilities** — Outstanding loans, mortgage, future fund commitments

SoW ledger (calculated where noted): Investible + Real Estate + Other = Total
Assets; Mortgage + Other = Total Debt; Total Net Assets = Assets − Debt; Total
Liquid Net Worth = Investible − Other Debt. Employment ownership: ever held an
ownership %? if >25%, capture company, year joined, still employed, business
description (risk/justification), positions/tenure, compensation.

SoW = "prove a positive": take what the client states and supply the narrative +
evidence that makes it plausible.

---

## 8. Build order — STATUS
1. ✅ Net-worth → $25M gate + USD — PR #8, MERGED + deployed.
4. ✅ Carry model + carry table — PR #9, MERGED + deployed. (docs PR #10, MERGED.)
2. ✅ Plan-of-action header + staged flow — PR #11 (open).
3. ✅ Qualitative lead narrative + demote registry noise — PR #12 (open).
5. ✅ Approach brevity rule (Rupert's style) — PR #13 (open).
6. ✅ Referral pointers (broad, LinkedIn/web) — PR #14 (open).
7. ✅ Meeting fact-find checklist → SoW — PR #15 (open).

PRs #11–#15 are a stacked chain (each based on the previous), awaiting the
deferred review (codex is auth-revoked; run `/code-review` or codex once
re-authed) before merging to prod.

Open follow-ups noted in PRs: editable carry inputs in the UI (#9); Rupert's
static call-routes playbook — direct/assistant/switchboard/voicemail (#13);
server-side auto-search for shared-network names (#14).

Each ships as its own PR on a branch → review → `gh pr merge`.

## 9. Review follow-ups (not blocking the gate PR)
- **Default income-tax rate** (`compute.ts` `DEFAULTS.tax = 0.45`, UK additional
  rate): intentionally kept — our prospects are UK-based financial sponsors;
  presentation currency (USD) is independent of tax jurisdiction. Revisit if/when
  we cover US-domiciled prospects (they'd want a US effective rate). Carry has its
  own ~22% rate in the carry model (§4).
- Currency invariant: the estimator prompt forces USD, but it's a soft
  instruction. The gate hardcodes a USD bar; if we ever see non-USD estimates in
  the wild, add a normalisation/guard in `withQualification`.
