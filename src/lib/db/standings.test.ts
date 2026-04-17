import { describe, expect, test } from "vitest";
import { computeDoublesStandings, computeTeamStandings } from "./standings";
import type { MatchResolved, TeamMatchResolved } from "@/lib/schemas/match";

describe("computeDoublesStandings", () => {
  test("computes W/L/diff/points from done matches", () => {
    const matches = [
      {
        status: "done",
        pairA: { id: "p01", label: "A – B" },
        pairB: { id: "p02", label: "C – D" },
        sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }],
      },
      {
        status: "done",
        pairA: { id: "p01", label: "A – B" },
        pairB: { id: "p03", label: "E – F" },
        sets: [{ a: 8, b: 11 }, { a: 11, b: 9 }, { a: 11, b: 7 }],
      },
      {
        status: "scheduled",
        pairA: { id: "p02", label: "C – D" },
        pairB: { id: "p03", label: "E – F" },
        sets: [],
      },
    ] as MatchResolved[];
    const entries = ["A – B", "C – D", "E – F"];
    const result = computeDoublesStandings(matches, entries);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ entry: "A – B", played: 2, won: 2, lost: 0, diff: 3, points: 2 });
    expect(result[1]).toMatchObject({ entry: "E – F", played: 1, won: 0, lost: 1, diff: -1, points: 0 });
    expect(result[2]).toMatchObject({ entry: "C – D", played: 1, won: 0, lost: 1, diff: -2, points: 0 });
  });

  test("ignores scheduled/live matches", () => {
    const matches = [
      { status: "live", pairA: { id: "p01", label: "A" }, pairB: { id: "p02", label: "B" }, sets: [{ a: 11, b: 8 }] },
    ] as MatchResolved[];
    const result = computeDoublesStandings(matches, ["A", "B"]);
    expect(result[0].played).toBe(0);
  });

  test("returns empty standings for entries with no matches", () => {
    const result = computeDoublesStandings([], ["A", "B"]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ played: 0, won: 0, lost: 0, diff: 0, points: 0 });
  });
});

describe("computeTeamStandings", () => {
  test("uses scoreA/scoreB instead of sets", () => {
    const matches = [
      { status: "done", teamA: { id: "tA1", name: "Team 1" }, teamB: { id: "tA2", name: "Team 2" }, scoreA: 2, scoreB: 1 },
    ] as TeamMatchResolved[];
    const result = computeTeamStandings(matches, ["Team 1", "Team 2"]);
    expect(result[0]).toMatchObject({ entry: "Team 1", won: 1, diff: 1, points: 1 });
    expect(result[1]).toMatchObject({ entry: "Team 2", won: 0, diff: -1, points: 0 });
  });
});
