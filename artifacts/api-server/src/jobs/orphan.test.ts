import { describe, it, expect } from "vitest";
import { isOrphan, isActiveStatus } from "./orphan";

describe("isActiveStatus", () => {
  it("true for the in-flight statuses, false for terminal", () => {
    for (const s of ["queued", "researching", "drafting", "estimating", "verifying"]) {
      expect(isActiveStatus(s)).toBe(true);
    }
    expect(isActiveStatus("done")).toBe(false);
    expect(isActiveStatus("failed")).toBe(false);
  });
});

describe("isOrphan", () => {
  it("an active job tracked as live in this process is NOT an orphan", () => {
    const live = new Set(["a"]);
    expect(isOrphan({ id: "a", status: "drafting" }, live)).toBe(false);
    expect(isOrphan({ id: "a", status: "queued" }, live)).toBe(false);
  });

  it("an active job NOT tracked here IS an orphan (any active stage, incl. queued)", () => {
    const live = new Set<string>();
    expect(isOrphan({ id: "x", status: "drafting" }, live)).toBe(true);
    // the round-2 false-positive concern (slow live run) can't happen — it's tracked;
    // and the round-3 gap (queued orphan) IS now reclaimable, regardless of age:
    expect(isOrphan({ id: "x", status: "queued" }, live)).toBe(true);
  });

  it("a terminal job is never an orphan even if untracked (don't fail finished runs)", () => {
    const live = new Set<string>();
    expect(isOrphan({ id: "x", status: "done" }, live)).toBe(false);
    expect(isOrphan({ id: "x", status: "failed" }, live)).toBe(false);
  });
});
