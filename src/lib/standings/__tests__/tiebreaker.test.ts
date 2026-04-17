// src/lib/standings/__tests__/tiebreaker.test.ts
import { describe, expect, test } from "vitest";
import { applyDoublesRanking, applyTeamRanking } from "../tiebreaker";
import type { StandingRow, DoublesMatchForTiebreak, TeamMatchForTiebreak } from "../types";

function mkRow(
  id: string,
  won: number,
  lost: number,
  setsWon: number,
  setsLost: number,
): StandingRow {
  return {
    entryId: id,
    entry: `Entry ${id}`,
    played: won + lost,
    won,
    lost,
    diff: setsWon - setsLost,
    setsWon,
    setsLost,
    points: won * 2,
    rank: 0,
  };
}

function mkDoublesMatch(
  pairAId: string,
  pairBId: string,
  setsA: number,
  setsB: number,
  winnerId: string | null = setsA > setsB ? pairAId : setsB > setsA ? pairBId : null,
): DoublesMatchForTiebreak {
  return {
    pairA: { id: pairAId },
    pairB: { id: pairBId },
    setsA,
    setsB,
    status: "done",
    winner: winnerId ? { id: winnerId } : null,
  };
}

describe("applyDoublesRanking", () => {
  test("no ties — sequential ranks", () => {
    const rows = [mkRow("A", 3, 0, 9, 2), mkRow("B", 2, 1, 6, 4), mkRow("C", 1, 2, 3, 7), mkRow("D", 0, 3, 1, 9)];
    const matches: DoublesMatchForTiebreak[] = [];
    const ranked = applyDoublesRanking(rows, matches);
    expect(ranked.map((r) => [r.entryId, r.rank])).toEqual([
      ["A", 1], ["B", 2], ["C", 3], ["D", 4],
    ]);
  });

  test("2-way tie — H2H resolves", () => {
    const rows = [mkRow("A", 2, 1, 6, 4), mkRow("B", 2, 1, 7, 3), mkRow("C", 0, 2, 1, 7)];
    const matches = [mkDoublesMatch("A", "B", 2, 1)];
    const ranked = applyDoublesRanking(rows, matches);
    expect(ranked[0].entryId).toBe("A");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].entryId).toBe("B");
    expect(ranked[1].rank).toBe(2);
  });

  test("2-way tie — H2H not played, sets diff resolves", () => {
    const rows = [mkRow("A", 2, 1, 6, 3), mkRow("B", 2, 1, 5, 4)];
    const matches: DoublesMatchForTiebreak[] = [];
    const ranked = applyDoublesRanking(rows, matches);
    expect(ranked[0].entryId).toBe("A");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].entryId).toBe("B");
    expect(ranked[1].rank).toBe(2);
  });

  test("2-way tie — H2H not played, sets diff equal, setsWon resolves", () => {
    const rows = [mkRow("A", 2, 1, 6, 4), mkRow("B", 2, 1, 7, 5)];
    const matches: DoublesMatchForTiebreak[] = [];
    const ranked = applyDoublesRanking(rows, matches);
    expect(ranked[0].entryId).toBe("B");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].entryId).toBe("A");
    expect(ranked[1].rank).toBe(2);
  });

  test("2-way tie — fully tied → same rank", () => {
    const rows = [mkRow("A", 2, 1, 6, 4), mkRow("B", 2, 1, 6, 4)];
    const matches: DoublesMatchForTiebreak[] = [];
    const ranked = applyDoublesRanking(rows, matches);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1);
  });

  test("3-way tie — mini-league resolves all", () => {
    const rows = [mkRow("A", 2, 1, 6, 4), mkRow("B", 2, 1, 6, 4), mkRow("C", 2, 1, 6, 4)];
    const matches = [
      mkDoublesMatch("A", "B", 2, 0),
      mkDoublesMatch("B", "C", 2, 1),
      mkDoublesMatch("C", "A", 2, 0),
    ];
    const ranked = applyDoublesRanking(rows, matches);
    expect(ranked.map((r) => [r.entryId, r.rank])).toEqual([
      ["C", 1], ["A", 2], ["B", 3],
    ]);
  });

  test("3-way tie — mini-league reduces to 2-way → H2H fallback", () => {
    const rows = [mkRow("A", 2, 1, 7, 3), mkRow("B", 2, 1, 6, 4), mkRow("C", 2, 1, 5, 5)];
    const matches = [
      mkDoublesMatch("A", "B", 2, 1),
      mkDoublesMatch("A", "C", 2, 0),
      mkDoublesMatch("B", "C", 2, 1),
    ];
    const ranked = applyDoublesRanking(rows, matches);
    expect(ranked.map((r) => [r.entryId, r.rank])).toEqual([
      ["A", 1], ["B", 2], ["C", 3],
    ]);
  });

  test("3-way tie — mini-league unresolved → same rank", () => {
    const rows = [mkRow("A", 2, 1, 6, 4), mkRow("B", 2, 1, 6, 4), mkRow("C", 2, 1, 6, 4)];
    const matches = [
      mkDoublesMatch("A", "B", 2, 1),
      mkDoublesMatch("B", "C", 2, 1),
      mkDoublesMatch("C", "A", 2, 1),
    ];
    const ranked = applyDoublesRanking(rows, matches);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1);
    expect(ranked[2].rank).toBe(1);
  });

  test("zero-play entries ranked last with same rank", () => {
    const rows = [
      mkRow("A", 1, 0, 2, 1),
      mkRow("B", 0, 0, 0, 0),
      mkRow("C", 0, 0, 0, 0),
    ];
    const matches: DoublesMatchForTiebreak[] = [];
    const ranked = applyDoublesRanking(rows, matches);
    expect(ranked[0].entryId).toBe("A");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].rank).toBe(2);
  });
});

