import type { DoublesKoResolved, KoRound } from "@/lib/schemas/knockout";

const ROUND_ORDER: KoRound[] = ["qf", "sf", "f"];

/** Trận đã có kết quả — thắng do bỏ cuộc cũng tính. */
function decided(m: DoublesKoResolved): boolean {
  return m.status === "done" || m.status === "forfeit";
}

/** Cặp thua của một trận đã phân định. */
function loserLabel(m: DoublesKoResolved): string | null {
  const winnerId = m.winner?.id;
  if (!winnerId) return null;
  const loser = m.entryA?.id === winnerId ? m.entryB : m.entryA;
  return loser?.label ?? null;
}

export type FinalRanking = {
  champion: string;
  runnerUp: string | null;
  /** Hai cặp thua bán kết — điều lệ §2.3 cho đồng hạng Ba, không đánh tranh hạng 3. */
  thirds: string[];
};

/**
 * Thứ hạng chung cuộc, hoặc null khi chung kết chưa phân định.
 *
 * Gộp về một chỗ vì logic này đang bị chép ở `_ContentHome.tsx` và
 * `_publicKnockout.tsx` — ba bản chép rời là ba cơ hội lệch nhau.
 */
export function finalRanking(
  matches: readonly DoublesKoResolved[],
): FinalRanking | null {
  const final = matches.find((m) => m.round === "f");
  if (!final || !decided(final) || !final.winner) return null;

  const winnerId = final.winner.id;
  const runnerUp =
    final.entryA?.id === winnerId ? final.entryB : final.entryA;

  const thirds = matches
    .filter((m) => m.round === "sf" && decided(m))
    .map(loserLabel)
    .filter((name): name is string => name !== null);

  return {
    champion: final.winner.label,
    runnerUp: runnerUp?.label ?? null,
    thirds,
  };
}

/**
 * Sắp một cột theo thứ tự các trận mà nó nạp vào: với mỗi trận ở cột kế tiếp,
 * lấy trận rót vào ô "a" rồi tới ô "b". Trận không nối vào đâu xếp cuối.
 */
function orderByFeed(
  column: readonly DoublesKoResolved[],
  next: readonly DoublesKoResolved[],
): DoublesKoResolved[] {
  const ordered: DoublesKoResolved[] = [];
  const taken = new Set<string>();

  for (const target of next) {
    for (const slot of ["a", "b"] as const) {
      const feeder = column.find(
        (m) => m.nextMatchId === target.id && m.nextSlot === slot,
      );
      if (feeder && !taken.has(feeder.id)) {
        ordered.push(feeder);
        taken.add(feeder.id);
      }
    }
  }
  for (const m of column) {
    if (!taken.has(m.id)) ordered.push(m);
  }
  return ordered;
}

/**
 * Chia trận vòng loại trực tiếp thành các cột để vẽ sơ đồ nhánh, mỗi vòng một cột.
 *
 * Thứ tự trong cột suy từ đường nối (`nextMatchId`/`nextSlot`) chứ không đóng cứng.
 * Với sơ đồ của giải — BK1 nhận thắng TK1 và thắng TK3 — cột tứ kết ra
 * TK1 · TK3 · TK2 · TK4, nhờ vậy hai trận cùng nạp một trận luôn nằm cạnh nhau
 * và đường nối không cắt chéo.
 */
export function orderForBracket(
  matches: readonly DoublesKoResolved[],
): DoublesKoResolved[][] {
  const columns = ROUND_ORDER.map((round) =>
    matches.filter((m) => m.round === round),
  ).filter((column) => column.length > 0);

  for (let i = columns.length - 2; i >= 0; i -= 1) {
    columns[i] = orderByFeed(columns[i], columns[i + 1]);
  }
  return columns;
}
