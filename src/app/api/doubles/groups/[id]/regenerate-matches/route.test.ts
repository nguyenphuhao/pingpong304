import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/db/groups", () => ({
  fetchDoublesGroupById: vi.fn(),
}));
vi.mock("@/lib/db/matches", () => ({
  fetchDoublesMatchesByGroup: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { cookies } from "next/headers";
import { fetchDoublesGroupById } from "@/lib/db/groups";
import { fetchDoublesMatchesByGroup } from "@/lib/db/matches";
import { POST } from "./route";

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
function postReq() {
  return new Request(
    "http://localhost/api/doubles/groups/gA/regenerate-matches",
    { method: "POST", body: JSON.stringify({}) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchDoublesMatchesByGroup).mockResolvedValue([]);
});

describe("POST regenerate-matches doubles", () => {
  test("401 not admin", async () => {
    mockNoCookie();
    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(401);
  });

  test("400 malformed id", async () => {
    mockAdminCookie();
    const res = await POST(postReq(), makeCtx("bad id!"));
    expect(res.status).toBe(400);
  });

  test("404 group not found", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue(null);
    const res = await POST(postReq(), makeCtx("gZ"));
    expect(res.status).toBe(404);
  });

  test("200 empty entries → no-op", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [],
    });
    const fetchChain = makeSupabaseChain({ data: [], error: null });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(fetchChain as never);

    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary).toEqual({ kept: 0, deleted: 0, added: 0 });
  });

  test("200 first run inserts all pairings", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [
        { id: "p01", label: "A" },
        { id: "p02", label: "B" },
        { id: "p03", label: "C" },
      ],
    });
    const fetchCurrent = makeSupabaseChain({ data: [], error: null });
    const fetchAllIds = makeSupabaseChain({ data: [], error: null });
    const insertChain = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(fetchCurrent as never)
      .mockReturnValueOnce(fetchAllIds as never)
      .mockReturnValueOnce(insertChain as never);

    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // 3 entries → C(3,2) = 3 pairings
    expect(body.data.summary).toEqual({ kept: 0, deleted: 0, added: 3 });
  });

  test("200 idempotent re-run keeps all", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [
        { id: "p01", label: "A" },
        { id: "p02", label: "B" },
      ],
    });
    const fetchCurrent = makeSupabaseChain({
      data: [{ id: "dm01", pair_a: "p01", pair_b: "p02" }],
      error: null,
    });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(fetchCurrent as never);

    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary).toEqual({ kept: 1, deleted: 0, added: 0 });
  });

  test("200 entries swap → delete stale + add new + keep matching", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [
        { id: "p01", label: "A" },
        { id: "p02", label: "B" },
        { id: "p04", label: "D" }, // p03 swapped to p04
      ],
    });
    const fetchCurrent = makeSupabaseChain({
      data: [
        { id: "dm01", pair_a: "p01", pair_b: "p02" }, // keep
        { id: "dm02", pair_a: "p01", pair_b: "p03" }, // delete
        { id: "dm03", pair_a: "p02", pair_b: "p03" }, // delete
      ],
      error: null,
    });
    const deleteChain = makeSupabaseChain({ data: null, error: null });
    const fetchAllIds = makeSupabaseChain({
      data: [{ id: "dm01" }, { id: "dm02" }, { id: "dm03" }],
      error: null,
    });
    const insertChain = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(fetchCurrent as never)
      .mockReturnValueOnce(deleteChain as never)
      .mockReturnValueOnce(fetchAllIds as never)
      .mockReturnValueOnce(insertChain as never);

    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary).toEqual({ kept: 1, deleted: 2, added: 2 });
  });

  test("207 partial failure on insert error", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [
        { id: "p01", label: "A" },
        { id: "p02", label: "B" },
      ],
    });
    const fetchCurrent = makeSupabaseChain({ data: [], error: null });
    const fetchAllIds = makeSupabaseChain({ data: [], error: null });
    const insertChain = makeSupabaseChain({
      data: null,
      error: { message: "boom" },
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(fetchCurrent as never)
      .mockReturnValueOnce(fetchAllIds as never)
      .mockReturnValueOnce(insertChain as never);

    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.error).toMatch(/boom/);
    expect(body.data.summary).toEqual({ kept: 0, deleted: 0, added: 0 });
  });

  test("207 partial — delete succeeded, insert failed → summary reflects delete", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [
        { id: "p01", label: "A" },
        { id: "p04", label: "D" },
        { id: "p05", label: "E" },
      ],
    });
    // Current has 2 stale entries (dm02, dm03) that are not in target pairings.
    // Target pairings (from p01,p04,p05): (p01,p04), (p01,p05), (p04,p05) — none match current.
    const fetchCurrent = makeSupabaseChain({
      data: [
        { id: "dm02", pair_a: "p02", pair_b: "p03" },
        { id: "dm03", pair_a: "p03", pair_b: "p06" },
      ],
      error: null,
    });
    const deleteChain = makeSupabaseChain({ data: null, error: null });
    const fetchAllIds = makeSupabaseChain({
      data: [{ id: "dm02" }, { id: "dm03" }],
      error: null,
    });
    const insertChain = makeSupabaseChain({
      data: null,
      error: { message: "insert boom" },
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(fetchCurrent as never)
      .mockReturnValueOnce(deleteChain as never)
      .mockReturnValueOnce(fetchAllIds as never)
      .mockReturnValueOnce(insertChain as never);

    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.data.summary.deleted).toBe(2);
    expect(body.data.summary.added).toBe(0);
    expect(body.error).toMatch(/insert boom/);
  });
});
