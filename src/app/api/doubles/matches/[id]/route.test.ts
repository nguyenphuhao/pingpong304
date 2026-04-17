import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/db/matches", () => ({
  fetchDoublesMatchById: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { cookies } from "next/headers";
import { fetchDoublesMatchById } from "@/lib/db/matches";
import { PATCH } from "./route";

function mockAdminCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ value: "ok", name: "pp_admin" }),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}
function mockNoCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}
function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function patchReq(body: unknown) {
  return new Request("http://localhost/api/doubles/matches/dm01", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function mockExisting(row: {
  pair_a?: string;
  pair_b?: string;
  sets?: unknown[];
  best_of?: number;
  status?: string;
  winner?: string | null;
}) {
  const chain = makeSupabaseChain({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: "dm01",
      pair_a: row.pair_a ?? "p01",
      pair_b: row.pair_b ?? "p02",
      sets: row.sets ?? [],
      best_of: row.best_of ?? 3,
      status: row.status ?? "scheduled",
      winner: row.winner ?? null,
    },
    error: null,
  });
  return chain;
}
function mockNotFound() {
  const chain = makeSupabaseChain({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  return chain;
}
function mockUpdate() {
  return makeSupabaseChain({ data: null, error: null });
}
function mockUpdateError() {
  return makeSupabaseChain({ data: null, error: { message: "db boom" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchDoublesMatchById).mockResolvedValue({
    id: "dm01",
    groupId: "gA",
    pairA: { id: "p01", label: "A – B" },
    pairB: { id: "p02", label: "C – D" },
    table: null,
    bestOf: 3,
    sets: [],
    setsA: 0,
    setsB: 0,
    status: "scheduled",
    winner: null,
  });
});

describe("PATCH /api/doubles/matches/[id]", () => {
  test("401 when not admin", async () => {
    mockNoCookie();
    const res = await PATCH(patchReq({}), makeCtx("dm01"));
    expect(res.status).toBe(401);
  });

  test("400 when id malformed", async () => {
    mockAdminCookie();
    const res = await PATCH(patchReq({}), makeCtx("bad id!"));
    expect(res.status).toBe(400);
  });

  test("404 when match not found", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from).mockReturnValueOnce(mockNotFound() as never);
    const res = await PATCH(patchReq({}), makeCtx("dm99"));
    expect(res.status).toBe(404);
  });

  test("200 PATCH sets only re-derives setsA/setsB", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting({}) as never)
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }] }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(200);
  });

  test("400 status='done' but sets tied", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from).mockReturnValueOnce(mockExisting({}) as never);
    const res = await PATCH(
      patchReq({
        sets: [{ a: 11, b: 8 }, { a: 9, b: 11 }],
        status: "done",
      }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Chưa đủ set/i);
  });

  test("200 status='done' with sets enough → derives winner", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting({}) as never)
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({
        sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }],
        status: "done",
      }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(200);
  });

  test("400 status='forfeit' without winner", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from).mockReturnValueOnce(mockExisting({}) as never);
    const res = await PATCH(
      patchReq({ status: "forfeit" }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(400);
  });

  test("400 status='forfeit' winner not in {pair_a, pair_b}", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from).mockReturnValueOnce(mockExisting({}) as never);
    const res = await PATCH(
      patchReq({ status: "forfeit", winner: "p99" }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Winner.*pair/i);
  });

  test("200 status='forfeit' with valid winner", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting({}) as never)
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ status: "forfeit", winner: "p02" }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(200);
  });

  test("200 status='scheduled' → resets winner=null", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting({ status: "done", winner: "p01" }) as never)
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ status: "scheduled" }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(200);
  });

  test("200 PATCH table=null clears table", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting({}) as never)
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(patchReq({ table: null }), makeCtx("dm01"));
    expect(res.status).toBe(200);
  });

  test("200 bestOf=5 re-derives winner with new threshold", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(
        mockExisting({
          sets: [{ a: 11, b: 0 }, { a: 11, b: 0 }, { a: 11, b: 0 }],
          best_of: 3,
          status: "done",
          winner: "p01",
        }) as never,
      )
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ bestOf: 5, status: "done" }),
      makeCtx("dm01"),
    );
    // 3-0 still meets threshold for bestOf=5 (need 3) → ok
    expect(res.status).toBe(200);
  });

  test("500 on supabase update error", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting({}) as never)
      .mockReturnValueOnce(mockUpdateError() as never);
    const res = await PATCH(
      patchReq({ sets: [{ a: 11, b: 8 }] }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(500);
  });
});
