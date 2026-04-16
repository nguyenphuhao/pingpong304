import { describe, expect, test } from "vitest";
import { IdSchema } from "./id";

describe("IdSchema", () => {
  test("accepts seed-like ids", () => {
    for (const id of ["d01", "t36", "p18", "T01", "gA", "tA1", "tko-sf1", "dko_qf2"]) {
      expect(IdSchema.safeParse(id).success).toBe(true);
    }
  });

  test("rejects empty", () => {
    expect(IdSchema.safeParse("").success).toBe(false);
  });

  test("rejects sql-like payloads", () => {
    for (const id of ["a;b", "p01' OR '1'='1", "a.b", "a,b", "a b", "a/b", "../x"]) {
      expect(IdSchema.safeParse(id).success).toBe(false);
    }
  });

  test("rejects non-string", () => {
    expect(IdSchema.safeParse(123).success).toBe(false);
  });
});
