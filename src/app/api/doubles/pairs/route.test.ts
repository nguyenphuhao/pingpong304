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
import { GET, POST } from "./route";

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

describe("GET /api/doubles/pairs", () => {
  test("returns pairs array", async () => {
    const pairs = [
      { id: "p01", p1: { id: "d01", name: "A" }, p2: { id: "d02", name: "B" } },
    ];
    const chain = makeSupabaseChain({ data: pairs, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: pairs, error: null });
  });

  test("returns 500 on supabase error", async () => {
    const chain = makeSupabaseChain({ data: null, error: { message: "boom" } });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/doubles/pairs", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const req = new Request("http://localhost/api/doubles/pairs", {
      method: "POST",
      body: JSON.stringify({ p1: "d01", p2: "d02" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test("returns 400 when p1=p2", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost/api/doubles/pairs", {
      method: "POST",
      body: JSON.stringify({ p1: "d01", p2: "d01" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/khác nhau/i);
  });

  test("returns 400 when FK player missing", async () => {
    mockAdminCookie();
    const verifyChain = makeSupabaseChain({
      data: [{ id: "d01" }],
      error: null,
    });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(
      verifyChain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const req = new Request("http://localhost/api/doubles/pairs", {
      method: "POST",
      body: JSON.stringify({ p1: "d01", p2: "d02" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/VĐV/);
  });

  test("returns 201 with inserted pair resolved", async () => {
    mockAdminCookie();
    const verifyChain = makeSupabaseChain({
      data: [{ id: "d01" }, { id: "d02" }],
      error: null,
    });
    const scanChain = makeSupabaseChain({
      data: [{ id: "p01" }],
      error: null,
    });
    const inserted = { id: "p02" };
    const insertChain = makeSupabaseChain({ data: inserted, error: null });
    insertChain.single = vi.fn().mockResolvedValue({ data: inserted, error: null });
    const resolved = {
      id: "p02",
      p1: { id: "d01", name: "A" },
      p2: { id: "d02", name: "B" },
    };
    const reFetchChain = makeSupabaseChain({ data: resolved, error: null });
    reFetchChain.maybeSingle = vi.fn().mockResolvedValue({ data: resolved, error: null });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(scanChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(reFetchChain as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/doubles/pairs", {
      method: "POST",
      body: JSON.stringify({ p1: "d01", p2: "d02" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual(resolved);
  });

  test("retries on 23505 conflict", async () => {
    mockAdminCookie();
    const verifyChain = makeSupabaseChain({
      data: [{ id: "d01" }, { id: "d02" }],
      error: null,
    });
    const scanChain1 = makeSupabaseChain({ data: [{ id: "p01" }], error: null });
    const insertFail = makeSupabaseChain({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    insertFail.single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    const scanChain2 = makeSupabaseChain({
      data: [{ id: "p01" }, { id: "p02" }],
      error: null,
    });
    const insertOk = makeSupabaseChain({ data: { id: "p03" }, error: null });
    insertOk.single = vi.fn().mockResolvedValue({ data: { id: "p03" }, error: null });
    const resolved = {
      id: "p03",
      p1: { id: "d01", name: "A" },
      p2: { id: "d02", name: "B" },
    };
    const reFetchChain = makeSupabaseChain({ data: resolved, error: null });
    reFetchChain.maybeSingle = vi.fn().mockResolvedValue({ data: resolved, error: null });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(scanChain1 as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertFail as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(scanChain2 as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertOk as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(reFetchChain as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/doubles/pairs", {
      method: "POST",
      body: JSON.stringify({ p1: "d01", p2: "d02" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("p03");
  });
});
