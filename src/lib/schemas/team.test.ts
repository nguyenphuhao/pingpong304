import { describe, expect, test } from "vitest";
import { TeamInputSchema, TeamPatchSchema } from "./team";

describe("TeamInputSchema", () => {
  test("accepts valid", () => {
    const r = TeamInputSchema.safeParse({
      name: "Đội A",
      members: ["t01", "t02", "t03"],
    });
    expect(r.success).toBe(true);
  });

  test("rejects empty name", () => {
    const r = TeamInputSchema.safeParse({
      name: "",
      members: ["t01", "t02", "t03"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects name over 60 chars", () => {
    const r = TeamInputSchema.safeParse({
      name: "x".repeat(61),
      members: ["t01", "t02", "t03"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects 2 members", () => {
    const r = TeamInputSchema.safeParse({
      name: "A",
      members: ["t01", "t02"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects 4 members", () => {
    const r = TeamInputSchema.safeParse({
      name: "A",
      members: ["t01", "t02", "t03", "t04"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects duplicate members", () => {
    const r = TeamInputSchema.safeParse({
      name: "A",
      members: ["t01", "t02", "t01"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects invalid id in members", () => {
    const r = TeamInputSchema.safeParse({
      name: "A",
      members: ["t 01", "t02", "t03"],
    });
    expect(r.success).toBe(false);
  });

  test("trims name", () => {
    const r = TeamInputSchema.safeParse({
      name: "  Đội A  ",
      members: ["t01", "t02", "t03"],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Đội A");
  });
});

describe("TeamPatchSchema", () => {
  test("accepts empty", () => {
    expect(TeamPatchSchema.safeParse({}).success).toBe(true);
  });

  test("accepts name only", () => {
    expect(TeamPatchSchema.safeParse({ name: "Mới" }).success).toBe(true);
  });

  test("accepts members only (valid)", () => {
    expect(
      TeamPatchSchema.safeParse({ members: ["t04", "t05", "t06"] }).success,
    ).toBe(true);
  });

  test("rejects partial members (length 2)", () => {
    expect(TeamPatchSchema.safeParse({ members: ["t01", "t02"] }).success).toBe(false);
  });
});
