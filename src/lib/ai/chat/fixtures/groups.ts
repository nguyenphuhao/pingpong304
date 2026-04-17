import type { MatchResolved, TeamMatchResolved } from "@/lib/schemas/match";
import type { EntryInfo } from "@/lib/standings/types";

// Doubles: 4 pairs, all 6 matches done, clear winner
export const doublesGroupAllDone: {
  entries: EntryInfo[];
  matches: MatchResolved[];
} = {
  entries: [
    { id: "p1", label: "Cặp 1" },
    { id: "p2", label: "Cặp 2" },
    { id: "p3", label: "Cặp 3" },
    { id: "p4", label: "Cặp 4" },
  ],
  matches: [
    mkDoubles("m1", "g1", "p1", "p2", 2, 0, "p1"),
    mkDoubles("m2", "g1", "p3", "p4", 2, 1, "p3"),
    mkDoubles("m3", "g1", "p1", "p3", 2, 1, "p1"),
    mkDoubles("m4", "g1", "p2", "p4", 2, 0, "p2"),
    mkDoubles("m5", "g1", "p1", "p4", 2, 0, "p1"),
    mkDoubles("m6", "g1", "p2", "p3", 2, 1, "p2"),
  ],
};

// Doubles: 4 pairs, 3 matches done, 3 pending — alive scenario
export const doublesGroupMidTournament: {
  entries: EntryInfo[];
  matches: MatchResolved[];
} = {
  entries: [
    { id: "p1", label: "Cặp 1" },
    { id: "p2", label: "Cặp 2" },
    { id: "p3", label: "Cặp 3" },
    { id: "p4", label: "Cặp 4" },
  ],
  matches: [
    mkDoubles("m1", "g1", "p1", "p2", 2, 0, "p1"),
    mkDoubles("m2", "g1", "p3", "p4", 2, 1, "p3"),
    mkDoubles("m3", "g1", "p1", "p3", 2, 1, "p1"),
    mkScheduled("m4", "g1", "p2", "p4"),
    mkScheduled("m5", "g1", "p1", "p4"),
    mkScheduled("m6", "g1", "p2", "p3"),
  ],
};

// Teams: 4 teams, mid tournament
export const teamsGroupMidTournament: {
  entries: EntryInfo[];
  matches: TeamMatchResolved[];
} = {
  entries: [
    { id: "t1", label: "Đội 1" },
    { id: "t2", label: "Đội 2" },
    { id: "t3", label: "Đội 3" },
    { id: "t4", label: "Đội 4" },
  ],
  matches: [
    mkTeam("tm1", "gt1", "t1", "t2", 2, 1, "t1"),
    mkTeam("tm2", "gt1", "t3", "t4", 2, 0, "t3"),
    mkTeamScheduled("tm3", "gt1", "t1", "t3"),
    mkTeamScheduled("tm4", "gt1", "t2", "t4"),
    mkTeamScheduled("tm5", "gt1", "t1", "t4"),
    mkTeamScheduled("tm6", "gt1", "t2", "t3"),
  ],
};

// ── helpers ──

function mkDoubles(
  id: string,
  groupId: string,
  a: string,
  b: string,
  setsA: number,
  setsB: number,
  winner: string,
): MatchResolved {
  return {
    id,
    groupId,
    pairA: { id: a, label: labelFor(a) },
    pairB: { id: b, label: labelFor(b) },
    table: null,
    bestOf: 3,
    sets: Array.from({ length: setsA + setsB }, (_, i) =>
      i < setsA ? { a: 11, b: 5 } : { a: 5, b: 11 },
    ),
    setsA,
    setsB,
    status: "done",
    winner: { id: winner, label: labelFor(winner) },
  };
}

function mkScheduled(
  id: string,
  groupId: string,
  a: string,
  b: string,
): MatchResolved {
  return {
    id,
    groupId,
    pairA: { id: a, label: labelFor(a) },
    pairB: { id: b, label: labelFor(b) },
    table: null,
    bestOf: 3,
    sets: [],
    setsA: 0,
    setsB: 0,
    status: "scheduled",
    winner: null,
  };
}

function mkTeam(
  id: string,
  groupId: string,
  a: string,
  b: string,
  scoreA: number,
  scoreB: number,
  winner: string,
): TeamMatchResolved {
  return {
    id,
    groupId,
    teamA: { id: a, name: labelFor(a) },
    teamB: { id: b, name: labelFor(b) },
    table: null,
    scoreA,
    scoreB,
    status: "done",
    winner: { id: winner, name: labelFor(winner) },
    individual: [],
  };
}

function mkTeamScheduled(
  id: string,
  groupId: string,
  a: string,
  b: string,
): TeamMatchResolved {
  return {
    id,
    groupId,
    teamA: { id: a, name: labelFor(a) },
    teamB: { id: b, name: labelFor(b) },
    table: null,
    scoreA: 0,
    scoreB: 0,
    status: "scheduled",
    winner: null,
    individual: [],
  };
}

function labelFor(id: string): string {
  const map: Record<string, string> = {
    p1: "Cặp 1", p2: "Cặp 2", p3: "Cặp 3", p4: "Cặp 4",
    t1: "Đội 1", t2: "Đội 2", t3: "Đội 3", t4: "Đội 4",
  };
  return map[id] ?? id;
}
