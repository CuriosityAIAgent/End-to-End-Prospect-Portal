import { describe, it, expect } from "vitest";
import { assumptionsToQuestions } from "./assumptionQuestions";
import type { AssumptionLine, WealthEstimate, MoneyRange } from "../types";

const usd = (low: number, base: number, high: number): MoneyRange => ({ low, base, high, currency: "USD" });
const line = (p: Partial<AssumptionLine>): AssumptionLine => ({
  id: "l", label: "x", category: "other", basis: "assumption", sourceRef: "", confidence: "medium", ...p,
});
const estimate = (assumptions: AssumptionLine[], refused = false): WealthEstimate =>
  ({ assumptions, refused, currency: "USD" } as unknown as WealthEstimate);

describe("assumptionsToQuestions", () => {
  it("turns a material carry line into a client-validation question", () => {
    const qs = assumptionsToQuestions(estimate([line({ id: "c", label: "Carry at Fund III", category: "carry_equity", amount: usd(20_000_000, 21_000_000, 22_000_000) })]));
    expect(qs.length).toBe(1);
    expect(qs[0].question).toMatch(/carry/i);
    expect(qs[0].suggestedAnswer.length).toBeGreaterThan(0);
  });

  it("drops a material line with no value (no malformed 'at roughly .' question)", () => {
    const qs = assumptionsToQuestions(estimate([line({ id: "c", label: "Carry, spec failed to parse", category: "carry_equity" })]));
    expect(qs.length).toBe(0);
  });

  it("returns nothing for a refused estimate", () => {
    expect(assumptionsToQuestions(estimate([line({ category: "role_comp", annual: usd(1e6, 1e6, 1e6), years: 5 })], true))).toEqual([]);
  });

  it("ranks higher-value drivers first and respects the max", () => {
    const qs = assumptionsToQuestions(
      estimate([
        line({ id: "small", label: "small asset", category: "known_asset", amount: usd(1e6, 1e6, 1e6) }),
        line({ id: "big", label: "big exit", category: "liquidity_event", amount: usd(80e6, 90e6, 100e6) }),
      ]),
      1,
    );
    expect(qs.length).toBe(1);
    expect(qs[0].question).toMatch(/big exit/i);
  });
});
