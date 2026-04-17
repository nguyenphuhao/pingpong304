import { describe, it, expect } from "vitest";
import { buildSinglePrompt, buildBatchPrompt } from "./prompts";

describe("buildSinglePrompt", () => {
  it("builds prompt for doubles match", () => {
    const prompt = buildSinglePrompt({
      id: "m1",
      type: "doubles",
      bestOf: 3,
      sideA: "Hào – Minh",
      sideB: "Long – Tuấn",
    });
    expect(prompt).toContain("Hào – Minh");
    expect(prompt).toContain("Long – Tuấn");
    expect(prompt).toContain("Best of 3");
    expect(prompt).toContain("m1");
  });

  it("builds prompt for team match with sub-matches", () => {
    const prompt = buildSinglePrompt({
      id: "m2",
      type: "team",
      bestOf: 5,
      sideA: "Team A",
      sideB: "Team B",
      subMatches: [
        { label: "Đôi 1", kind: "doubles", bestOf: 3 },
        { label: "Đơn 1", kind: "singles", bestOf: 3 },
      ],
    });
    expect(prompt).toContain("Team A");
    expect(prompt).toContain("Đôi 1");
    expect(prompt).toContain("Đơn 1");
  });
});

describe("buildBatchPrompt", () => {
  it("builds prompt listing all matches", () => {
    const prompt = buildBatchPrompt({
      type: "doubles",
      matches: [
        { id: "m1", sideA: "A – B", sideB: "C – D", bestOf: 3, hasResult: false },
        { id: "m2", sideA: "E – F", sideB: "G – H", bestOf: 3, hasResult: true },
      ],
    });
    expect(prompt).toContain("A – B");
    expect(prompt).toContain("C – D");
    expect(prompt).toContain("đã có kết quả");
    expect(prompt).toContain("m1");
    expect(prompt).toContain("m2");
  });
});
