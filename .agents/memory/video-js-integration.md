---
name: video-js scaffold & SoW overview video integration
description: Gotchas wiring a video-js artifact into the SoW tool — scaffold typecheck quirk and the manual export→manifest pipeline.
---

# video-js scaffold tsconfig lacks DOM lib

A freshly scaffolded `video-js` artifact's `tsconfig.json` extends `tsconfig.base.json` (which sets `lib: ["es2022"]`, no DOM) and does NOT add a DOM lib of its own. The scaffold runs fine via Vite/esbuild, but `tsc` fails — including the untouched scaffold files (`main.tsx`, `lib/video/hooks.ts`) with "Cannot find name 'window'/'document'".

**Why it matters:** root `pnpm run typecheck` includes `./artifacts/**`, so a video artifact silently breaks the full typecheck until fixed.

**How to apply:** add `"lib": ["esnext", "dom", "dom.iterable"]` to the artifact's `tsconfig.json` `compilerOptions` (mirrors `artifacts/sow-tool/tsconfig.json`). Pure type-level fix; no runtime change.

# The overview explainer video reaches the app only via a manual step

video-js export is a **manual preview-pane action** — the agent cannot headlessly produce/host an mp4. So `artifacts/sow-tool/src/lib/videoManifest.ts` ships intentionally empty and every consumer (overview player on Journey home, per-section "i" video toggle) degrades to text-only.

**To actually surface a video:** export it from the preview pane → upload to object storage → add a manifest entry (e.g. `overview`) whose `videoUrl` points at `/api/storage/public-objects/<path>`. Until then the player/toggle stay hidden by design.
