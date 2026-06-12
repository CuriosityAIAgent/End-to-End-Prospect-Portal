---
name: SoW Journey home & convert invariants
description: How the sow-tool unified "Prospecting Journey" home derives stages, the dedup rule between prospects and assessments, and a convert dead-end gotcha.
---

# SoW Journey home (`/`)

The home page (`pages/journey.tsx`) shows ONE worklist merging prospects + onboarding assessments across a 5-stage rail: Identify → Cold Call → Brief → Meet → Onboard. There is **no backend stage column** — stage is derived purely on the frontend in `lib/journey.ts` (`buildJourney`, `stageCounts`). The prospect-status enum maps onto stages (researching→cold_call, briefed→brief, outreach→meet, converted→onboard, identified/dormant→identify).

## Dedup rule (decision — keep consistent)
A prospect is dropped from the worklist ONLY when its `convertedAssessmentId` points at an assessment that is actually present in the fetched assessments list — then it's represented by that assessment at Onboard. A prospect marked `converted` with NO matching assessment must still surface (at Onboard, action "Complete conversion") so nothing silently vanishes.

**Why:** both `GET /assessments` and `GET /prospects` are unpaginated full-table queries, so the assessment-id Set is complete and the existence check is reliable. Keying on "id exists in list" (not just "convertedAssessmentId is set") is what makes the manual-converted-without-assessment case visible instead of lost.

**How to apply:** if these list endpoints ever become paginated/filtered, the dedup check breaks (a real assessment could be absent from the page and its prospect would wrongly resurface) — revisit the rule then.

## Convert dead-end gotcha (pre-existing server behavior)
`POST /prospects/:id/convert` returns 409 whenever `convertedAssessmentId != null`. So if a converted prospect's assessment is later deleted, the prospect resurfaces on the journey with a "Complete conversion" action that can never succeed (the server still thinks it's converted). The server does not clear `convertedAssessmentId` on assessment delete. Fixing this is a server change (out of scope for the frontend redesign).
