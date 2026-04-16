import { describe, expect, test } from "vitest";
import { PairInputSchema, PairPatchSchema } from "./pair";

describe("PairInputSchema", () => {
  test("accepts valid", () => {
    expect(PairInputSchema.safeParse({ p1: "d01", p2: "d02" }).success).toBe(true);
  });

  test("rejects p1=p2", () => {
    const r = PairInputSchema.safeParse({ p1: "d01", p2: "d01" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toContain("khác nhau");
      expect(r.error.issues[0].path).toEqual(["p2"]);
    }
  });

  test("rejects missing p1", () => {
    expect(PairInputSchema.safeParse({ p2: "d02" }).success).toBe(false);
  });

  test("rejects invalid id format", () => {
    expect(PairInputSchema.safeParse({ p1: "d 01", p2: "d02" }).success).toBe(false);
  });
});

describe("PairPatchSchema", () => {
  test("accepts empty patch", () => {
    expect(PairPatchSchema.safeParse({}).success).toBe(true);
  });

  test("accepts partial p1 only", () => {
    expect(PairPatchSchema.safeParse({ p1: "d03" }).success).toBe(true);
  });

  test("rejects p1=p2 when both set", () => {
    expect(PairPatchSchema.safeParse({ p1: "d01", p2: "d01" }).success).toBe(false);
  });

  test("accepts p1 only even if duplicates existing p2 (can't check without row)", () => {
    expect(PairPatchSchema.safeParse({ p1: "d01" }).success).toBe(true);
  });
});
