import { describe, expect, test, vi, beforeEach } from "vitest";

const {
  mockEq,
  mockUpdate,
  mockMaybeSingle,
  mockSelectEq,
  mockSelect,
  mockFrom,
} = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockUpdate: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockSelectEq: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: {
    from: mockFrom,
  },
}));

import { advanceWinner, retractWinner } from "../advance";

beforeEach(() => {
  vi.clearAllMocks();
  mockEq.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockSelectEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockSelect.mockReturnValue({ eq: mockSelectEq });
  mockFrom.mockReturnValue({ update: mockUpdate, select: mockSelect });
});

describe("advanceWinner", () => {
  test("no-op when nextMatchId is null", async () => {
    await advanceWinner("doubles_ko", null, null, "winner-id");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("sets entry_a when nextSlot is a", async () => {
    await advanceWinner("doubles_ko", "dko-sf1", "a", "pair-1");
    expect(mockUpdate).toHaveBeenCalledWith({ entry_a: "pair-1" });
  });

  test("sets entry_b when nextSlot is b", async () => {
    await advanceWinner("doubles_ko", "dko-sf1", "b", "pair-2");
    expect(mockUpdate).toHaveBeenCalledWith({ entry_b: "pair-2" });
  });
});

describe("retractWinner", () => {
  test("clears entry_a when next match not done", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { status: "scheduled" }, error: null });
    await retractWinner("doubles_ko", "dko-sf1", "a");
    expect(mockUpdate).toHaveBeenCalledWith({ entry_a: null });
  });

  test("clears entry_b when next match not done", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { status: "scheduled" }, error: null });
    await retractWinner("doubles_ko", "dko-sf1", "b");
    expect(mockUpdate).toHaveBeenCalledWith({ entry_b: null });
  });

  test("throws if next match already done", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { status: "done" }, error: null });
    await expect(retractWinner("doubles_ko", "dko-sf1", "a")).rejects.toThrow(/trận tiếp đã hoàn thành/);
  });

  test("throws if next match is forfeit", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { status: "forfeit" }, error: null });
    await expect(retractWinner("doubles_ko", "dko-sf1", "a")).rejects.toThrow(/trận tiếp đã hoàn thành/);
  });
});
