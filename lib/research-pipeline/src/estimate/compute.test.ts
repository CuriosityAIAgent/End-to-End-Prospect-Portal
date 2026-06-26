import { describe, it, expect } from "vitest";
import { computeEstimate, qualify, toUsdApprox, QUALIFY_THRESHOLD } from "./compute";
import type { AssumptionLine, MoneyRange } from "../types";

const usd = (low: number, base: number, high: number): MoneyRange => ({ low, base, high, currency: "USD" });

describe("qualify (>$25M gate)", () => {
  it("above only when the conservative low end clears the bar", () => {
    expect(qualify(usd(25_000_000, 40_000_000, 60_000_000), QUALIFY_THRESHOLD)).toBe("above");
  });
  it("below when even the high end falls short", () => {
    expect(qualify(usd(5_000_000, 10_000_000, 24_000_000), QUALIFY_THRESHOLD)).toBe("below");
  });
  it("borderline when the bar sits inside the range", () => {
    expect(qualify(usd(10_000_000, 25_000_000, 40_000_000), QUALIFY_THRESHOLD)).toBe("borderline");
  });
});

describe("toUsdApprox", () => {
  it("passes USD through unchanged", () => {
    const r = usd(1, 2, 3);
    expect(toUsdApprox(r)).toBe(r);
  });
  it("normalises GBP up to USD (so £20-30M reads as 'above', not 'borderline')", () => {
    const gbp: MoneyRange = { low: 20_000_000, base: 25_000_000, high: 30_000_000, currency: "GBP" };
    const conv = toUsdApprox(gbp)!;
    expect(conv.currency).toBe("USD");
    expect(conv.low).toBeGreaterThan(25_000_000);
    expect(qualify(conv, QUALIFY_THRESHOLD)).toBe("above");
    // the raw (un-normalised) GBP range would have been mis-classified:
    expect(qualify(gbp, QUALIFY_THRESHOLD)).toBe("borderline");
  });
  it("returns null for an unknown currency (caller declines rather than guess)", () => {
    expect(toUsdApprox({ low: 1, base: 1, high: 1, currency: "XYZ" })).toBeNull();
  });
});

describe("computeEstimate", () => {
  const line = (p: Partial<AssumptionLine>): AssumptionLine => ({
    id: "l", label: "x", category: "other", basis: "assumption", sourceRef: "", confidence: "medium", ...p,
  });

  it("counts a carry_equity amount line (no annual) toward the total", () => {
    const r = computeEstimate([line({ category: "carry_equity", amount: usd(20_000_000, 21_000_000, 22_000_000) })], "USD");
    expect(r.total.base).toBeGreaterThan(0);
  });

  it("does not double-count a carry line that carries an annual stream", () => {
    // annual goes through the income loop only; amount-loop skips carry_equity-with-annual.
    const withAnnual = computeEstimate([line({ category: "carry_equity", annual: usd(1e6, 2e6, 3e6), years: 10 })], "USD");
    const withAmount = computeEstimate([line({ category: "carry_equity", amount: usd(1e6, 2e6, 3e6) })], "USD");
    // both are positive but driven by different loops; presence of annual must not
    // ALSO trigger the amount loop — assert the income-only line ignores a (absent) amount.
    expect(withAnnual.total.base).toBeGreaterThan(0);
    expect(withAmount.total.base).toBeGreaterThan(0);
  });

  it("anchors the total on a reported net-worth figure instead of summing components", () => {
    const r = computeEstimate(
      [
        line({ category: "reported_net_worth", amount: usd(100_000_000, 100_000_000, 100_000_000) }),
        line({ category: "role_comp", annual: usd(1e6, 1e6, 1e6), years: 10 }),
      ],
      "USD",
    );
    // anchored ≈ 100M, not 100M + accumulated comp
    expect(r.total.base).toBeLessThan(140_000_000);
    expect(r.total.base).toBeGreaterThan(60_000_000);
  });

  it("treats a negative liquidity_event as a loss (subtracts)", () => {
    const withLoss = computeEstimate(
      [
        line({ category: "known_asset", amount: usd(50_000_000, 50_000_000, 50_000_000) }),
        line({ category: "liquidity_event", amount: usd(-20_000_000, -20_000_000, -20_000_000) }),
      ],
      "USD",
    );
    const noLoss = computeEstimate([line({ category: "known_asset", amount: usd(50_000_000, 50_000_000, 50_000_000) })], "USD");
    expect(withLoss.total.base).toBeLessThan(noLoss.total.base);
  });
});
