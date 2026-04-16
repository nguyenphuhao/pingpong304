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

describe("GET /api/teams/teams", () => {
  test("returns resolved teams", async () => {
    const teams = [{ id: "T01", name: "A", members: ["t01", "t02", "t03"] }];
    const players = [
      { id: "t01", name: "P1" },
      { id: "t02", name: "P2" },
      { id: "t03", name: "P3" },
    ];
    const teamsChain = makeSupabaseChain({ data: teams, error: null });
    const playersChain = makeSupabaseChain({ data: players, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamsChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].members).toHaveLength(3);
    expect(body.data[0].members[0]).toEqual({ id: "t01", name: "P1" });
  });

  test("returns 500 on error", async () => {
    const teamsChain = makeSupabaseChain({ data: null, error: { message: "db down" } });
    const playersChain = makeSupabaseChain({ data: [], error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamsChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/teams/teams", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const req = new Request("http://localhost/api/teams/teams", {
      method: "POST",
      body: JSON.stringify({ name: "A", members: ["t01", "t02", "t03"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test("returns 400 when members length != 3", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost/api/teams/teams", {
      method: "POST",
      body: JSON.stringify({ name: "A", members: ["t01", "t02"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("returns 400 when member missing in players", async () => {
    mockAdminCookie();
    const verifyChain = makeSupabaseChain({
      data: [{ id: "t01" }, { id: "t02" }],
      error: null,
    });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(
      verifyChain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const req = new Request("http://localhost/api/teams/teams", {
      method: "POST",
      body: JSON.stringify({ name: "A", members: ["t01", "t02", "t99"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/VĐV/);
  });

  test("returns 201 with inserted team resolved", async () => {
    mockAdminCookie();
    const verifyChain = makeSupabaseChain({
      data: [{ id: "t01" }, { id: "t02" }, { id: "t03" }],
      error: null,
    });
    const scanChain = makeSupabaseChain({ data: [], error: null });
    const inserted = { id: "T01" };
    const insertChain = makeSupabaseChain({ data: inserted, error: null });
    insertChain.single = vi.fn().mockResolvedValue({ data: inserted, error: null });
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
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(scanChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(teamChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/teams/teams", {
      method: "POST",
      body: JSON.stringify({ name: "A", members: ["t01", "t02", "t03"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("T01");
    expect(body.data.members).toHaveLength(3);
  });
});
