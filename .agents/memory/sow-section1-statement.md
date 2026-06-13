---
name: SoW Section 1 — AI statement replaced manual profile fields
description: Durable decisions behind assessment Section 1 being an AI-drafted Source of Wealth statement instead of manual profile fields.
---

Assessment Section 1 was changed from manual `profile.*` fields to an AI-drafted **Source of Wealth statement** (narrative sections + a manual "additional" field) behind a preview→accept flow. The decisions worth keeping consistent:

**Legacy `profile.*` data is intentionally retained, not deleted/migrated.**
**Why:** existing assessments already hold `profile.*` answers in the `data` jsonb blob; the approved plan was to stop rendering/counting them, not to destructively rewrite live records.
**How to apply:** don't "tidy up" by deleting `profile.*` keys or the unused legacy catalog export. If you ever surface legacy data, read it from the blob — the schema is unchanged.

**Completion counts only the required narrative spine (overview + plausibility).**
**Why:** the middle wealth-mode sections are legitimately empty when the inputs give no basis, so counting them would punish correct blanks.

**The draft is no-fabrication and an all-empty result is a valid 200, not an error.**
**Why:** "the meeting note/briefing gave no basis" is a real, expected outcome the UI guides the banker through; 502 is reserved for genuine model/parse failure. Sections with no basis come back empty; inferences are framed as plausibility. No-fabrication is prompt-enforced (not guaranteed), so the preview→accept human gate is load-bearing — never auto-fill the blob from model output.

This follows the same convention as the other SoW AI routes (file-note rewrite/enhance, prospect briefing).
