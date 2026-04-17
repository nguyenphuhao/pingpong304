# Phase 5B: Standings + Tiebreaker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock-based standings computation with proper tiebreaker logic (H2H, mini-league) using match data already available in components.

**Architecture:** Pure TS module `src/lib/standings/` with types, compute, and tiebreaker functions. No new API routes or DB migrations. Components already have match data from Phase 5A — compute standings inline with tiebreaker applied. Delete legacy wrappers.

**Tech Stack:** TypeScript, Vitest, React (component prop changes)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/standings/types.ts` | Create | `StandingRow`, `EntryInfo` types |
| `src/lib/standings/tiebreaker.ts` | Create | `applyDoublesRanking`, `applyTeamRanking` — H2H + mini-league |
| `src/lib/standings/compute.ts` | Create | `computeDoublesStandings`, `computeTeamStandings` — aggregate + rank |
| `src/lib/standings/__tests__/tiebreaker.test.ts` | Create | Unit tests for tiebreaker logic |
| `src/lib/standings/__tests__/compute.test.ts` | Create | Unit tests for compute functions |
| `src/app/admin/_components.tsx` | Modify | Delete legacy code, import new standings, update component signatures |
| `src/app/d/[id]/page.tsx` | Modify | Pass `group.entries` instead of `group.entries.map(e => e.label)` |
| `src/app/t/[id]/page.tsx` | Modify | Same |
| `src/app/admin/doubles/groups/[id]/page.tsx` | Modify | Same |
| `src/app/admin/teams/groups/[id]/page.tsx` | Modify | Same |

---

### Task 1: Create standings types

**Files:**
- Create: `src/lib/standings/types.ts`

- [ ] **Step 1: Create types file**

```typescript
// src/lib/standings/types.ts
import type { Status } from "@/lib/schemas/match";

/** Display-ready standings row with rank assigned after tiebreaker. */
export type StandingRow = {
  entryId: string;
  entry: string;
  played: number;
  won: number;
  lost: number;
  diff: number;
  setsWon: number;
  setsLost: number;
  points: number;
  rank: number;
};

/** Entry input: ID for tiebreaker matching, label for display. */
export type EntryInfo = { id: string; label: string };

/** Minimal doubles match shape for tiebreaker computation. */
export type DoublesMatchForTiebreak = {
  pairA: { id: string };
  pairB: { id: string };
  setsA: number;
  setsB: number;
  status: Status;
  winner: { id: string } | null;
};

