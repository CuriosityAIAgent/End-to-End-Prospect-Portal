import { describe, it, expect } from "vitest";
import { parsePrepResponse } from "./prepSchema";

const full = JSON.stringify({
  read: {
    narrative: "Built his wealth founding then selling a logistics group, now an active angel investor.",
    headline: "Ex-founder, mid-eight-figure, post-exit",
    keyFacts: [{ label: "Wealth origin", value: "2019 trade sale" }],
    themes: [
      { id: "origin", heading: "How the wealth was built", takeaway: "Founder exit", facts: [{ text: "Sold to a strategic in 2019", basis: "supported" }] },
    ],
  },
  approach: {
    email: [
      { id: "email-1", label: "News hook", rationale: "recent raise", newsHook: "Fund III close", subject: "JP Morgan Private Bank", body: "Short ask for a 30-minute meeting." },
      { id: "email-2", label: "Warm", rationale: "x", newsHook: null, subject: "Hello", body: "Warm note." },
      { id: "email-3", label: "Direct", rationale: "x", newsHook: null, subject: "Intro", body: "Direct note." },
    ],
    call: [{ id: "call-1", label: "News", rationale: "x", newsHook: "Fund III", opener: "Hi, JPM PB here", flow: ["state remit", "ask for 30 min"] }],
    anticipatedObjections: [{ objection: "Already banked", response: "Complement, not replace." }],
  },
  sourceOfWealth: {
    likelyCategories: ["business_sale"],
    questions: [{ question: "Confirm the 2019 sale proceeds?", why: "establishes source", suggestedAnswer: "~$40M", expectedEvidence: ["SPA"] }],
  },
});

describe("parsePrepResponse", () => {
  it("parses the qualitative narrative into the read", () => {
    const p = parsePrepResponse(full)!;
    expect(p.read!.narrative).toMatch(/founding then selling/);
    expect(p.read!.headline).toMatch(/Ex-founder/);
    expect(p.read!.themes[0].id).toBe("origin");
  });

  it("includes the narrative in the derived flat read (so verification sees it)", () => {
    const p = parsePrepResponse(full)!;
    expect(p.marketRead).toMatch(/Built his wealth founding/);
  });

  it("parses the 3 email variants and the call flow", () => {
    const p = parsePrepResponse(full)!;
    expect(p.approach!.email.length).toBe(3);
    expect(p.approach!.email[0].subject).toBe("JP Morgan Private Bank");
    expect(p.approach!.call[0].flow.length).toBe(2);
  });

  it("tolerates a missing narrative (back-compat with pre-narrative packs)", () => {
    const noNarr = JSON.parse(full);
    delete noNarr.read.narrative;
    const p = parsePrepResponse(JSON.stringify(noNarr))!;
    expect(p.read!.narrative).toBe("");
    expect(p.read!.headline).toMatch(/Ex-founder/);
  });

  it("returns null for a non-JSON reply", () => {
    expect(parsePrepResponse("the model refused to answer")).toBeNull();
  });
});
