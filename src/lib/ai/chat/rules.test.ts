import { describe, it, expect } from "vitest";
import { loadTournamentRules } from "./rules";

describe("loadTournamentRules", () => {
  it("returns the full markdown content", () => {
    const rules = loadTournamentRules();
    expect(rules).toContain("# Điều lệ giải");
    expect(rules.length).toBeGreaterThan(100);
  });

  it("is cached across calls (same reference)", () => {
    const a = loadTournamentRules();
    const b = loadTournamentRules();
    expect(a).toBe(b);
  });
});
