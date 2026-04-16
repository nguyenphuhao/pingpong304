import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/db/groups", () => ({
  fetchDoublesGroupById: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { cookies } from "next/headers";
import { fetchDoublesGroupById } from "@/lib/db/groups";
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
  return new Request("http://localhost/api/doubles/groups/gA", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/doubles/groups/[id]", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const res = await PATCH(patchReq({ entries: [] }), makeCtx("gA"));
    expect(res.status).toBe(401);
  });

  test("returns 400 when id malformed", async () => {
    mockAdminCookie();
    const res = await PATCH(patchReq({ entries: [] }), makeCtx("bad id!"));
    expect(res.status).toBe(400);
  });

  test("returns 400 when body shape invalid", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gA" }, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      existChain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    const res = await PATCH(patchReq({ entries: "not-array" }), makeCtx("gA"));
    expect(res.status).toBe(400);
  });

  test("returns 400 on duplicate entries", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gA" }, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      existChain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    const res = await PATCH(
      patchReq({ entries: ["p01", "p01"] }),
      makeCtx("gA"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/trùng/i);
  });

  test("returns 404 when group not found", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: null, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      existChain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    const res = await PATCH(patchReq({ entries: [] }), makeCtx("gZ"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH verifies pair existence", () => {
  test("returns 400 when pair in entries not exist", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gA" }, error: null });
    const verifyChain = makeSupabaseChain({
      data: [{ id: "p01" }],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(existChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await PATCH(
      patchReq({ entries: ["p01", "p99"] }),
      makeCtx("gA"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/p99/);
    expect(body.error).toMatch(/không tồn tại/i);
  });
});

describe("PATCH cross-group validation", () => {
  test("returns 409 when entry is in another group", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gA" }, error: null });
    const verifyChain = makeSupabaseChain({
      data: [{ id: "p01" }, { id: "p05" }],
      error: null,
    });
    const crossChain = makeSupabaseChain({
      data: [{ id: "gB", name: "Bảng B", entries: ["p05", "p08"] }],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(existChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(crossChain as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await PATCH(
      patchReq({ entries: ["p01", "p05"] }),
      makeCtx("gA"),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/p05/);
    expect(body.error).toMatch(/Bảng B/);
  });
});

describe("PATCH success", () => {
  test("returns 200 with resolved group", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gA" }, error: null });
    const verifyChain = makeSupabaseChain({
      data: [{ id: "p01" }, { id: "p04" }],
      error: null,
    });
    const crossChain = makeSupabaseChain({ data: [], error: null });
    const updChain = makeSupabaseChain({ data: null, error: null });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(existChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(crossChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(updChain as unknown as ReturnType<typeof supabaseServer.from>);

    const resolved = {
      id: "gA",
      name: "Bảng A",
      entries: [
        { id: "p01", label: "Minh Quân – Tân Sinh" },
        { id: "p04", label: "Hoài Nam – Phi Hùng" },
      ],
    };
    vi.mocked(fetchDoublesGroupById).mockResolvedValue(resolved);

    const res = await PATCH(
      patchReq({ entries: ["p01", "p04"] }),
      makeCtx("gA"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: resolved, error: null });
  });

  test("returns 200 on empty entries", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gA" }, error: null });
    const crossChain = makeSupabaseChain({ data: [], error: null });
    const updChain = makeSupabaseChain({ data: null, error: null });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(existChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(crossChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(updChain as unknown as ReturnType<typeof supabaseServer.from>);

    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [],
    });

    const res = await PATCH(patchReq({ entries: [] }), makeCtx("gA"));
    expect(res.status).toBe(200);
  });
});
