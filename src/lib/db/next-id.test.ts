import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { nextId } from "./next-id";

function mockIds(ids: string[]) {
  const chain = makeSupabaseChain({
    data: ids.map((id) => ({ id })),
    error: null,
  });
  vi.mocked(supabaseServer.from).mockReturnValue(
    chain as unknown as ReturnType<typeof supabaseServer.from>,
  );
  return chain;
}

describe("nextId", () => {
  test("returns {prefix}01 when table empty", async () => {
    mockIds([]);
    expect(await nextId("doubles_pairs", "p", 2)).toBe("p01");
  });

  test("increments from max", async () => {
    mockIds(["p01", "p05", "p18"]);
    expect(await nextId("doubles_pairs", "p", 2)).toBe("p19");
  });

  test("pads below threshold, overflows above", async () => {
    mockIds(["p99"]);
    expect(await nextId("doubles_pairs", "p", 2)).toBe("p100");
  });

  test("ignores ids with non-numeric suffix", async () => {
    mockIds(["p01", "pXYZ", "p03"]);
    expect(await nextId("doubles_pairs", "p", 2)).toBe("p04");
  });

  test("uses prefix 'T' case-sensitive (does not match 'tA1')", async () => {
    const chain = mockIds([]);
    expect(await nextId("teams", "T", 2)).toBe("T01");
    expect(chain.like).toHaveBeenCalledWith("id", "T%");
  });

  test("throws on supabase error", async () => {
    const chain = makeSupabaseChain({ data: null, error: { message: "boom" } });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    await expect(nextId("doubles_pairs", "p", 2)).rejects.toThrow("boom");
  });
});
