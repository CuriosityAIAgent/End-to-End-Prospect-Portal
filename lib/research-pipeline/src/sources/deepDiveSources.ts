// ============================================================================
// Deep-dive source registry — where we look for UHNW wealth context
//
// UHNW wealth is rarely held in one obvious place. It sits across operating
// companies, charitable trusts, private foundations, property (often via SPVs
// or trusts) and frequently offshore structures. Generic web search misses
// most of it, so each research angle targets the AUTHORITATIVE registries that
// actually hold the signal. We surface them today via site-targeted SERP
// queries (DataForSEO) + clean extraction (Jina); several also offer direct
// APIs (noted in `api`) to wire as a precision upgrade.
// ============================================================================

import type { ResearchAngle } from "../types";

export interface DeepDiveSource {
  id: string;
  name: string;
  /** Domain used for site-targeted search (site:<domain>). */
  domain: string;
  angle: ResearchAngle;
  region: "uk" | "us" | "global";
  /** What this source yields for a Source-of-Wealth picture. */
  yields: string;
  /** Direct API available to wire later for precision (vs. site-scoped search). */
  api?: { kind: string; note: string };
}

export const DEEP_DIVE_SOURCES: DeepDiveSource[] = [
  // ── Corporate ownership & directorships ────────────────────────────────
  {
    id: "companies-house",
    name: "UK Companies House",
    domain: "find-and-update.company-information.service.gov.uk",
    angle: "corporate",
    region: "uk",
    yields: "Directorships, PSC / beneficial ownership, shareholdings, filing history.",
    api: { kind: "rest", note: "Companies House REST API (free key) — already partially integrated elsewhere." },
  },
  {
    id: "opencorporates",
    name: "OpenCorporates",
    domain: "opencorporates.com",
    angle: "corporate",
    region: "global",
    yields: "Company officerships across ~140 jurisdictions — international anchor.",
    api: { kind: "rest", note: "OpenCorporates API (key)." },
  },
  {
    id: "sec-edgar",
    name: "SEC EDGAR",
    domain: "sec.gov",
    angle: "corporate",
    region: "us",
    yields: "Public-company filings, insider holdings (Form 3/4/5), 13F holdings, Form D private raises.",
    api: { kind: "rest", note: "EDGAR full-text search + submissions API (free, no key)." },
  },

  // ── Trusts & foundations / philanthropy ────────────────────────────────
  {
    id: "charity-commission",
    name: "UK Charity Commission",
    domain: "register-of-charities.charitycommission.gov.uk",
    angle: "trusts_foundations",
    region: "uk",
    yields: "Charitable trusts & foundations, trustees, assets, income — names the people behind the structure.",
    api: { kind: "rest", note: "Charity Commission Register API (key)." },
  },
  {
    id: "oscr",
    name: "OSCR (Scottish Charity Regulator)",
    domain: "oscr.org.uk",
    angle: "trusts_foundations",
    region: "uk",
    yields: "Scottish charities & trustee roles.",
  },
  {
    id: "propublica-nonprofits",
    name: "ProPublica Nonprofit Explorer",
    domain: "projects.propublica.org",
    angle: "trusts_foundations",
    region: "us",
    yields: "US private foundations & nonprofits via IRS Form 990 / 990-PF — assets, officers, grants.",
    api: { kind: "rest", note: "ProPublica Nonprofit Explorer API (free)." },
  },
  {
    id: "candid-guidestar",
    name: "Candid / GuideStar",
    domain: "guidestar.org",
    angle: "trusts_foundations",
    region: "us",
    yields: "Foundation profiles, 990s, trustees and grant-making.",
  },

  // ── Offshore & complex structures ──────────────────────────────────────
  {
    id: "icij-offshore",
    name: "ICIJ Offshore Leaks Database",
    domain: "offshoreleaks.icij.org",
    angle: "offshore",
    region: "global",
    yields: "Offshore companies, trusts and foundations tied to a person (Panama/Pandora/Paradise/Bahamas leaks).",
    api: { kind: "data", note: "ICIJ publishes the full database for download." },
  },

  // ── Property & real assets ─────────────────────────────────────────────
  {
    id: "land-registry",
    name: "HM Land Registry",
    domain: "gov.uk",
    angle: "property",
    region: "uk",
    yields: "UK property ownership (incl. via companies / overseas entities — ODER register).",
    api: { kind: "rest", note: "Land Registry price-paid / commercial APIs." },
  },

  // ── Deals & liquidity events ───────────────────────────────────────────
  {
    id: "crunchbase",
    name: "Crunchbase",
    domain: "crunchbase.com",
    angle: "deals",
    region: "global",
    yields: "Fund roles, portfolio, fundraises and exits — wealth-creation events.",
  },

  // ── Wealth rankings & profile ──────────────────────────────────────────
  {
    id: "forbes",
    name: "Forbes Profiles / Lists",
    domain: "forbes.com",
    angle: "wealth_profile",
    region: "global",
    yields: "Estimated net worth and source-of-wealth narrative.",
  },
  {
    id: "sunday-times-rich-list",
    name: "Sunday Times Rich List",
    domain: "thetimes.co.uk",
    angle: "wealth_profile",
    region: "uk",
    yields: "UK wealth estimates and how it was made.",
  },

  // ── Litigation / public records ────────────────────────────────────────
  {
    id: "courtlistener",
    name: "CourtListener / PACER",
    domain: "courtlistener.com",
    angle: "litigation",
    region: "us",
    yields: "US litigation, judgments, probate — wealth events and red-flag signals.",
    api: { kind: "rest", note: "CourtListener API (free)." },
  },
];

/** Domains to site-target for a given research angle. */
export function domainsForAngle(angle: ResearchAngle): string[] {
  return DEEP_DIVE_SOURCES.filter((s) => s.angle === angle).map((s) => s.domain);
}
