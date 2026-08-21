import { describe, expect, test } from "vitest";
import { orderForBracket, finalRanking } from "./bracket";
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

// ── finalRanking ──

type Side = { id: string; label: string } | null;

function koResult(
  id: string,
  round: "qf" | "sf" | "f",
  a: Side,
  b: Side,
  winnerId: string | null,
  status: "scheduled" | "done" | "forfeit" | "live" = "done",
): DoublesKoResolved {
  const base = ko({ id, round });
  const winner = [a, b].find((s) => s?.id === winnerId) ?? null;
  return { ...base, entryA: a, entryB: b, winner, status };
}

const P = (id: string, label: string) => ({ id, label });

describe("finalRanking", () => {
  const sf1 = koResult("sf1", "sf", P("A3", "H'Lim / Phương"), P("C1", "Cường / Vinh"), "A3");
  const sf2 = koResult("sf2", "sf", P("B2", "Quân / Minh"), P("D4", "Sĩ / Hùng"), "D4");

  test("chung kết chưa đấu thì chưa có thứ hạng", () => {
    const f = koResult("f", "f", null, null, null, "scheduled");
    expect(finalRanking([sf1, sf2, f])).toBeNull();
  });

  test("vô địch là cặp thắng chung kết, á quân là cặp còn lại", () => {
    const f = koResult("f", "f", P("A3", "H'Lim / Phương"), P("D4", "Sĩ / Hùng"), "A3");
    const r = finalRanking([sf1, sf2, f]);
    expect(r?.champion).toBe("H'Lim / Phương");
    expect(r?.runnerUp).toBe("Sĩ / Hùng");
  });

  test("hai cặp thua bán kết đồng hạng ba", () => {
    const f = koResult("f", "f", P("A3", "H'Lim / Phương"), P("D4", "Sĩ / Hùng"), "A3");
    expect(finalRanking([sf1, sf2, f])?.thirds).toEqual([
      "Cường / Vinh",
      "Quân / Minh",
    ]);
  });

  test("bán kết chưa xong thì chưa tính vào hạng ba", () => {
    const pending = koResult("sf2", "sf", P("B2", "Quân / Minh"), P("D4", "Sĩ / Hùng"), null, "live");
    const f = koResult("f", "f", P("A3", "H'Lim / Phương"), P("D4", "Sĩ / Hùng"), "A3");
    expect(finalRanking([sf1, pending, f])?.thirds).toEqual(["Cường / Vinh"]);
  });

  test("thắng do bỏ cuộc vẫn tính là đã phân định", () => {
    const f = koResult("f", "f", P("A3", "H'Lim / Phương"), P("D4", "Sĩ / Hùng"), "A3", "forfeit");
    expect(finalRanking([sf1, sf2, f])?.champion).toBe("H'Lim / Phương");
  });

  test("không có trận chung kết thì trả null", () => {
    expect(finalRanking([sf1, sf2])).toBeNull();
  });
});
