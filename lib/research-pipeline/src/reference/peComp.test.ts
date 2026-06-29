import { describe, it, expect } from "vitest";
import {
  peCompReference,
  PE_CASH_COMP_USD,
  PE_COMP_SOURCES,
} from "./peComp";
import { CARRY_POINTS_TABLE, carryPointsForTier } from "../estimate/carry";

describe("PE comp benchmark", () => {
  it("keys the cash-comp table on tiers that round-trip through carryPointsForTier", () => {
    for (const tier of Object.keys(PE_CASH_COMP_USD)) {
      expect(CARRY_POINTS_TABLE).toHaveProperty(tier);
      // The prompt injects these keys as seniorityTier values — they must parse.
      expect(carryPointsForTier(tier)).toBeDefined();
    }
  });

  it("has internally ordered ranges (low ≤ base ≤ high) and rising seniority", () => {
    for (const c of Object.values(PE_CASH_COMP_USD)) {
      expect(c.low).toBeLessThanOrEqual(c.base);
      expect(c.base).toBeLessThanOrEqual(c.high);
    }
    expect(PE_CASH_COMP_USD.partner.base).toBeGreaterThan(PE_CASH_COMP_USD.vp_mid.base);
    expect(PE_CASH_COMP_USD.senior_partner.base).toBeGreaterThan(PE_CASH_COMP_USD.partner.base);
  });

  it("renders a reference block citing all three sources and the partner range", () => {
    const ref = peCompReference();
    for (const s of PE_COMP_SOURCES) expect(ref).toContain(s.name.split(" — ")[0].trim());
    // Leading word on each row must be the canonical seniorityTier key.
    expect(ref).toMatch(/^\s*-\s*partner \(Partner \/ MD\):/m);
    expect(ref).toMatch(/\$700k–\$2m/);
    // Carry % must NOT be stated in the prompt (the carry table prices it).
    expect(ref).not.toMatch(/0\.3|0\.7%/);
  });
});
