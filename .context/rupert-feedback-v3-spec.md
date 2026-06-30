# Prospect Intel — Rupert Feedback v3 (changes + decisions)

Source: fresh recorded feedback from Rupert (2026-06-30). Branch:
`rupert-feedback-v3`. Builds on `rupert-feedback-v2-spec.md`. This captures
intent — it does not override Rupert.

The feedback is all about the prospect **briefing pack** (the `/prospect/:id`
page, the four-step journey: ① Brief & qualify → ② Approach → ③ Meeting → ④
Source of Wealth).

---

> **This PR covers points 1–6 only.** Point 7 (company-employment proof) is a
> follow-up — the design and the verified manual-capture implementation are
> recorded below but deliberately left out of this PR per Rupert's scope ("open
> a PR for 1 to 6").

## What shipped on this branch (points 1–6)

### 1 + 5. "Convert to Client" removed; Source of Wealth opens inline
**Feedback:** *"Convert to client does not make sense… there's no point in having
a button to 'convert to client' for the SOW section to open up — keep it open
and give the ability for users to go up and down easily."*

- Removed the "Convert to Client" CTA + confirm dialog from step ④ on the
  prospect page.
- The real `SourceOfWealthSection` + `CorroborationDocuments` now render **inline
  and open** in step ④, wired to the prospect record (`prospect.data`), not a
  separate assessment. This works with **zero backend change** because
  `useDraftSourceOfWealth` is data-driven (it takes the meeting note + briefing,
  not an assessment id).
- SoW step's "done" state now reflects whether a statement has actually been
  drafted (`sowStatementFields` populated), not whether a convert happened.
- A prospect converted under the **old** flow still shows a small link to its
  earlier assessment (continuity); no data is orphaned.
- The legacy `/assessment/:id` page + `POST /prospects/:id/convert` route are
  left intact for those old records but are no longer part of the primary flow.
- Files: `artifacts/sow-tool/src/pages/prospect.tsx`.

### 2 + 3. Keep the 1→2→3→4 flow; reviewable at all points
**Feedback:** *"keep the same flow of 1,2,3,4… we need to be able to go back and
forth and review the briefing pack at all points of time."*

- Kept the four-step backbone.
- The steps now read as **one continuous document: every step open by default**.
  The rail jumps to any step and highlights the next action; each step can still
  be collapsed individually from its header. (Was: a one-at-a-time accordion.)
- Files: `prospect.tsx` (`openSteps` set + `toggleStep`/`selectStep`).

### 4. "Discussion coverage" removed
**Feedback:** *"Discussion Coverage is redundant and not required — remove that
section."*

- Removed the whole Discussion-coverage grid + the "Enhance note with these
  details" action from the file note. "Rewrite in professional format" stays as
  the single AI action.
- Stored `coverage` data shape is left untouched (back-compat); only the UI is
  gone. The backend enhance path is now simply unused.
- Files: `artifacts/sow-tool/src/components/file-note-panel.tsx`.

### 6. "Supporting documents to collect" framed as banker guidance
**Feedback:** *"Supporting documents to collect — we should have this as a
suggestion to bankers on the kind of documents that will help support the
corroboration of the story."*

- Added explanatory copy framing the list as **suggested** documents that would
  corroborate the wealth story — a prompt for what to ask the client for.
- Files: `artifacts/sow-tool/src/components/corroboration-documents.tsx`.

---

## Point 7 — company-employment proof (FOLLOW-UP, not in this PR)

**Feedback:** *"If a company is mentioned in the briefing pack: go to the
company's website, find the individual in the Team / About Us page, screenshot
their profile, and add it to the Source-of-Wealth corroboration as proof they
work there. We probably need a Playwright integration — and we can reuse the
same for the FCA register extract."*

### Step 1 — manual capture (built + verified, held back from this PR)
A **"Company / employer proof"** block in `corroboration-documents.tsx`:
- Banker enters the employer name → one-click **web search pre-aimed at the
  person's profile on the firm's own Team/About/People page**.
- A field to paste the profile URL where they were found.
- A state control ("Screenshot of profile attached to file") + a printed handoff
  line — mirroring exactly how the FCA fallback works when not auto-configured.

This delivers the corroboration goal today and structures the data
(`CorroborationData.employer`) so the automated capture can populate it later.

### Deferred: the automated Playwright capture (needs an infra decision)
Build it as a **gated capability, identical in shape to the FCA route**
(`fca.ts`): a `/api/corroboration/employer/*` route that, when configured,
launches headless Chromium, finds the company site → the team/about page → the
person, and screenshots the profile into object storage; when **not** configured
the UI shows the manual fallback above. Note re: FCA — it already uses the
**free official FCA API (no scraping)**, so Playwright is *not* needed there; the
reuse Rupert has in mind is the general "visit a page, capture proof" mechanism.

Why deferred rather than shipped:
- New **native dependency** (`playwright`) — can't be esbuild-bundled, must be an
  external in `artifacts/api-server/build.mjs`.
- The Railway deploy must **install Chromium** (`playwright install --with-deps`)
  — a Dockerfile/nixpacks change.
- Screenshots need to land in the existing **object storage** (GCS) and be
  referenced from `CorroborationData.employer`.
- The browser automation can't be verified end-to-end from the dev workspace.

Open question for Rupert/team: green-light the deploy infra (Chromium in
Railway) so the automated capture can be turned on behind the gate?

---

## Codex review — fixed + deferred

Ran `codex review` on the working-tree diff before commit. Fixed:
- **[P1] File-note data loss** — `patch()` rewrote the note from a narrowed
  object, dropping legacy `coverage` (still read by the SoW drafter) on every
  edit. Now spreads the raw value first so untouched fields persist.
- **[P1] Pipeline still said "Convert"** — `journey.ts` labels/next-actions
  ("Convert to Source of Wealth", "Complete conversion", "Ready to convert")
  contradicted point 1. Relabelled to the inline-SoW vocabulary.

Deferred (out of the 1–6 scope; tracked for follow-up). A re-review confirmed
the two P1s above are fixed; the remaining findings are all the legacy /
pipeline-representation theme below — they need a backend `hasSow` field and a
dedup decision, not a briefing-pack edit, and none lose data:
- **Pipeline can't show SoW-done.** `ProspectSummary` has no `hasSow`, so a
  prospect with a completed inline statement still shows at the "sow" stage with
  "Draft Source of Wealth". Needs a `hasSow` field on `GET /prospects` (backend
  + generated client regen).
- **Legacy converted prospects route to their assessment, not inline SoW.**
  `buildJourney` still dedupes a converted prospect in favour of its linked
  assessment (pre-existing behaviour, unchanged here). For legacy records that
  is correct — the SoW data lives on the assessment, which stays reachable; the
  prospect's inline SoW would be empty. New prospects never convert, so they are
  unaffected. Revisit when the assessment entity is retired.
- **Legacy converted prospects** keep the Active/Dormant control hidden
  (`status !== "converted"` guard in `prospect.tsx`), so they can't be re-parked.
  Legacy-only edge case; left as-is.

## Verification
- `pnpm --filter @workspace/sow-tool typecheck` — clean.
- `pnpm --filter @workspace/sow-tool build` — succeeds.
- Browser/runtime behaviour of the inline SoW + free navigation not yet
  exercised in a running app (no DB/server stood up in this workspace).
