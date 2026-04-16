import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { GET, PATCH, DELETE } from "./route";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/doubles/players/[id]", () => {
  test("returns 200 with player on found", async () => {
    const player = { id: "d01", name: "A", gender: "M", club: "", phone: null };
    const chain = makeSupabaseChain({ data: player, error: null });
    chain.single = vi.fn().mockResolvedValue({ data: player, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET(new Request("http://localhost/x"), ctx("d01"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(player);
  });

  test("returns 404 when not found", async () => {
    const chain = makeSupabaseChain({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    chain.single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET(new Request("http://localhost/x"), ctx("dxx"));
    expect(res.status).toBe(404);
  });
});

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

describe("PATCH /api/doubles/players/[id]", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ name: "Mới" }),
    });
    const res = await PATCH(req, ctx("d01"));
    expect(res.status).toBe(401);
  });

  test("returns 400 on invalid body", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ gender: "X" }),
    });
    const res = await PATCH(req, ctx("d01"));
    expect(res.status).toBe(400);
  });

  test("returns 200 with updated player", async () => {
    mockAdminCookie();
    const updated = { id: "d01", name: "Mới", gender: "M", club: "", phone: null };
    const chain = makeSupabaseChain({ data: updated, error: null });
    chain.single = vi.fn().mockResolvedValue({ data: updated, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ name: "Mới" }),
    });
    const res = await PATCH(req, ctx("d01"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Mới");
  });

  test("returns 404 when row not found", async () => {
    mockAdminCookie();
    const chain = makeSupabaseChain({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    chain.single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ name: "X" }),
    });
    const res = await PATCH(req, ctx("dxx"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/doubles/players/[id]", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const res = await DELETE(new Request("http://localhost/x"), ctx("d01"));
    expect(res.status).toBe(401);
  });

  test("returns 409 when player is in a pair", async () => {
    mockAdminCookie();
    const preCheck = makeSupabaseChain({
      data: [{ id: "p01", p1: "d01", p2: "d02" }],
      error: null,
    });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(
      preCheck as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await DELETE(new Request("http://localhost/x"), ctx("d01"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("cặp");
    expect(body.error).toContain("p01");
  });

  test("returns 200 on successful delete", async () => {
    mockAdminCookie();
    // pre-check returns empty
    const preCheck = makeSupabaseChain({ data: [], error: null });
    // delete returns success
    const del = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(preCheck as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(del as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await DELETE(new Request("http://localhost/x"), ctx("d99"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: null, error: null });
  });
});

describe("DELETE /api/doubles/players/[id] — id guard", () => {
  test("returns 400 on invalid id format", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: "ok", name: "pp_admin" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      { params: Promise.resolve({ id: "a;b" }) },
    );
    expect(res.status).toBe(400);
  });
});
