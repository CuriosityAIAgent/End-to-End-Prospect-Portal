import { Router, type IRouter } from "express";

// FCA Financial Services Register — corroboration of a regulated individual.
//
// We call the FREE official FCA Register API (no browser/scraping) and render
// our own structured "register extract" as the corroboration document, with a
// live deep-link so the onboarding officer can re-verify. Needs a free API key
// (email signup at register.fca.org.uk/Developer): set FCA_API_EMAIL +
// FCA_API_KEY. When unset, the endpoints degrade gracefully and the UI falls
// back to a pre-filled deep link the banker can open and print.
//
// Base + auth + endpoints: https://register.fca.org.uk/services/V0.1
//   GET /Search?q=<name>&type=individual
//   GET /Individuals/{IRN}        GET /Individuals/{IRN}/CF
// Headers: X-Auth-Email, X-Auth-Key. Rate limit ~50 req / 10s.

const router: IRouter = Router();

const FCA_BASE = "https://register.fca.org.uk/services/V0.1";

export function fcaConfigured(): boolean {
  return !!process.env.FCA_API_EMAIL && !!process.env.FCA_API_KEY;
}

function fcaHeaders(): Record<string, string> {
  return {
    "X-Auth-Email": process.env.FCA_API_EMAIL ?? "",
    "X-Auth-Key": process.env.FCA_API_KEY ?? "",
    Accept: "application/json",
  };
}

/** Human-facing register pages (for the deep-link fallback + a verifiable link). */
function individualPageUrl(irn: string): string {
  return `https://register.fca.org.uk/s/individual?id=${encodeURIComponent(irn)}`;
}
function searchPageUrl(name: string): string {
  return `https://register.fca.org.uk/s/search?q=${encodeURIComponent(name)}&type=Individuals`;
}

// Discriminate a genuine upstream response (even an empty "no results" one)
// from a failure (timeout / rate-limit / bad key / network) so the routes never
// pass off an outage as "no matches" or an extract with no appointments.
type FcaResult = { ok: true; body: any } | { ok: false; status: number | null };

async function fcaGet(path: string): Promise<FcaResult> {
  try {
    const res = await fetch(`${FCA_BASE}${path}`, {
      headers: fcaHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    // Tolerate an empty body (e.g. 204) without throwing on JSON.parse.
    const text = await res.text();
    return { ok: true, body: text ? JSON.parse(text) : null };
  } catch {
    return { ok: false, status: null };
  }
}

const asArray = (x: unknown): any[] => (Array.isArray(x) ? x : x && typeof x === "object" ? [x] : []);

/** First non-empty string among the candidate keys (FCA field names vary). */
function pick(obj: any, keys: string[]): string {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export interface FcaControlledFunction {
  code: string;
  name: string;
  firm: string;
  effectiveDate: string;
  endDate: string;
  current: boolean;
}

export interface FcaExtract {
  irn: string;
  name: string;
  status: string;
  controlledFunctions: FcaControlledFunction[];
  registerUrl: string;
  asOf: string;
}

// Parse defensively — the register's individual/CF payloads nest under `Data`,
// with controlled functions keyed by code under `Current` / `Previous`, and
// field names that drift. Tolerate shape variation rather than assume it.
export function normaliseIndividual(irn: string, detail: any, cf: any, asOf: string): FcaExtract {
  const d0 = asArray(detail?.Data)[0] ?? {};
  const details = (d0 && typeof d0.Details === "object" && d0.Details) || d0 || {};
  const name = pick(details, ["Full Name", "Commonly Used Name", "Name"]);
  const status = pick(details, ["Status"]);

  const controlledFunctions: FcaControlledFunction[] = [];
  for (const item of asArray(cf?.Data)) {
    for (const bucket of ["Current", "Previous"] as const) {
      const group = item?.[bucket];
      if (!group || typeof group !== "object") continue;
      for (const [cfKey, raw] of Object.entries(group)) {
        for (const entry of asArray(raw)) {
          if (!entry || typeof entry !== "object") continue;
          controlledFunctions.push({
            code: cfKey,
            name: pick(entry, ["Name"]) || cfKey,
            firm: pick(entry, ["Firm Name", "Name of Firm", "Firm", "Current Firm Name"]),
            effectiveDate: pick(entry, ["Effective Date"]),
            endDate: pick(entry, ["End Date", "Suspension / Restriction Effective Date"]),
            current: bucket === "Current",
          });
        }
      }
    }
  }

  return {
    irn,
    name: name || irn,
    status,
    controlledFunctions,
    registerUrl: individualPageUrl(irn),
    asOf,
  };
}

// Is the FCA lookup available? Lets the UI choose auto-fetch vs deep-link fallback.
router.get("/fca/status", (_req, res): void => {
  res.json({ configured: fcaConfigured() });
});

// Search the register for an individual by name.
router.get("/fca/individuals/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (!q) {
    res.status(400).json({ error: "Provide a name to search." });
    return;
  }
  if (!fcaConfigured()) {
    res.json({ configured: false, results: [], fallbackUrl: searchPageUrl(q) });
    return;
  }
  const search = await fcaGet(`/Search?q=${encodeURIComponent(q)}&type=individual`);
  if (!search.ok) {
    res.status(502).json({ error: "The FCA register could not be reached. Please try again." });
    return;
  }
  const results = asArray(search.body?.Data)
    .map((d) => ({
      irn: pick(d, ["Reference Number", "IRN", "Reference"]),
      name: pick(d, ["Name"]),
      status: pick(d, ["Status"]),
    }))
    .filter((r) => r.irn && r.name);
  res.json({ configured: true, results, fallbackUrl: searchPageUrl(q) });
});

// Fetch one individual + controlled functions → a structured corroboration extract.
router.get("/fca/individuals/:irn", async (req, res): Promise<void> => {
  const irn = String(req.params.irn ?? "").trim();
  if (!irn) {
    res.status(400).json({ error: "Provide an FCA reference number (IRN)." });
    return;
  }
  if (!fcaConfigured()) {
    res.status(503).json({ error: "FCA register lookup is not configured." });
    return;
  }
  // The extract promises the individual AND their controlled functions, so both
  // calls must genuinely succeed — otherwise we'd attach a record missing all
  // appointments and pass it off as complete corroboration.
  const [detail, cf] = await Promise.all([
    fcaGet(`/Individuals/${encodeURIComponent(irn)}`),
    fcaGet(`/Individuals/${encodeURIComponent(irn)}/CF`),
  ]);
  if (!detail.ok) {
    if (detail.status === 404) {
      res.status(404).json({ error: "That individual was not found on the FCA register." });
      return;
    }
    res.status(502).json({ error: "Could not retrieve this individual from the FCA register. Please try again." });
    return;
  }
  // A regulated person may genuinely have no controlled functions — treat an
  // empty/absent (404) CF response as "none", but still fail on a real outage
  // (timeout / 5xx / auth) so we never attach a record that's silently missing
  // appointments the register actually holds.
  if (!cf.ok && cf.status !== 404) {
    res.status(502).json({ error: "Could not retrieve the full FCA record. Please try again." });
    return;
  }
  const cfBody = cf.ok ? cf.body : null;
  res.json({ configured: true, extract: normaliseIndividual(irn, detail.body, cfBody, new Date().toISOString()) });
});

export default router;
