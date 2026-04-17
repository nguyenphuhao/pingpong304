import { describe, expect, test } from "vitest";
import {
  MatchResultSchema,
  SingleResultSchema,
  BatchResultSchema,
  RejectionSchema,
  ParseMatchResponseSchema,
} from "./schemas";

describe("MatchResultSchema", () => {
  test("accepts valid doubles result (sets only)", () => {
    const input = { sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }] };
    expect(MatchResultSchema.parse(input)).toEqual(input);
  });

  test("accepts valid team result (sets + subMatches)", () => {
    const input = {
      sets: [],
      subMatches: [
        { label: "Đôi", sets: [{ a: 11, b: 8 }] },
        { label: "Đơn 1", sets: [{ a: 11, b: 6 }, { a: 11, b: 9 }] },
      ],
    };
    expect(MatchResultSchema.parse(input)).toEqual(input);
  });

  test("accepts result without subMatches (optional)", () => {
    const input = { sets: [{ a: 11, b: 0 }] };
    const result = MatchResultSchema.parse(input);
    expect(result.subMatches).toBeUndefined();
  });

  test("rejects scores outside 0-99 (a > 99)", () => {
    expect(() =>
      MatchResultSchema.parse({ sets: [{ a: 100, b: 0 }] }),
    ).toThrow();
  });

  test("rejects scores outside 0-99 (b < 0)", () => {
    expect(() =>
      MatchResultSchema.parse({ sets: [{ a: 11, b: -1 }] }),
    ).toThrow();
  });

  test("rejects scores outside 0-99 in subMatches", () => {
    expect(() =>
      MatchResultSchema.parse({
        sets: [],
        subMatches: [{ label: "Đơn", sets: [{ a: 100, b: 0 }] }],
      }),
    ).toThrow();
  });
});

describe("SingleResultSchema", () => {
  const validSingle = {
    status: "ok" as const,
    mode: "single" as const,
    matchId: "match-001",
    result: { sets: [{ a: 11, b: 8 }] },
  };

  test("accepts valid single result", () => {
    expect(SingleResultSchema.parse(validSingle)).toEqual(validSingle);
  });

  test("rejects missing matchId", () => {
    const { matchId: _matchId, ...rest } = validSingle;
    expect(() => SingleResultSchema.parse(rest)).toThrow();
  });

  test("rejects empty matchId", () => {
    expect(() =>
      SingleResultSchema.parse({ ...validSingle, matchId: "" }),
    ).toThrow();
  });

  test("rejects wrong mode", () => {
    expect(() =>
      SingleResultSchema.parse({ ...validSingle, mode: "batch" }),
    ).toThrow();
  });

  test("rejects wrong status", () => {
    expect(() =>
      SingleResultSchema.parse({ ...validSingle, status: "rejected" }),
    ).toThrow();
  });
});

describe("BatchResultSchema", () => {
  const validParsed = {
    matchId: "match-001",
    sideA: "Team A",
    sideB: "Team B",
    result: { sets: [{ a: 11, b: 8 }] },
    alreadyHasResult: false,
  };

  test("accepts valid batch result with parsed array + unmatched", () => {
    const input = {
      status: "ok" as const,
      mode: "batch" as const,
      parsed: [validParsed],
      unmatched: ["some text"],
    };
    expect(BatchResultSchema.parse(input)).toEqual(input);
  });

  test("accepts valid batch result without unmatched", () => {
    const input = {
      status: "ok" as const,
      mode: "batch" as const,
      parsed: [validParsed],
    };
    const result = BatchResultSchema.parse(input);
    expect(result.unmatched).toBeUndefined();
  });

  test("accepts empty parsed array", () => {
    const input = {
      status: "ok" as const,
      mode: "batch" as const,
      parsed: [],
    };
    expect(BatchResultSchema.parse(input).parsed).toHaveLength(0);
  });

  test("rejects wrong mode", () => {
    expect(() =>
      BatchResultSchema.parse({ status: "ok", mode: "single", parsed: [] }),
    ).toThrow();
  });
});

describe("RejectionSchema", () => {
  test("accepts valid rejection", () => {
    const input = { status: "rejected" as const, reason: "Không hiểu input" };
    expect(RejectionSchema.parse(input)).toEqual(input);
  });

  test("rejects empty reason", () => {
    expect(() =>
      RejectionSchema.parse({ status: "rejected", reason: "" }),
    ).toThrow();
  });

  test("rejects wrong status", () => {
    expect(() =>
      RejectionSchema.parse({ status: "ok", reason: "some reason" }),
    ).toThrow();
  });
});

describe("ParseMatchResponseSchema", () => {
  test("accepts single result", () => {
    const input = {
      status: "ok",
      mode: "single",
      matchId: "match-001",
      result: { sets: [{ a: 11, b: 8 }] },
    };
    const result = ParseMatchResponseSchema.parse(input);
    expect(result.status).toBe("ok");
  });

  test("accepts batch result", () => {
    const input = {
      status: "ok",
      mode: "batch",
      parsed: [
        {
          matchId: "match-001",
          sideA: "A",
          sideB: "B",
          result: { sets: [] },
          alreadyHasResult: false,
        },
      ],
    };
    const result = ParseMatchResponseSchema.parse(input);
    expect(result.status).toBe("ok");
  });

  test("accepts rejection", () => {
    const input = { status: "rejected", reason: "Cannot parse" };
    const result = ParseMatchResponseSchema.parse(input);
    expect(result.status).toBe("rejected");
  });

  test("rejects unknown shape", () => {
    expect(() =>
      ParseMatchResponseSchema.parse({ status: "unknown" }),
    ).toThrow();
  });
});
