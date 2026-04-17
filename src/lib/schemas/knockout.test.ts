import { describe, expect, test } from "vitest";
import { DoublesKoPatchSchema, TeamKoPatchSchema } from "./knockout";

describe("DoublesKoPatchSchema", () => {
  test("accepts empty body", () => {
    expect(DoublesKoPatchSchema.parse({})).toEqual({});
  });
  test("accepts sets only", () => {
    const r = DoublesKoPatchSchema.parse({ sets: [{ a: 11, b: 8 }] });
    expect(r.sets).toHaveLength(1);
  });
  test("accepts entry swap", () => {
    const r = DoublesKoPatchSchema.parse({ entryA: "pair-1" });
    expect(r.entryA).toBe("pair-1");
  });
  test("accepts null entry (clear)", () => {
    const r = DoublesKoPatchSchema.parse({ entryA: null });
    expect(r.entryA).toBeNull();
  });
  test("rejects forfeit without winner", () => {
    expect(() =>
      DoublesKoPatchSchema.parse({ status: "forfeit" }),
    ).toThrow(/Forfeit yêu cầu winner/);
  });
  test("accepts bestOf change", () => {
    const r = DoublesKoPatchSchema.parse({ bestOf: 5 });
    expect(r.bestOf).toBe(5);
  });
});

describe("TeamKoPatchSchema", () => {
  const sub = {
    id: "tko-sf1-sub1",
    label: "Đôi",
    kind: "doubles" as const,
    playersA: ["tp1", "tp2"],
    playersB: ["tp3", "tp4"],
    bestOf: 3 as const,
    sets: [],
  };
  test("accepts empty body", () => {
    expect(TeamKoPatchSchema.parse({})).toEqual({});
  });
  test("accepts individual array", () => {
    const r = TeamKoPatchSchema.parse({ individual: [sub] });
    expect(r.individual).toHaveLength(1);
  });
  test("accepts entry swap", () => {
    const r = TeamKoPatchSchema.parse({ entryA: "team-1" });
    expect(r.entryA).toBe("team-1");
  });
  test("rejects forfeit without winner", () => {
    expect(() =>
      TeamKoPatchSchema.parse({ status: "forfeit" }),
    ).toThrow(/Forfeit yêu cầu winner/);
  });
});
