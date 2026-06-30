# Prospecting tool — Rupert feedback v4 (consolidated)

Single source of truth for the current round. Folds in: (a) Rupert's latest
change requests, (b) the "make existing profiles reflect today's changes"
concern, and (c) the goal of one **consistent, demo-ready** end state.

**Canonical demo profile: Samir — managing partner, SoftBank.**
Banker: **Rupert Watkins, JP Morgan Private Bank.** Every example (prep pack,
emails, call script, file note, SoW statement, employer proof) is built and
shown against Samir so the whole tool reads consistently when demoed. Test facts
to keep verbatim through the pipeline: **£17m property in Whiteleys, £5m
mortgage; $30m at Goldman Sachs.**

> No production data exists — everything is test profiles. So the earlier
> "back-fill converted prospects from their assessment" migration is **moot**.
> The data task is instead: **reset to a clean, consistent demo set anchored on
> Samir** (see §8), not a careful prod migration.

---

## 1. Watch items — kill false positives
**Problem:** a probate case (*Majid v Jane Asia*) with nothing to do with the
prospect surfaced as a watch item — the name went into the query unquoted, so
unrelated name fragments matched.

**Where:** `lib/research-pipeline/src/research/deepResearch.ts` —
`anglesQueries()` (~L73-83) builds `` `${subject} ${ANGLE_KEYWORDS[angle]}` ``
with the subject **unquoted**; the `litigation` angle keywords (L32) are
`"court judgment settlement divorce probate insolvency bankruptcy"`.

**Change:** quote the exact name for the adverse/watch-item angle —
`` `"${subject}" ${ANGLE_KEYWORDS[angle]}` `` — and in the `site:`-targeted
variant too. Keep quoting scoped to the litigation/watch angle so legitimate
career/news recall isn't harmed. Net: a probate/insolvency hit only surfaces
when the full name matches.

## 2. Emails — formal, copy-paste-ready, banker-attributed
**Where:** spec in `lib/research-pipeline/src/write/prepSchema.ts` (email
variants, ~L42-50); rendered by `prospect-prep-panel.tsx` (`ApproachSection`);
generated in `artifacts/api-server/src/routes/prospects.ts` prep job. **The
banker/`relationshipManager` name is never passed into generation** (confirmed).

**Changes:**
- **Greeting + locked structure.** Every email opens "Dear Samir" / "Hi Samir",
  then body, then one clear ask, then sign-off. Fixed shape so the output pastes
  straight into Outlook (plain text, no markdown, no stray headers).
- **Banker name flows in.** Thread `relationshipManager` (the "Banker" field
  already on the prospect record) into the prep input + the email prompt so the
  sign-off and "I'm X at JP Morgan" read as that banker (e.g. Rupert Watkins).
- **Base on Rupert's drafts, not free-generation.** The drafts ARE the
  screenshots already provided (Cold Call Email + Follow up Email — JP Morgan
  Private Bank copy, "Dear …", senior-advisor remit, JPM value paragraph,
  complement-to-existing line, CTA for a 30-min intro, "Kind regards, Rupert").
  Embed that exact structure + copy as the template the generator must follow;
  the model only fills the news-hook line and the prospect-fit remit. No
  separate drafts pending.

## 3. Call script — script-style, banker-named opener
**Where:** `prepSchema.ts` call variants (~L45): `opener` + `flow`. The opener
names "JPM Private Bank" generically; the **banker's name is not passed**, so it
does not auto-populate.

**Change:** pass the banker name through and shape the opener on the cold-call
clinic template, e.g. *"Hi Samir, my name is Rupert Watkins, senior advisor at
JP Morgan, I look after managing partners of senior PE and GPs in London…"*.
Confirms Rupert's open question: it does **not** currently auto-populate — this
fixes it.

## 4. Referral pointers — add go/IQ link
**Where:** `artifacts/sow-tool/src/components/referral-pointers.tsx`. Order is
already right (client referral → JPM internal coverage → cold).

**Change:** under the "JPMorgan internal" channel, add a **go/IQ** launch link
(reuse the existing `SearchLink`/`ExternalLink` pattern) so the banker can find
the covering JP Morgan banker. Label it clearly internal-only (won't resolve on
external machines). **DEPENDENCY: confirm the exact go/IQ URL.**

