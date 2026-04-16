import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { cookies } from "next/headers";
import { DELETE, GET, PATCH } from "./route";

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

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/doubles/pairs/[id]", () => {
  test("returns pair when found", async () => {
    const row = { id: "p01", p1: { id: "d01", name: "A" }, p2: { id: "d02", name: "B" } };
    const chain = makeSupabaseChain({ data: row, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET(new Request("http://localhost/api/doubles/pairs/p01"), ctx("p01"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(row);
  });

  test("returns 404 when not found", async () => {
    const chain = makeSupabaseChain({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET(new Request("http://localhost/api/doubles/pairs/p99"), ctx("p99"));
    expect(res.status).toBe(404);
  });

  test("returns 400 on invalid id format", async () => {
    const res = await GET(new Request("http://localhost/api/doubles/pairs/a;b"), ctx("a;b"));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/doubles/pairs/[id]", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const req = new Request("http://localhost/api/doubles/pairs/p01", {
      method: "PATCH",
      body: JSON.stringify({ p1: "d03" }),
    });
    const res = await PATCH(req, ctx("p01"));
    expect(res.status).toBe(401);
  });

  test("returns 400 on invalid id", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost/api/doubles/pairs/a;b", {
      method: "PATCH",
      body: JSON.stringify({ p1: "d03" }),
    });
    const res = await PATCH(req, ctx("a;b"));
    expect(res.status).toBe(400);
  });

  test("returns 400 when p1=p2 in patch", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost/api/doubles/pairs/p01", {
      method: "PATCH",
      body: JSON.stringify({ p1: "d01", p2: "d01" }),
    });
    const res = await PATCH(req, ctx("p01"));
    expect(res.status).toBe(400);
  });

  test("returns 200 on happy path", async () => {
    mockAdminCookie();
    const existing = {
      id: "p01",
      p1: { id: "d01", name: "A" },
      p2: { id: "d02", name: "B" },
    };
    const existingChain = makeSupabaseChain({ data: existing, error: null });
    existingChain.maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
    const verifyChain = makeSupabaseChain({
      data: [{ id: "d03" }],
      error: null,
    });
    const updateChain = makeSupabaseChain({ data: { id: "p01" }, error: null });
    updateChain.single = vi.fn().mockResolvedValue({ data: { id: "p01" }, error: null });
    const resolved = {
      id: "p01",
      p1: { id: "d03", name: "C" },
      p2: { id: "d02", name: "B" },
    };
    const reFetchChain = makeSupabaseChain({ data: resolved, error: null });
    reFetchChain.maybeSingle = vi.fn().mockResolvedValue({ data: resolved, error: null });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(existingChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(updateChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(reFetchChain as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/doubles/pairs/p01", {
      method: "PATCH",
      body: JSON.stringify({ p1: "d03" }),
    });
    const res = await PATCH(req, ctx("p01"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.p1.id).toBe("d03");
  });

  test("returns 404 when pair does not exist", async () => {
    mockAdminCookie();
    const existingChain = makeSupabaseChain({ data: null, error: null });
    existingChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(
      existingChain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const req = new Request("http://localhost/api/doubles/pairs/p99", {
      method: "PATCH",
      body: JSON.stringify({ p1: "d03" }),
    });
    const res = await PATCH(req, ctx("p99"));
    expect(res.status).toBe(404);
  });

  test("returns 400 when patch p1 matches existing p2 (merged p1===p2)", async () => {
    mockAdminCookie();
    const existing = {
      id: "p01",
      p1: { id: "d01", name: "A" },
      p2: { id: "d02", name: "B" },
    };
    const existingChain = makeSupabaseChain({ data: existing, error: null });
    existingChain.maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(
      existingChain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const req = new Request("http://localhost/api/doubles/pairs/p01", {
      method: "PATCH",
      body: JSON.stringify({ p1: "d02" }),
    });
    const res = await PATCH(req, ctx("p01"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/khác nhau/);
  });
});

describe("DELETE /api/doubles/pairs/[id]", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("p01"));
    expect(res.status).toBe(401);
  });

  test("returns 400 on invalid id", async () => {
    mockAdminCookie();
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("a;b"));
    expect(res.status).toBe(400);
  });

  test("returns 409 when pair referenced in matches", async () => {
    mockAdminCookie();
    const matchesChain = makeSupabaseChain({
      data: [{ id: "dm01" }, { id: "dm02" }],
      error: null,
    });
    const groupsChain = makeSupabaseChain({ data: [], error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchesChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(groupsChain as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      ctx("p01"),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("2 trận đấu");
  });

  test("returns 409 when pair referenced in groups.entries", async () => {
    mockAdminCookie();
    const matchesChain = makeSupabaseChain({ data: [], error: null });
    const groupsChain = makeSupabaseChain({
      data: [{ id: "gA", name: "Bảng A" }],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchesChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(groupsChain as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      ctx("p01"),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Bảng A");
  });

  test("returns 409 combined refs", async () => {
    mockAdminCookie();
    const matchesChain = makeSupabaseChain({
      data: [{ id: "dm01" }],
      error: null,
    });
    const groupsChain = makeSupabaseChain({
      data: [{ id: "gA", name: "Bảng A" }],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchesChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(groupsChain as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      ctx("p01"),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/trận đấu.*và.*Bảng A/);
  });

  test("returns 200 when no refs", async () => {
    mockAdminCookie();
    const matchesChain = makeSupabaseChain({ data: [], error: null });
    const groupsChain = makeSupabaseChain({ data: [], error: null });
    const deleteChain = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchesChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(groupsChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(deleteChain as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      ctx("p99"),
    );
    expect(res.status).toBe(200);
  });
});
