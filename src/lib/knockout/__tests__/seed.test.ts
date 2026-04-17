import { describe, expect, test } from "vitest";
import { buildDoublesBracket, buildTeamBracket, type SeedEntry } from "../seed";

describe("buildDoublesBracket", () => {
  const seeds: SeedEntry[] = [
    { groupName: "A", rank: 1, entryId: "a1" },
    { groupName: "A", rank: 2, entryId: "a2" },
    { groupName: "B", rank: 1, entryId: "b1" },
    { groupName: "B", rank: 2, entryId: "b2" },
    { groupName: "C", rank: 1, entryId: "c1" },
    { groupName: "C", rank: 2, entryId: "c2" },
    { groupName: "D", rank: 1, entryId: "d1" },
    { groupName: "D", rank: 2, entryId: "d2" },
  ];

  test("creates 7 matches", () => {
    expect(buildDoublesBracket(seeds, ["A", "B", "C", "D"])).toHaveLength(7);
  });

  test("QF cross-group: A1 vs D2, C1 vs B2, B1 vs C2, D1 vs A2", () => {
    const qf = buildDoublesBracket(seeds, ["A", "B", "C", "D"]).filter((m) => m.round === "qf");
    expect(qf).toHaveLength(4);
    expect(qf[0]).toMatchObject({ entry_a: "a1", entry_b: "d2" });
    expect(qf[1]).toMatchObject({ entry_a: "c1", entry_b: "b2" });
    expect(qf[2]).toMatchObject({ entry_a: "b1", entry_b: "c2" });
    expect(qf[3]).toMatchObject({ entry_a: "d1", entry_b: "a2" });
  });

  test("SF and F have null entries", () => {
    const bracket = buildDoublesBracket(seeds, ["A", "B", "C", "D"]);
    for (const m of bracket.filter((m) => m.round !== "qf")) {
      expect(m.entry_a).toBeNull();
      expect(m.entry_b).toBeNull();
    }
  });

  test("next_match_id links QF→SF→F", () => {
    const byId = new Map(buildDoublesBracket(seeds, ["A", "B", "C", "D"]).map((m) => [m.id, m]));
    expect(byId.get("dko-qf1")!.next_match_id).toBe("dko-sf1");
    expect(byId.get("dko-qf1")!.next_slot).toBe("a");
    expect(byId.get("dko-qf2")!.next_match_id).toBe("dko-sf1");
    expect(byId.get("dko-qf2")!.next_slot).toBe("b");
    expect(byId.get("dko-qf3")!.next_match_id).toBe("dko-sf2");
    expect(byId.get("dko-qf3")!.next_slot).toBe("a");
    expect(byId.get("dko-qf4")!.next_match_id).toBe("dko-sf2");
    expect(byId.get("dko-qf4")!.next_slot).toBe("b");
    expect(byId.get("dko-sf1")!.next_match_id).toBe("dko-f");
    expect(byId.get("dko-sf2")!.next_match_id).toBe("dko-f");
    expect(byId.get("dko-f")!.next_match_id).toBeNull();
  });

  test("labels are correct", () => {
    const byId = new Map(buildDoublesBracket(seeds, ["A", "B", "C", "D"]).map((m) => [m.id, m]));
    expect(byId.get("dko-qf1")!.label_a).toBe("Nhất bảng A");
    expect(byId.get("dko-qf1")!.label_b).toBe("Nhì bảng D");
    expect(byId.get("dko-sf1")!.label_a).toBe("Thắng TK 1");
    expect(byId.get("dko-f")!.label_a).toBe("Thắng BK 1");
  });

  test("all matches best_of 5", () => {
    for (const m of buildDoublesBracket(seeds, ["A", "B", "C", "D"])) expect(m.best_of).toBe(5);
  });
});

describe("buildTeamBracket", () => {
  const seeds: SeedEntry[] = [
    { groupName: "A", rank: 1, entryId: "ta1" },
    { groupName: "A", rank: 2, entryId: "ta2" },
    { groupName: "B", rank: 1, entryId: "tb1" },
    { groupName: "B", rank: 2, entryId: "tb2" },
  ];

  test("creates 3 matches", () => {
    expect(buildTeamBracket(seeds, ["A", "B"])).toHaveLength(3);
  });

  test("SF cross-group: A1 vs B2, B1 vs A2", () => {
    const sf = buildTeamBracket(seeds, ["A", "B"]).filter((m) => m.round === "sf");
    expect(sf[0]).toMatchObject({ entry_a: "ta1", entry_b: "tb2" });
    expect(sf[1]).toMatchObject({ entry_a: "tb1", entry_b: "ta2" });
  });

  test("each match has 3 individual sub-matches", () => {
    for (const m of buildTeamBracket(seeds, ["A", "B"])) {
      expect(m.individual).toHaveLength(3);
      expect(m.individual[0]).toMatchObject({ label: "Đơn 1", kind: "singles" });
      expect(m.individual[1]).toMatchObject({ label: "Đôi", kind: "doubles" });
      expect(m.individual[2]).toMatchObject({ label: "Đơn 2", kind: "singles" });
    }
  });

  test("SF→F links", () => {
    const byId = new Map(buildTeamBracket(seeds, ["A", "B"]).map((m) => [m.id, m]));
    expect(byId.get("tko-sf1")!.next_match_id).toBe("tko-f");
    expect(byId.get("tko-sf1")!.next_slot).toBe("a");
    expect(byId.get("tko-sf2")!.next_match_id).toBe("tko-f");
    expect(byId.get("tko-sf2")!.next_slot).toBe("b");
    expect(byId.get("tko-f")!.next_match_id).toBeNull();
  });
});
