import type { MatchResolved } from "@/lib/schemas/match";

export type CompareResult = {
  h2h: Array<{
    matchId: string;
    setsA: number;
    setsB: number;
    winnerId: string | null;
  }>;
  h2hWinsA: number;
  h2hWinsB: number;
  commonOpponents: Array<{
    opponentId: string;
    opponentLabel: string;
    aResult: "W" | "L" | "none";
    bResult: "W" | "L" | "none";
  }>;
};

export function compareDoublesPairs(input: {
  idA: string;
  idB: string;
  matches: MatchResolved[];
}): CompareResult {
  const done = input.matches.filter(
    (m) => m.status === "done" || m.status === "forfeit",
  );

  const h2h = done.filter(
    (m) =>
      (m.pairA.id === input.idA && m.pairB.id === input.idB) ||
      (m.pairA.id === input.idB && m.pairB.id === input.idA),
  );

  let h2hWinsA = 0;
  let h2hWinsB = 0;
  const h2hOut = h2h.map((m) => {
    const aIsPairA = m.pairA.id === input.idA;
    const setsA = aIsPairA ? m.setsA : m.setsB;
    const setsB = aIsPairA ? m.setsB : m.setsA;
    if (m.winner?.id === input.idA) h2hWinsA += 1;
    else if (m.winner?.id === input.idB) h2hWinsB += 1;
    return {
      matchId: m.id,
      setsA,
      setsB,
      winnerId: m.winner?.id ?? null,
    };
  });

  const opponentsOf = (pairId: string) => {
    const map = new Map<string, { label: string; result: "W" | "L" }>();
    for (const m of done) {
      if (m.pairA.id === pairId) {
        map.set(m.pairB.id, {
          label: m.pairB.label,
          result: m.winner?.id === pairId ? "W" : "L",
        });
      } else if (m.pairB.id === pairId) {
        map.set(m.pairA.id, {
          label: m.pairA.label,
          result: m.winner?.id === pairId ? "W" : "L",
        });
      }
    }
    return map;
  };

  const oppA = opponentsOf(input.idA);
  const oppB = opponentsOf(input.idB);
  const commonIds = [...oppA.keys()].filter((id) => oppB.has(id) && id !== input.idA && id !== input.idB);

  const commonOpponents = commonIds.map((id) => ({
    opponentId: id,
    opponentLabel: oppA.get(id)!.label,
    aResult: oppA.get(id)!.result,
    bResult: oppB.get(id)!.result,
  }));

  return { h2h: h2hOut, h2hWinsA, h2hWinsB, commonOpponents };
}
