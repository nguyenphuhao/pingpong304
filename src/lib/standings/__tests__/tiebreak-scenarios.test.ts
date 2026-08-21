import { describe, expect, test } from "vitest";
import { computeDoublesStandings } from "../compute";
import { qualification } from "@/lib/live/format";
import type { MatchResolved } from "@/lib/schemas/match";

/**
 * Sáu kịch bản chia điểm của một bảng 5 cặp, chạy qua đúng đường mà màn BXH
 * dùng. Mục đích: đổi luật phân định thì phải thấy ngay ở đây, chứ không phát
 * hiện ra vào chiều thi đấu khi BTC đã in kết quả.
 *
 * Nguồn luật: docs/tournament-rules.md §4.
 */

const CODES = ["A1", "A2", "A3", "A4", "A5"];
const entries = CODES.map((id) => ({ id, label: id }));

/** Thứ tự trận đúng tờ lịch BTC (1-indexed theo số hiệu cặp). */
const ORDER: Array<[number, number]> = [
  [1, 2], [3, 4], [1, 5], [2, 3], [4, 5],
  [1, 3], [2, 4], [3, 5], [1, 4], [2, 5],
];

const SLOTS = 2; // hai cặp đầu bảng vào tứ kết

/**
 * Dựng 10 trận từ danh sách "ai thắng trận nào".
 * `narrow` liệt kê số hiệu trận thắng sát 2-1; còn lại thắng đậm 2-0.
 * Nhờ vậy điều khiển được hiệu số mà không phải tự tính tay từng ván.
 */
function build(winners: number[], narrow: number[] = []): MatchResolved[] {
  const tight = new Set(narrow);
  return ORDER.map(([x, y], i) => {
    const winnerNo = winners[i];
    if (winnerNo !== x && winnerNo !== y) {
      throw new Error(`Trận ${i + 1} (${x}v${y}): cặp ${winnerNo} không đá trận này`);
    }
    const aWins = winnerNo === x;
    const raw = tight.has(i + 1)
      ? [[11, 9], [9, 11], [11, 7]]
      : [[11, 8], [11, 6]];
    const sets = raw.map(([w, l]) => (aWins ? { a: w, b: l } : { a: l, b: w }));
    const setsA = sets.filter((t) => t.a > t.b).length;
    const pairA = { id: CODES[x - 1], label: CODES[x - 1] };
    const pairB = { id: CODES[y - 1], label: CODES[y - 1] };
    return {
      id: `dm${String(i + 1).padStart(2, "0")}`,
      groupId: "gA",
      pairA,
      pairB,
      table: 1,
      bestOf: 3,
      sets,
      setsA,
      setsB: sets.length - setsA,
      status: "done",
      winner: aWins ? pairA : pairB,
    } satisfies MatchResolved;
  });
}

function rank(winners: number[], narrow?: number[]) {
  const rows = computeDoublesStandings(entries, build(winners, narrow));
  const allRanks = rows.map((r) => r.rank);
  return {
    order: rows.map((r) => r.entryId),
    ranks: allRanks,
    wins: rows.map((r) => r.won),
    status: (id: string) => {
      const row = rows.find((r) => r.entryId === id)!;
      return qualification(allRanks, row.rank, true, SLOTS);
    },
    advancing: rows
      .filter((r) => qualification(allRanks, r.rank, true, SLOTS) === "advance")
      .map((r) => r.entryId),
  };
}

describe("1 — không ai bằng điểm", () => {
  const r = rank([1, 3, 1, 2, 4, 1, 2, 3, 1, 2]);

  test("xếp thẳng theo số trận thắng 4-3-2-1-0", () => {
    expect(r.wins).toEqual([4, 3, 2, 1, 0]);
    expect(r.order).toEqual(["A1", "A2", "A3", "A4", "A5"]);
  });

  test("hai cặp đầu chắc suất", () => {
    expect(r.advancing).toEqual(["A1", "A2"]);
  });
});

describe("2 — hai cặp bằng điểm ở hạng nhất/nhì", () => {
  // A2 thắng đối đầu A1 (trận 1), nhưng A1 thắng các trận khác đậm hơn nên
  // hiệu số toàn bảng tốt hơn hẳn.
  const r = rank([2, 3, 1, 2, 4, 1, 2, 3, 1, 5], [1, 4, 7]);

  test("cùng 3 trận thắng", () => {
    expect(r.wins.slice(0, 2)).toEqual([3, 3]);
  });

  test("đối đầu trực tiếp quyết định, KHÔNG phải hiệu số", () => {
    expect(r.order.slice(0, 2)).toEqual(["A2", "A1"]);
  });

  test("cả hai đều chắc suất, không phải bốc thăm", () => {
    expect(r.advancing).toEqual(["A2", "A1"]);
  });
});

