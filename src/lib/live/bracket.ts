import type { DoublesKoResolved, KoRound } from "@/lib/schemas/knockout";

const ROUND_ORDER: KoRound[] = ["qf", "sf", "f"];

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
