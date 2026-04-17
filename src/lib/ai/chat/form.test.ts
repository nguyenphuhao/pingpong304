import { describe, it, expect } from "vitest";
import { analyzePairForm } from "./form";
import { doublesGroupAllDone } from "./fixtures/groups";

describe("analyzePairForm", () => {
  it("returns win/lose counts for last N", () => {
    const result = analyzePairForm({
      pairId: "p1",
      matches: doublesGroupAllDone.matches,
      lastN: 5,
    });
    expect(result.totalRecent).toBeGreaterThan(0);
    expect(result.wins + result.losses).toBe(result.totalRecent);
  });

  it("detects winning streak", () => {
    const result = analyzePairForm({
      pairId: "p1",
      matches: doublesGroupAllDone.matches,
      lastN: 5,
    });
    expect(result.streak).toMatch(/^W\d+$/);
  });

  it("returns 0 for pair with no matches", () => {
    const result = analyzePairForm({
      pairId: "unknown",
      matches: doublesGroupAllDone.matches,
      lastN: 5,
    });
    expect(result.totalRecent).toBe(0);
    expect(result.streak).toBe("none");
  });

  it("computes avg set diff", () => {
    const result = analyzePairForm({
      pairId: "p1",
      matches: doublesGroupAllDone.matches,
      lastN: 5,
    });
    expect(typeof result.avgSetDiff).toBe("number");
  });
});
