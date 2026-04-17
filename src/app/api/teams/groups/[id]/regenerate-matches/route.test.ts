import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/db/groups", () => ({
  fetchTeamGroupById: vi.fn(),
}));
vi.mock("@/lib/db/matches", () => ({
  fetchTeamMatchesByGroup: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { cookies } from "next/headers";
import { fetchTeamGroupById } from "@/lib/db/groups";
import { fetchTeamMatchesByGroup } from "@/lib/db/matches";
import { POST } from "./route";

function mockAdminCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ value: "ok", name: "pp_admin" }),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}
function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function postReq() {
  return new Request(
    "http://localhost/api/teams/groups/gtA/regenerate-matches",
    { method: "POST", body: JSON.stringify({}) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchTeamMatchesByGroup).mockResolvedValue([]);
});

describe("POST regenerate-matches teams", () => {
  test("404 group not found", async () => {
    mockAdminCookie();
    vi.mocked(fetchTeamGroupById).mockResolvedValue(null);
    const res = await POST(postReq(), makeCtx("gZZ"));
    expect(res.status).toBe(404);
  });

  test("200 first run creates matches with default 3 subs", async () => {
    mockAdminCookie();
    vi.mocked(fetchTeamGroupById).mockResolvedValue({
      id: "gtA",
      name: "Bảng A",
      entries: [
        { id: "tA1", label: "A" },
        { id: "tA2", label: "B" },
      ],
    });
    const fetchCurrent = makeSupabaseChain({ data: [], error: null });
    const fetchAllIds = makeSupabaseChain({ data: [], error: null });
    const insertChain = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(fetchCurrent as never)
      .mockReturnValueOnce(fetchAllIds as never)
      .mockReturnValueOnce(insertChain as never);

    const res = await POST(postReq(), makeCtx("gtA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary).toEqual({ kept: 0, deleted: 0, added: 1 });
    // verify insert payload had individual array length 3 with default labels
    const insertCall = (insertChain.insert as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0];
    expect(insertCall).toBeDefined();
    expect(insertCall[0].individual).toHaveLength(3);
    const labels = insertCall[0].individual.map(
      (s: { label: string }) => s.label,
    );
    expect(labels).toEqual(["Đôi", "Đơn 1", "Đơn 2"]);
  });

  test("200 idempotent preserves individual edits on kept matches", async () => {
    mockAdminCookie();
    vi.mocked(fetchTeamGroupById).mockResolvedValue({
      id: "gtA",
      name: "Bảng A",
      entries: [
        { id: "tA1", label: "A" },
        { id: "tA2", label: "B" },
      ],
    });
    const fetchCurrent = makeSupabaseChain({
      data: [{ id: "tm01", team_a: "tA1", team_b: "tA2" }],
      error: null,
    });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(fetchCurrent as never);

    const res = await POST(postReq(), makeCtx("gtA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary).toEqual({ kept: 1, deleted: 0, added: 0 });
  });

  test("207 partial failure on insert error", async () => {
    mockAdminCookie();
    vi.mocked(fetchTeamGroupById).mockResolvedValue({
      id: "gtA",
      name: "Bảng A",
      entries: [
        { id: "tA1", label: "A" },
        { id: "tA2", label: "B" },
      ],
    });
    const fetchCurrent = makeSupabaseChain({ data: [], error: null });
    const fetchAllIds = makeSupabaseChain({ data: [], error: null });
    const insertChain = makeSupabaseChain({
      data: null,
      error: { message: "boom" },
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(fetchCurrent as never)
      .mockReturnValueOnce(fetchAllIds as never)
      .mockReturnValueOnce(insertChain as never);

    const res = await POST(postReq(), makeCtx("gtA"));
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.error).toMatch(/boom/);
    expect(body.data.summary).toEqual({ kept: 0, deleted: 0, added: 0 });
  });

  test("207 partial — delete succeeded, insert failed → summary reflects delete", async () => {
    mockAdminCookie();
    vi.mocked(fetchTeamGroupById).mockResolvedValue({
      id: "gtA",
      name: "Bảng A",
      entries: [
        { id: "tA1", label: "A" },
        { id: "tA4", label: "D" },
        { id: "tA5", label: "E" },
      ],
    });
    // Current has 2 stale entries that are not in target pairings.
    const fetchCurrent = makeSupabaseChain({
      data: [
        { id: "tm02", team_a: "tA2", team_b: "tA3" },
        { id: "tm03", team_a: "tA3", team_b: "tA6" },
      ],
      error: null,
    });
    const deleteChain = makeSupabaseChain({ data: null, error: null });
    const fetchAllIds = makeSupabaseChain({
      data: [{ id: "tm02" }, { id: "tm03" }],
      error: null,
    });
    const insertChain = makeSupabaseChain({
      data: null,
      error: { message: "insert boom" },
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(fetchCurrent as never)
      .mockReturnValueOnce(deleteChain as never)
      .mockReturnValueOnce(fetchAllIds as never)
      .mockReturnValueOnce(insertChain as never);

    const res = await POST(postReq(), makeCtx("gtA"));
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.data.summary.deleted).toBe(2);
    expect(body.data.summary.added).toBe(0);
    expect(body.error).toMatch(/insert boom/);
  });
});
