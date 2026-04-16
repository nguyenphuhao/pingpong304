import { describe, expect, test } from "vitest";
import { GroupEntriesPatchSchema } from "./group";

describe("GroupEntriesPatchSchema", () => {
  test("accepts valid entries array", () => {
    const r = GroupEntriesPatchSchema.safeParse({ entries: ["p01", "p04"] });
    expect(r.success).toBe(true);
  });

  test("accepts empty entries array", () => {
    const r = GroupEntriesPatchSchema.safeParse({ entries: [] });
    expect(r.success).toBe(true);
  });

  test("rejects duplicate entries", () => {
    const r = GroupEntriesPatchSchema.safeParse({ entries: ["p01", "p01"] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/trùng/i);
    }
  });

  test("rejects entry with bad id (regex fail)", () => {
    const r = GroupEntriesPatchSchema.safeParse({ entries: ["p01", "a b"] });
    expect(r.success).toBe(false);
  });

  test("rejects non-array entries", () => {
    const r = GroupEntriesPatchSchema.safeParse({ entries: "p01" });
    expect(r.success).toBe(false);
  });

  test("rejects missing entries key", () => {
    const r = GroupEntriesPatchSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});
