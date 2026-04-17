import { describe, expect, test } from "vitest";
import { computeDoublesStandings, computeTeamStandings } from "../compute";
import type { MatchResolved, TeamMatchResolved } from "@/lib/schemas/match";
import type { EntryInfo } from "../types";

function mkEntries(...ids: string[]): EntryInfo[] {
  return ids.map((id) => ({ id, label: `Entry ${id}` }));
}

function mkDoublesMatch(
  id: string,
  pairAId: string,
  pairBId: string,
  setsA: number,
  setsB: number,
  status: "done" | "forfeit" | "scheduled" | "live" = "done",
): MatchResolved {
  const winnerId = setsA > setsB ? pairAId : setsB > setsA ? pairBId : null;
  return {
    id,
    groupId: "g1",
    pairA: { id: pairAId, label: `Pair ${pairAId}` },
    pairB: { id: pairBId, label: `Pair ${pairBId}` },
    table: null,
    bestOf: 3,
    sets: [],
    setsA,
    setsB,
    status,
    winner: winnerId ? { id: winnerId, label: `Pair ${winnerId}` } : null,
  };
}

function mkTeamMatch(
  id: string,
  teamAId: string,
  teamBId: string,
  scoreA: number,
  scoreB: number,
  status: "done" | "forfeit" | "scheduled" | "live" = "done",
): TeamMatchResolved {
  const winnerId = scoreA > scoreB ? teamAId : scoreB > scoreA ? teamBId : null;
  return {
    id,
    groupId: "g1",
    teamA: { id: teamAId, name: `Team ${teamAId}` },
    teamB: { id: teamBId, name: `Team ${teamBId}` },
    table: null,
    scoreA,
    scoreB,
    status,
    winner: winnerId ? { id: winnerId, name: `Team ${winnerId}` } : null,
    individual: [],
  };
}

describe("computeDoublesStandings", () => {
  test("basic standings — no ties", () => {
    const entries = mkEntries("A", "B", "C");
    const matches = [
      mkDoublesMatch("m1", "A", "B", 2, 0),
      mkDoublesMatch("m2", "A", "C", 2, 1),
      mkDoublesMatch("m3", "B", "C", 2, 1),
    ];
    const standings = computeDoublesStandings(entries, matches);
    expect(standings[0].entryId).toBe("A");
    expect(standings[0].won).toBe(2);
    expect(standings[0].points).toBe(2);
    expect(standings[0].rank).toBe(1);
    expect(standings[1].entryId).toBe("B");
    expect(standings[1].rank).toBe(2);
    expect(standings[2].entryId).toBe("C");
    expect(standings[2].rank).toBe(3);
  });

  test("entries with no matches — all rank same", () => {
    const entries = mkEntries("A", "B", "C");
    const standings = computeDoublesStandings(entries, []);
    expect(standings.every((r) => r.rank === 1)).toBe(true);
    expect(standings.every((r) => r.played === 0)).toBe(true);
  });

  test("forfeit matches counted", () => {
    const entries = mkEntries("A", "B");
    const m: MatchResolved = {
      ...mkDoublesMatch("m1", "A", "B", 0, 0, "forfeit"),
      winner: { id: "A", label: "Pair A" },
    };
    const standings = computeDoublesStandings(entries, [m]);
    expect(standings[0].entryId).toBe("A");
    expect(standings[0].won).toBe(1);
    expect(standings[0].played).toBe(1);
  });

  test("live matches excluded from standings", () => {
    const entries = mkEntries("A", "B");
    const matches = [mkDoublesMatch("m1", "A", "B", 2, 1, "live")];
    const standings = computeDoublesStandings(entries, matches);
    expect(standings.every((r) => r.played === 0)).toBe(true);
  });

  test("scheduled matches excluded", () => {
    const entries = mkEntries("A", "B");
    const matches = [mkDoublesMatch("m1", "A", "B", 0, 0, "scheduled")];
    const standings = computeDoublesStandings(entries, matches);
    expect(standings.every((r) => r.played === 0)).toBe(true);
  });
});

describe("computeTeamStandings", () => {
  test("basic standings — no ties", () => {
    const entries = mkEntries("tA", "tB", "tC");
    const matches = [
      mkTeamMatch("m1", "tA", "tB", 3, 2),
      mkTeamMatch("m2", "tA", "tC", 4, 1),
      mkTeamMatch("m3", "tB", "tC", 3, 2),
    ];
    const standings = computeTeamStandings(entries, matches);
    expect(standings[0].entryId).toBe("tA");
    expect(standings[0].won).toBe(2);
    expect(standings[0].diff).toBe(4);
    expect(standings[0].rank).toBe(1);
  });

  test("uses sub-match scores (scoreA/scoreB), not sets", () => {
    const entries = mkEntries("tA", "tB");
    const matches = [mkTeamMatch("m1", "tA", "tB", 3, 2)];
    const standings = computeTeamStandings(entries, matches);
    expect(standings[0].setsWon).toBe(3);
    expect(standings[0].setsLost).toBe(2);
    expect(standings[0].diff).toBe(1);
  });
});
