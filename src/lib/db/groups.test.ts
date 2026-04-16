import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("./pairs", () => ({
  fetchPairs: vi.fn(),
}));

vi.mock("./teams", () => ({
  fetchTeams: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { fetchPairs } from "./pairs";
import { fetchTeams } from "./teams";
import {
  fetchDoublesGroups,
  fetchDoublesGroupById,
  fetchTeamGroups,
  fetchTeamGroupById,
} from "./groups";

const PAIRS = [
  { id: "p01", p1: { id: "d01", name: "Minh Quân" }, p2: { id: "d02", name: "Tân Sinh" } },
  { id: "p04", p1: { id: "d07", name: "Hoài Nam" }, p2: { id: "d08", name: "Phi Hùng" } },
];

describe("fetchDoublesGroups", () => {
  test("resolves entries IDs to 'p1name – p2name' labels", async () => {
    vi.mocked(fetchPairs).mockResolvedValue(PAIRS);
    const groups = [
      { id: "gA", name: "Bảng A", entries: ["p01", "p04"] },
    ];
    const chain = makeSupabaseChain({ data: groups, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const out = await fetchDoublesGroups();
    expect(out).toEqual([
      {
        id: "gA",
        name: "Bảng A",
        entries: [
          { id: "p01", label: "Minh Quân – Tân Sinh" },
          { id: "p04", label: "Hoài Nam – Phi Hùng" },
        ],
      },
    ]);
    expect(supabaseServer.from).toHaveBeenCalledWith("doubles_groups");
    expect(chain.order).toHaveBeenCalledWith("id");
  });

  test("returns '?' label when pair not in map", async () => {
    vi.mocked(fetchPairs).mockResolvedValue([]);
    const groups = [{ id: "gA", name: "Bảng A", entries: ["p99"] }];
    const chain = makeSupabaseChain({ data: groups, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const out = await fetchDoublesGroups();
    expect(out[0].entries).toEqual([{ id: "p99", label: "?" }]);
  });

  test("returns [] when groups data is null", async () => {
    vi.mocked(fetchPairs).mockResolvedValue([]);
    const chain = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchDoublesGroups()).toEqual([]);
  });

  test("throws on supabase error", async () => {
    vi.mocked(fetchPairs).mockResolvedValue([]);
    const chain = makeSupabaseChain({ data: null, error: { message: "boom" } });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    await expect(fetchDoublesGroups()).rejects.toThrow("boom");
  });
});

describe("fetchDoublesGroupById", () => {
  test("returns resolved group when found", async () => {
    vi.mocked(fetchPairs).mockResolvedValue(PAIRS);
    const chain = makeSupabaseChain({
      data: { id: "gA", name: "Bảng A", entries: ["p01"] },
      error: null,
    });
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "gA", name: "Bảng A", entries: ["p01"] },
      error: null,
    });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const out = await fetchDoublesGroupById("gA");
    expect(out).toEqual({
      id: "gA",
      name: "Bảng A",
      entries: [{ id: "p01", label: "Minh Quân – Tân Sinh" }],
    });
  });

  test("returns null when group not found", async () => {
    vi.mocked(fetchPairs).mockResolvedValue([]);
    const chain = makeSupabaseChain({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchDoublesGroupById("gZ")).toBeNull();
  });
});

const TEAMS = [
  { id: "tA1", name: "Bình Tân 1", members: [{ id: "t01", name: "Quốc" }] },
  { id: "tA2", name: "Bình Tân 2", members: [] },
];

describe("fetchTeamGroups", () => {
  test("resolves entries IDs to team names", async () => {
    vi.mocked(fetchTeams).mockResolvedValue(TEAMS);
    const groups = [{ id: "gtA", name: "Bảng A", entries: ["tA1", "tA2"] }];
    const chain = makeSupabaseChain({ data: groups, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const out = await fetchTeamGroups();
    expect(out).toEqual([
      {
        id: "gtA",
        name: "Bảng A",
        entries: [
          { id: "tA1", label: "Bình Tân 1" },
          { id: "tA2", label: "Bình Tân 2" },
        ],
      },
    ]);
    expect(supabaseServer.from).toHaveBeenCalledWith("team_groups");
  });

  test("returns '?' label when team not in map", async () => {
    vi.mocked(fetchTeams).mockResolvedValue([]);
    const groups = [{ id: "gtA", name: "Bảng A", entries: ["tZ9"] }];
    const chain = makeSupabaseChain({ data: groups, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    const out = await fetchTeamGroups();
    expect(out[0].entries).toEqual([{ id: "tZ9", label: "?" }]);
  });

  test("throws on supabase error", async () => {
    vi.mocked(fetchTeams).mockResolvedValue([]);
    const chain = makeSupabaseChain({ data: null, error: { message: "boom" } });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    await expect(fetchTeamGroups()).rejects.toThrow("boom");
  });
});

describe("fetchTeamGroupById", () => {
  test("returns resolved team group when found", async () => {
    vi.mocked(fetchTeams).mockResolvedValue(TEAMS);
    const chain = makeSupabaseChain({
      data: { id: "gtA", name: "Bảng A", entries: ["tA1"] },
      error: null,
    });
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "gtA", name: "Bảng A", entries: ["tA1"] },
      error: null,
    });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    const out = await fetchTeamGroupById("gtA");
    expect(out).toEqual({
      id: "gtA",
      name: "Bảng A",
      entries: [{ id: "tA1", label: "Bình Tân 1" }],
    });
  });

  test("returns null when not found", async () => {
    vi.mocked(fetchTeams).mockResolvedValue([]);
    const chain = makeSupabaseChain({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchTeamGroupById("gtZ")).toBeNull();
  });
});
