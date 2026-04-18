import { describe, expect, test } from "vitest";
import { filterAndSortMatches, type MatchIndexItem } from "./_search-filter";

function make(overrides: Partial<MatchIndexItem>): MatchIndexItem {
  return {
    id: "m1",
    kind: "doubles",
    groupId: "g1",
    groupName: "Bảng A",
    sideA: "A",
    sideB: "B",
    status: "scheduled",
    ...overrides,
  };
}

describe("filterAndSortMatches", () => {
  test("empty query returns only live matches", () => {
    const items = [
      make({ id: "1", status: "live" }),
      make({ id: "2", status: "scheduled" }),
      make({ id: "3", status: "done" }),
    ];
    const result = filterAndSortMatches(items, "");
    expect(result.map((m) => m.id)).toEqual(["1"]);
  });

  test("empty query with no live matches returns empty", () => {
    const items = [
      make({ id: "1", status: "scheduled" }),
      make({ id: "2", status: "done" }),
    ];
    expect(filterAndSortMatches(items, "")).toEqual([]);
  });

  test("diacritic-insensitive match on sideA or sideB", () => {
    const items = [
      make({ id: "1", sideA: "Nguyễn Hào", sideB: "Trần B" }),
      make({ id: "2", sideA: "Lê Hạo", sideB: "Phạm C" }),
      make({ id: "3", sideA: "Võ Hảo", sideB: "Đỗ D" }),
      make({ id: "4", sideA: "Minh", sideB: "Tuấn" }),
    ];
    const result = filterAndSortMatches(items, "hao");
    expect(result.map((m) => m.id).sort()).toEqual(["1", "2", "3"]);
  });

  test("sort by status rank then groupName", () => {
    const items = [
      make({ id: "1", status: "done", groupName: "Bảng A" }),
      make({ id: "2", status: "live", groupName: "Bảng B" }),
      make({ id: "3", status: "scheduled", groupName: "Bảng A" }),
      make({ id: "4", status: "forfeit", groupName: "Bảng A" }),
      make({ id: "5", status: "live", groupName: "Bảng A" }),
    ];
    const result = filterAndSortMatches(items, "");
    // query empty → only live; check order live-A before live-B
    expect(result.map((m) => m.id)).toEqual(["5", "2"]);
  });

  test("with query, full status ordering", () => {
    const items = [
      make({ id: "1", status: "done", sideA: "Hào" }),
      make({ id: "2", status: "live", sideA: "Hào" }),
      make({ id: "3", status: "scheduled", sideA: "Hào" }),
      make({ id: "4", status: "forfeit", sideA: "Hào" }),
    ];
    const result = filterAndSortMatches(items, "hao");
    expect(result.map((m) => m.id)).toEqual(["2", "3", "1", "4"]);
  });

  test("no match returns empty", () => {
    const items = [make({ id: "1", sideA: "Minh", sideB: "Tuấn" })];
    expect(filterAndSortMatches(items, "xyz")).toEqual([]);
  });

  test("whitespace-only query treated as empty", () => {
    const items = [
      make({ id: "1", status: "live" }),
      make({ id: "2", status: "scheduled" }),
    ];
    const result = filterAndSortMatches(items, "   ");
    expect(result.map((m) => m.id)).toEqual(["1"]);
  });
});