## 5. Meeting-note rewriter — preserve numbers verbatim
**Where:** `artifacts/api-server/src/routes/fileNotes.ts` — `REWRITE_INSTRUCTIONS`
(~L26-41) and `ENHANCE_INSTRUCTIONS` (~L47-64). Current rule is the weak
"Maintain all factual information"; figures got stripped on the first pass.

**Change:** add an explicit, hard rule to both prompts: *any number, amount,
date, %, or specific asset value in the note must be carried across verbatim —
never deleted, rounded, or summarised away* (e.g. "£17m property in Whiteleys,
£5m mortgage" must survive). This is the same class of fix as §6.

## 6. Source-of-Wealth statement
**Where:** `artifacts/api-server/src/routes/sourceOfWealth.ts` —
`draftInstructions()` (~L36-68); evidence reference in `sowEvidence.ts`.

**Changes:**
- **Preserve figures.** Same numbers rule: a specific figure ("$30m at Goldman
  Sachs") must not be softened into "a significant banking relationship" and
  dropped. Add the verbatim-figures rule to the SoW prompt.
- **Banker-attestation framing.** Replace the `plausibility` section's
  documentary-evidence boilerplate ("identify the documentary evidence that
  would corroborate it" → the employment-contracts / offer-letters / carried-
  interest / LP-agreements "none reviewed today, obtain during KYC" paragraph)
  with a **banker attestation**: given the client's career arc and market
  experience, the banker attests the stated wealth level is consistent with the
  asset base such a person would be expected to have accumulated. Mirrors what
  onboarding actually asks. (The corroboration *checklist* UI + employer-proof
  stay as-is — they're working well; this is only the statement's prose.)

## 7. Banker-name field (cross-cutting, enables §2 & §3)
The "Banker" field already exists on the prospect (`relationshipManager`). The
work is to **thread it into prep generation** (`prospects.ts` prep input +
`prepSchema.ts` voice/email/call specs) so it populates emails and the call
opener. Make sure it's captured before generating (prompt the banker if empty).

---

## Working well — DO NOT change
Pre-pack generation (~2 min); the profile boxes (notable info, current exposure,
three-phase career, where wealth sits); the five SoW questions; the SoW narrative
(repetition is expected/fine); and the employer-proof lookup (company site →
screenshot → Collect). Protect these while making the changes above.

## 8. Consistency — align ALL profiles to the Samir standard (don't discard)
No prod data, and the research already done on the other profiles must **not go
to waste**. So:
1. Build **Samir** end-to-end as the reference standard (every change above).
2. Then **bring every existing profile up to that same standard** — re-run the
   WRITE/generation steps (prep pack → emails → call → SoW) through the updated
   pipeline so each profile shows the same workflow, structure, and content
   quality. Reuse each profile's existing research/corpus where we can rather
   than re-researching from scratch.
3. The simplified journey (rail + steps, inline SoW) already renders identically
   for every profile from the v3 work — so clicking any profile gives the same
   workflow; this step makes the *content* match the standard too.
Carry canonical facts (£17m Whiteleys/£5m mortgage; $30m Goldman; SoftBank MP)
through file note → SoW so the "preserve numbers" fixes are visibly demonstrated.
Fold in the deferred **pipeline `hasSow`** item so an inline-completed profile
reads as SoW-done, not "Draft Source of Wealth".

This is a follow-up PHASE that runs AFTER the prompt changes land (re-gen must
use the new prompts). Build order below.

---

## Dependencies / open items
1. ~~Rupert's email drafts~~ — RESOLVED: the drafts are the provided screenshots (§2).
2. **go/IQ URL** — §4. Using the internal shortlink `go/iq` until confirmed.
3. ~~Delete test profiles?~~ — RESOLVED: do NOT discard; align all profiles to the
   Samir standard (§8).

## Suggested build order
1. Unblocked now: §1 (watch-item quoting), §5 (file-note numbers), §6 (SoW
   numbers + attestation), §7 (banker-name flow), §3 (call opener), §4 (go/IQ
   link, pending URL).
2. §2 email structure + banker flow now; swap in Rupert's draft copy on arrival.
3. §8 rebuild the Samir reference profile + tidy test data; add `hasSow`.
Each lands on a branch → codex review → PR (the established loop).
