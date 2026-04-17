import type { MatchResolved } from "@/lib/schemas/match";

export type FormResult = {
  totalRecent: number;
  wins: number;
  losses: number;
  streak: string; // "W3", "L2", "none"
  avgSetDiff: number;
  winRate: number; // 0-100
  lastMatches: Array<{
    opponent: string;
    result: "W" | "L";
    setsA: number;
    setsB: number;
  }>;
};

/**
 * Phân tích phong độ N trận gần nhất của 1 cặp.
 *
 * @remarks
 * Caller phải truyền `matches` theo thứ tự thời gian (cũ trước, mới sau).
 * Nếu lấy từ DB, dùng `fetchDoublesMatchesByGroup` (đã sort by id, khớp thứ
 * tự tạo match). V2 sẽ cân nhắc truyền `updatedAt` khi schema có.
 */
export function analyzePairForm(input: {
  pairId: string;
  matches: MatchResolved[];
  lastN: number;
}): FormResult {
  const done = input.matches
    .filter((m) => m.status === "done" || m.status === "forfeit")
    .filter((m) => m.pairA.id === input.pairId || m.pairB.id === input.pairId);

  const recent = done.slice(-input.lastN).reverse();

  if (recent.length === 0) {
    return {
      totalRecent: 0,
      wins: 0,
      losses: 0,
      streak: "none",
      avgSetDiff: 0,
      winRate: 0,
      lastMatches: [],
    };
  }

  const lastMatches = recent.map((m) => {
    const isA = m.pairA.id === input.pairId;
    const won = m.winner?.id === input.pairId;
    return {
      opponent: isA ? m.pairB.label : m.pairA.label,
      result: won ? ("W" as const) : ("L" as const),
      setsA: isA ? m.setsA : m.setsB,
      setsB: isA ? m.setsB : m.setsA,
    };
  });

  const wins = lastMatches.filter((m) => m.result === "W").length;
  const losses = lastMatches.length - wins;

  // Streak = consecutive same-result from most recent
  const recentResult = lastMatches[0].result;
  let streakCount = 0;
  for (const m of lastMatches) {
    if (m.result === recentResult) streakCount += 1;
    else break;
  }
  const streak = `${recentResult}${streakCount}`;

  const avgSetDiff =
    lastMatches.reduce((sum, m) => sum + (m.setsA - m.setsB), 0) / lastMatches.length;

  return {
    totalRecent: lastMatches.length,
    wins,
    losses,
    streak,
    avgSetDiff,
    winRate: (wins / lastMatches.length) * 100,
    lastMatches,
  };
}
