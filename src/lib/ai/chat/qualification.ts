import type { MatchResolved, TeamMatchResolved } from "@/lib/schemas/match";
import type { EntryInfo, StandingRow } from "@/lib/standings/types";
import {
  computeDoublesStandings,
  computeTeamStandings,
} from "@/lib/standings/compute";

export type OddsOwnMatch = {
  matchId: string;
  opponent: { id: string; label: string };
  pIfWin: number;
  pIfLose: number;
  critical: boolean;
};

export type OddsExternalMatch = {
  matchId: string;
  pairA: { id: string; label: string };
  pairB: { id: string; label: string };
  impact: "high" | "medium" | "low";
};

export type OddsScenario = {
  description: string;
  probability: number;
  ambiguous?: boolean;
};

export type OddsResult = {
  status: "qualified" | "eliminated" | "alive";
  probability: number;
  totalScenarios: number;
  qualifyingScenarios: number;
  ownMatches: OddsOwnMatch[];
  externalMatches: OddsExternalMatch[];
  scenarios: OddsScenario[];
  ambiguousRate: number;
};

type DoublesInput = {
  entries: EntryInfo[];
  matches: MatchResolved[];
  targetId: string;
  advanceCount: number;
};

type TeamsInput = {
  entries: EntryInfo[];
  matches: TeamMatchResolved[];
  targetId: string;
  advanceCount: number;
};

export function computeDoublesOdds(input: DoublesInput): OddsResult {
  return computeOdds({
    entries: input.entries,
    done: input.matches.filter((m) => m.status === "done" || m.status === "forfeit"),
    pending: input.matches.filter((m) => m.status === "scheduled" || m.status === "live"),
    targetId: input.targetId,
    advanceCount: input.advanceCount,
    synthesize: synthDoublesMatch,
    getMatchId: (m) => m.id,
    getPair: (m) => [m.pairA, m.pairB] as const,
    compute: (entries, matches) => computeDoublesStandings(entries, matches),
  });
}

export function computeTeamsOdds(input: TeamsInput): OddsResult {
  return computeOdds({
    entries: input.entries,
    done: input.matches.filter((m) => m.status === "done" || m.status === "forfeit"),
    pending: input.matches.filter((m) => m.status === "scheduled" || m.status === "live"),
    targetId: input.targetId,
    advanceCount: input.advanceCount,
    synthesize: synthTeamMatch,
    getMatchId: (m) => m.id,
    getPair: (m) => [
      { id: m.teamA.id, label: m.teamA.name },
      { id: m.teamB.id, label: m.teamB.name },
    ] as const,
    compute: (entries, matches) => computeTeamStandings(entries, matches),
  });
}

type EngineInput<M> = {
  entries: EntryInfo[];
  done: M[];
  pending: M[];
  targetId: string;
  advanceCount: number;
  synthesize: (m: M, aWins: boolean) => M;
  getMatchId: (m: M) => string;
  getPair: (m: M) => readonly [{ id: string; label: string }, { id: string; label: string }];
  compute: (entries: EntryInfo[], matches: M[]) => StandingRow[];
};

