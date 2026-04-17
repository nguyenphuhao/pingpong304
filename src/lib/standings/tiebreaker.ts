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

// ── Teams ────────────────────────────────────────────────────────────

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
  const played = sorted.filter((r) => r.played > 0);
  const unplayed = sorted.filter((r) => r.played === 0);

  const groups: StandingRow[][] = [];
  for (const row of played) {
    const last = groups[groups.length - 1];
    if (last && last[0].won === row.won) {
      last.push(row);
    } else {
      groups.push([row]);
    }
  }

  const result: StandingRow[] = [];
  let rank = 1;
  for (const group of groups) {
    const resolved = group.length === 1
      ? [{ ...group[0], rank }]
      : resolveTiedGroup(group, matches, metric, rank, 0);
    result.push(...resolved);
    rank = result.length + 1;
  }

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

  if (depth >= 2) {
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
  const h2h = findH2H(a.entryId, b.entryId, matches, metric);
  if (h2h) {
    const winner = h2h === a.entryId ? a : b;
    const loser = h2h === a.entryId ? b : a;
    return [
      { ...winner, rank: startRank },
      { ...loser, rank: startRank + 1 },
    ];
  }

  if (a.diff !== b.diff) {
    const [first, second] = a.diff > b.diff ? [a, b] : [b, a];
    return [
      { ...first, rank: startRank },
      { ...second, rank: startRank + 1 },
    ];
  }

  if (a.setsWon !== b.setsWon) {
    const [first, second] = a.setsWon > b.setsWon ? [a, b] : [b, a];
    return [
      { ...first, rank: startRank },
      { ...second, rank: startRank + 1 },
    ];
  }

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

  const miniMatches = allMatches.filter((m) => {
    const a = metric.entryAId(m);
    const b = metric.entryBId(m);
    return ids.has(a) && ids.has(b);
  });

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

  const sortedTied = [...tied].sort((a, b) => {
    const ma = miniRows.get(a.entryId)!;
    const mb = miniRows.get(b.entryId)!;
    return mb.won - ma.won || mb.diff - ma.diff || mb.setsWon - ma.setsWon;
  });

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
      const resolved = resolveTwo(group[0], group[1], allMatches, metric, rank);
      result.push(...resolved);
    } else {
      result.push(...group.map((r) => ({ ...r, rank })));
    }
    rank = startRank + result.length;
  }

  return result;
}