/** Minimal team match shape for tiebreaker computation. */
export type TeamMatchForTiebreak = {
  teamA: { id: string };
  teamB: { id: string };
  scoreA: number;
  scoreB: number;
  status: Status;
  winner: { id: string } | null;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: no errors related to `src/lib/standings/types.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/standings/types.ts
git commit -m "feat(standings): add standings types"
```

---

### Task 2: Implement doubles tiebreaker with tests (TDD)

**Files:**
- Create: `src/lib/standings/tiebreaker.ts`
- Create: `src/lib/standings/__tests__/tiebreaker.test.ts`

- [ ] **Step 1: Write failing tests for doubles tiebreaker**

```typescript
// src/lib/standings/__tests__/tiebreaker.test.ts
import { describe, expect, test } from "vitest";
import { applyDoublesRanking } from "../tiebreaker";
import type { StandingRow, DoublesMatchForTiebreak } from "../types";

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
    // A and B both won 2, but A beat B directly
    const rows = [mkRow("A", 2, 1, 6, 4), mkRow("B", 2, 1, 7, 3), mkRow("C", 0, 2, 1, 7)];
    const matches = [mkDoublesMatch("A", "B", 2, 1)]; // A beat B
    const ranked = applyDoublesRanking(rows, matches);
    expect(ranked[0].entryId).toBe("A");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].entryId).toBe("B");
    expect(ranked[1].rank).toBe(2);
  });

  test("2-way tie — H2H not played, sets diff resolves", () => {
    const rows = [mkRow("A", 2, 1, 6, 3), mkRow("B", 2, 1, 5, 4)];
    const matches: DoublesMatchForTiebreak[] = []; // no H2H match
    const ranked = applyDoublesRanking(rows, matches);
    // A has diff +3, B has diff +1 → A first
    expect(ranked[0].entryId).toBe("A");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].entryId).toBe("B");
    expect(ranked[1].rank).toBe(2);
  });

  test("2-way tie — H2H not played, sets diff equal, setsWon resolves", () => {
    const rows = [mkRow("A", 2, 1, 6, 4), mkRow("B", 2, 1, 7, 5)];
    const matches: DoublesMatchForTiebreak[] = [];
    const ranked = applyDoublesRanking(rows, matches);
    // Both diff +2, but B has 7 setsWon vs A's 6
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
    // A, B, C all won 2 overall. In H2H: A beat B, B beat C, C beat A (circular)
    const rows = [mkRow("A", 2, 1, 6, 4), mkRow("B", 2, 1, 6, 4), mkRow("C", 2, 1, 6, 4)];
    // Mini-league: each won 1, lost 1. Differentiate by sets diff within mini-league.
    const matches = [
      mkDoublesMatch("A", "B", 2, 0), // A beat B: A +2, B -2
      mkDoublesMatch("B", "C", 2, 1), // B beat C: B +1, C -1
      mkDoublesMatch("C", "A", 2, 0), // C beat A: C +2, A -2
    ];
    // Mini-league won: A=1, B=1, C=1
    // Mini-league sets diff: A=0(+2-2), B=-1(-2+1), C=+1(-1+2)
    // Sort: C (diff+1) > A (diff 0) > B (diff-1)
    const ranked = applyDoublesRanking(rows, matches);
    expect(ranked.map((r) => [r.entryId, r.rank])).toEqual([
      ["C", 1], ["A", 2], ["B", 3],
    ]);
  });

  test("3-way tie — mini-league reduces to 2-way → H2H fallback", () => {
    // A, B, C all won 2. In mini-league: A won 2, B and C won 1 each.
    // B and C still tied after mini-league → H2H between B and C
    const rows = [mkRow("A", 2, 1, 7, 3), mkRow("B", 2, 1, 6, 4), mkRow("C", 2, 1, 5, 5)];
    const matches = [
      mkDoublesMatch("A", "B", 2, 1), // A beat B
      mkDoublesMatch("A", "C", 2, 0), // A beat C
      mkDoublesMatch("B", "C", 2, 1), // B beat C → H2H tiebreak: B > C
    ];
    // Mini-league: A=2W, B=1W, C=0W → A rank 1
    // B and C: B won 1, C won 0 in mini-league → already separated
    const ranked = applyDoublesRanking(rows, matches);
    expect(ranked.map((r) => [r.entryId, r.rank])).toEqual([
      ["A", 1], ["B", 2], ["C", 3],
    ]);
  });

  test("3-way tie — mini-league unresolved → same rank", () => {
    // All 3 have identical mini-league stats
    const rows = [mkRow("A", 2, 1, 6, 4), mkRow("B", 2, 1, 6, 4), mkRow("C", 2, 1, 6, 4)];
    const matches = [
      mkDoublesMatch("A", "B", 2, 1),
      mkDoublesMatch("B", "C", 2, 1),
      mkDoublesMatch("C", "A", 2, 1),
    ];
    // Mini-league: each won 1, lost 1. Sets diff: each +1 -1 = 0. SetsWon: each 2. → tie
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
    // B and C both unplayed, ranked after A with same rank
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].rank).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/standings/__tests__/tiebreaker.test.ts 2>&1 | tail -20`
Expected: FAIL — module `../tiebreaker` not found

- [ ] **Step 3: Implement doubles tiebreaker**

```typescript
// src/lib/standings/tiebreaker.ts
import type {
  StandingRow,
  DoublesMatchForTiebreak,
  TeamMatchForTiebreak,
} from "./types";

// ── Doubles ──────────────────────────────────────────────────────────

export function applyDoublesRanking(
  rows: StandingRow[],
  matches: DoublesMatchForTiebreak[],
): StandingRow[] {
  const doneMatches = matches.filter(
    (m) => m.status === "done" || m.status === "forfeit",
  );
  const sorted = [...rows].sort((a, b) => b.won - a.won);
  return assignRanks(sorted, doneMatches, doublesMetric);
}

// ── Teams (placeholder — implemented in Task 3) ─────────────────────

export function applyTeamRanking(
  rows: StandingRow[],
  matches: TeamMatchForTiebreak[],
): StandingRow[] {
  const doneMatches = matches.filter(
    (m) => m.status === "done" || m.status === "forfeit",
  );
  const sorted = [...rows].sort((a, b) => b.won - a.won);
  return assignRanks(sorted, doneMatches, teamMetric);
}

// ── Metric abstraction ──────────────────────────────────────────────

type Metric<M> = {
  entryAId: (m: M) => string;
  entryBId: (m: M) => string;
  scoreA: (m: M) => number;
  scoreB: (m: M) => number;
  winnerId: (m: M) => string | null;
};

const doublesMetric: Metric<DoublesMatchForTiebreak> = {
  entryAId: (m) => m.pairA.id,
  entryBId: (m) => m.pairB.id,
  scoreA: (m) => m.setsA,
  scoreB: (m) => m.setsB,
  winnerId: (m) => m.winner?.id ?? null,
};

const teamMetric: Metric<TeamMatchForTiebreak> = {
  entryAId: (m) => m.teamA.id,
  entryBId: (m) => m.teamB.id,
  scoreA: (m) => m.scoreA,
  scoreB: (m) => m.scoreB,
  winnerId: (m) => m.winner?.id ?? null,
};

// ── Core ranking engine ─────────────────────────────────────────────

function assignRanks<M>(
  sorted: StandingRow[],
  matches: M[],
  metric: Metric<M>,
): StandingRow[] {
  // Separate played from unplayed
  const played = sorted.filter((r) => r.played > 0);
  const unplayed = sorted.filter((r) => r.played === 0);

  // Group played entries by won count
  const groups: StandingRow[][] = [];
  for (const row of played) {
    const last = groups[groups.length - 1];
    if (last && last[0].won === row.won) {
      last.push(row);
    } else {
      groups.push([row]);
    }
  }

  // Resolve each tied group
  const result: StandingRow[] = [];
  let rank = 1;
  for (const group of groups) {
    const resolved = group.length === 1
      ? [{ ...group[0], rank }]
      : resolveTiedGroup(group, matches, metric, rank, 0);
    result.push(...resolved);
    rank = result.length + 1;
  }

  // Unplayed entries get same rank, sorted alphabetically
  const unplayedRank = result.length + 1;
  const sortedUnplayed = [...unplayed]
    .sort((a, b) => a.entry.localeCompare(b.entry))
    .map((r) => ({ ...r, rank: unplayedRank }));
  result.push(...sortedUnplayed);

  return result;
}

function resolveTiedGroup<M>(
  tied: StandingRow[],
  allMatches: M[],
  metric: Metric<M>,
  startRank: number,
  depth: number,
): StandingRow[] {
  if (tied.length <= 1) {
    return tied.map((r) => ({ ...r, rank: startRank }));
  }

  if (tied.length === 2) {
    return resolveTwo(tied[0], tied[1], allMatches, metric, startRank);
  }

  // 3+ entries: mini-league
  if (depth >= 2) {
    // Cap recursion — assign same rank
    return tied.map((r) => ({ ...r, rank: startRank }));
  }

  return resolveMiniLeague(tied, allMatches, metric, startRank, depth);
}

function resolveTwo<M>(
  a: StandingRow,
  b: StandingRow,
  matches: M[],
  metric: Metric<M>,
  startRank: number,
): StandingRow[] {
  // Step 1: H2H
  const h2h = findH2H(a.entryId, b.entryId, matches, metric);
  if (h2h) {
    const winner = h2h === a.entryId ? a : b;
    const loser = h2h === a.entryId ? b : a;
    return [
      { ...winner, rank: startRank },
      { ...loser, rank: startRank + 1 },
    ];
  }

  // Step 2: sets/sub diff
  if (a.diff !== b.diff) {
    const [first, second] = a.diff > b.diff ? [a, b] : [b, a];
    return [
      { ...first, rank: startRank },
      { ...second, rank: startRank + 1 },
    ];
  }

  // Step 3: setsWon
  if (a.setsWon !== b.setsWon) {
    const [first, second] = a.setsWon > b.setsWon ? [a, b] : [b, a];
    return [
      { ...first, rank: startRank },
      { ...second, rank: startRank + 1 },
    ];
  }

  // Unresolved
  return [
    { ...a, rank: startRank },
    { ...b, rank: startRank },
  ];
}

function findH2H<M>(
  idA: string,
  idB: string,
  matches: M[],
  metric: Metric<M>,
): string | null {
  const match = matches.find((m) => {
    const a = metric.entryAId(m);
    const b = metric.entryBId(m);
    return (a === idA && b === idB) || (a === idB && b === idA);
  });
  if (!match) return null;
  return metric.winnerId(match);
}

function resolveMiniLeague<M>(
  tied: StandingRow[],
  allMatches: M[],
  metric: Metric<M>,
  startRank: number,
  depth: number,
): StandingRow[] {
  const ids = new Set(tied.map((r) => r.entryId));

  // Filter matches to only those between tied entries
  const miniMatches = allMatches.filter((m) => {
    const a = metric.entryAId(m);
    const b = metric.entryBId(m);
    return ids.has(a) && ids.has(b);
  });

  // Recompute stats within mini-league
  const miniRows = new Map<string, { won: number; diff: number; setsWon: number }>();
  for (const r of tied) {
    miniRows.set(r.entryId, { won: 0, diff: 0, setsWon: 0 });
  }

  for (const m of miniMatches) {
    const aId = metric.entryAId(m);
    const bId = metric.entryBId(m);
    const sa = metric.scoreA(m);
    const sb = metric.scoreB(m);
    const winner = metric.winnerId(m);
    const ra = miniRows.get(aId);
    const rb = miniRows.get(bId);
    if (!ra || !rb) continue;

    ra.diff += sa - sb;
    rb.diff += sb - sa;
    ra.setsWon += sa;
    rb.setsWon += sb;

    if (winner === aId) {
      ra.won += 1;
    } else if (winner === bId) {
      rb.won += 1;
    }
  }

  // Sort by mini-league stats: won → diff → setsWon
  const sortedTied = [...tied].sort((a, b) => {
    const ma = miniRows.get(a.entryId)!;
    const mb = miniRows.get(b.entryId)!;
    return mb.won - ma.won || mb.diff - ma.diff || mb.setsWon - ma.setsWon;
  });

  // Group by mini-league stats and resolve remaining ties
  const result: StandingRow[] = [];
  let rank = startRank;
  const subGroups: StandingRow[][] = [];
  for (const row of sortedTied) {
    const last = subGroups[subGroups.length - 1];
    if (last) {
      const lastStats = miniRows.get(last[0].entryId)!;
      const curStats = miniRows.get(row.entryId)!;
      if (
        lastStats.won === curStats.won &&
        lastStats.diff === curStats.diff &&
        lastStats.setsWon === curStats.setsWon
      ) {
        last.push(row);
        continue;
      }
    }
    subGroups.push([row]);
  }

  for (const group of subGroups) {
    if (group.length === 1) {
      result.push({ ...group[0], rank });
    } else if (group.length === 2) {
      // Fall back to H2H for 2-way tie after mini-league
      const resolved = resolveTwo(group[0], group[1], allMatches, metric, rank);
      result.push(...resolved);
    } else {
      // Still 3+ tied after mini-league at this depth — assign same rank
      result.push(...group.map((r) => ({ ...r, rank })));
    }
    rank = startRank + result.length;
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/standings/__tests__/tiebreaker.test.ts 2>&1 | tail -20`
Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/standings/tiebreaker.ts src/lib/standings/__tests__/tiebreaker.test.ts
git commit -m "feat(standings): implement doubles tiebreaker with H2H + mini-league"
```

---

### Task 3: Add team tiebreaker tests

Team tiebreaker uses the same engine via `teamMetric`. `applyTeamRanking` is already implemented in Task 2. Add team-specific tests to verify correct metric usage.

**Files:**
- Modify: `src/lib/standings/__tests__/tiebreaker.test.ts`

- [ ] **Step 1: Add team tiebreaker tests**

Append to `src/lib/standings/__tests__/tiebreaker.test.ts`:

```typescript
import { applyTeamRanking } from "../tiebreaker";
import type { TeamMatchForTiebreak } from "../types";

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
    // A and B tied on wins. A has better sub-match diff.
    const rows = [
      mkRow("A", 2, 1, 8, 4), // setsWon/setsLost here = sub_won/sub_lost for teams
      mkRow("B", 2, 1, 6, 6),
    ];
    const matches: TeamMatchForTiebreak[] = []; // no H2H
    const ranked = applyTeamRanking(rows, matches);
    // A diff +4 vs B diff 0 → A first
    expect(ranked[0].entryId).toBe("A");
    expect(ranked[0].rank).toBe(1);
  });

  test("H2H resolves 2-way tie", () => {
    const rows = [mkRow("tA", 1, 1, 5, 5), mkRow("tB", 1, 1, 5, 5)];
    const matches = [mkTeamMatch("tA", "tB", 3, 2, "tA")]; // tA beat tB
    const ranked = applyTeamRanking(rows, matches);
    expect(ranked[0].entryId).toBe("tA");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].entryId).toBe("tB");
    expect(ranked[1].rank).toBe(2);
  });

  test("3-way mini-league with team metrics", () => {
    const rows = [mkRow("tA", 2, 1, 7, 5), mkRow("tB", 2, 1, 7, 5), mkRow("tC", 2, 1, 7, 5)];
    const matches = [
      mkTeamMatch("tA", "tB", 3, 2), // tA beat tB: sub diff A+1, B-1
      mkTeamMatch("tB", "tC", 4, 1), // tB beat tC: sub diff B+3, C-3
      mkTeamMatch("tC", "tA", 3, 2), // tC beat tA: sub diff C+1, A-1
    ];
    // Mini-league won: all 1. Sub diff: A=0(+1-1), B=+2(-1+3), C=-2(-3+1). SubWon: A=5, B=6, C=4
    // Sort by diff: B(+2) > A(0) > C(-2)
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
    // Scheduled match ignored for H2H → fall to diff (equal) → setsWon (equal) → same rank
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1);
  });
});
```

- [ ] **Step 2: Run all tiebreaker tests**

Run: `npx vitest run src/lib/standings/__tests__/tiebreaker.test.ts 2>&1 | tail -20`
Expected: all tests PASS (both doubles and teams)

- [ ] **Step 3: Commit**

```bash
git add src/lib/standings/__tests__/tiebreaker.test.ts
git commit -m "test(standings): add team tiebreaker tests"
```

---

### Task 4: Implement compute functions with tests (TDD)

**Files:**
- Create: `src/lib/standings/compute.ts`
- Create: `src/lib/standings/__tests__/compute.test.ts`

- [ ] **Step 1: Write failing tests for compute functions**

```typescript
// src/lib/standings/__tests__/compute.test.ts
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
    expect(standings[0].points).toBe(4);
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
    const matches = [mkDoublesMatch("m1", "A", "B", 0, 0, "forfeit")];
    // Forfeit has winner=null, setsA=0, setsB=0
    // Modify: forfeit requires explicit winner per Phase 5A rules
    const m = { ...matches[0], winner: { id: "A", label: "Pair A" } };
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
    expect(standings[0].diff).toBe(4); // (3-2) + (4-1) = 1 + 3 = 4
    expect(standings[0].rank).toBe(1);
  });

  test("uses sub-match scores (scoreA/scoreB), not sets", () => {
    const entries = mkEntries("tA", "tB");
    const matches = [mkTeamMatch("m1", "tA", "tB", 3, 2)];
    const standings = computeTeamStandings(entries, matches);
    expect(standings[0].setsWon).toBe(3); // scoreA = sub-matches won
    expect(standings[0].setsLost).toBe(2);
    expect(standings[0].diff).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/standings/__tests__/compute.test.ts 2>&1 | tail -20`
Expected: FAIL — module `../compute` not found

- [ ] **Step 3: Implement compute functions**

```typescript
// src/lib/standings/compute.ts
import type { MatchResolved, TeamMatchResolved } from "@/lib/schemas/match";
import type { EntryInfo, StandingRow } from "./types";
import { applyDoublesRanking, applyTeamRanking } from "./tiebreaker";

export function computeDoublesStandings(
  entries: EntryInfo[],
  matches: MatchResolved[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [
      e.id,
      {
        entryId: e.id,
        entry: e.label,
        played: 0,
        won: 0,
        lost: 0,
        diff: 0,
        setsWon: 0,
        setsLost: 0,
        points: 0,
        rank: 0,
      },
    ]),
  );

  for (const m of matches) {
    if (m.status !== "done" && m.status !== "forfeit") continue;
    const ra = rows.get(m.pairA.id);
    const rb = rows.get(m.pairB.id);
    if (!ra || !rb) continue;

    ra.played += 1;
    rb.played += 1;
    ra.setsWon += m.setsA;
    ra.setsLost += m.setsB;
    rb.setsWon += m.setsB;
    rb.setsLost += m.setsA;
    ra.diff += m.setsA - m.setsB;
    rb.diff += m.setsB - m.setsA;

    if (m.winner?.id === m.pairA.id) {
      ra.won += 1;
      rb.lost += 1;
      ra.points += 2;
    } else if (m.winner?.id === m.pairB.id) {
      rb.won += 1;
      ra.lost += 1;
      rb.points += 2;
    }
  }

  return applyDoublesRanking([...rows.values()], matches);
}

export function computeTeamStandings(
  entries: EntryInfo[],
  matches: TeamMatchResolved[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [
      e.id,
      {
        entryId: e.id,
        entry: e.label,
        played: 0,
        won: 0,
        lost: 0,
        diff: 0,
        setsWon: 0,
        setsLost: 0,
        points: 0,
        rank: 0,
      },
    ]),
  );

  for (const m of matches) {
    if (m.status !== "done" && m.status !== "forfeit") continue;
    const ra = rows.get(m.teamA.id);
    const rb = rows.get(m.teamB.id);
    if (!ra || !rb) continue;

    ra.played += 1;
    rb.played += 1;
    ra.setsWon += m.scoreA;
    ra.setsLost += m.scoreB;
    rb.setsWon += m.scoreB;
    rb.setsLost += m.scoreA;
    ra.diff += m.scoreA - m.scoreB;
    rb.diff += m.scoreB - m.scoreA;

    if (m.winner?.id === m.teamA.id) {
      ra.won += 1;
      rb.lost += 1;
      ra.points += 2;
    } else if (m.winner?.id === m.teamB.id) {
      rb.won += 1;
      ra.lost += 1;
      rb.points += 2;
    }
  }

  return applyTeamRanking([...rows.values()], matches);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/standings/__tests__/compute.test.ts 2>&1 | tail -20`
Expected: all tests PASS

- [ ] **Step 5: Run all standings tests together**

Run: `npx vitest run src/lib/standings/ 2>&1 | tail -20`
Expected: all tiebreaker + compute tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/standings/compute.ts src/lib/standings/__tests__/compute.test.ts
git commit -m "feat(standings): implement compute functions with DB-aware aggregation"
```

---

### Task 5: Update `_components.tsx` — delete legacy code, import new standings

**Files:**
- Modify: `src/app/admin/_components.tsx`

This task deletes the legacy types, wrappers, and compute functions, then updates `DoublesSchedule`, `TeamSchedule`, and `StandingsCard` to use the new standings module.

- [ ] **Step 1: Add import for new standings module**

At the top of `src/app/admin/_components.tsx`, add after the existing imports:

```typescript
import { computeDoublesStandings, computeTeamStandings } from "@/lib/standings/compute";
import type { StandingRow } from "@/lib/standings/types";
```

- [ ] **Step 2: Delete legacy types**

Delete these blocks from `_components.tsx`:
- The `StandingRow` type (lines ~245-252)
- The `LegacyDoublesMatch` type (lines ~254-263)
- The `LegacyTeamMatch` type (lines ~265-274)
- The `resolvedToLegacyStatus` function (lines ~276-279)
- The `resolvedToLegacyDoublesMatch` function (lines ~281-292)
- The `resolvedToLegacyTeamMatch` function (lines ~294-305)
- The `computeDoublesStandings` function (lines ~307-337)
- The `computeTeamStandings` function (lines ~339-368)

- [ ] **Step 3: Update `StandingsCard` to use `rank` from `StandingRow`**

Replace the `StandingsCard` component. The key change is using `r.rank` instead of `i + 1`, and keying by `r.entryId`:

```typescript
function StandingsCard({
  rows,
  diffLabel,
}: {
  rows: StandingRow[];
  diffLabel: string;
}) {
  const played = rows.some((r) => r.played > 0);
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-end justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">
            <Trophy className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Bảng xếp hạng</h2>
            <p className="text-sm text-muted-foreground">
              {played ? "Cập nhật theo trận đã chốt" : "Chưa có trận nào chốt"}
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Thắng: 2 điểm</div>
      </div>

      <ol className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.entryId}
            className="flex items-center gap-3 rounded-lg border bg-card/40 p-3"
          >
            <RankBadge rank={r.rank} active={r.played > 0} />
            <div className="min-w-0 flex-1">
              <div className="font-medium leading-tight">{r.entry}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
                <span>{r.played} trận</span>
                <span className="text-green-600 dark:text-green-400">{r.won}T</span>
                <span className="text-red-600 dark:text-red-400">{r.lost}B</span>
                <span
                  title={diffLabel}
                  className={
                    r.diff > 0
                      ? "text-green-600 dark:text-green-400"
                      : r.diff < 0
                        ? "text-red-600 dark:text-red-400"
                        : ""
                  }
                >
                  HS {r.diff > 0 ? `+${r.diff}` : r.diff}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end leading-none">
              <span className="text-xl font-semibold tabular-nums">{r.points}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">điểm</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
```

- [ ] **Step 4: Update `DoublesSchedule` — change `entries` prop type and usage**

Change the `DoublesSchedule` component:

```typescript
export function DoublesSchedule({
  groupId,
  groupName,
  entries,
  matches,
  readOnly,
}: {
  groupId: string;
  groupName: string;
  entries: { id: string; label: string }[];
  matches: MatchResolved[];
  readOnly?: boolean;
}) {
  const standings = computeDoublesStandings(entries, matches);
  const color = groupColor(groupId);
  return (
    <div className="flex flex-col gap-4">
      <Card className={`p-4 ${color.border} ${color.bg}`}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`flex size-8 items-center justify-center rounded-lg font-semibold ${color.badge}`}>
              {groupName.replace(/^Bảng\s*/i, "")}
            </span>
            <div>
              <div className="text-sm text-muted-foreground">Bảng đấu</div>
              <div className="font-semibold">{groupName}</div>
            </div>
          </div>
          <Badge variant="secondary">{entries.length} cặp</Badge>
        </div>
        <ol className="space-y-1 text-sm">
          {entries.map((e, i) => (
            <li
              key={e.id}
              className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1.5"
            >
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
              <span className="truncate">{e.label}</span>
            </li>
          ))}
        </ol>
      </Card>

      <StandingsCard rows={standings} diffLabel="Hiệu số ván" />

      <div>
        <SectionHeader
          title="Lịch thi đấu vòng bảng"
          subtitle={`${matches.length} trận · vòng tròn`}
        />
        <div className="flex flex-col gap-2">
          {matches.map((m, i) => (
            <DoublesMatchCard
              key={m.id}
              match={m}
              index={i + 1}
              readOnly={readOnly}
              altBg={i % 2 === 1 ? color.rowAlt : ""}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update `TeamSchedule` — same pattern**

Change the `TeamSchedule` component:

```typescript
export function TeamSchedule({
  groupId,
  groupName,
  entries,
  matches,
  teamPlayersByTeamId = {},
  readOnly,
}: {
  groupId: string;
  groupName: string;
  entries: { id: string; label: string }[];
  matches: TeamMatchResolved[];
  teamPlayersByTeamId?: Record<string, Array<{ id: string; name: string }>>;
  readOnly?: boolean;
}) {
  const standings = computeTeamStandings(entries, matches);
  const color = groupColor(groupId);
  return (
    <div className="flex flex-col gap-4">
      <Card className={`p-4 ${color.border} ${color.bg}`}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`flex size-8 items-center justify-center rounded-lg font-semibold ${color.badge}`}>
              {groupName.replace(/^Bảng\s*/i, "")}
            </span>
            <div>
              <div className="text-sm text-muted-foreground">Bảng đấu</div>
              <div className="font-semibold">{groupName}</div>
            </div>
          </div>
          <Badge variant="secondary">{entries.length} đội</Badge>
        </div>
        <ol className="space-y-1 text-sm">
          {entries.map((e, i) => (
            <li
              key={e.id}
              className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1.5"
            >
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
              <span className="truncate">{e.label}</span>
            </li>
          ))}
        </ol>
      </Card>

      <StandingsCard rows={standings} diffLabel="Hiệu số trận cá nhân" />

      <div>
        <SectionHeader
          title="Lịch thi đấu vòng bảng"
          subtitle={`${matches.length} trận · vòng tròn`}
        />
        <div className="flex flex-col gap-3">
          {matches.map((m, i) => (
            <TeamMatchCard
              key={m.id}
              match={m}
              index={i + 1}
              readOnly={readOnly}
              altBg={i % 2 === 1 ? color.rowAlt : ""}
              teamAPlayers={teamPlayersByTeamId[m.teamA.id] ?? []}
              teamBPlayers={teamPlayersByTeamId[m.teamB.id] ?? []}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -40`
Expected: Errors in caller pages (they still pass `string[]` for entries) — that's expected, fixed in Task 6.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/_components.tsx
git commit -m "refactor(standings): delete legacy wrappers, use new standings module"
```

---

### Task 6: Update caller pages to pass `{id, label}` entries

**Files:**
- Modify: `src/app/d/[id]/page.tsx`
- Modify: `src/app/t/[id]/page.tsx`
- Modify: `src/app/admin/doubles/groups/[id]/page.tsx`
- Modify: `src/app/admin/teams/groups/[id]/page.tsx`

All 4 pages currently do `entries={group.entries.map((e) => e.label)}`. Change to `entries={group.entries}` since `group.entries` is already `GroupEntry[]` = `{ id: string; label: string }[]`.

- [ ] **Step 1: Update `src/app/d/[id]/page.tsx`**

Change:
```typescript
entries={group.entries.map((e) => e.label)}
```
To:
```typescript
entries={group.entries}
```

- [ ] **Step 2: Update `src/app/t/[id]/page.tsx`**

Change:
```typescript
entries={group.entries.map((e) => e.label)}
```
To:
```typescript
entries={group.entries}
```

- [ ] **Step 3: Update `src/app/admin/doubles/groups/[id]/page.tsx`**

Change:
```typescript
entries={group.entries.map((e) => e.label)}
```
To:
```typescript
entries={group.entries}
```

- [ ] **Step 4: Update `src/app/admin/teams/groups/[id]/page.tsx`**

Change:
```typescript
entries={group.entries.map((e) => e.label)}
```
To:
```typescript
entries={group.entries}
```

- [ ] **Step 5: Verify TypeScript compiles with zero errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: no errors

- [ ] **Step 6: Run all tests**

Run: `npx vitest run 2>&1 | tail -20`
Expected: all tests pass (existing + new standings tests)

- [ ] **Step 7: Commit**

```bash
git add src/app/d/[id]/page.tsx src/app/t/[id]/page.tsx src/app/admin/doubles/groups/[id]/page.tsx src/app/admin/teams/groups/[id]/page.tsx
git commit -m "refactor(standings): pass full entries to DoublesSchedule/TeamSchedule"
```

---

### Task 7: Build verification + final check

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds with all routes compiled

- [ ] **Step 2: Run all tests**

Run: `npx vitest run 2>&1 | tail -20`
Expected: all tests pass

- [ ] **Step 3: Verify no unused imports remain**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: clean

- [ ] **Step 4: Commit if any cleanup was needed**

Only if fixes were applied in this step.

---

## Summary

| Task | What | Tests |
|------|------|-------|
| 1 | Types module | tsc check |
| 2 | Doubles tiebreaker + tests | 8 unit tests |
| 3 | Team tiebreaker tests | 4 unit tests |
| 4 | Compute functions + tests | 7 unit tests |
| 5 | Update `_components.tsx` | tsc check |
| 6 | Update 4 caller pages | tsc + all tests |
| 7 | Build verification | next build + vitest |
