import type { SetScore, SubMatch, BestOf } from "@/lib/schemas/match";

export function deriveSetCounts(sets: SetScore[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a += 1;
    else if (s.b > s.a) b += 1;
  }
  return { a, b };
}

function threshold(bestOf: BestOf): number {
  return Math.floor(bestOf / 2) + 1;
}

export function deriveDoublesWinner(
  sets: SetScore[],
  pairAId: string,
  pairBId: string,
  bestOf: BestOf,
): string | null {
  const { a, b } = deriveSetCounts(sets);
  const t = threshold(bestOf);
  if (a >= t) return pairAId;
  if (b >= t) return pairBId;
  return null;
}

export function deriveSubMatchWinner(
  sub: SubMatch,
  sideAId: string,
  sideBId: string,
): string | null {
  return deriveDoublesWinner(sub.sets, sideAId, sideBId, sub.bestOf);
}

export function deriveTeamScore(
  individual: SubMatch[],
  teamAId: string,
  teamBId: string,
): { scoreA: number; scoreB: number } {
  let scoreA = 0;
  let scoreB = 0;
  for (const sub of individual) {
    const w = deriveSubMatchWinner(sub, teamAId, teamBId);
    if (w === teamAId) scoreA += 1;
    else if (w === teamBId) scoreB += 1;
  }
  return { scoreA, scoreB };
}

export function deriveTeamWinner(
  individual: SubMatch[],
  teamAId: string,
  teamBId: string,
): string | null {
  if (individual.length === 0) return null;
  const { scoreA, scoreB } = deriveTeamScore(individual, teamAId, teamBId);
  const t = Math.floor(individual.length / 2) + 1;
  if (scoreA >= t) return teamAId;
  if (scoreB >= t) return teamBId;
  return null;
}
