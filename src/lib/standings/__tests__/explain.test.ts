import { describe, expect, test } from "vitest";
import { explainDoublesRanking } from "../explain";
import { computeDoublesStandings } from "../compute";
import type { MatchResolved } from "@/lib/schemas/match";

/**
 * Tầng giải thích phải nói ĐÚNG lý do hệ thống xếp như vậy.
 *
 * Trước đây route AI chỉ nhận bảng xếp hạng cuối rồi bảo model tự suy — model
 * bịa ra "hiệu số cao hơn nên xếp trên" cho cặp có hiệu số THẤP hơn. Nay lý do
 * tính bằng code, model chỉ diễn đạt lại.
 */

const CODES = ["A1", "A2", "A3", "A4", "A5"];
const entries = CODES.map((id) => ({ id, label: id }));
const ORDER: Array<[number, number]> = [
  [1, 2], [3, 4], [1, 5], [2, 3], [4, 5],
  [1, 3], [2, 4], [3, 5], [1, 4], [2, 5],
];

function build(winners: number[], narrow: number[] = []): MatchResolved[] {
  const tight = new Set(narrow);
  return ORDER.map(([x, y], i) => {
    const aWins = winners[i] === x;
    const raw = tight.has(i + 1) ? [[11, 9], [9, 11], [11, 7]] : [[11, 8], [11, 6]];
    const sets = raw.map(([w, l]) => (aWins ? { a: w, b: l } : { a: l, b: w }));
    const setsA = sets.filter((t) => t.a > t.b).length;
    const pairA = { id: CODES[x - 1], label: CODES[x - 1] };
    const pairB = { id: CODES[y - 1], label: CODES[y - 1] };
    return {
      id: `dm${i + 1}`, groupId: "gA", pairA, pairB, table: 1, bestOf: 3,
      sets, setsA, setsB: sets.length - setsA,
      status: "done", winner: aWins ? pairA : pairB,
    } satisfies MatchResolved;
  });
}

const notesFor = (winners: number[], narrow?: number[]) =>
  explainDoublesRanking(entries, build(winners, narrow));

describe("không ai bằng điểm", () => {
  test("không sinh ghi chú phân định nào", () => {
    expect(notesFor([1, 3, 1, 2, 4, 1, 2, 3, 1, 2])).toEqual([]);
  });
});

describe("hai cặp bằng điểm — phân định bằng đối đầu", () => {
  // A2 và A3 cùng 2 thắng; A2 thắng đối đầu nhưng hiệu số toàn bảng kém hơn.
  const notes = notesFor([1, 3, 1, 2, 4, 1, 2, 3, 1, 5], [4, 7]);

  test("báo cả hai nhóm bằng điểm, nhóm tranh suất đi tiếp đứng trước", () => {
    // A2/A3 cùng 2 thắng (tranh suất cuối), A4/A5 cùng 1 thắng
    expect(notes.map((n) => n.entries)).toEqual([
      ["A2", "A3"],
      ["A4", "A5"],
    ]);
    expect(notes[0].won).toBe(2);
  });

  test("nêu đúng tiêu chí là đối đầu trực tiếp", () => {
    expect(notes[0].method).toBe("h2h");
  });

  test("nói rõ cặp thắng đối đầu có hiệu số kém hơn — chỗ dễ bị hiểu nhầm nhất", () => {
    expect(notes[0].text).toContain("A2");
    expect(notes[0].text).toContain("đối đầu");
    expect(notes[0].text).toMatch(/-2/);
    expect(notes[0].text).toMatch(/\+1/);
  });

  test("KHÔNG được nói hiệu số quyết định", () => {
    expect(notes[0].text).not.toMatch(/hiệu số cao hơn/i);
  });
});

describe("ba cặp bằng điểm — phân định bằng bảng con", () => {
  const notes = notesFor([1, 3, 1, 2, 4, 3, 2, 3, 1, 2], [4]);

  test("một nhóm ba cặp, xếp theo bảng con", () => {
    expect(notes).toHaveLength(1);
    expect(notes[0].method).toBe("mini");
    expect(notes[0].entries).toEqual(["A3", "A1", "A2"]);
  });

  test("nêu số liệu bảng con thật, không phải hiệu số toàn bảng", () => {
    // Hiệu số bảng con: A3 +1, A1 0, A2 −1
    expect(notes[0].text).toContain("bảng con");
    expect(notes[0].text).toMatch(/A3[^.]*\+1/);
    expect(notes[0].text).toMatch(/A2[^.]*-1/);
  });
});

describe("cả năm cặp bằng nhau — không phân định được", () => {
  const notes = notesFor([1, 3, 5, 2, 4, 1, 2, 3, 4, 5]);

  test("báo là không phân định được, cần bốc thăm", () => {
    expect(notes).toHaveLength(1);
    expect(notes[0].method).toBe("unresolved");
    expect(notes[0].entries).toHaveLength(5);
    expect(notes[0].text).toContain("bốc thăm");
  });
});

describe("ghi chú luôn khớp thứ tự thật của bảng xếp hạng", () => {
  const cases: Array<[string, number[], number[]]> = [
    ["không bằng điểm", [1, 3, 1, 2, 4, 1, 2, 3, 1, 2], []],
    ["hai cặp bằng", [1, 3, 1, 2, 4, 1, 2, 3, 1, 5], [4, 7]],
    ["ba cặp bằng", [1, 3, 1, 2, 4, 3, 2, 3, 1, 2], [4]],
    ["năm cặp bằng", [1, 3, 5, 2, 4, 1, 2, 3, 4, 5], []],
  ];

  test.each(cases)("%s — thứ tự trong ghi chú trùng bảng xếp hạng", (_n, w, nar) => {
    const matches = build(w, nar);
    const rows = computeDoublesStandings(entries, matches);
    for (const note of explainDoublesRanking(entries, matches)) {
      const thuTuThat = rows
        .filter((r) => note.entries.includes(r.entryId))
        .map((r) => r.entryId);
      expect(note.entries).toEqual(thuTuThat);
    }
  });
});
