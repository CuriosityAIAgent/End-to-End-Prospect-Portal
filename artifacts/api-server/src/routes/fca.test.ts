import { describe, it, expect } from "vitest";
import { normaliseIndividual } from "./fca";

const ASOF = "2026-06-29T00:00:00.000Z";

describe("normaliseIndividual", () => {
  it("pulls name + status from the nested Details and lists current/previous CFs", () => {
    const detail = {
      Data: [{ Details: { "Full Name": "Jane Q Banker", IRN: "JQB00001", Status: "Active" } }],
    };
    const cf = {
      Data: [
        {
          Current: {
            "(1)SMF1 Chief Executive": [
              { Name: "SMF1 Chief Executive", "Firm Name": "Acme Capital LLP", "Effective Date": "01/03/2018" },
            ],
          },
          Previous: {
            "(2)SMF3 Executive Director": [
              { Name: "SMF3 Executive Director", "Firm Name": "Old Partners Ltd", "Effective Date": "01/01/2010", "End Date": "31/12/2017" },
            ],
          },
        },
      ],
    };

    const x = normaliseIndividual("JQB00001", detail, cf, ASOF);
    expect(x.name).toBe("Jane Q Banker");
    expect(x.status).toBe("Active");
    expect(x.irn).toBe("JQB00001");
    expect(x.registerUrl).toContain("JQB00001");
    expect(x.asOf).toBe(ASOF);

    const current = x.controlledFunctions.filter((c) => c.current);
    const previous = x.controlledFunctions.filter((c) => !c.current);
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({ name: "SMF1 Chief Executive", firm: "Acme Capital LLP", effectiveDate: "01/03/2018" });
    expect(previous).toHaveLength(1);
    expect(previous[0].firm).toBe("Old Partners Ltd");
    expect(previous[0].endDate).toBe("31/12/2017");
  });

  it("tolerates a single CF entry given as an object (not an array)", () => {
    const detail = { Data: [{ Details: { Name: "Solo Director", Status: "Active" } }] };
    const cf = { Data: [{ Current: { "(1)SMF1": { Name: "SMF1", "Firm Name": "One Firm" } } }] };
    const x = normaliseIndividual("AAA1", detail, cf, ASOF);
    expect(x.name).toBe("Solo Director");
    expect(x.controlledFunctions).toHaveLength(1);
    expect(x.controlledFunctions[0]).toMatchObject({ firm: "One Firm", current: true });
  });

  it("degrades safely when CF data is missing or empty, falling back to the IRN for name", () => {
    const x = normaliseIndividual("ZZZ9", { Data: [] }, null, ASOF);
    expect(x.name).toBe("ZZZ9");
    expect(x.status).toBe("");
    expect(x.controlledFunctions).toEqual([]);
  });

  it("falls back to the cf-code key when an entry has no Name", () => {
    const detail = { Data: [{ Details: { "Full Name": "No Name CFs", Status: "Inactive" } }] };
    const cf = { Data: [{ Current: { "(99)SMFX Something": [{ "Firm Name": "Firm X" }] } }] };
    const x = normaliseIndividual("BBB2", detail, cf, ASOF);
    expect(x.controlledFunctions[0].name).toBe("(99)SMFX Something");
    expect(x.controlledFunctions[0].firm).toBe("Firm X");
  });
});
