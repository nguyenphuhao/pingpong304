import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/db/groups", () => ({
  fetchTeamGroupById: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { cookies } from "next/headers";
import { fetchTeamGroupById } from "@/lib/db/groups";
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
  return new Request("http://localhost/api/teams/groups/gtA", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/teams/groups/[id]", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const res = await PATCH(patchReq({ entries: [] }), makeCtx("gtA"));
    expect(res.status).toBe(401);
  });

  test("returns 400 when id malformed", async () => {
    mockAdminCookie();
    const res = await PATCH(patchReq({ entries: [] }), makeCtx("bad id!"));
    expect(res.status).toBe(400);
  });

  test("returns 400 on duplicate entries", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gtA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gtA" }, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      existChain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    const res = await PATCH(
      patchReq({ entries: ["tA1", "tA1"] }),
      makeCtx("gtA"),
    );
    expect(res.status).toBe(400);
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
    const res = await PATCH(patchReq({ entries: [] }), makeCtx("gtZ"));
    expect(res.status).toBe(404);
  });

  test("returns 400 when team not exist", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gtA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gtA" }, error: null });
    const verifyChain = makeSupabaseChain({
      data: [{ id: "tA1" }],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(existChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>);
    const res = await PATCH(
      patchReq({ entries: ["tA1", "tZ9"] }),
      makeCtx("gtA"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tZ9/);
  });

  test("returns 409 when team in another group", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gtA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gtA" }, error: null });
    const verifyChain = makeSupabaseChain({
      data: [{ id: "tB1" }],
      error: null,
    });
    const crossChain = makeSupabaseChain({
      data: [{ id: "gtB", name: "Bảng B", entries: ["tB1"] }],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(existChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(crossChain as unknown as ReturnType<typeof supabaseServer.from>);
    const res = await PATCH(
      patchReq({ entries: ["tB1"] }),
      makeCtx("gtA"),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/tB1/);
    expect(body.error).toMatch(/Bảng B/);
  });

  test("returns 200 with resolved group", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gtA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gtA" }, error: null });
    const verifyChain = makeSupabaseChain({
      data: [{ id: "tA1" }],
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
      id: "gtA",
      name: "Bảng A",
      entries: [{ id: "tA1", label: "Bình Tân 1" }],
    };
    vi.mocked(fetchTeamGroupById).mockResolvedValue(resolved);

    const res = await PATCH(patchReq({ entries: ["tA1"] }), makeCtx("gtA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: resolved, error: null });
  });
});
