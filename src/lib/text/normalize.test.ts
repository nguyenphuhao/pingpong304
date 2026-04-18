import { describe, expect, test } from "vitest";
import { normalizeVi } from "./normalize";

describe("normalizeVi", () => {
  test("strips single-char diacritics", () => {
    expect(normalizeVi("Hào")).toBe("hao");
    expect(normalizeVi("Hạo")).toBe("hao");
    expect(normalizeVi("Hảo")).toBe("hao");
  });

  test("handles multi-word uppercase and mixed marks", () => {
    expect(normalizeVi("NGUYỄN Phú Hào")).toBe("nguyen phu hao");
  });

  test("maps đ/Đ to d", () => {
    expect(normalizeVi("Lê Thị Đức")).toBe("le thi duc");
    expect(normalizeVi("đô đốc")).toBe("do doc");
  });

  test("collapses whitespace and trims", () => {
    expect(normalizeVi("  Hào   Đức ")).toBe("hao duc");
    expect(normalizeVi("\tHào\n\nĐức")).toBe("hao duc");
  });

  test("empty and whitespace-only", () => {
    expect(normalizeVi("")).toBe("");
    expect(normalizeVi("   ")).toBe("");
    expect(normalizeVi("\t\n")).toBe("");
  });

  test("leaves latin characters unchanged", () => {
    expect(normalizeVi("abc123")).toBe("abc123");
  });
});
