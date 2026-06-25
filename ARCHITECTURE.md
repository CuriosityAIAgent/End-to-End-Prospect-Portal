# What this is — in plain terms

A **banker-facing workspace** that runs a private banker's whole relationship
lifecycle, from first contact to an onboarded client, on one rail:

> **Identify → Cold Call → Brief → Meet → Onboard**

It does two jobs: (1) help the banker **prepare** for a prospect using deep,
verified research, and (2) capture a regulator-facing **Source of Wealth (SoW)**
file when that prospect becomes a client.

---

## The screens

| Screen | Route | What the banker does |
|--------|-------|----------------------|
| **Journey home** | `/` | Sees every relationship (prospects + assessments) on the 5-stage rail, a "Next Actions" worklist, and live counts. Starting point. |
| **Prospect workspace** | `/prospect/:id` | Everything pre-client: the **prep pack** (below), a cold-call script, an AI **briefing**, the systematic prospecting profile, a meeting file note, and a "convert to client assessment" button. |
| **Assessment workspace** | `/assessment/:id` | The KYC file: the **Source of Wealth statement**, applicable wealth categories + document checklists, source of funds, plausibility checks, red flags, sign-off. Autosaves; prints. |
| **Pipeline** | `/prospecting` | The prospect list + pipeline totals. |

---

## The features

- **Deep research** — for a named prospect, searches many angles at once
  (companies, **trusts & foundations, offshore structures**, philanthropy, deals,
  property) across authoritative sources, not just a single web search.
- **Prep pack** ("name in → advisor-ready prep") — produces a **cold-call
  script**, the right **Source-of-Wealth questions with anticipated answers + the
  documents to expect**, and a **market read** of how the wealth was likely built.
  A weaker advisor walks in prepared; they validate each point with the client.
- **Net-worth qualification (>$25M?)** — alongside the prep, a defensible
  net-worth estimate is built as an assumption *ledger* (the model grounds the
  inputs, the **code** computes the figure). At the prospecting stage it's reduced
  to the one thing that matters: does the prospect clear the **$25M** bar —
  **Qualifies / Borderline / Below**? (A precise range is too wide to be useful;
  it's kept internally to drive the verdict + the SoW questions.) For PE /
  hedge-fund principals a **carried-interest model** estimates carry from
  `fund size × (multiple − 1) × carry pool × carry points × (1 − tax)`, shown as
  editable workings the banker uses as a conversation hook. All figures in USD.
- **AI briefing** — a pre-meeting brief: summary, talking points, warm referral
  routes, recommended approach, with cited sources.
- **Source of Wealth statement** — drafts a regulator-facing narrative (six
  sections) from the meeting note + briefing. Preview → accept; never auto-fills.
- **Meeting file note** — free-form note → AI "rewrite into a professional note";
  an 8-dimension coverage grid prompts what a complete meeting touches.
- **Voice transcription** — dictate a note instead of typing.
- **Verification on every AI output** — see the engine below.

---

## How it's orchestrated — the engine

The core idea: **deep research → Claude writes → OpenAI verifies → banker validates.**
Four roles, each a different service, wired together in `lib/research-pipeline`:

```
  [ prospect name + a few details ]
            │
            ▼
  1. RESEARCH  ──  DataForSEO (broad, structured search) + Jina (clean page text)
            │       fans out across wealth angles → one evidence corpus
            ▼
  2. WRITE    ──  Claude (Anthropic)
            │       drafts the briefing / prep / SoW statement, grounded ONLY in
            │       that corpus. Never asserts what the sources don't support.
            ▼
  3. VERIFY   ──  OpenAI (a DIFFERENT model on purpose)
            │       checks each claim against the source material:
            │       supported / inference / unsupported → confidence + flags
            ▼
  4. VALIDATE ──  the banker
                  reviews flagged claims and confirms with the client before
                  anything enters the record.
```

Why two different AI providers? An independent model is far better at catching
the writer's own mistakes than asking the writer to grade itself. Claude writes,
OpenAI verifies — the cross-check is the trust layer.

Running alongside is the **net-worth estimator** (`lib/research-pipeline/src/estimate`):
the model emits a grounded assumption *ledger* — never a prose number — the code
computes the ranges deterministically, an independent model validates each line,
and the result is reduced to the **>$25M qualification gate**. Carried interest is
modelled explicitly for financial sponsors (fund size + seniority → carry points →
an after-tax figure the code, not the model, computes).

**Graceful degradation:** every external service is optional. No DataForSEO/Jina
→ falls back to the model's own web search. No Anthropic key → OpenAI writes. No
database → the app still boots and serves; data endpoints just wait for the DB.

---

## How the pieces fit (tech)

A pnpm monorepo. One thing runs in production: **`api-server`** (Express), which
also serves the **`sow-tool`** React frontend. Everything else is a build-time
library.

| Piece | Role |
|-------|------|
| `artifacts/sow-tool` | React + Vite frontend (the screens). Editorial JPC design. |
| `artifacts/api-server` | Express API + serves the frontend. The only runtime service. |
| `lib/research-pipeline` | The engine: deepResearch, write (Claude), verify (OpenAI), deep-dive source registry, SoW evidence reference. |
| `lib/db` | Postgres schema (Drizzle ORM): `prospects` + `assessments`. |
| `lib/api-spec` → `api-zod` / `api-client-react` | OpenAPI contract → generated validators + typed React hooks. |
| `lib/integrations-openai-ai-*` | OpenAI client (verify, transcription, image, audio). |

Data: each prospect/assessment is one row with a flexible `data` JSON blob, so
the questionnaire can evolve without DB migrations.

See [README.md](README.md) for run/build details and [DEPLOY.md](DEPLOY.md) for
deployment + environment variables.
