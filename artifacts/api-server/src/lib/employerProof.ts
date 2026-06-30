// Company-employment corroboration via a headless browser.
//
// Goal (Rupert feedback v3, point 7): when a company is named in the briefing,
// visit the firm's own site, find the individual on a Team / About / People
// page, and capture a screenshot of their profile as proof of employment — the
// evidence that backs the Source of Wealth story.
//
// OPTIONAL capability, gated exactly like the FCA lookup. `playwright` is an
// OPTIONAL dependency and the browser binaries must be installed in the deploy
// (`pnpm exec playwright install --with-deps chromium`); set
// EMPLOYER_PROOF_ENABLED=true once they are. When the flag is off or the import
// fails, the routes report `configured:false` and the UI falls back to the
// manual flow (find + paste URL + attach screenshot to the file).
//
// NOTE: this browser-automation path has not been exercised end to end in CI —
// validate against a real site + Chromium before enabling the flag in prod.

import { lookup } from "node:dns/promises";
import net from "node:net";

export function employerProofConfigured(): boolean {
  return process.env.EMPLOYER_PROOF_ENABLED === "true";
}

/** Capture is genuinely available only if the optional browser package loads. */
export async function employerProofAvailable(): Promise<boolean> {
  if (!employerProofConfigured()) return false;
  try {
    await import("playwright");
    return true;
  } catch {
    return false;
  }
}

/** A URL we refused to fetch (SSRF guard) — surfaced to the client as a 400. */
export class UnsafeUrlError extends Error {}

// Block loopback / private / link-local / CGNAT / metadata ranges so the
// capture endpoint can't be turned into an SSRF probe of the internal network.
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::1" || v6 === "::") return true;
  if (v6.startsWith("fe80")) return true; // link-local
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // unique-local
  if (v6.startsWith("::ffff:")) {
    const mapped = v6.split(":").pop() ?? "";
    if (net.isIPv4(mapped)) return isPrivateIp(mapped);
  }
  return false;
}

/**
 * Validate a navigation target: http(s) only, and every resolved address must
 * be public. Returns the parsed URL. NOTE: there is a residual DNS-rebinding
 * gap between this lookup and the browser's own resolution — acceptable for an
 * off-by-default, gated capability, but worth pinning the IP if this is ever
 * exposed to untrusted callers.
 */
export async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http(s) URLs can be captured.");
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    throw new UnsafeUrlError("That host could not be resolved.");
  }
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) {
    throw new UnsafeUrlError("Refusing to capture a private or internal address.");
  }
  return url;
}

export type Confidence = "high" | "medium" | "low";

export interface EmployerCaptureResult {
  found: boolean;
  /** The page the screenshot was taken from (landing or a linked team page). */
  profileUrl: string;
  /** Text around the matched name — the human-readable corroboration snippet. */
  matchedText: string;
  confidence: Confidence;
  /** PNG screenshot, base64-encoded (no `data:` prefix). Undefined on failure. */
  screenshotBase64?: string;
}

// Slugs that commonly lead to a firm's people/leadership pages. Used both to
// rank candidate links and to recognise that we are already on such a page.
const TEAM_HINTS = [
  "team", "about", "people", "leadership", "our-team", "who-we-are",
  "management", "partners", "our-people", "meet-the-team", "staff", "founders",
];

const NAV_TIMEOUT_MS = 30_000;
const MAX_TEAM_PAGES = 4;

/** Case-insensitive whole-ish-word presence of the name in a blob of text. */
function nameInText(name: string, text: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  return text.toLowerCase().includes(n);
}

