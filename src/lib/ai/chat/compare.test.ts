import { describe, it, expect } from "vitest";
import { compareDoublesPairs } from "./compare";
import { doublesGroupAllDone } from "./fixtures/groups";

describe("compareDoublesPairs", () => {
  it("returns H2H history between two pairs", () => {
    const result = compareDoublesPairs({
      idA: "p1",
      idB: "p2",
      matches: doublesGroupAllDone.matches,
    });
    expect(result.h2h.length).toBeGreaterThan(0);
    expect(result.h2hWinsA + result.h2hWinsB).toBe(result.h2h.length);
  });

  it("returns common opponents", () => {
    const result = compareDoublesPairs({
      idA: "p1",
      idB: "p2",
      matches: doublesGroupAllDone.matches,
    });
    expect(Array.isArray(result.commonOpponents)).toBe(true);
  });

  it("returns empty H2H when pairs never played", () => {
    const result = compareDoublesPairs({
      idA: "p1",
      idB: "unknown",
      matches: doublesGroupAllDone.matches,
    });
    expect(result.h2h.length).toBe(0);
  });
});
