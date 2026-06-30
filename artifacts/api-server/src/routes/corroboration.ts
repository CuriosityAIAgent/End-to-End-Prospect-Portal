import { Router, type IRouter, type Request, type Response } from "express";
import {
  employerProofConfigured,
  employerProofAvailable,
  captureEmployerProof,
  UnsafeUrlError,
} from "../lib/employerProof";

// Company-employment corroboration (Rupert feedback v3, point 7).
//
// Gated capability, same shape as the FCA route: a `/status` probe lets the UI
// choose the automated capture vs the manual fallback, and the capture endpoint
// degrades gracefully when the headless browser is unavailable.

const router: IRouter = Router();

// Is the automated capture available? Checks the env flag AND that the optional
// playwright package actually loads (Chromium-missing still surfaces at capture
// time as a 503, which the client treats as "fall back to manual").
router.get("/corroboration/status", async (_req: Request, res: Response): Promise<void> => {
  res.json({ configured: await employerProofAvailable() });
});

// Visit the employer's site, find the individual, screenshot their profile.
router.post("/corroboration/employer/capture", async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as { name?: unknown; url?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!name || !url) {
    res.status(400).json({ error: "Provide both the individual's name and a company / profile URL." });
    return;
  }
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: "The URL must start with http(s)://." });
    return;
  }
  if (!employerProofConfigured()) {
    // Mirrors FCA: tell the client to use the manual flow.
    res.status(503).json({ configured: false, error: "Automated capture is not configured." });
    return;
  }

  try {
    const result = await captureEmployerProof({ name, url });
    res.json({ configured: true, ...result });
  } catch (err) {
    // A refused URL (SSRF guard / bad URL) is the caller's fault → 400.
    if (err instanceof UnsafeUrlError) {
      res.status(400).json({ error: err.message });
      return;
    }
    // Distinguish "browser not installed" (capability genuinely unavailable, so
    // the UI should fall back) from a transient capture failure (retryable).
    const message = err instanceof Error ? err.message : String(err);
    const missingBrowser = /Cannot find module 'playwright'|Executable doesn't exist|playwright install/i.test(message);
    req.log?.error({ err }, "Employer proof capture failed");
    if (missingBrowser) {
      res.status(503).json({ configured: false, error: "The headless browser is not installed on the server." });
      return;
    }
    res.status(502).json({ error: "The company site could not be captured. Please try again or attach a screenshot manually." });
  }
});

export default router;
