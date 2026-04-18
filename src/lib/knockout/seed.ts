export type SeedEntry = {
  groupName: string;
  rank: number;
  entryId: string;
};

type DoublesKoInsert = {
  id: string;
  round: "qf" | "sf" | "f";
  best_of: number;
  label_a: string;
  label_b: string;
  entry_a: string | null;
  entry_b: string | null;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
};

type TeamKoInsert = {
  id: string;
  round: "qf" | "sf" | "f";
  label_a: string;
  label_b: string;
  entry_a: string | null;
  entry_b: string | null;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
  individual: Array<{
    id: string;
    label: string;
    kind: "singles" | "doubles";
    playersA: string[];
    playersB: string[];
    bestOf: 3 | 5;
    sets: Array<{ a: number; b: number }>;
  }>;
};

function findEntry(seeds: SeedEntry[], group: string, rank: number): string | null {
  return seeds.find((s) => s.groupName === group && s.rank === rank)?.entryId ?? null;
}

function shortName(name: string): string {
  return name.replace(/^Bảng\s*/i, "");
}

export function buildDoublesBracket(seeds: SeedEntry[], groupNames: string[]): DoublesKoInsert[] {
  const groups = [...groupNames].sort();
  const [A, B, C, D] = groups;
  const [sA, sB, sC, sD] = [A, B, C, D].map(shortName);

  return [
    {
      id: "dko-qf1", round: "qf", best_of: 5,
      label_a: `Nhất ${sA}`, label_b: `Nhì ${sC}`,
      entry_a: findEntry(seeds, A, 1), entry_b: findEntry(seeds, C, 2),
      next_match_id: "dko-sf1", next_slot: "a",
    },
    {
      id: "dko-qf2", round: "qf", best_of: 5,
      label_a: `Nhất ${sC}`, label_b: `Nhì ${sA}`,
      entry_a: findEntry(seeds, C, 1), entry_b: findEntry(seeds, A, 2),
      next_match_id: "dko-sf2", next_slot: "a",
    },
    {
      id: "dko-qf3", round: "qf", best_of: 5,
      label_a: `Nhất ${sB}`, label_b: `Nhì ${sD}`,
      entry_a: findEntry(seeds, B, 1), entry_b: findEntry(seeds, D, 2),
      next_match_id: "dko-sf1", next_slot: "b",
    },
    {
      id: "dko-qf4", round: "qf", best_of: 5,
      label_a: `Nhất ${sD}`, label_b: `Nhì ${sB}`,
      entry_a: findEntry(seeds, D, 1), entry_b: findEntry(seeds, B, 2),
      next_match_id: "dko-sf2", next_slot: "b",
    },
    {
      id: "dko-sf1", round: "sf", best_of: 5,
      label_a: "Thắng TK 1", label_b: "Thắng TK 2",
      entry_a: null, entry_b: null,
      next_match_id: "dko-f", next_slot: "a",
    },
    {
      id: "dko-sf2", round: "sf", best_of: 5,
      label_a: "Thắng TK 3", label_b: "Thắng TK 4",
      entry_a: null, entry_b: null,
      next_match_id: "dko-f", next_slot: "b",
    },
    {
      id: "dko-f", round: "f", best_of: 5,
      label_a: "Thắng BK 1", label_b: "Thắng BK 2",
      entry_a: null, entry_b: null,
      next_match_id: null, next_slot: null,
    },
  ];
}

function teamSubMatches(matchId: string): TeamKoInsert["individual"] {
  return [
    { id: `${matchId}-sub1`, label: "Đơn 1", kind: "singles", playersA: [], playersB: [], bestOf: 3, sets: [] },
    { id: `${matchId}-sub2`, label: "Đôi", kind: "doubles", playersA: [], playersB: [], bestOf: 3, sets: [] },
    { id: `${matchId}-sub3`, label: "Đơn 2", kind: "singles", playersA: [], playersB: [], bestOf: 3, sets: [] },
  ];
}

export function buildTeamBracket(seeds: SeedEntry[], groupNames: string[]): TeamKoInsert[] {
  const groups = [...groupNames].sort();
  const [A, B] = groups;
  const [sA, sB] = [A, B].map(shortName);

  return [
    {
      id: "tko-sf1", round: "sf",
      label_a: `Nhất ${sA}`, label_b: `Nhì ${sB}`,
      entry_a: findEntry(seeds, A, 1), entry_b: findEntry(seeds, B, 2),
      next_match_id: "tko-f", next_slot: "a",
      individual: teamSubMatches("tko-sf1"),
    },
    {
      id: "tko-sf2", round: "sf",
      label_a: `Nhất ${sB}`, label_b: `Nhì ${sA}`,
      entry_a: findEntry(seeds, B, 1), entry_b: findEntry(seeds, A, 2),
      next_match_id: "tko-f", next_slot: "b",
      individual: teamSubMatches("tko-sf2"),
    },
    {
      id: "tko-f", round: "f",
      label_a: "Thắng BK 1", label_b: "Thắng BK 2",
      entry_a: null, entry_b: null,
      next_match_id: null, next_slot: null,
      individual: teamSubMatches("tko-f"),
    },
  ];
}
