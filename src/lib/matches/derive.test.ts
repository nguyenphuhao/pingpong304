import { describe, expect, test } from "vitest";
import {
  deriveSetCounts,
  deriveDoublesWinner,
  deriveSubMatchWinner,
  deriveTeamScore,
  deriveTeamWinner,
} from "./derive";
import type { SubMatch } from "@/lib/schemas/match";

describe("deriveSetCounts", () => {
  test("counts wins per side", () => {
    expect(
      deriveSetCounts([{ a: 11, b: 8 }, { a: 9, b: 11 }, { a: 11, b: 7 }]),
    ).toEqual({ a: 2, b: 1 });
  });
  test("ignores tied sets (a==b)", () => {
    expect(deriveSetCounts([{ a: 11, b: 11 }, { a: 11, b: 8 }])).toEqual({
      a: 1,
      b: 0,
    });
  });
  test("empty → 0/0", () => {
    expect(deriveSetCounts([])).toEqual({ a: 0, b: 0 });
  });
});

describe("deriveDoublesWinner", () => {
  test("bestOf=3, 2-1 → pairA", () => {
    expect(
      deriveDoublesWinner(
        [{ a: 11, b: 8 }, { a: 9, b: 11 }, { a: 11, b: 7 }],
        "p01",
        "p02",
        3,
      ),
    ).toBe("p01");
  });
  test("bestOf=3, 1-2 → pairB", () => {
    expect(
      deriveDoublesWinner(
        [{ a: 9, b: 11 }, { a: 11, b: 8 }, { a: 9, b: 11 }],
        "p01",
        "p02",
        3,
      ),
    ).toBe("p02");
  });
  test("bestOf=3, 1-1 → null (chưa quyết)", () => {
    expect(
      deriveDoublesWinner(
        [{ a: 11, b: 8 }, { a: 9, b: 11 }],
        "p01",
        "p02",
        3,
      ),
    ).toBeNull();
  });
  test("bestOf=5, 2-2 → null", () => {
    expect(
      deriveDoublesWinner(
        [
          { a: 11, b: 8 },
          { a: 9, b: 11 },
          { a: 11, b: 7 },
          { a: 8, b: 11 },
        ],
        "p01",
        "p02",
        5,
      ),
    ).toBeNull();
  });
  test("bestOf=5, 3-0 → pairA", () => {
    expect(
      deriveDoublesWinner(
        [{ a: 11, b: 8 }, { a: 11, b: 7 }, { a: 11, b: 6 }],
        "p01",
        "p02",
        5,
      ),
    ).toBe("p01");
  });
  test("empty sets → null", () => {
    expect(deriveDoublesWinner([], "p01", "p02", 3)).toBeNull();
  });
});

describe("deriveSubMatchWinner", () => {
  const baseSub: SubMatch = {
    id: "tm01-s1",
    label: "Đơn 1",
    kind: "singles",
    playersA: ["t01"],
    playersB: ["t04"],
    bestOf: 3,
    sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }],
  };
  test("singles winner = sideA when count majority", () => {
    expect(deriveSubMatchWinner(baseSub, "tA1", "tA2")).toBe("tA1");
  });
  test("doubles winner = sideB when count majority", () => {
    const sub: SubMatch = {
      ...baseSub,
      kind: "doubles",
      playersA: ["t01", "t02"],
      playersB: ["t04", "t05"],
      sets: [{ a: 8, b: 11 }, { a: 7, b: 11 }],
    };
    expect(deriveSubMatchWinner(sub, "tA1", "tA2")).toBe("tA2");
  });
  test("undecided → null", () => {
    const sub: SubMatch = { ...baseSub, sets: [{ a: 11, b: 8 }] };
    expect(deriveSubMatchWinner(sub, "tA1", "tA2")).toBeNull();
  });
});

describe("deriveTeamScore", () => {
  const mkSub = (a: number, b: number): SubMatch => ({
    id: `s-${a}-${b}`,
    label: "x",
    kind: "singles",
    playersA: ["t01"],
    playersB: ["t04"],
    bestOf: 3,
    sets: [{ a, b }, { a, b }],
  });
  test("counts sub winners", () => {
    const subs = [mkSub(11, 0), mkSub(11, 0), mkSub(0, 11)];
    expect(deriveTeamScore(subs, "tA1", "tA2")).toEqual({
      scoreA: 2,
      scoreB: 1,
    });
  });
  test("undecided subs not counted", () => {
    const subs = [
      mkSub(11, 0),
      { ...mkSub(0, 0), sets: [{ a: 11, b: 8 }] }, // 1-0, undecided
    ];
    expect(deriveTeamScore(subs, "tA1", "tA2")).toEqual({
      scoreA: 1,
      scoreB: 0,
    });
  });
  test("empty individual → 0/0", () => {
    expect(deriveTeamScore([], "tA1", "tA2")).toEqual({ scoreA: 0, scoreB: 0 });
  });
});

describe("deriveTeamWinner", () => {
  const mkSub = (a: number, b: number): SubMatch => ({
    id: `s-${a}-${b}`,
    label: "x",
    kind: "singles",
    playersA: ["t01"],
    playersB: ["t04"],
    bestOf: 3,
    sets: [{ a, b }, { a, b }],
  });
  test("3 subs, 2-1 → teamA", () => {
    const subs = [mkSub(11, 0), mkSub(11, 0), mkSub(0, 11)];
    expect(deriveTeamWinner(subs, "tA1", "tA2")).toBe("tA1");
  });
  test("5 subs, 3-2 → teamB", () => {
    const subs = [
      mkSub(0, 11),
      mkSub(0, 11),
      mkSub(11, 0),
      mkSub(11, 0),
      mkSub(0, 11),
    ];
    expect(deriveTeamWinner(subs, "tA1", "tA2")).toBe("tA2");
  });
  test("3 subs, 1-1 (1 undecided) → null", () => {
    const subs = [
      mkSub(11, 0),
      mkSub(0, 11),
      { ...mkSub(0, 0), sets: [] }, // undecided
    ];
    expect(deriveTeamWinner(subs, "tA1", "tA2")).toBeNull();
  });
  test("empty → null", () => {
    expect(deriveTeamWinner([], "tA1", "tA2")).toBeNull();
  });
});
