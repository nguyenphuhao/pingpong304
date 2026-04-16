import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { fetchTeams, fetchTeamById } from "./teams";

describe("fetchTeams", () => {
  test("maps team + members to resolved names", async () => {
    const teams = [
      { id: "T01", name: "Đội 1", members: ["t01", "t02", "t03"] },
    ];
    const players = [
      { id: "t01", name: "An" },
      { id: "t02", name: "Bình" },
      { id: "t03", name: "Cường" },
    ];
    const teamsChain = makeSupabaseChain({ data: teams, error: null });
    const playersChain = makeSupabaseChain({ data: players, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamsChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);

    const out = await fetchTeams();
    expect(out).toEqual([
      {
        id: "T01",
        name: "Đội 1",
        members: [
          { id: "t01", name: "An" },
          { id: "t02", name: "Bình" },
          { id: "t03", name: "Cường" },
        ],
      },
    ]);
  });

  test("uses '?' placeholder when member id missing in players", async () => {
    const teams = [{ id: "T01", name: "A", members: ["t01", "t99", "t03"] }];
    const players = [{ id: "t01", name: "An" }, { id: "t03", name: "Cường" }];
    const teamsChain = makeSupabaseChain({ data: teams, error: null });
    const playersChain = makeSupabaseChain({ data: players, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamsChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);

    const out = await fetchTeams();
    expect(out[0].members[1]).toEqual({ id: "t99", name: "?" });
  });

  test("returns [] when no teams", async () => {
    const teamsChain = makeSupabaseChain({ data: [], error: null });
    const playersChain = makeSupabaseChain({ data: [], error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamsChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);
    expect(await fetchTeams()).toEqual([]);
  });

  test("throws on teams fetch error", async () => {
    const teamsChain = makeSupabaseChain({ data: null, error: { message: "teams boom" } });
    const playersChain = makeSupabaseChain({ data: [], error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamsChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);
    await expect(fetchTeams()).rejects.toThrow("teams boom");
  });
});

describe("fetchTeamById", () => {
  test("returns team with resolved names when found", async () => {
    const team = { id: "T01", name: "Đội 1", members: ["t01", "t02", "t03"] };
    const players = [
      { id: "t01", name: "An" },
      { id: "t02", name: "Bình" },
      { id: "t03", name: "Cường" },
    ];
    const teamChain = makeSupabaseChain({ data: team, error: null });
    teamChain.maybeSingle = vi.fn().mockResolvedValue({ data: team, error: null });
    const playersChain = makeSupabaseChain({ data: players, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);

    const out = await fetchTeamById("T01");
    expect(out?.members).toHaveLength(3);
    expect(out?.members[0]).toEqual({ id: "t01", name: "An" });
  });

  test("returns null when not found", async () => {
    const teamChain = makeSupabaseChain({ data: null, error: null });
    teamChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(
      teamChain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchTeamById("T99")).toBeNull();
  });
});
