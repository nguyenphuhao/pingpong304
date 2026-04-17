import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import {
  fetchDoublesMatchesByGroup,
  fetchDoublesMatchById,
  fetchTeamMatchesByGroup,
  fetchTeamMatchById,
  fetchLiveDoubles,
  fetchLiveTeams,
  fetchRecentDoubles,
  fetchRecentTeams,
} from "./matches";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchDoublesMatchesByGroup", () => {
  test("resolves pair labels", async () => {
    const matchChain = makeSupabaseChain({
      data: [
        {
          id: "dm01",
          group_id: "gA",
          pair_a: "p01",
          pair_b: "p02",
          table: null,
          best_of: 3,
          sets: [],
          status: "scheduled",
          winner: null,
          sets_a: 0,
          sets_b: 0,
        },
      ],
      error: null,
    });
    const pairsChain = makeSupabaseChain({
      data: [
        {
          id: "p01",
          p1: { id: "d01", name: "A" },
          p2: { id: "d02", name: "B" },
        },
        {
          id: "p02",
          p1: { id: "d03", name: "C" },
          p2: { id: "d04", name: "D" },
        },
      ],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchChain as never)
      .mockReturnValueOnce(pairsChain as never);

    const r = await fetchDoublesMatchesByGroup("gA");
    expect(r).toHaveLength(1);
    expect(r[0].pairA).toEqual({ id: "p01", label: "A – B" });
    expect(r[0].pairB).toEqual({ id: "p02", label: "C – D" });
    expect(r[0].setsA).toBe(0);
    expect(r[0].winner).toBeNull();
  });

  test("unknown pair ID → label '?'", async () => {
    const matchChain = makeSupabaseChain({
      data: [
        {
          id: "dm01",
          group_id: "gA",
          pair_a: "p99",
          pair_b: "p02",
          table: null,
          best_of: 3,
          sets: [],
          status: "scheduled",
          winner: null,
          sets_a: 0,
          sets_b: 0,
        },
      ],
      error: null,
    });
    const pairsChain = makeSupabaseChain({
      data: [
        {
          id: "p02",
          p1: { id: "d03", name: "C" },
          p2: { id: "d04", name: "D" },
        },
      ],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchChain as never)
      .mockReturnValueOnce(pairsChain as never);

    const r = await fetchDoublesMatchesByGroup("gA");
    expect(r[0].pairA).toEqual({ id: "p99", label: "?" });
  });

  test("returns winner resolved when set", async () => {
    const matchChain = makeSupabaseChain({
      data: [
        {
          id: "dm01",
          group_id: "gA",
          pair_a: "p01",
          pair_b: "p02",
          table: 3,
          best_of: 3,
          sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }],
          status: "done",
          winner: "p01",
          sets_a: 2,
          sets_b: 0,
        },
      ],
      error: null,
    });
    const pairsChain = makeSupabaseChain({
      data: [
        { id: "p01", p1: { id: "d01", name: "A" }, p2: { id: "d02", name: "B" } },
        { id: "p02", p1: { id: "d03", name: "C" }, p2: { id: "d04", name: "D" } },
      ],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchChain as never)
      .mockReturnValueOnce(pairsChain as never);

    const r = await fetchDoublesMatchesByGroup("gA");
    expect(r[0].winner).toEqual({ id: "p01", label: "A – B" });
    expect(r[0].table).toBe(3);
  });

  test("throws on supabase error", async () => {
    const matchChain = makeSupabaseChain({
      data: null,
      error: { message: "boom" },
    });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(matchChain as never);
    await expect(fetchDoublesMatchesByGroup("gA")).rejects.toThrow("boom");
  });
});

describe("fetchDoublesMatchById", () => {
  test("returns null when not found", async () => {
    const chain = makeSupabaseChain({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(chain as never);
    const r = await fetchDoublesMatchById("dm99");
    expect(r).toBeNull();
  });
});

describe("fetchTeamMatchesByGroup", () => {
  test("resolves teams + sub-match players", async () => {
    const matchChain = makeSupabaseChain({
      data: [
        {
          id: "tm01",
          group_id: "gtA",
          team_a: "tA1",
          team_b: "tA2",
          table: null,
          status: "scheduled",
          score_a: 0,
          score_b: 0,
          winner: null,
          individual: [
            {
              id: "tm01-d",
              label: "Đôi",
              kind: "doubles",
              playersA: ["t01", "t02"],
              playersB: ["t04", "t05"],
              bestOf: 3,
              sets: [],
            },
          ],
        },
      ],
      error: null,
    });
    const teamsChain = makeSupabaseChain({
      data: [
        { id: "tA1", name: "Bình Tân 1", members: ["t01", "t02", "t03"] },
        { id: "tA2", name: "Bình Tân 2", members: ["t04", "t05", "t06"] },
      ],
      error: null,
    });
    const playersChain = makeSupabaseChain({
      data: [
        { id: "t01", name: "Quốc" },
        { id: "t02", name: "Quy" },
        { id: "t04", name: "Hảo" },
        { id: "t05", name: "Hưởng" },
      ],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchChain as never)
      .mockReturnValueOnce(teamsChain as never)
      .mockReturnValueOnce(playersChain as never);

    const r = await fetchTeamMatchesByGroup("gtA");
    expect(r).toHaveLength(1);
    expect(r[0].teamA.name).toBe("Bình Tân 1");
    expect(r[0].individual[0].playersA).toEqual([
      { id: "t01", name: "Quốc" },
      { id: "t02", name: "Quy" },
    ]);
  });
});

describe("fetchTeamMatchById", () => {
  test("returns null when not found", async () => {
    const chain = makeSupabaseChain({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(chain as never);
    const r = await fetchTeamMatchById("tm99");
    expect(r).toBeNull();
  });
});

describe("fetchLiveDoubles", () => {
  test("returns only live matches", async () => {
    const matchChain = makeSupabaseChain({
      data: [
        {
          id: "dm05", group_id: "gA", pair_a: "p01", pair_b: "p02",
          table: 3, best_of: 3, sets: [{ a: 11, b: 8 }],
          status: "live", winner: null, sets_a: 1, sets_b: 0,
        },
      ],
      error: null,
    });
    const pairsChain = makeSupabaseChain({
      data: [
        { id: "p01", p1: { id: "d01", name: "A" }, p2: { id: "d02", name: "B" } },
        { id: "p02", p1: { id: "d03", name: "C" }, p2: { id: "d04", name: "D" } },
      ],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchChain as never)
      .mockReturnValueOnce(pairsChain as never);

    const r = await fetchLiveDoubles();
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe("live");
    expect(r[0].pairA.label).toBe("A – B");
  });
});

describe("fetchRecentDoubles", () => {
  test("returns done matches with limit", async () => {
    const matchChain = makeSupabaseChain({
      data: [
        {
          id: "dm01", group_id: "gA", pair_a: "p01", pair_b: "p02",
          table: null, best_of: 3, sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }],
          status: "done", winner: "p01", sets_a: 2, sets_b: 0,
        },
      ],
      error: null,
    });
    const pairsChain = makeSupabaseChain({
      data: [
        { id: "p01", p1: { id: "d01", name: "A" }, p2: { id: "d02", name: "B" } },
        { id: "p02", p1: { id: "d03", name: "C" }, p2: { id: "d04", name: "D" } },
      ],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchChain as never)
      .mockReturnValueOnce(pairsChain as never);

    const r = await fetchRecentDoubles(5);
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe("done");
  });
});
