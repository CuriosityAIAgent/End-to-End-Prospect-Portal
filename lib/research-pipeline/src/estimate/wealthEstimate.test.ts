import { describe, it, expect } from "vitest";
import { parseLedger } from "./wealthEstimate";

const ledger = (assumptions: unknown[]) => JSON.stringify({ refused: false, currency: "USD", headline: "h", assumptions });

describe("parseLedger — carry materialisation (the 'code-computed, never the model's' invariant)", () => {
  it("computes the carry amount from a valid carry spec (model supplies inputs, code the number)", () => {
    const d = parseLedger(ledger([
      { id: "c", label: "Carry, senior partner, $3bn fund", category: "carry_equity", carry: { fundSizeUsd: 3_000_000_000, seniorityTier: "senior_partner", grossMultiple: { low: 1.8, base: 2.0, high: 2.5 } } },
    ]))!;
    const c = d.lines[0];
    expect(c.amount).toBeDefined();
    expect(c.amount!.base).toBeGreaterThan(15_000_000);
    expect(c.amount!.currency).toBe("USD");
    expect(c.annual).toBeUndefined();
  });

  it("DROPS a model-supplied amount on a carry line that has no valid carry spec", () => {
    // codex P1: a carry_equity line with a model amount but no spec must not be counted.
    const d = parseLedger(ledger([
      { id: "c", label: "fake carry", category: "carry_equity", amount: { low: 5e8, base: 5e8, high: 5e8 } },
    ]))!;
    expect(d.lines[0].amount).toBeUndefined();
  });

  it("keeps a legacy annual carry stream (income-style) untouched", () => {
    const d = parseLedger(ledger([
      { id: "c", label: "legacy carry", category: "carry_equity", annual: { low: 1e6, base: 2e6, high: 3e6 }, years: 10 },
    ]))!;
    expect(d.lines[0].annual).toBeDefined();
    expect(d.lines[0].amount).toBeUndefined();
  });

  it("prefers the code-computed carry when the model wrongly supplies BOTH carry and annual", () => {
    const d = parseLedger(ledger([
      { id: "c", label: "both", category: "carry_equity", carry: { fundSizeUsd: 2e9, seniorityTier: "partner" }, annual: { low: 1e6, base: 2e6, high: 3e6 }, years: 10 },
    ]))!;
    expect(d.lines[0].amount).toBeDefined(); // carry computed
    expect(d.lines[0].annual).toBeUndefined(); // stream dropped
  });

  it("drops a carry line whose tier is unrecognised garbage (fail closed)", () => {
    const d = parseLedger(ledger([
      { id: "c", label: "garbage tier", category: "carry_equity", carry: { fundSizeUsd: 2e9, seniorityTier: "chief mango officer" } },
    ]))!;
    // no valid pct → carry spec rejected → no model amount to keep → no value
    expect(d.lines[0].amount).toBeUndefined();
  });

  it("returns null for non-JSON", () => {
    expect(parseLedger("nope")).toBeNull();
  });
});
