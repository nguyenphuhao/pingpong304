import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { fetchPairs, fetchPairById } from "./pairs";

describe("fetchPairs", () => {
  test("returns resolved shape", async () => {
    const rows = [
      { id: "p01", p1: { id: "d01", name: "A" }, p2: { id: "d02", name: "B" } },
    ];
    const chain = makeSupabaseChain({ data: rows, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const out = await fetchPairs();
    expect(out).toEqual(rows);
    expect(supabaseServer.from).toHaveBeenCalledWith("doubles_pairs");
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining("doubles_players"));
    expect(chain.order).toHaveBeenCalledWith("id");
  });

  test("returns [] when data is null", async () => {
    const chain = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchPairs()).toEqual([]);
  });

  test("throws on error", async () => {
    const chain = makeSupabaseChain({ data: null, error: { message: "boom" } });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    await expect(fetchPairs()).rejects.toThrow("boom");
  });
});

describe("fetchPairById", () => {
  test("returns pair when found", async () => {
    const row = { id: "p01", p1: { id: "d01", name: "A" }, p2: { id: "d02", name: "B" } };
    const chain = makeSupabaseChain({ data: row, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchPairById("p01")).toEqual(row);
  });

  test("returns null when not found", async () => {
    const chain = makeSupabaseChain({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchPairById("p99")).toBeNull();
  });
});
