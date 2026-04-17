import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/db/matches", () => ({
  fetchTeamMatchById: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { cookies } from "next/headers";
import { fetchTeamMatchById } from "@/lib/db/matches";
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
  return new Request("http://localhost/api/teams/matches/tm01", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function mockExisting(opts?: {
  team_a?: string;
  team_b?: string;
  individual?: unknown[];
  status?: string;
  winner?: string | null;
}) {
  const chain = makeSupabaseChain({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: "tm01",
      team_a: opts?.team_a ?? "tA1",
      team_b: opts?.team_b ?? "tA2",
      individual: opts?.individual ?? [],
      status: opts?.status ?? "scheduled",
      winner: opts?.winner ?? null,
    },
    error: null,
  });
  return chain;
}
function mockTeams(rows: Array<{ id: string; members: string[] }>) {
  return makeSupabaseChain({ data: rows, error: null });
}
function mockUpdate() {
  return makeSupabaseChain({ data: null, error: null });
}

const validSub = (id: string) => ({
  id,
  label: "Đôi",
  kind: "doubles" as const,
  playersA: ["t01", "t02"],
  playersB: ["t04", "t05"],
  bestOf: 3 as const,
  sets: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchTeamMatchById).mockResolvedValue({
    id: "tm01",
    groupId: "gtA",
    teamA: { id: "tA1", name: "Team A" },
    teamB: { id: "tA2", name: "Team B" },
    table: null,
    scoreA: 0,
    scoreB: 0,
    status: "scheduled",
    winner: null,
    individual: [],
  });
});

describe("PATCH /api/teams/matches/[id]", () => {
  test("401 not admin", async () => {
    mockNoCookie();
    const res = await PATCH(patchReq({}), makeCtx("tm01"));
    expect(res.status).toBe(401);
  });

  test("404 match not found", async () => {
    mockAdminCookie();
    const chain = makeSupabaseChain({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(chain as never);
    const res = await PATCH(patchReq({}), makeCtx("tm99"));
    expect(res.status).toBe(404);
  });

  test("400 sub-match player not in team.members", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting() as never)
      .mockReturnValueOnce(
        mockTeams([
          { id: "tA1", members: ["t01", "t02", "t03"] },
          { id: "tA2", members: ["t04", "t05", "t06"] },
        ]) as never,
      );
    const sub = {
      ...validSub("tm01-d"),
      playersA: ["t99", "t02"], // t99 not in tA1
    };
    const res = await PATCH(
      patchReq({ individual: [sub] }),
      makeCtx("tm01"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/t99.*tA1|VĐV.*không thuộc/i);
  });

  test("400 singles with 2 players (zod refine)", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from).mockReturnValueOnce(mockExisting() as never);
    const sub = {
      ...validSub("tm01-s1"),
      kind: "singles" as const,
      playersA: ["t01", "t02"],
      playersB: ["t04"],
    };
    const res = await PATCH(
      patchReq({ individual: [sub] }),
      makeCtx("tm01"),
    );
    expect(res.status).toBe(400);
  });

  test("200 PATCH individual full-replace re-derives scores", async () => {
    mockAdminCookie();
    const sub = {
      ...validSub("tm01-d"),
      sets: [{ a: 11, b: 0 }, { a: 11, b: 0 }],
    };
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting() as never)
      .mockReturnValueOnce(
        mockTeams([
          { id: "tA1", members: ["t01", "t02", "t03"] },
          { id: "tA2", members: ["t04", "t05", "t06"] },
        ]) as never,
      )
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ individual: [sub] }),
      makeCtx("tm01"),
    );
    expect(res.status).toBe(200);
  });

  test("200 mixed singles/doubles subs", async () => {
    mockAdminCookie();
    const subs = [
      validSub("tm01-d"),
      {
        id: "tm01-s1",
        label: "Đơn 1",
        kind: "singles" as const,
        playersA: ["t01"],
        playersB: ["t04"],
        bestOf: 3 as const,
        sets: [],
      },
    ];
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting() as never)
      .mockReturnValueOnce(
        mockTeams([
          { id: "tA1", members: ["t01", "t02", "t03"] },
          { id: "tA2", members: ["t04", "t05", "t06"] },
        ]) as never,
      )
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ individual: subs }),
      makeCtx("tm01"),
    );
    expect(res.status).toBe(200);
  });

  test("200 reduce 3 → 1 sub", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting() as never)
      .mockReturnValueOnce(
        mockTeams([
          { id: "tA1", members: ["t01", "t02", "t03"] },
          { id: "tA2", members: ["t04", "t05", "t06"] },
        ]) as never,
      )
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ individual: [validSub("tm01-d")] }),
      makeCtx("tm01"),
    );
    expect(res.status).toBe(200);
  });

  test("200 expand 3 → 5 sub", async () => {
    mockAdminCookie();
    const subs = [
      validSub("tm01-1"),
      validSub("tm01-2"),
      validSub("tm01-3"),
      validSub("tm01-4"),
      validSub("tm01-5"),
    ];
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting() as never)
      .mockReturnValueOnce(
        mockTeams([
          { id: "tA1", members: ["t01", "t02", "t03"] },
          { id: "tA2", members: ["t04", "t05", "t06"] },
        ]) as never,
      )
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ individual: subs }),
      makeCtx("tm01"),
    );
    expect(res.status).toBe(200);
  });

  test("400 forfeit without winner", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from).mockReturnValueOnce(mockExisting() as never);
    const res = await PATCH(
      patchReq({ status: "forfeit" }),
      makeCtx("tm01"),
    );
    expect(res.status).toBe(400);
  });

  test("400 forfeit winner not in {team_a, team_b}", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from).mockReturnValueOnce(mockExisting() as never);
    const res = await PATCH(
      patchReq({ status: "forfeit", winner: "tZZ" }),
      makeCtx("tm01"),
    );
    expect(res.status).toBe(400);
  });

  test("200 forfeit with valid winner", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting() as never)
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ status: "forfeit", winner: "tA2" }),
      makeCtx("tm01"),
    );
    expect(res.status).toBe(200);
  });

  test("400 status='done' but tied", async () => {
    mockAdminCookie();
    const subs = [
      { ...validSub("tm01-1"), sets: [{ a: 11, b: 0 }, { a: 11, b: 0 }] },
      { ...validSub("tm01-2"), sets: [{ a: 0, b: 11 }, { a: 0, b: 11 }] },
    ];
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting() as never)
      .mockReturnValueOnce(
        mockTeams([
          { id: "tA1", members: ["t01", "t02", "t03"] },
          { id: "tA2", members: ["t04", "t05", "t06"] },
        ]) as never,
      );
    const res = await PATCH(
      patchReq({ individual: subs, status: "done" }),
      makeCtx("tm01"),
    );
    expect(res.status).toBe(400);
  });
});
