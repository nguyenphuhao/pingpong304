import { describe, expect, test } from "vitest";
import { PlayerInputSchema, PlayerPatchSchema } from "./player";

describe("PlayerInputSchema", () => {
  test("accepts valid input", () => {
    const r = PlayerInputSchema.safeParse({
      name: "Nguyễn Văn A",
      gender: "M",
      club: "CLB Bình Tân",
      phone: "0901234567",
    });
    expect(r.success).toBe(true);
  });

  test("accepts empty phone", () => {
    const r = PlayerInputSchema.safeParse({
      name: "A",
      gender: "F",
      club: "",
      phone: "",
    });
    expect(r.success).toBe(true);
  });

  test("accepts missing phone", () => {
    const r = PlayerInputSchema.safeParse({ name: "A", gender: "M", club: "" });
    expect(r.success).toBe(true);
  });

  test("rejects empty name", () => {
    const r = PlayerInputSchema.safeParse({ name: "", gender: "M", club: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(["name"]);
      expect(r.error.issues[0].message).toContain("không được");
    }
  });

  test("rejects name over 80 chars", () => {
    const r = PlayerInputSchema.safeParse({
      name: "x".repeat(81),
      gender: "M",
      club: "",
    });
    expect(r.success).toBe(false);
  });

  test("rejects invalid gender", () => {
    const r = PlayerInputSchema.safeParse({
      name: "A",
      gender: "X",
      club: "",
    });
    expect(r.success).toBe(false);
  });

  test("rejects phone over 20 chars", () => {
    const r = PlayerInputSchema.safeParse({
      name: "A",
      gender: "M",
      club: "",
      phone: "1".repeat(21),
    });
    expect(r.success).toBe(false);
  });

  test("trims whitespace", () => {
    const r = PlayerInputSchema.safeParse({
      name: "  Nguyễn  ",
      gender: "M",
      club: " CLB ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Nguyễn");
      expect(r.data.club).toBe("CLB");
    }
  });
});

describe("PlayerPatchSchema", () => {
  test("accepts partial input", () => {
    const r = PlayerPatchSchema.safeParse({ name: "Mới" });
    expect(r.success).toBe(true);
  });

  test("accepts empty object (no-op patch)", () => {
    const r = PlayerPatchSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  test("still validates individual fields", () => {
    const r = PlayerPatchSchema.safeParse({ gender: "X" });
    expect(r.success).toBe(false);
  });
});