function computeOdds<M>(input: EngineInput<M>): OddsResult {
  const { entries, done, pending, targetId, advanceCount, synthesize, getMatchId, getPair, compute } = input;

  // Base cases
  if (pending.length === 0) {
    const standings = compute(entries, done);
    const target = standings.find((r) => r.entryId === targetId);
    const qualified = target !== undefined && target.rank <= advanceCount;
    return {
      status: qualified ? "qualified" : "eliminated",
      probability: qualified ? 100 : 0,
      totalScenarios: 1,
      qualifyingScenarios: qualified ? 1 : 0,
      ownMatches: [],
      externalMatches: [],
      scenarios: [],
      ambiguousRate: 0,
    };
  }

  const N = pending.length;
  const total = 1 << N;
  let qualifying = 0;
  let ambiguous = 0;

  // Per-own-match tally
  const ownTally = new Map<string, { winTotal: number; winQ: number; loseTotal: number; loseQ: number }>();
  const ownMatchIds = new Set<string>();
  for (const m of pending) {
    const [a, b] = getPair(m);
    if (a.id === targetId || b.id === targetId) {
      ownMatchIds.add(getMatchId(m));
      ownTally.set(getMatchId(m), { winTotal: 0, winQ: 0, loseTotal: 0, loseQ: 0 });
    }
  }

  // Track for external-impact: count qualifying in each of the 2 states per match
  const extStateCount = new Map<string, { aWinsQ: number; bWinsQ: number; aWinsTotal: number; bWinsTotal: number }>();
  for (const m of pending) {
    const [a, b] = getPair(m);
    if (a.id !== targetId && b.id !== targetId) {
      extStateCount.set(getMatchId(m), { aWinsQ: 0, bWinsQ: 0, aWinsTotal: 0, bWinsTotal: 0 });
    }
  }

  for (let i = 0; i < total; i++) {
    const simulated = pending.map((m, idx) => synthesize(m, ((i >> idx) & 1) === 1));
    const standings = compute(entries, [...done, ...simulated]);
    const target = standings.find((r) => r.entryId === targetId);
    const isQualified = target !== undefined && target.rank <= advanceCount;
    // Detect ambiguous tie at boundary
    if (target && target.rank === advanceCount) {
      const atBoundary = standings.filter((r) => r.rank === advanceCount);
      if (atBoundary.length > 1) ambiguous += 1;
    }
    if (isQualified) qualifying += 1;

    for (let idx = 0; idx < N; idx++) {
      const m = pending[idx];
      const mid = getMatchId(m);
      const aWins = ((i >> idx) & 1) === 1;
      const [a, b] = getPair(m);
      if (ownMatchIds.has(mid)) {
        const targetWon = (a.id === targetId && aWins) || (b.id === targetId && !aWins);
        const t = ownTally.get(mid)!;
        if (targetWon) {
          t.winTotal += 1;
          if (isQualified) t.winQ += 1;
        } else {
          t.loseTotal += 1;
          if (isQualified) t.loseQ += 1;
        }
      } else {
        const e = extStateCount.get(mid)!;
        if (aWins) {
          e.aWinsTotal += 1;
          if (isQualified) e.aWinsQ += 1;
        } else {
          e.bWinsTotal += 1;
          if (isQualified) e.bWinsQ += 1;
        }
      }
    }
  }

  const probability = (qualifying / total) * 100;
  const status: OddsResult["status"] =
    qualifying === total ? "qualified" : qualifying === 0 ? "eliminated" : "alive";

  const ownMatches: OddsOwnMatch[] = Array.from(ownMatchIds).map((mid) => {
    const t = ownTally.get(mid)!;
    const match = pending.find((m) => getMatchId(m) === mid)!;
    const [a, b] = getPair(match);
    const opponent = a.id === targetId ? b : a;
    const pIfWin = t.winTotal === 0 ? 0 : (t.winQ / t.winTotal) * 100;
    const pIfLose = t.loseTotal === 0 ? 0 : (t.loseQ / t.loseTotal) * 100;
    return {
      matchId: mid,
      opponent,
      pIfWin,
      pIfLose,
      critical: Math.abs(pIfWin - pIfLose) > 40,
    };
  });

  const externalMatches: OddsExternalMatch[] = Array.from(extStateCount.entries()).map(
    ([mid, e]) => {
      const match = pending.find((m) => getMatchId(m) === mid)!;
      const [a, b] = getPair(match);
      const pA = e.aWinsTotal === 0 ? 0 : (e.aWinsQ / e.aWinsTotal) * 100;
      const pB = e.bWinsTotal === 0 ? 0 : (e.bWinsQ / e.bWinsTotal) * 100;
      const delta = Math.abs(pA - pB);
      const impact: OddsExternalMatch["impact"] =
        delta > 30 ? "high" : delta > 10 ? "medium" : "low";
      return { matchId: mid, pairA: a, pairB: b, impact };
    },
  );

  // Top 3 narrative scenarios: group by target's own match outcomes
  const scenarios = buildNarrativeScenarios(ownMatches);

  return {
    status,
    probability,
    totalScenarios: total,
    qualifyingScenarios: qualifying,
    ownMatches,
    externalMatches,
    scenarios,
    ambiguousRate: (ambiguous / total) * 100,
  };
}

function buildNarrativeScenarios(ownMatches: OddsOwnMatch[]): OddsScenario[] {
  const out: OddsScenario[] = [];
  for (const m of ownMatches) {
    if (m.pIfWin - m.pIfLose > 10) {
      out.push({
        description: `Nếu thắng ${m.opponent.label}: ${m.pIfWin.toFixed(0)}% vào vòng trong`,
        probability: m.pIfWin,
      });
    }
    if (m.pIfLose > 10) {
      out.push({
        description: `Nếu thua ${m.opponent.label}: ${m.pIfLose.toFixed(0)}% vào vòng trong`,
        probability: m.pIfLose,
      });
    }
  }
  return out.slice(0, 5);
}

function synthDoublesMatch(m: MatchResolved, aWins: boolean): MatchResolved {
  const sweep = m.bestOf === 3 ? 2 : 3;
  const setsA = aWins ? sweep : 0;
  const setsB = aWins ? 0 : sweep;
  return {
    ...m,
    status: "done",
    winner: aWins ? m.pairA : m.pairB,
    setsA,
    setsB,
    sets: Array.from({ length: sweep }, () =>
      aWins ? { a: 11, b: 5 } : { a: 5, b: 11 },
    ),
  };
}

function synthTeamMatch(m: TeamMatchResolved, aWins: boolean): TeamMatchResolved {
  return {
    ...m,
    status: "done",
    winner: aWins ? m.teamA : m.teamB,
    scoreA: aWins ? 2 : 0,
    scoreB: aWins ? 0 : 2,
  };
}
