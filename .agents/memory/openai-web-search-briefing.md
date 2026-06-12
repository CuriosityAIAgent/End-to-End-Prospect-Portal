---
name: OpenAI live web-search briefing
description: How the AI briefing uses OpenAI Responses API web_search, and the sandbox env-var quirk that bites when verifying it.
---

# OpenAI Responses API + live web_search

The prospect briefing uses `openai.responses.create({ model, tools:[{type:"web_search"}], instructions, input })` from `@workspace/integrations-openai-ai-server`. Web citations come from `response.output` → message items → `output_text` parts → `annotations` with `type === "url_citation"` (fields `url`, `title`). Dedupe by url. `response.output_text` is the concatenated text.

**Prompt the model to return ONLY a JSON object** and slice between the first `{` and last `}` before `JSON.parse` — the model sometimes wraps prose/fences around it. Reject empty output (502) rather than persisting a hollow briefing and promoting status.

## Sandbox env-var quirk (important)
**Why:** The `code_execution` JS sandbox does NOT inherit env vars set during the current session (e.g. `AI_INTEGRATIONS_OPENAI_BASE_URL`, `_API_KEY` from `setupReplitAIIntegrations`). Testing AI calls from the sandbox fails on missing creds even though the running server has them.
**How to apply:** Verify AI endpoints from bash/curl against the running workflow (`localhost:80/api/...`) or read `$AI_INTEGRATIONS_OPENAI_*` in a bash shell — not from the code_execution notebook.
