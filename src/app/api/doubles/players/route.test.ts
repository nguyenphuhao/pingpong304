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

describe("GET /api/doubles/players", () => {
  test("returns players array on success", async () => {
    const players = [
      { id: "d01", name: "A", phone: "", gender: "M", club: "" },
      { id: "d02", name: "B", phone: "", gender: "F", club: "" },
    ];
    const chain = makeSupabaseChain({ data: players, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: players, error: null });
    expect(supabaseServer.from).toHaveBeenCalledWith("doubles_players");
  });

  test("returns 500 on supabase error", async () => {
    const chain = makeSupabaseChain({ data: null, error: { message: "db down" } });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("db down");
  });
});

describe("POST /api/doubles/players", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const req = new Request("http://localhost/api/doubles/players", {
      method: "POST",
      body: JSON.stringify({ name: "A", gender: "M", club: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test("returns 400 on invalid body", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost/api/doubles/players", {
      method: "POST",
      body: JSON.stringify({ name: "", gender: "M", club: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tên|name/i);
  });

  test("returns 201 and generates next id", async () => {
    mockAdminCookie();
    // 1st from(): select existing ids — return d01..d05
    // 2nd from(): insert — return the new row
    const selectChain = makeSupabaseChain({
      data: [{ id: "d01" }, { id: "d02" }, { id: "d05" }],
      error: null,
    });
    const inserted = { id: "d06", name: "Test", gender: "M", club: "CLB", phone: "" };
    const insertChain = makeSupabaseChain({ data: inserted, error: null });
    insertChain.single = vi.fn().mockResolvedValue({ data: inserted, error: null });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(selectChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertChain as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/doubles/players", {
      method: "POST",
      body: JSON.stringify({ name: "Test", gender: "M", club: "CLB" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("d06");
  });

  test("retries on id conflict (23505)", async () => {
    mockAdminCookie();
    // select returns d01..d03 → nextId = d04
    const selectChain = makeSupabaseChain({
      data: [{ id: "d01" }, { id: "d02" }, { id: "d03" }],
      error: null,
    });
    // 1st insert fails with 23505
    const insertFail = makeSupabaseChain({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    insertFail.single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    // retry: new select + successful insert
    const selectChain2 = makeSupabaseChain({
      data: [{ id: "d01" }, { id: "d02" }, { id: "d03" }, { id: "d04" }],
      error: null,
    });
    const insertOk = makeSupabaseChain({
      data: { id: "d05", name: "X", gender: "M", club: "", phone: "" },
      error: null,
    });
    insertOk.single = vi.fn().mockResolvedValue({
      data: { id: "d05", name: "X", gender: "M", club: "", phone: "" },
      error: null,
    });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(selectChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertFail as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(selectChain2 as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertOk as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/doubles/players", {
      method: "POST",
      body: JSON.stringify({ name: "X", gender: "M", club: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("d05");
  });
});
