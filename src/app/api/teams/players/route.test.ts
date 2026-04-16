import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { GET } from "./route";
import { POST } from "./route";
import { cookies } from "next/headers";

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

describe("GET /api/teams/players", () => {
  test("returns players array on success", async () => {
    const players = [
      { id: "t01", name: "Quốc", phone: "", gender: "M", club: "CLB Bình Tân" },
      { id: "t02", name: "Quy", phone: "", gender: "M", club: "CLB Bình Tân" },
    ];
    const chain = makeSupabaseChain({ data: players, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: players, error: null });
    expect(supabaseServer.from).toHaveBeenCalledWith("team_players");
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

describe("POST /api/teams/players", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const req = new Request("http://localhost/api/teams/players", {
      method: "POST",
      body: JSON.stringify({ name: "A", gender: "M", club: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test("returns 400 on invalid body", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost/api/teams/players", {
      method: "POST",
      body: JSON.stringify({ name: "", gender: "M", club: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("returns 201 and generates next id with t prefix", async () => {
    mockAdminCookie();
    const selectChain = makeSupabaseChain({
      data: [{ id: "t01" }, { id: "t02" }, { id: "t03" }],
      error: null,
    });
    const inserted = { id: "t04", name: "Test", gender: "M", club: "CLB", phone: "" };
    const insertChain = makeSupabaseChain({ data: inserted, error: null });
    insertChain.single = vi.fn().mockResolvedValue({ data: inserted, error: null });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(selectChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertChain as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/teams/players", {
      method: "POST",
      body: JSON.stringify({ name: "Test", gender: "M", club: "CLB" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("t04");
  });

  test("retries on id conflict (23505)", async () => {
    mockAdminCookie();
    const selectChain = makeSupabaseChain({
      data: [{ id: "t01" }, { id: "t02" }],
      error: null,
    });
    const insertFail = makeSupabaseChain({ data: null, error: { code: "23505" } });
    insertFail.single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    const selectChain2 = makeSupabaseChain({
      data: [{ id: "t01" }, { id: "t02" }, { id: "t03" }],
      error: null,
    });
    const insertOk = makeSupabaseChain({
      data: { id: "t04", name: "X", gender: "M", club: "", phone: "" },
      error: null,
    });
    insertOk.single = vi.fn().mockResolvedValue({
      data: { id: "t04", name: "X", gender: "M", club: "", phone: "" },
      error: null,
    });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(selectChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertFail as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(selectChain2 as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertOk as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/teams/players", {
      method: "POST",
      body: JSON.stringify({ name: "X", gender: "M", club: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("t04");
  });
});