describe("3 — hai cặp bằng điểm ở hạng nhì/ba (đúng chỗ cắt suất)", () => {
  // A2 thắng đối đầu A3 (trận 4) nhưng hiệu số toàn bảng kém hơn A3.
  const r = rank([1, 3, 1, 2, 4, 1, 2, 3, 1, 5], [4, 7]);

  test("A2 đi tiếp nhờ thắng đối đầu, dù hiệu số kém hơn A3", () => {
    expect(r.order.slice(0, 3)).toEqual(["A1", "A2", "A3"]);
    expect(r.advancing).toEqual(["A1", "A2"]);
  });

  test("A3 bị loại, không phải bốc thăm — đã phân định được", () => {
    expect(r.status("A3")).toBe("out");
  });
});

describe("4 — ba cặp bằng điểm ở hạng nhất/nhì/ba", () => {
  // A1 thắng A2, A2 thắng A3, A3 thắng A1 — vòng tròn, mỗi cặp 1 thắng bảng con.
  // Trận 4 thắng sát nên hiệu số bảng con tách được ba cặp.
  const r = rank([1, 3, 1, 2, 4, 3, 2, 3, 1, 2], [4]);

  test("ba cặp cùng 3 trận thắng", () => {
    expect(r.wins.slice(0, 3)).toEqual([3, 3, 3]);
  });

  test("bảng con phân định được, xếp theo hiệu số bảng con", () => {
    expect(r.order.slice(0, 3)).toEqual(["A3", "A1", "A2"]);
    expect(r.ranks.slice(0, 3)).toEqual([1, 2, 3]);
  });

  test("hai cặp đầu chắc suất, cặp thứ ba bị loại", () => {
    expect(r.advancing).toEqual(["A3", "A1"]);
    expect(r.status("A2")).toBe("out");
  });
});

describe("5 — ba cặp bằng điểm ở hạng nhì/ba/tư", () => {
  const r = rank([1, 3, 1, 2, 4, 1, 4, 3, 1, 2], [7]);

  test("A1 nhất tuyệt đối, ba cặp còn lại cùng 2 thắng", () => {
    expect(r.wins).toEqual([4, 2, 2, 2, 0]);
  });

  test("bảng con chọn ra đúng một cặp cho suất cuối", () => {
    expect(r.advancing).toEqual(["A1", "A2"]);
    expect(r.status("A3")).toBe("out");
    expect(r.status("A4")).toBe("out");
  });
});

describe("6 — cả năm cặp bằng điểm", () => {
  // Vòng tròn khép kín: mỗi cặp thắng đúng 2 trận, mọi chỉ số bằng nhau.
  const r = rank([1, 3, 5, 2, 4, 1, 2, 3, 4, 5]);

  test("cả năm cùng 2 thắng và cùng hạng 1", () => {
    expect(r.wins).toEqual([2, 2, 2, 2, 2]);
    expect(r.ranks).toEqual([1, 1, 1, 1, 1]);
  });

  test("hệ thống KHÔNG tự chọn ai đi tiếp — phải bốc thăm", () => {
    expect(r.advancing).toEqual([]);
    for (const id of CODES) expect(r.status(id)).toBe("drawLots");
  });
});

describe("bất khả thi: đúng bốn cặp bằng điểm", () => {
  // Tổng trận thắng của bảng 5 cặp luôn = 10 (mỗi trận đúng một người thắng).
  // Bốn cặp bằng w điểm, cặp còn lại v → 4w + v = 10 với 0 ≤ v,w ≤ 4,
  // nghiệm duy nhất là w = v = 2, tức cả NĂM bằng nhau chứ không phải bốn.
  test("vét cạn 1024 bố cục: không có bố cục nào có đúng 4 cặp bằng điểm", () => {
    const sizes = new Set<number>();
    for (let mask = 0; mask < 1 << ORDER.length; mask++) {
      const won = [0, 0, 0, 0, 0];
      ORDER.forEach(([a, b], i) => {
        won[(mask >> i) & 1 ? b - 1 : a - 1] += 1;
      });
      const tally = new Map<number, number>();
      for (const w of won) tally.set(w, (tally.get(w) ?? 0) + 1);
      sizes.add(Math.max(...tally.values()));
    }
    expect([...sizes].sort()).toEqual([1, 2, 3, 5]);
    expect(sizes.has(4)).toBe(false);
  });
});
