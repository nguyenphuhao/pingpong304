import { describe, expect, test } from "vitest";
import { orderForBracket } from "./bracket";
import type { DoublesKoResolved } from "@/lib/schemas/knockout";

type Wire = {
  id: string;
  round: "qf" | "sf" | "f";
  nextMatchId?: string;
  nextSlot?: "a" | "b";
};

function ko({ id, round, nextMatchId, nextSlot }: Wire): DoublesKoResolved {
  return {
    id,
    round,
    bestOf: 5,
    table: null,
    labelA: "",
    labelB: "",
    entryA: null,
    entryB: null,
    sets: [],
    setsA: 0,
    setsB: 0,
    status: "scheduled",
    winner: null,
    nextMatchId: nextMatchId ?? null,
    nextSlot: nextSlot ?? null,
  };
}

/** Sơ đồ thật của giải: BK1 = thắng TK1 gặp thắng TK3, BK2 = TK2 gặp TK4. */
const BRACKET: DoublesKoResolved[] = [
  ko({ id: "qf1", round: "qf", nextMatchId: "sf1", nextSlot: "a" }),
  ko({ id: "qf2", round: "qf", nextMatchId: "sf2", nextSlot: "a" }),
  ko({ id: "qf3", round: "qf", nextMatchId: "sf1", nextSlot: "b" }),
  ko({ id: "qf4", round: "qf", nextMatchId: "sf2", nextSlot: "b" }),
  ko({ id: "sf1", round: "sf", nextMatchId: "f", nextSlot: "a" }),
  ko({ id: "sf2", round: "sf", nextMatchId: "f", nextSlot: "b" }),
  ko({ id: "f", round: "f" }),
];

const ids = (cols: DoublesKoResolved[][]) => cols.map((c) => c.map((m) => m.id));

describe("orderForBracket", () => {
  test("một cột cho mỗi vòng, xếp từ tứ kết tới chung kết", () => {
    expect(ids(orderForBracket(BRACKET))).toEqual([
      ["qf1", "qf3", "qf2", "qf4"],
      ["sf1", "sf2"],
      ["f"],
    ]);
  });

  test("hai trận nạp cùng một trận nằm cạnh nhau, ô a trước ô b", () => {
    const [qfCol] = orderForBracket(BRACKET);
    expect(qfCol[0].nextMatchId).toBe(qfCol[1].nextMatchId);
    expect(qfCol[0].nextSlot).toBe("a");
    expect(qfCol[1].nextSlot).toBe("b");
    expect(qfCol[2].nextMatchId).toBe(qfCol[3].nextMatchId);
    expect(qfCol[2].nextSlot).toBe("a");
    expect(qfCol[3].nextSlot).toBe("b");
  });

  test("đổi đường nối thì thứ tự cột đổi theo — không đóng cứng", () => {
    const rewired: DoublesKoResolved[] = [
      ko({ id: "qf1", round: "qf", nextMatchId: "sf1", nextSlot: "a" }),
      ko({ id: "qf2", round: "qf", nextMatchId: "sf1", nextSlot: "b" }),
      ko({ id: "qf3", round: "qf", nextMatchId: "sf2", nextSlot: "a" }),
      ko({ id: "qf4", round: "qf", nextMatchId: "sf2", nextSlot: "b" }),
      ko({ id: "sf1", round: "sf", nextMatchId: "f", nextSlot: "a" }),
      ko({ id: "sf2", round: "sf", nextMatchId: "f", nextSlot: "b" }),
      ko({ id: "f", round: "f" }),
    ];
    expect(ids(orderForBracket(rewired))[0]).toEqual(["qf1", "qf2", "qf3", "qf4"]);
  });

  test("bỏ qua vòng không có trận nào", () => {
    const noQf = BRACKET.filter((m) => m.round !== "qf");
    expect(ids(orderForBracket(noQf))).toEqual([["sf1", "sf2"], ["f"]]);
  });

  test("trận không nối vào đâu vẫn được giữ, xếp cuối cột", () => {
    const orphan = [...BRACKET, ko({ id: "qf5", round: "qf" })];
    expect(ids(orderForBracket(orphan))[0]).toEqual(["qf1", "qf3", "qf2", "qf4", "qf5"]);
  });

  test("mảng rỗng trả về mảng rỗng", () => {
    expect(orderForBracket([])).toEqual([]);
  });

  test("không làm mất trận nào", () => {
    const flat = orderForBracket(BRACKET).flat();
    expect(flat).toHaveLength(BRACKET.length);
    expect(new Set(flat.map((m) => m.id)).size).toBe(BRACKET.length);
  });
});