/** A short snippet of `text` centred on the first mention of `name`. */
function snippetAround(name: string, text: string, radius = 220): string {
  const idx = text.toLowerCase().indexOf(name.trim().toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + name.length + radius);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

/**
 * Visit `url`, try to locate `name` on the page (or on a linked team/about
 * page), and screenshot the profile. Never throws for a "not found" — that is a
 * legitimate result the banker should see. Throws only on infrastructure
 * failure (playwright missing, launch failure) so the route can fall back.
 */
export async function captureEmployerProof(opts: {
  name: string;
  url: string;
}): Promise<EmployerCaptureResult> {
  const { name, url } = opts;

  // SSRF guard: the initial target must resolve to a public address.
  const initial = await assertSafeUrl(url);

  // Lazy import so the server boots and runs without playwright installed.
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1600 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    });

    // SSRF defence-in-depth: intercept EVERY request the browser makes
    // (navigations, 30x redirects, and subresources like img/iframe/script) and
    // abort any that resolves to a private/internal address or uses a non-web
    // scheme. The initial assertSafeUrl check alone can't stop a public page
    // from redirecting Chromium to, or embedding, an internal target.
    const hostPublic = new Map<string, boolean>();
    await context.route("**/*", async (route) => {
      const reqUrl = route.request().url();
      let u: URL;
      try {
        u = new URL(reqUrl);
      } catch {
        await route.abort();
        return;
      }
      if (u.protocol === "data:" || u.protocol === "blob:") {
        await route.continue();
        return;
      }
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        await route.abort();
        return;
      }
      let ok = hostPublic.get(u.hostname);
      if (ok === undefined) {
        try {
          const addrs = await lookup(u.hostname, { all: true });
          ok = addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
        } catch {
          ok = false;
        }
        hostPublic.set(u.hostname, ok);
      }
      if (ok) await route.continue();
      else await route.abort();
    });

    const page = await context.newPage();

    // `page.evaluate` callbacks execute in the browser; reach the DOM through
    // `globalThis` so this file type-checks under the server's Node lib (no DOM).
    const readBodyText = () =>
      page.evaluate(() => ((globalThis as any).document?.body?.innerText as string) ?? "");

    const shoot = async (profileUrl: string, confidence: Confidence, found: boolean) => {
      const bodyText = await readBodyText();
      const matchedText = found ? snippetAround(name, bodyText) : "";
      // Prefer an element-level shot tightly around the name; fall back to the
      // full page when we can't isolate it.
      let buf: Buffer | null = null;
      if (found) {
        try {
          const locator = page.getByText(name, { exact: false }).first();
          await locator.scrollIntoViewIfNeeded({ timeout: 3_000 });
          buf = await locator.screenshot({ timeout: 5_000 });
        } catch {
          buf = null;
        }
      }
      if (!buf) buf = await page.screenshot({ fullPage: true });
      return {
        found,
        profileUrl,
        matchedText,
        confidence,
        screenshotBase64: buf.toString("base64"),
      } satisfies EmployerCaptureResult;
    };

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });

    // 1) Already on a page that names the person → highest confidence.
    const landingText = await readBodyText();
    if (nameInText(name, landingText)) {
      return await shoot(page.url(), "high", true);
    }

    // 2) Otherwise hunt for team/about pages linked from here and check each.
    const candidates: string[] = await page.evaluate((hints: string[]) => {
      const doc: any = (globalThis as any).document;
      const out: string[] = [];
      for (const a of Array.from(doc.querySelectorAll("a[href]")) as any[]) {
        const href: string = a.href;
        const label = (((a.textContent as string) ?? "") + " " + href).toLowerCase();
        if (hints.some((h) => label.includes(h))) out.push(href);
      }
      return Array.from(new Set(out));
    }, TEAM_HINTS);

    // Only follow links on the SAME ORIGIN (scheme + host + port) as the initial
    // target — a scraped link must never let us pivot to a different site/port
    // or an internal host. The request interception above is the backstop.
    const sameOrigin = candidates.filter((href) => {
      try {
        return new URL(href).origin === initial.origin;
      } catch {
        return false;
      }
    });

    for (const href of sameOrigin.slice(0, MAX_TEAM_PAGES)) {
      try {
        await page.goto(href, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
        const text = await readBodyText();
        if (nameInText(name, text)) {
          return await shoot(page.url(), "medium", true);
        }
      } catch {
        // Skip a dead/blocked candidate link and keep looking.
      }
    }

    // 3) Not found — return the landing page shot so the banker can judge.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }).catch(() => {});
    return await shoot(url, "low", false);
  } finally {
    await browser.close();
  }
}