function mkTeamMatch(
  teamAId: string,
  teamBId: string,
  scoreA: number,
  scoreB: number,
  winnerId: string | null = scoreA > scoreB ? teamAId : scoreB > scoreA ? teamBId : null,
): TeamMatchForTiebreak {
  return {
    teamA: { id: teamAId },
    teamB: { id: teamBId },
    scoreA,
    scoreB,
    status: "done",
    winner: winnerId ? { id: winnerId } : null,
  };
}

describe("applyTeamRanking", () => {
  test("uses sub-match diff, not sets", () => {
    const rows = [
      mkRow("A", 2, 1, 8, 4),
      mkRow("B", 2, 1, 6, 6),
    ];
    const matches: TeamMatchForTiebreak[] = [];
    const ranked = applyTeamRanking(rows, matches);
    expect(ranked[0].entryId).toBe("A");
    expect(ranked[0].rank).toBe(1);
  });

  test("H2H resolves 2-way tie", () => {
    const rows = [mkRow("tA", 1, 1, 5, 5), mkRow("tB", 1, 1, 5, 5)];
    const matches = [mkTeamMatch("tA", "tB", 3, 2, "tA")];
    const ranked = applyTeamRanking(rows, matches);
    expect(ranked[0].entryId).toBe("tA");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].entryId).toBe("tB");
    expect(ranked[1].rank).toBe(2);
  });

  test("3-way mini-league with team metrics", () => {
    const rows = [mkRow("tA", 2, 1, 7, 5), mkRow("tB", 2, 1, 7, 5), mkRow("tC", 2, 1, 7, 5)];
    const matches = [
      mkTeamMatch("tA", "tB", 3, 2),
      mkTeamMatch("tB", "tC", 4, 1),
      mkTeamMatch("tC", "tA", 3, 2),
    ];
    const ranked = applyTeamRanking(rows, matches);
    expect(ranked.map((r) => [r.entryId, r.rank])).toEqual([
      ["tB", 1], ["tA", 2], ["tC", 3],
    ]);
  });

  test("excludes non-done matches", () => {
    const rows = [mkRow("tA", 1, 0, 3, 2), mkRow("tB", 1, 0, 3, 2)];
    const matches: TeamMatchForTiebreak[] = [
      { teamA: { id: "tA" }, teamB: { id: "tB" }, scoreA: 0, scoreB: 0, status: "scheduled", winner: null },
    ];
    const ranked = applyTeamRanking(rows, matches);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1);
  });
});
