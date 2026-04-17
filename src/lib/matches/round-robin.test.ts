import { describe, expect, test } from "vitest";
import {
  generatePairings,
  computeMatchDiff,
  nextMatchId,
} from "./round-robin";

describe("generatePairings", () => {
  test("4 entries → 6 pairings (i<j)", () => {
    const r = generatePairings(["p01", "p02", "p03", "p04"]);
    expect(r).toEqual([
      { a: "p01", b: "p02" },
      { a: "p01", b: "p03" },
      { a: "p01", b: "p04" },
      { a: "p02", b: "p03" },
      { a: "p02", b: "p04" },
      { a: "p03", b: "p04" },
    ]);
  });
  test("empty → []", () => {
    expect(generatePairings([])).toEqual([]);
  });
  test("single → []", () => {
    expect(generatePairings(["p01"])).toEqual([]);
  });
  test("2 entries → 1 pairing", () => {
    expect(generatePairings(["p01", "p02"])).toEqual([{ a: "p01", b: "p02" }]);
  });
});

describe("computeMatchDiff", () => {
  test("first run (no current) → add all", () => {
    const r = computeMatchDiff(
      [],
      [{ a: "p01", b: "p02" }, { a: "p01", b: "p03" }],
    );
    expect(r.keep).toEqual([]);
    expect(r.delete).toEqual([]);
    expect(r.add).toEqual([
      { a: "p01", b: "p02" },
      { a: "p01", b: "p03" },
    ]);
  });
  test("idempotent re-run → keep all", () => {
    const current = [
      { id: "dm01", a: "p01", b: "p02" },
      { id: "dm02", a: "p01", b: "p03" },
    ];
    const r = computeMatchDiff(current, [
      { a: "p01", b: "p02" },
      { a: "p01", b: "p03" },
    ]);
    expect(r.keep.map((m) => m.id)).toEqual(["dm01", "dm02"]);
    expect(r.delete).toEqual([]);
    expect(r.add).toEqual([]);
  });
  test("canonical order match (p02-p01 == p01-p02)", () => {
    const current = [{ id: "dm01", a: "p02", b: "p01" }];
    const r = computeMatchDiff(current, [{ a: "p01", b: "p02" }]);
    expect(r.keep.map((m) => m.id)).toEqual(["dm01"]);
    expect(r.delete).toEqual([]);
    expect(r.add).toEqual([]);
  });
  test("entries changed → keep matching, delete stale, add new", () => {
    const current = [
      { id: "dm01", a: "p01", b: "p02" },
      { id: "dm02", a: "p01", b: "p03" },
      { id: "dm03", a: "p02", b: "p03" },
    ];
    // Swap p03 → p04
    const r = computeMatchDiff(current, [
      { a: "p01", b: "p02" },
      { a: "p01", b: "p04" },
      { a: "p02", b: "p04" },
    ]);
    expect(r.keep.map((m) => m.id).sort()).toEqual(["dm01"]);
    expect(r.delete.sort()).toEqual(["dm02", "dm03"]);
    expect(r.add).toEqual([
      { a: "p01", b: "p04" },
      { a: "p02", b: "p04" },
    ]);
  });
  test("empty target → delete all", () => {
    const current = [{ id: "dm01", a: "p01", b: "p02" }];
    const r = computeMatchDiff(current, []);
    expect(r.delete).toEqual(["dm01"]);
    expect(r.add).toEqual([]);
  });
});

describe("nextMatchId", () => {
  test("empty → first ID with prefix", () => {
    expect(nextMatchId("dm", [])).toBe("dm01");
  });
  test("max+1 (no hole reuse)", () => {
    expect(nextMatchId("dm", ["dm01", "dm03"])).toBe("dm04");
  });
  test("respects pad length", () => {
    expect(nextMatchId("tm", ["tm09"])).toBe("tm10");
  });
  test("ignores non-matching prefix", () => {
    expect(nextMatchId("dm", ["tm01", "tm02"])).toBe("dm01");
  });
});
