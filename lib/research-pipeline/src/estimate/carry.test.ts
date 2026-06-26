import { describe, it, expect } from "vitest";
import { carryNetRange, carryPointsForTier, CARRY_POINTS_TABLE } from "./carry";

describe("carryNetRange", () => {
  it("matches Rupert's Tower Brook example (~$21M/fund: 4.5% on $3bn, ~2x)", () => {
    const r = carryNetRange({
      fundSizeUsd: 3_000_000_000,
      personalCarryPct: { low: 0.04, base: 0.045, high: 0.05 },
      grossMultiple: { low: 1.8, base: 2.0, high: 2.5 },
    });
    // 3bn × (2-1) × 0.20 × 0.045 × (1-0.22) = $21.06M
    expect(r.base).toBeGreaterThan(20_000_000);
    expect(r.base).toBeLessThan(22_000_000);
    expect(r.currency).toBe("USD");
    expect(r.low).toBeLessThanOrEqual(r.base);
    expect(r.high).toBeGreaterThanOrEqual(r.base);
  });

  it("a loss-making fund (multiple < 1) yields zero, never negative", () => {
    const r = carryNetRange({
      fundSizeUsd: 1_000_000_000,
      personalCarryPct: { low: 0.04, base: 0.05, high: 0.06 },
      grossMultiple: { low: 0.8, base: 0.9, high: 1.0 },
    });
    expect(r.low).toBe(0);
    expect(r.base).toBe(0);
    expect(r.high).toBe(0);
  });

  it("zero fund size and negative carry points clamp to zero", () => {
    expect(carryNetRange({ fundSizeUsd: 0, personalCarryPct: { low: 0.05, base: 0.05, high: 0.05 } }).base).toBe(0);
    expect(
      carryNetRange({ fundSizeUsd: 1e9, personalCarryPct: { low: -0.01, base: -0.01, high: -0.01 } }).base,
    ).toBe(0);
  });

  it("honours an explicit zero tax rate (does not fall back to the 22% default)", () => {
    const zero = carryNetRange({ fundSizeUsd: 1e9, personalCarryPct: { low: 0.05, base: 0.05, high: 0.05 }, grossMultiple: { low: 2, base: 2, high: 2 }, taxRate: 0 });
    const taxed = carryNetRange({ fundSizeUsd: 1e9, personalCarryPct: { low: 0.05, base: 0.05, high: 0.05 }, grossMultiple: { low: 2, base: 2, high: 2 }, taxRate: 0.22 });
    expect(zero.base).toBeGreaterThan(taxed.base);
  });
});

describe("carryPointsForTier", () => {
  it("resolves exact canonical tiers", () => {
    expect(carryPointsForTier("senior_partner")).toEqual(CARRY_POINTS_TABLE.senior_partner);
    expect(carryPointsForTier("founder_managing_partner")?.base).toBe(0.2);
  });

  it("tolerates casing and separator drift from the model", () => {
    expect(carryPointsForTier("Senior Partner")?.base).toBe(0.05);
    expect(carryPointsForTier("senior-partner")?.base).toBe(0.05);
    expect(carryPointsForTier("SENIOR_PARTNER")?.base).toBe(0.05);
  });

  it("maps common synonyms to canonical tiers", () => {
    expect(carryPointsForTier("Founder")?.base).toBe(0.2);
    expect(carryPointsForTier("Managing Partner")?.base).toBe(0.2);
    expect(carryPointsForTier("Associate")).toEqual(CARRY_POINTS_TABLE.junior);
    expect(carryPointsForTier("VP")).toEqual(CARRY_POINTS_TABLE.vp_mid);
  });

  it("fails closed (undefined) for genuinely unknown tiers", () => {
    expect(carryPointsForTier("chief mango officer")).toBeUndefined();
    expect(carryPointsForTier("")).toBeUndefined();
  });
});
