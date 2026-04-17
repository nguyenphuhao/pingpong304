import { describe, expect, test } from "vitest";
import {
  SetScoreSchema,
  SubMatchSchema,
  DoublesMatchPatchSchema,
  TeamMatchPatchSchema,
} from "./match";

describe("SetScoreSchema", () => {
  test("accepts valid score", () => {
    expect(SetScoreSchema.parse({ a: 11, b: 8 })).toEqual({ a: 11, b: 8 });
  });
  test("rejects negative", () => {
    expect(() => SetScoreSchema.parse({ a: -1, b: 0 })).toThrow();
  });
  test("rejects non-int", () => {
    expect(() => SetScoreSchema.parse({ a: 1.5, b: 0 })).toThrow();
  });
  test("rejects > 99", () => {
    expect(() => SetScoreSchema.parse({ a: 100, b: 0 })).toThrow();
  });
});

describe("SubMatchSchema", () => {
  const valid = {
    id: "tm01-d",
    label: "Đôi",
    kind: "doubles" as const,
    playersA: ["t01", "t02"],
    playersB: ["t04", "t05"],
    bestOf: 3 as const,
    sets: [],
  };
  test("accepts valid doubles sub", () => {
    expect(SubMatchSchema.parse(valid)).toEqual(valid);
  });
  test("rejects singles with 2 players", () => {
    expect(() =>
      SubMatchSchema.parse({ ...valid, kind: "singles", playersA: ["t01", "t02"] }),
    ).toThrow(/Số VĐV/);
  });
  test("rejects doubles with 1 player", () => {
    expect(() =>
      SubMatchSchema.parse({ ...valid, playersA: ["t01"] }),
    ).toThrow(/Số VĐV/);
  });
  test("rejects sets > bestOf", () => {
    const sets = Array(6).fill({ a: 11, b: 0 });
    expect(() => SubMatchSchema.parse({ ...valid, sets })).toThrow();
  });
  test("accepts sets <= bestOf", () => {
    const sets = [{ a: 11, b: 8 }, { a: 11, b: 7 }];
    expect(SubMatchSchema.parse({ ...valid, sets }).sets).toHaveLength(2);
  });
});

describe("DoublesMatchPatchSchema", () => {
  test("accepts empty body", () => {
    expect(DoublesMatchPatchSchema.parse({})).toEqual({});
  });
  test("accepts sets only", () => {
    expect(DoublesMatchPatchSchema.parse({ sets: [{ a: 11, b: 8 }] })).toEqual({
      sets: [{ a: 11, b: 8 }],
    });
  });
  test("rejects forfeit without winner", () => {
    expect(() =>
      DoublesMatchPatchSchema.parse({ status: "forfeit" }),
    ).toThrow(/Forfeit yêu cầu winner/);
  });
  test("accepts forfeit with winner", () => {
    expect(
      DoublesMatchPatchSchema.parse({ status: "forfeit", winner: "p01" }),
    ).toEqual({ status: "forfeit", winner: "p01" });
  });
  test("rejects winner with bad ID", () => {
    expect(() =>
      DoublesMatchPatchSchema.parse({ status: "forfeit", winner: "bad id!" }),
    ).toThrow();
  });
  test("accepts winner=null when not forfeit", () => {
    expect(
      DoublesMatchPatchSchema.parse({ status: "scheduled", winner: null }),
    ).toEqual({ status: "scheduled", winner: null });
  });
  test("rejects table=0", () => {
    expect(() => DoublesMatchPatchSchema.parse({ table: 0 })).toThrow();
  });
});

describe("TeamMatchPatchSchema", () => {
  const sub = {
    id: "tm01-d",
    label: "Đôi",
    kind: "doubles" as const,
    playersA: ["t01", "t02"],
    playersB: ["t04", "t05"],
    bestOf: 3 as const,
    sets: [],
  };
  test("accepts empty body", () => {
    expect(TeamMatchPatchSchema.parse({})).toEqual({});
  });
  test("accepts individual array", () => {
    const r = TeamMatchPatchSchema.parse({ individual: [sub] });
    expect(r.individual).toHaveLength(1);
  });
  test("rejects empty individual", () => {
    expect(() => TeamMatchPatchSchema.parse({ individual: [] })).toThrow();
  });
  test("rejects > 7 subs", () => {
    const subs = Array(8).fill(sub).map((s, i) => ({ ...s, id: `tm01-${i}` }));
    expect(() => TeamMatchPatchSchema.parse({ individual: subs })).toThrow();
  });
  test("rejects forfeit without winner", () => {
    expect(() =>
      TeamMatchPatchSchema.parse({ status: "forfeit" }),
    ).toThrow(/Forfeit yêu cầu winner/);
  });
  test("rejects duplicate sub IDs", () => {
    const dup = [sub, { ...sub }];
    expect(() => TeamMatchPatchSchema.parse({ individual: dup })).toThrow(
      /Sub-match ID trùng/,
    );
  });
});
