import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { searchPlayers } from "./search";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchPlayers", () => {
  test("returns empty on empty query", async () => {
    const r = await searchPlayers("");
    expect(r).toEqual([]);
  });

  test("returns empty on whitespace query", async () => {
    const r = await searchPlayers("   ");
    expect(r).toEqual([]);
  });

  test("queries both doubles and team players", async () => {
    const doublesChain = makeSupabaseChain({
      data: [{ id: "d01", name: "Minh Quân", phone: "0901", gender: "M", club: "BT" }],
      error: null,
    });
    const teamsChain = makeSupabaseChain({
      data: [],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(doublesChain as never)
      .mockReturnValueOnce(teamsChain as never);

    const r = await searchPlayers("minh");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: "d01", name: "Minh Quân", kind: "doubles" });
  });

  test("combines results from both sources", async () => {
    const doublesChain = makeSupabaseChain({
      data: [{ id: "d01", name: "Hảo", phone: "0901", gender: "M", club: "BT" }],
      error: null,
    });
    const teamsChain = makeSupabaseChain({
      data: [{ id: "t01", name: "Hảo", phone: "0902", gender: "M", club: "BT" }],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(doublesChain as never)
      .mockReturnValueOnce(teamsChain as never);

    const r = await searchPlayers("hảo");
    expect(r).toHaveLength(2);
    expect(r[0].kind).toBe("doubles");
    expect(r[1].kind).toBe("teams");
  });
});
