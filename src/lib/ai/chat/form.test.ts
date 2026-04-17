import { describe, it, expect } from "vitest";
import type { MatchResolved } from "@/lib/schemas/match";
import { analyzePairForm } from "./form";
import { doublesGroupAllDone } from "./fixtures/groups";

const lossStreakMatches: MatchResolved[] = [
  // p1 wins m1 (oldest)
  {
    id: "m1",
    groupId: "g1",
    pairA: { id: "p1", label: "Cặp 1" },
    pairB: { id: "p2", label: "Cặp 2" },
    table: null,
    bestOf: 3,
    sets: [{ a: 11, b: 5 }, { a: 11, b: 7 }],
    setsA: 2,
    setsB: 0,
    status: "done",
    winner: { id: "p1", label: "Cặp 1" },
  },
  // p1 loses m2, m3 (most recent)
  {
    id: "m2",
    groupId: "g1",
    pairA: { id: "p1", label: "Cặp 1" },
    pairB: { id: "p3", label: "Cặp 3" },
    table: null,
    bestOf: 3,
    sets: [{ a: 5, b: 11 }, { a: 7, b: 11 }],
    setsA: 0,
    setsB: 2,
    status: "done",
    winner: { id: "p3", label: "Cặp 3" },
  },
  {
    id: "m3",
    groupId: "g1",
    pairA: { id: "p1", label: "Cặp 1" },
    pairB: { id: "p4", label: "Cặp 4" },
    table: null,
    bestOf: 3,
    sets: [{ a: 9, b: 11 }, { a: 5, b: 11 }],
    setsA: 0,
    setsB: 2,
    status: "done",
    winner: { id: "p4", label: "Cặp 4" },
  },
];

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

  it("detects losing streak", () => {
    const result = analyzePairForm({
      pairId: "p1",
      matches: lossStreakMatches,
      lastN: 5,
    });
    expect(result.streak).toMatch(/^L\d+$/);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(2);
  });
});
