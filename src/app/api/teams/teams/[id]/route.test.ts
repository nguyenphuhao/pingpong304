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

describe("GET /api/teams/teams/[id]", () => {
  test("returns team when found", async () => {
    const teamRow = { id: "T01", name: "A", members: ["t01", "t02", "t03"] };
    const teamChain = makeSupabaseChain({ data: teamRow, error: null });
    teamChain.maybeSingle = vi.fn().mockResolvedValue({ data: teamRow, error: null });
    const playersChain = makeSupabaseChain({
      data: [
        { id: "t01", name: "P1" },
        { id: "t02", name: "P2" },
        { id: "t03", name: "P3" },
      ],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await GET(new Request("http://localhost"), ctx("T01"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("T01");
  });

  test("returns 404 when not found", async () => {
    const teamChain = makeSupabaseChain({ data: null, error: null });
    teamChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(
      teamChain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    const res = await GET(new Request("http://localhost"), ctx("T99"));
    expect(res.status).toBe(404);
  });

  test("returns 400 on invalid id", async () => {
    const res = await GET(new Request("http://localhost"), ctx("a;b"));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/teams/teams/[id]", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ name: "B" }),
    });
    const res = await PATCH(req, ctx("T01"));
    expect(res.status).toBe(401);
  });

  test("returns 400 on invalid id", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ name: "B" }),
    });
    const res = await PATCH(req, ctx("a;b"));
    expect(res.status).toBe(400);
  });

  test("returns 400 when members has dupes", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ members: ["t01", "t01", "t02"] }),
    });
    const res = await PATCH(req, ctx("T01"));
    expect(res.status).toBe(400);
  });

  test("returns 200 on name-only update", async () => {
    mockAdminCookie();
    const updateChain = makeSupabaseChain({ data: { id: "T01" }, error: null });
    updateChain.single = vi.fn().mockResolvedValue({ data: { id: "T01" }, error: null });
    const teamRow = { id: "T01", name: "B", members: ["t01", "t02", "t03"] };
    const teamChain = makeSupabaseChain({ data: teamRow, error: null });
    teamChain.maybeSingle = vi.fn().mockResolvedValue({ data: teamRow, error: null });
    const playersChain = makeSupabaseChain({
      data: [
        { id: "t01", name: "P1" },
        { id: "t02", name: "P2" },
        { id: "t03", name: "P3" },
      ],
      error: null,
    });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(updateChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(teamChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ name: "B" }),
    });
    const res = await PATCH(req, ctx("T01"));
    expect(res.status).toBe(200);
  });

  test("returns 200 on members update (verifies FK first)", async () => {
    mockAdminCookie();
    const verifyChain = makeSupabaseChain({
      data: [{ id: "t04" }, { id: "t05" }, { id: "t06" }],
      error: null,
    });
    const updateChain = makeSupabaseChain({ data: { id: "T01" }, error: null });
    updateChain.single = vi.fn().mockResolvedValue({ data: { id: "T01" }, error: null });
    const teamRow = { id: "T01", name: "A", members: ["t04", "t05", "t06"] };
    const teamChain = makeSupabaseChain({ data: teamRow, error: null });
    teamChain.maybeSingle = vi.fn().mockResolvedValue({ data: teamRow, error: null });
    const playersChain = makeSupabaseChain({
      data: [
        { id: "t04", name: "P4" },
        { id: "t05", name: "P5" },
        { id: "t06", name: "P6" },
      ],
      error: null,
    });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(updateChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(teamChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ members: ["t04", "t05", "t06"] }),
    });
    const res = await PATCH(req, ctx("T01"));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/teams/teams/[id]", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("T01"));
    expect(res.status).toBe(401);
  });

  test("returns 400 on invalid id", async () => {
    mockAdminCookie();
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("a;b"));
    expect(res.status).toBe(400);
  });

  test("returns 409 when team in matches", async () => {
    mockAdminCookie();
    const matchesChain = makeSupabaseChain({
      data: [{ id: "tmm01" }],
      error: null,
    });
    const groupsChain = makeSupabaseChain({ data: [], error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchesChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(groupsChain as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      ctx("tA1"),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("1 trận đấu");
  });

  test("returns 409 when team in groups.entries", async () => {
    mockAdminCookie();
    const matchesChain = makeSupabaseChain({ data: [], error: null });
    const groupsChain = makeSupabaseChain({
      data: [{ id: "gtA", name: "Bảng A" }],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchesChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(groupsChain as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      ctx("tA1"),
    );
    expect(res.status).toBe(409);
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
      ctx("T99"),
    );
    expect(res.status).toBe(200);
  });
});
