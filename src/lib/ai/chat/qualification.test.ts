import { describe, it, expect } from "vitest";
import { computeDoublesOdds, computeTeamsOdds } from "./qualification";
import {
  doublesGroupAllDone,
  doublesGroupMidTournament,
  teamsGroupMidTournament,
} from "./fixtures/groups";

describe("computeDoublesOdds — all matches done", () => {
  it("returns 'qualified' with probability 100 if top 2", () => {
    const result = computeDoublesOdds({
      entries: doublesGroupAllDone.entries,
      matches: doublesGroupAllDone.matches,
      targetId: "p1",
      advanceCount: 2,
    });
    expect(result.status).toBe("qualified");
    expect(result.probability).toBe(100);
  });

  it("returns 'eliminated' with probability 0 if outside top 2", () => {
    const result = computeDoublesOdds({
      entries: doublesGroupAllDone.entries,
      matches: doublesGroupAllDone.matches,
      targetId: "p4",
      advanceCount: 2,
    });
    expect(result.status).toBe("eliminated");
    expect(result.probability).toBe(0);
  });
});

describe("computeDoublesOdds — mid tournament", () => {
  const input = {
    entries: doublesGroupMidTournament.entries,
    matches: doublesGroupMidTournament.matches,
    advanceCount: 2,
  };

  it("enumerates 2^3 = 8 scenarios", () => {
    const result = computeDoublesOdds({ ...input, targetId: "p1" });
    expect(result.totalScenarios).toBe(8);
  });

  it("p1 (2-0 already) has high probability", () => {
    const result = computeDoublesOdds({ ...input, targetId: "p1" });
    expect(result.probability).toBeGreaterThan(80);
    expect(result.status).toBe("alive");
  });

  it("includes own matches with pIfWin/pIfLose", () => {
    const result = computeDoublesOdds({ ...input, targetId: "p1" });
    expect(result.ownMatches.length).toBeGreaterThan(0);
    for (const m of result.ownMatches) {
      expect(m.pIfWin).toBeGreaterThanOrEqual(m.pIfLose);
    }
  });

  it("flags critical matches (pIfWin - pIfLose > 40%)", () => {
    const result = computeDoublesOdds({ ...input, targetId: "p4" });
    const critical = result.ownMatches.filter((m) => m.critical);
    expect(critical.length).toBeGreaterThan(0);
  });

  it("external matches exclude target", () => {
    const result = computeDoublesOdds({ ...input, targetId: "p1" });
    for (const m of result.externalMatches) {
      expect(m.pairA.id).not.toBe("p1");
      expect(m.pairB.id).not.toBe("p1");
    }
  });
});

describe("computeTeamsOdds — mid tournament", () => {
  it("enumerates scenarios for teams group", () => {
    const result = computeTeamsOdds({
      entries: teamsGroupMidTournament.entries,
      matches: teamsGroupMidTournament.matches,
      targetId: "t1",
      advanceCount: 2,
    });
    expect(result.totalScenarios).toBeGreaterThan(0);
    expect(["qualified", "eliminated", "alive"]).toContain(result.status);
  });
});
