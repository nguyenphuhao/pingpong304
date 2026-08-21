import { describe, expect, test } from "vitest";
import { entryCodes, resolveGroup } from "./groups";
import type { GroupResolved } from "@/lib/schemas/group";

const group = (id: string, name: string, entryIds: string[]): GroupResolved => ({
  id,
  name,
  entries: entryIds.map((eid) => ({ id: eid, label: eid })),
});

const GROUPS = [
  group("gA", "Bảng A", ["A1", "A2"]),
  group("gB", "Bảng B", ["B1", "B2"]),
  group("gC", "Bảng C", ["C1", "C2"]),
];

describe("entryCodes", () => {
  test("mã cặp là chữ bảng cộng thứ tự trong bảng", () => {
    const codes = entryCodes(GROUPS[0]);
    expect(codes.get("A1")).toBe("A1");
    expect(codes.get("A2")).toBe("A2");
  });

  test("suy từ vị trí, không lệ thuộc mã trong DB", () => {
    const codes = entryCodes(group("gB", "Bảng B", ["p07", "p03"]));
    expect(codes.get("p07")).toBe("B1");
    expect(codes.get("p03")).toBe("B2");
  });

  test("bảng rỗng trả về map rỗng", () => {
    expect(entryCodes(group("gA", "Bảng A", [])).size).toBe(0);
  });
});

describe("resolveGroup", () => {
  test("chọn đúng bảng theo tham số", () => {
    expect(resolveGroup(GROUPS, "B")?.id).toBe("gB");
  });

  test("không truyền gì thì lấy bảng đầu", () => {
    expect(resolveGroup(GROUPS, undefined)?.id).toBe("gA");
  });

  test("tham số không khớp bảng nào thì lấy bảng đầu", () => {
    expect(resolveGroup(GROUPS, "Z")?.id).toBe("gA");
  });

  test("không phân biệt hoa thường", () => {
    expect(resolveGroup(GROUPS, "c")?.id).toBe("gC");
  });

  test("chưa có bảng nào thì trả null", () => {
    expect(resolveGroup([], "A")).toBeNull();
  });
});
