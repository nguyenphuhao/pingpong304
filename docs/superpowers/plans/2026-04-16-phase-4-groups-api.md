# Phase 4: Groups API + Public UI Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay mock Groups (`MOCK_DOUBLES_GROUPS`, `MOCK_TEAM_GROUPS`) bằng Supabase, cho admin PATCH entries của từng bảng, migrate public pages `/d` + `/t` đọc groups từ DB. Matches/KO vẫn mock (Phase 5+).

**Architecture:** RSC fetch groups qua `fetchDoublesGroups`/`fetchTeamGroups` (2-step: groups + reuse `fetchPairs`/`fetchTeams` để resolve entries ID→label). Client `GroupEntriesDialog` gọi PATCH route với `requireAdmin` + zod `IdSchema` + `verifyEntriesExist` + `verifyCrossGroup`. New type `GroupResolved` coexist với mock `Group` (Phase 3 precedent, `PairWithNames` alongside `Pair`).

**Tech Stack:** Next.js 16, React 19 (`useOptimistic`, `useTransition`), TypeScript strict, Supabase (`@supabase/supabase-js`), Zod 4, Vitest 4, `@base-ui/react` primitives (Dialog), `sonner` toasts, Tailwind 4, `lucide-react` icons.

**Spec:** `docs/superpowers/specs/2026-04-16-phase-4-groups-api-design.md`

**Branch:** `feat/supabase-phase-4` (create from `main` ở Pre-flight)

---

## File Structure

**New files:**
- `src/lib/schemas/group.ts` — zod `GroupEntriesPatchSchema` + types `GroupEntry`, `GroupResolved`
- `src/lib/schemas/group.test.ts` — schema unit tests
- `src/lib/db/groups.ts` — `fetchDoublesGroups`, `fetchDoublesGroupById`, `fetchTeamGroups`, `fetchTeamGroupById`
- `src/lib/db/groups.test.ts` — DB helper tests
- `src/app/api/doubles/groups/[id]/route.ts` — PATCH handler (doubles)
- `src/app/api/doubles/groups/[id]/route.test.ts` — route tests
- `src/app/api/teams/groups/[id]/route.ts` — PATCH handler (teams)
- `src/app/api/teams/groups/[id]/route.test.ts` — route tests
- `src/app/admin/_groups-section.tsx` — extracted `GroupsSection` + `GroupEntriesDialog`

**Modified:**
- `src/app/admin/_components.tsx` — `ContentWorkspace` props type, gỡ inline `GroupsSection`
- `src/app/admin/doubles/page.tsx`, `src/app/admin/teams/page.tsx` — thêm `fetchDoublesGroups`/`fetchTeamGroups`
- `src/app/admin/doubles/groups/[id]/page.tsx`, `src/app/admin/teams/groups/[id]/page.tsx` — RSC fetch by id
- `src/app/admin/doubles/loading.tsx`, `src/app/admin/teams/loading.tsx` — thêm skeleton Groups tab
- `src/app/d/page.tsx`, `src/app/t/page.tsx` — RSC fetch groups
- `src/app/d/[id]/page.tsx`, `src/app/t/[id]/page.tsx` — RSC fetch by id
- `src/app/_ContentHome.tsx` — thêm `groups` prop
- `src/app/_publicGroup.tsx` — accept `groups` prop, gỡ mock imports cho groups, map `e.label`
- `src/app/_home.ts` — `getStandings` signature đổi (thêm `entries: string[]` arg)

**Unchanged (intentional):**
- `MOCK_*_GROUPS`, `MOCK_*_MATCHES` trong `_mock.ts` — home page `/` + `_home.ts` internals còn dùng
- `src/app/page.tsx`, `src/app/search/*`
- Matches / KO sections / `_publicKnockout.tsx`

---

## Pre-flight

- [ ] **Step 0: Create branch from main**

```bash
git checkout main
git pull origin main 2>/dev/null || true
git checkout -b feat/supabase-phase-4
```

Expected: switched to new branch `feat/supabase-phase-4`.

---

## CHECKPOINT A — Foundations (schemas + DB helpers)

Shared schema, types, và fetch helpers. Zero UI impact. Tests pass riêng lẻ trước khi làm API route.

### Task A1: Schema group.ts

**Files:**
- Create: `src/lib/schemas/group.ts`
- Test: `src/lib/schemas/group.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/schemas/group.test.ts
import { describe, expect, test } from "vitest";
import { GroupEntriesPatchSchema } from "./group";

describe("GroupEntriesPatchSchema", () => {
  test("accepts valid entries array", () => {
    const r = GroupEntriesPatchSchema.safeParse({ entries: ["p01", "p04"] });
    expect(r.success).toBe(true);
  });

  test("accepts empty entries array", () => {
    const r = GroupEntriesPatchSchema.safeParse({ entries: [] });
    expect(r.success).toBe(true);
  });

  test("rejects duplicate entries", () => {
    const r = GroupEntriesPatchSchema.safeParse({ entries: ["p01", "p01"] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/trùng/i);
    }
  });

  test("rejects entry with bad id (regex fail)", () => {
    const r = GroupEntriesPatchSchema.safeParse({ entries: ["p01", "a b"] });
    expect(r.success).toBe(false);
  });

  test("rejects non-array entries", () => {
    const r = GroupEntriesPatchSchema.safeParse({ entries: "p01" });
    expect(r.success).toBe(false);
  });

  test("rejects missing entries key", () => {
    const r = GroupEntriesPatchSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/schemas/group.test.ts`
Expected: FAIL — `Cannot find module './group'`.

- [ ] **Step 3: Implement schema + types**

```ts
// src/lib/schemas/group.ts
import { z } from "zod";
import { IdSchema } from "./id";

export const GroupEntriesPatchSchema = z.object({
  entries: z
    .array(IdSchema)
    .refine(
      (arr) => new Set(arr).size === arr.length,
      "entries không được trùng lặp",
    ),
});

export type GroupEntriesPatch = z.infer<typeof GroupEntriesPatchSchema>;

export type GroupEntry = { id: string; label: string };

export type GroupResolved = {
  id: string;
  name: string;
  entries: GroupEntry[];
};
```

- [ ] **Step 4: Run test — PASS**

Run: `npm test -- src/lib/schemas/group.test.ts`
Expected: 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/group.ts src/lib/schemas/group.test.ts
git commit -m "feat(schemas): add GroupEntriesPatchSchema + GroupResolved types"
```

---

### Task A2: fetchDoublesGroups + fetchDoublesGroupById

**Files:**
- Create: `src/lib/db/groups.ts`
- Test: `src/lib/db/groups.test.ts`

- [ ] **Step 1: Write failing tests (doubles only — teams in A3)**

```ts
// src/lib/db/groups.test.ts
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("./pairs", () => ({
  fetchPairs: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { fetchPairs } from "./pairs";
import { fetchDoublesGroups, fetchDoublesGroupById } from "./groups";

const PAIRS = [
  { id: "p01", p1: { id: "d01", name: "Minh Quân" }, p2: { id: "d02", name: "Tân Sinh" } },
  { id: "p04", p1: { id: "d07", name: "Hoài Nam" }, p2: { id: "d08", name: "Phi Hùng" } },
];

describe("fetchDoublesGroups", () => {
  test("resolves entries IDs to 'p1name – p2name' labels", async () => {
    vi.mocked(fetchPairs).mockResolvedValue(PAIRS);
    const groups = [
      { id: "gA", name: "Bảng A", entries: ["p01", "p04"] },
    ];
    const chain = makeSupabaseChain({ data: groups, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const out = await fetchDoublesGroups();
    expect(out).toEqual([
      {
        id: "gA",
        name: "Bảng A",
        entries: [
          { id: "p01", label: "Minh Quân – Tân Sinh" },
          { id: "p04", label: "Hoài Nam – Phi Hùng" },
        ],
      },
    ]);
    expect(supabaseServer.from).toHaveBeenCalledWith("doubles_groups");
    expect(chain.order).toHaveBeenCalledWith("id");
  });

  test("returns '?' label when pair not in map", async () => {
    vi.mocked(fetchPairs).mockResolvedValue([]);
    const groups = [{ id: "gA", name: "Bảng A", entries: ["p99"] }];
    const chain = makeSupabaseChain({ data: groups, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const out = await fetchDoublesGroups();
    expect(out[0].entries).toEqual([{ id: "p99", label: "?" }]);
  });

  test("returns [] when groups data is null", async () => {
    vi.mocked(fetchPairs).mockResolvedValue([]);
    const chain = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchDoublesGroups()).toEqual([]);
  });

  test("throws on supabase error", async () => {
    vi.mocked(fetchPairs).mockResolvedValue([]);
    const chain = makeSupabaseChain({ data: null, error: { message: "boom" } });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    await expect(fetchDoublesGroups()).rejects.toThrow("boom");
  });
});

describe("fetchDoublesGroupById", () => {
  test("returns resolved group when found", async () => {
    vi.mocked(fetchPairs).mockResolvedValue(PAIRS);
    const chain = makeSupabaseChain({
      data: { id: "gA", name: "Bảng A", entries: ["p01"] },
      error: null,
    });
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "gA", name: "Bảng A", entries: ["p01"] },
      error: null,
    });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const out = await fetchDoublesGroupById("gA");
    expect(out).toEqual({
      id: "gA",
      name: "Bảng A",
      entries: [{ id: "p01", label: "Minh Quân – Tân Sinh" }],
    });
  });

  test("returns null when group not found", async () => {
    vi.mocked(fetchPairs).mockResolvedValue([]);
    const chain = makeSupabaseChain({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchDoublesGroupById("gZ")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/db/groups.test.ts`
Expected: FAIL — `Cannot find module './groups'`.

- [ ] **Step 3: Implement doubles helpers**

```ts
// src/lib/db/groups.ts
import { supabaseServer } from "@/lib/supabase/server";
import { fetchPairs } from "./pairs";
import type { GroupResolved } from "@/lib/schemas/group";

type GroupRow = { id: string; name: string; entries: string[] };

function buildPairLabelMap(
  pairs: Awaited<ReturnType<typeof fetchPairs>>,
): Map<string, string> {
  return new Map(
    pairs.map((p) => [p.id, `${p.p1.name} – ${p.p2.name}`]),
  );
}

function resolveDoublesEntries(
  entries: string[],
  map: Map<string, string>,
): GroupResolved["entries"] {
  return entries.map((id) => ({ id, label: map.get(id) ?? "?" }));
}

export async function fetchDoublesGroups(): Promise<GroupResolved[]> {
  const [groupsResp, pairs] = await Promise.all([
    supabaseServer
      .from("doubles_groups")
      .select("id, name, entries")
      .order("id"),
    fetchPairs(),
  ]);
  if (groupsResp.error) throw new Error(groupsResp.error.message);
  const map = buildPairLabelMap(pairs);
  return ((groupsResp.data ?? []) as GroupRow[]).map((g) => ({
    id: g.id,
    name: g.name,
    entries: resolveDoublesEntries(g.entries, map),
  }));
}

export async function fetchDoublesGroupById(
  id: string,
): Promise<GroupResolved | null> {
  const chain = supabaseServer
    .from("doubles_groups")
    .select("id, name, entries")
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: GroupRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (!data) return null;
  const pairs = await fetchPairs();
  const map = buildPairLabelMap(pairs);
  return {
    id: data.id,
    name: data.name,
    entries: resolveDoublesEntries(data.entries, map),
  };
}
```

- [ ] **Step 4: Run test — PASS**

Run: `npm test -- src/lib/db/groups.test.ts`
Expected: 6 tests passed (4 for fetchDoublesGroups, 2 for fetchDoublesGroupById).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/groups.ts src/lib/db/groups.test.ts
git commit -m "feat(db): add fetchDoublesGroups + fetchDoublesGroupById with label resolver"
```

---

### Task A3: fetchTeamGroups + fetchTeamGroupById

**Files:**
- Modify: `src/lib/db/groups.ts` (add team helpers)
- Modify: `src/lib/db/groups.test.ts` (add team tests)

- [ ] **Step 1: Add failing tests for teams**

Append to `src/lib/db/groups.test.ts` (below existing doubles tests, update imports ở đầu file):

```ts
// Update imports block at top of file:
// vi.mock("./teams", () => ({ fetchTeams: vi.fn() }));
// import { fetchTeams } from "./teams";
// import { fetchTeamGroups, fetchTeamGroupById } from "./groups";
```

Full imports block (replace existing vi.mock/import section):

```ts
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("./pairs", () => ({
  fetchPairs: vi.fn(),
}));

vi.mock("./teams", () => ({
  fetchTeams: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { fetchPairs } from "./pairs";
import { fetchTeams } from "./teams";
import {
  fetchDoublesGroups,
  fetchDoublesGroupById,
  fetchTeamGroups,
  fetchTeamGroupById,
} from "./groups";
```

Append team tests at end:

```ts
const TEAMS = [
  { id: "tA1", name: "Bình Tân 1", members: [{ id: "t01", name: "Quốc" }] },
  { id: "tA2", name: "Bình Tân 2", members: [] },
];

describe("fetchTeamGroups", () => {
  test("resolves entries IDs to team names", async () => {
    vi.mocked(fetchTeams).mockResolvedValue(TEAMS);
    const groups = [{ id: "gtA", name: "Bảng A", entries: ["tA1", "tA2"] }];
    const chain = makeSupabaseChain({ data: groups, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const out = await fetchTeamGroups();
    expect(out).toEqual([
      {
        id: "gtA",
        name: "Bảng A",
        entries: [
          { id: "tA1", label: "Bình Tân 1" },
          { id: "tA2", label: "Bình Tân 2" },
        ],
      },
    ]);
    expect(supabaseServer.from).toHaveBeenCalledWith("team_groups");
  });

  test("returns '?' label when team not in map", async () => {
    vi.mocked(fetchTeams).mockResolvedValue([]);
    const groups = [{ id: "gtA", name: "Bảng A", entries: ["tZ9"] }];
    const chain = makeSupabaseChain({ data: groups, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    const out = await fetchTeamGroups();
    expect(out[0].entries).toEqual([{ id: "tZ9", label: "?" }]);
  });

  test("throws on supabase error", async () => {
    vi.mocked(fetchTeams).mockResolvedValue([]);
    const chain = makeSupabaseChain({ data: null, error: { message: "boom" } });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    await expect(fetchTeamGroups()).rejects.toThrow("boom");
  });
});

describe("fetchTeamGroupById", () => {
  test("returns resolved team group when found", async () => {
    vi.mocked(fetchTeams).mockResolvedValue(TEAMS);
    const chain = makeSupabaseChain({
      data: { id: "gtA", name: "Bảng A", entries: ["tA1"] },
      error: null,
    });
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "gtA", name: "Bảng A", entries: ["tA1"] },
      error: null,
    });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    const out = await fetchTeamGroupById("gtA");
    expect(out).toEqual({
      id: "gtA",
      name: "Bảng A",
      entries: [{ id: "tA1", label: "Bình Tân 1" }],
    });
  });

  test("returns null when not found", async () => {
    vi.mocked(fetchTeams).mockResolvedValue([]);
    const chain = makeSupabaseChain({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchTeamGroupById("gtZ")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

Run: `npm test -- src/lib/db/groups.test.ts`
Expected: FAIL — `fetchTeamGroups is not a function`.

- [ ] **Step 3: Implement team helpers**

Append to `src/lib/db/groups.ts`:

```ts
import { fetchTeams } from "./teams";

function buildTeamLabelMap(
  teams: Awaited<ReturnType<typeof fetchTeams>>,
): Map<string, string> {
  return new Map(teams.map((t) => [t.id, t.name]));
}

function resolveTeamEntries(
  entries: string[],
  map: Map<string, string>,
): GroupResolved["entries"] {
  return entries.map((id) => ({ id, label: map.get(id) ?? "?" }));
}

export async function fetchTeamGroups(): Promise<GroupResolved[]> {
  const [groupsResp, teams] = await Promise.all([
    supabaseServer
      .from("team_groups")
      .select("id, name, entries")
      .order("id"),
    fetchTeams(),
  ]);
  if (groupsResp.error) throw new Error(groupsResp.error.message);
  const map = buildTeamLabelMap(teams);
  return ((groupsResp.data ?? []) as GroupRow[]).map((g) => ({
    id: g.id,
    name: g.name,
    entries: resolveTeamEntries(g.entries, map),
  }));
}

export async function fetchTeamGroupById(
  id: string,
): Promise<GroupResolved | null> {
  const chain = supabaseServer
    .from("team_groups")
    .select("id, name, entries")
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: GroupRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (!data) return null;
  const teams = await fetchTeams();
  const map = buildTeamLabelMap(teams);
  return {
    id: data.id,
    name: data.name,
    entries: resolveTeamEntries(data.entries, map),
  };
}
```

- [ ] **Step 4: Run test — PASS**

Run: `npm test -- src/lib/db/groups.test.ts`
Expected: 10 tests passed (6 doubles + 4 teams).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/groups.ts src/lib/db/groups.test.ts
git commit -m "feat(db): add fetchTeamGroups + fetchTeamGroupById with label resolver"
```

---

### Task A4: Checkpoint A verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all existing Phase 2-3 tests + new 16 tests pass.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Checkpoint note**

Commit tag (optional, no push):

```bash
git tag -a phase4-checkpoint-a -m "Phase 4 Checkpoint A — foundations complete"
```

**STOP — Review Checkpoint A before proceeding.** Schemas + helpers ready, zero UI impact.

---

## CHECKPOINT B — API routes (PATCH)

2 route handlers với `requireAdmin`, `IdSchema`, zod, `verifyEntriesExist`, `verifyCrossGroup`, resolved response.

### Task B1: Shared route helpers (doubles)

**Files:**
- Create: `src/app/api/doubles/groups/[id]/route.ts` (partial — helpers + skeleton PATCH)
- Create: `src/app/api/doubles/groups/[id]/route.test.ts`

- [ ] **Step 1: Write first batch of route tests (auth + basic validation)**

```ts
// src/app/api/doubles/groups/[id]/route.test.ts
import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/db/groups", () => ({
  fetchDoublesGroupById: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { cookies } from "next/headers";
import { fetchDoublesGroupById } from "@/lib/db/groups";
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
  return new Request("http://localhost/api/doubles/groups/gA", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/doubles/groups/[id]", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const res = await PATCH(patchReq({ entries: [] }), makeCtx("gA"));
    expect(res.status).toBe(401);
  });

  test("returns 400 when id malformed", async () => {
    mockAdminCookie();
    const res = await PATCH(patchReq({ entries: [] }), makeCtx("bad id!"));
    expect(res.status).toBe(400);
  });

  test("returns 400 when body shape invalid", async () => {
    mockAdminCookie();
    // Group exists → proceed to body validation
    const existChain = makeSupabaseChain({ data: { id: "gA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gA" }, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      existChain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    const res = await PATCH(patchReq({ entries: "not-array" }), makeCtx("gA"));
    expect(res.status).toBe(400);
  });

  test("returns 400 on duplicate entries", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gA" }, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      existChain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    const res = await PATCH(
      patchReq({ entries: ["p01", "p01"] }),
      makeCtx("gA"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/trùng/i);
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
    const res = await PATCH(patchReq({ entries: [] }), makeCtx("gZ"));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

Run: `npm test -- src/app/api/doubles/groups/\\[id\\]/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement route handler skeleton (auth + 400/404)**

```ts
// src/app/api/doubles/groups/[id]/route.ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchDoublesGroupById } from "@/lib/db/groups";
import { IdSchema } from "@/lib/schemas/id";
import { GroupEntriesPatchSchema } from "@/lib/schemas/group";
import { supabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

class ConflictError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ConflictError";
  }
}

async function groupExists(id: string): Promise<boolean> {
  const chain = supabaseServer
    .from("doubles_groups")
    .select("id")
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: { id: string } | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  return data !== null;
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    if (!(await groupExists(id))) return err("Bảng không tồn tại", 404);

    const body = await req.json();
    const parsed = GroupEntriesPatchSchema.parse(body);

    // B2: verify pairs exist
    // B3: verify cross-group
    // Final: update + fetch resolved

    const { error: updErr } = await supabaseServer
      .from("doubles_groups")
      .update({ entries: parsed.entries })
      .eq("id", id);
    if (updErr) return err(updErr.message);

    const resolved = await fetchDoublesGroupById(id);
    return ok(resolved);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    if (e instanceof BadRequestError) return err(e.message, 400);
    if (e instanceof ConflictError) return err(e.message, 409);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run test — PASS**

Run: `npm test -- src/app/api/doubles/groups/\\[id\\]/route.test.ts`
Expected: 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/groups/\[id\]/route.ts src/app/api/doubles/groups/\[id\]/route.test.ts
git commit -m "feat(api): PATCH /api/doubles/groups/[id] skeleton with auth + 400/404"
```

---

### Task B2: verifyPairsExist for doubles groups route

**Files:**
- Modify: `src/app/api/doubles/groups/[id]/route.ts`
- Modify: `src/app/api/doubles/groups/[id]/route.test.ts`

- [ ] **Step 1: Add failing test for pair-not-found**

Append to `route.test.ts`:

```ts
describe("PATCH verifies pair existence", () => {
  test("returns 400 when pair in entries not exist", async () => {
    mockAdminCookie();
    // 1st call: groupExists → returns {id}
    const existChain = makeSupabaseChain({ data: { id: "gA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gA" }, error: null });
    // 2nd call: verifyPairs → returns only p01
    const verifyChain = makeSupabaseChain({
      data: [{ id: "p01" }],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(existChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await PATCH(
      patchReq({ entries: ["p01", "p99"] }),
      makeCtx("gA"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/p99/);
    expect(body.error).toMatch(/không tồn tại/i);
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

Run: `npm test -- src/app/api/doubles/groups/\\[id\\]/route.test.ts`
Expected: FAIL — "expected 200, received 400" hoặc "p99 not in error" (since entries PATCH is blindly succeeding).

- [ ] **Step 3: Add verifyPairsExist + call it in PATCH**

Add helper after `groupExists`:

```ts
async function verifyPairsExist(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { data, error } = await supabaseServer
    .from("doubles_pairs")
    .select("id")
    .or(ids.map((id) => `id.eq.${id}`).join(","));
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r: { id: string }) => r.id));
  for (const id of ids) {
    if (!found.has(id))
      throw new BadRequestError(`Cặp không tồn tại: ${id}`);
  }
}
```

Update PATCH — thêm dòng gọi sau `const parsed = GroupEntriesPatchSchema.parse(body);`:

```ts
    const parsed = GroupEntriesPatchSchema.parse(body);
    await verifyPairsExist(parsed.entries);
    // B3: verify cross-group  ← next task
```

- [ ] **Step 4: Run test — PASS**

Run: `npm test -- src/app/api/doubles/groups/\\[id\\]/route.test.ts`
Expected: 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/groups/\[id\]/route.ts src/app/api/doubles/groups/\[id\]/route.test.ts
git commit -m "feat(api): verify pairs exist before update on doubles groups PATCH"
```

---

### Task B3: verifyCrossGroup for doubles groups route

**Files:**
- Modify: `src/app/api/doubles/groups/[id]/route.ts`
- Modify: `src/app/api/doubles/groups/[id]/route.test.ts`

- [ ] **Step 1: Add failing test for cross-group 409**

Append to `route.test.ts`:

```ts
describe("PATCH cross-group validation", () => {
  test("returns 409 when entry is in another group", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gA" }, error: null });
    const verifyChain = makeSupabaseChain({
      data: [{ id: "p01" }, { id: "p05" }],
      error: null,
    });
    const crossChain = makeSupabaseChain({
      data: [{ id: "gB", name: "Bảng B", entries: ["p05", "p08"] }],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(existChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(crossChain as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await PATCH(
      patchReq({ entries: ["p01", "p05"] }),
      makeCtx("gA"),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/p05/);
    expect(body.error).toMatch(/Bảng B/);
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

Run: `npm test -- src/app/api/doubles/groups/\\[id\\]/route.test.ts`
Expected: FAIL — "expected 409, received 200".

- [ ] **Step 3: Add verifyCrossGroup helper + call in PATCH**

Add helper after `verifyPairsExist`:

```ts
async function verifyCrossGroupDoubles(
  entries: string[],
  currentGroupId: string,
): Promise<void> {
  if (entries.length === 0) return;
  const { data, error } = await supabaseServer
    .from("doubles_groups")
    .select("id, name, entries")
    .neq("id", currentGroupId);
  if (error) throw new Error(error.message);
  const others = (data ?? []) as Array<{ id: string; name: string; entries: string[] }>;
  const entrySet = new Set(entries);
  for (const g of others) {
    for (const e of g.entries) {
      if (entrySet.has(e)) {
        throw new ConflictError(
          `Cặp ${e} đang ở ${g.name}, xóa khỏi đó trước`,
        );
      }
    }
  }
}
```

**Also add `.neq` to supabase-mock chain** if missing. Check `src/test/supabase-mock.ts` — ensure `chain.neq = vi.fn(chainable)` exists. If not, add it.

Check current mock file:

```bash
grep -n "chain.neq" src/test/supabase-mock.ts
```

If empty, add this line after `chain.eq = vi.fn(chainable);`:

```ts
// src/test/supabase-mock.ts (add line)
chain.neq = vi.fn(chainable);
```

Update PATCH body — thêm dòng sau `await verifyPairsExist(...)`:

```ts
    await verifyPairsExist(parsed.entries);
    await verifyCrossGroupDoubles(parsed.entries, id);

    const { error: updErr } = await supabaseServer
      ...
```

- [ ] **Step 4: Run test — PASS**

Run: `npm test -- src/app/api/doubles/groups/\\[id\\]/route.test.ts`
Expected: 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/groups/\[id\]/route.ts src/app/api/doubles/groups/\[id\]/route.test.ts src/test/supabase-mock.ts
git commit -m "feat(api): cross-group conflict check (409) on doubles groups PATCH"
```

---

### Task B4: Success path test for doubles PATCH

**Files:**
- Modify: `src/app/api/doubles/groups/[id]/route.test.ts`

- [ ] **Step 1: Add success path test**

Append to `route.test.ts`:

```ts
describe("PATCH success", () => {
  test("returns 200 with resolved group", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gA" }, error: null });
    const verifyChain = makeSupabaseChain({
      data: [{ id: "p01" }, { id: "p04" }],
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
      id: "gA",
      name: "Bảng A",
      entries: [
        { id: "p01", label: "Minh Quân – Tân Sinh" },
        { id: "p04", label: "Hoài Nam – Phi Hùng" },
      ],
    };
    vi.mocked(fetchDoublesGroupById).mockResolvedValue(resolved);

    const res = await PATCH(
      patchReq({ entries: ["p01", "p04"] }),
      makeCtx("gA"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: resolved, error: null });
  });

  test("returns 200 on empty entries", async () => {
    mockAdminCookie();
    const existChain = makeSupabaseChain({ data: { id: "gA" }, error: null });
    existChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "gA" }, error: null });
    const crossChain = makeSupabaseChain({ data: [], error: null });
    const updChain = makeSupabaseChain({ data: null, error: null });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(existChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(crossChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(updChain as unknown as ReturnType<typeof supabaseServer.from>);

    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [],
    });

    const res = await PATCH(patchReq({ entries: [] }), makeCtx("gA"));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test — PASS (implementation already covers success path)**

Run: `npm test -- src/app/api/doubles/groups/\\[id\\]/route.test.ts`
Expected: 9 tests passed.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/doubles/groups/\[id\]/route.test.ts
git commit -m "test(api): add success path tests for doubles groups PATCH"
```

---

### Task B5: Team groups PATCH route

**Files:**
- Create: `src/app/api/teams/groups/[id]/route.ts`
- Create: `src/app/api/teams/groups/[id]/route.test.ts`

- [ ] **Step 1: Copy doubles test → adapt for teams**

```ts
// src/app/api/teams/groups/[id]/route.test.ts
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
```

- [ ] **Step 2: Run test — verify FAIL**

Run: `npm test -- src/app/api/teams/groups/\\[id\\]/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement teams route (mirror doubles)**

```ts
// src/app/api/teams/groups/[id]/route.ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchTeamGroupById } from "@/lib/db/groups";
import { IdSchema } from "@/lib/schemas/id";
import { GroupEntriesPatchSchema } from "@/lib/schemas/group";
import { supabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

class ConflictError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ConflictError";
  }
}

async function groupExists(id: string): Promise<boolean> {
  const chain = supabaseServer
    .from("team_groups")
    .select("id")
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: { id: string } | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  return data !== null;
}

async function verifyTeamsExist(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { data, error } = await supabaseServer
    .from("teams")
    .select("id")
    .or(ids.map((id) => `id.eq.${id}`).join(","));
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r: { id: string }) => r.id));
  for (const id of ids) {
    if (!found.has(id))
      throw new BadRequestError(`Đội không tồn tại: ${id}`);
  }
}

async function verifyCrossGroupTeams(
  entries: string[],
  currentGroupId: string,
): Promise<void> {
  if (entries.length === 0) return;
  const { data, error } = await supabaseServer
    .from("team_groups")
    .select("id, name, entries")
    .neq("id", currentGroupId);
  if (error) throw new Error(error.message);
  const others = (data ?? []) as Array<{
    id: string;
    name: string;
    entries: string[];
  }>;
  const entrySet = new Set(entries);
  for (const g of others) {
    for (const e of g.entries) {
      if (entrySet.has(e)) {
        throw new ConflictError(
          `Đội ${e} đang ở ${g.name}, xóa khỏi đó trước`,
        );
      }
    }
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    if (!(await groupExists(id))) return err("Bảng không tồn tại", 404);

    const body = await req.json();
    const parsed = GroupEntriesPatchSchema.parse(body);
    await verifyTeamsExist(parsed.entries);
    await verifyCrossGroupTeams(parsed.entries, id);

    const { error: updErr } = await supabaseServer
      .from("team_groups")
      .update({ entries: parsed.entries })
      .eq("id", id);
    if (updErr) return err(updErr.message);

    const resolved = await fetchTeamGroupById(id);
    return ok(resolved);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    if (e instanceof BadRequestError) return err(e.message, 400);
    if (e instanceof ConflictError) return err(e.message, 409);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run test — PASS**

Run: `npm test -- src/app/api/teams/groups/\\[id\\]/route.test.ts`
Expected: 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/groups/\[id\]/route.ts src/app/api/teams/groups/\[id\]/route.test.ts
git commit -m "feat(api): PATCH /api/teams/groups/[id] with verify + cross-group"
```

---

### Task B6: Checkpoint B verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass (16 foundation + 16 new API tests = 32 new total).

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Tag checkpoint**

```bash
git tag -a phase4-checkpoint-b -m "Phase 4 Checkpoint B — API routes complete"
```

**STOP — Review Checkpoint B before proceeding.** API routes ready, tests pass.

---

## CHECKPOINT C — Admin UI

Extract `GroupsSection` ra file riêng với `GroupEntriesDialog`, optimistic + sonner + PATCH wire, update RSC fetch ở admin pages và skeleton.

### Task C1: Extract GroupsSection scaffold

**Files:**
- Create: `src/app/admin/_groups-section.tsx`
- Modify: `src/app/admin/_components.tsx`

- [ ] **Step 1: Read current GroupsSection trong `_components.tsx`**

Dùng Read tool xem `src/app/admin/_components.tsx:129-176` (GroupsSection + entries render). Copy content làm baseline.

- [ ] **Step 2: Create `_groups-section.tsx` với `GroupResolved` type**

```tsx
// src/app/admin/_groups-section.tsx
"use client";

import Link from "next/link";
import { ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GroupResolved } from "@/lib/schemas/group";
import type { PairWithNames } from "@/lib/schemas/pair";
import type { TeamWithNames } from "@/lib/schemas/team";
import { groupColor } from "../_groupColors";
import { SectionHeader } from "./_components";

export function GroupsSection({
  kind,
  groups,
  pairs,
  teams,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  pairs?: PairWithNames[];
  teams?: TeamWithNames[];
}) {
  const entryLabel = kind === "doubles" ? "cặp" : "đội";
  const base =
    kind === "doubles" ? "/admin/doubles/groups" : "/admin/teams/groups";

  return (
    <div>
      <SectionHeader
        title="Bảng đấu"
        subtitle={`${groups.length} bảng · bấm để xem lịch`}
      />
      <div className="flex flex-col gap-3">
        {groups.map((g) => {
          const c = groupColor(g.id);
          return (
            <Card key={g.id} className={`p-4 ${c.border} ${c.bg}`}>
              <div className="mb-3 flex items-center justify-between">
                <Link
                  href={`${base}/${g.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg font-semibold ${c.badge}`}
                  >
                    {g.name.replace(/^Bảng\s*/i, "")}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {g.entries.length} {entryLabel} · xem lịch vòng bảng
                    </div>
                  </div>
                  <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                </Link>
                <div className="ml-2 flex gap-0.5">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Sửa"
                    className="bg-muted hover:bg-muted/70"
                  >
                    <Pencil />
                  </Button>
                </div>
              </div>
              <ul className="space-y-1.5 text-sm">
                {g.entries.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-2">
                    <span className="inline-flex size-5 items-center justify-center rounded bg-muted text-sm text-muted-foreground">
                      {i + 1}
                    </span>
                    {e.label}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `_components.tsx` ContentWorkspace — gỡ inline GroupsSection, cập nhật type**

Trong `src/app/admin/_components.tsx`:

1. Gỡ inline `function GroupsSection(...)` (lines ~129-176)
2. Gỡ `Link`, `Card` usage nếu chỉ dùng bởi GroupsSection (check uses — Card còn dùng ở KnockoutSection, giữ)
3. Thêm `import { GroupsSection } from "./_groups-section";` ở đầu file
4. Đổi import type: `import type { GroupResolved } from "@/lib/schemas/group";` (thêm)
5. `ContentWorkspace` props: `groups: Group[]` → `groups: GroupResolved[]`
6. GroupsSection usage giữ `<GroupsSection kind={kind} groups={groups} pairs={pairs} teams={teams} />` (thêm pairs/teams props)
7. Gỡ import `Group` nếu không còn dùng trong `_components.tsx` nữa (check `DoublesSchedule`, `KnockoutSection` — they use different types; should be safe)
8. Gỡ import `ConfirmDeleteButton` nếu GroupsSection là consumer duy nhất; nhưng PlayersSection (trong `_players-section.tsx`) import từ `_components.tsx` nên giữ export.

Specific edits:

Find line `function GroupsSection({ kind, groups }: { kind: Content; groups: Group[] }) {` và gỡ toàn bộ function (~50 lines) đến closing `}`.

Replace import block:

```tsx
// Add at top imports:
import type { GroupResolved } from "@/lib/schemas/group";
import { GroupsSection } from "./_groups-section";
```

Update `ContentWorkspace` signature (around line 60-70):

```tsx
export function ContentWorkspace({
  kind,
  players,
  pairs,
  teams,
  groups,
  knockout,
  knockoutNote,
}: {
  kind: Content;
  players: Player[];
  pairs?: PairWithNames[];
  teams?: TeamWithNames[];
  groups: GroupResolved[];
  knockout: KnockoutMatch[];
  knockoutNote?: string;
}) {
```

Update JSX `<GroupsSection>` usage (around line 92):

```tsx
<TabsContent value="groups" className="mt-4">
  <GroupsSection kind={kind} groups={groups} pairs={pairs} teams={teams} />
</TabsContent>
```

- [ ] **Step 4: Tạm thời fix caller compile — admin/doubles/page.tsx + admin/teams/page.tsx**

RSC pages hiện pass `groups={MOCK_DOUBLES_GROUPS}` — type mismatch. Tạm pass `groups={[]}` placeholder để type check. Sẽ fix real ở Task C4.

Trong `src/app/admin/doubles/page.tsx`:

```tsx
// before
groups={MOCK_DOUBLES_GROUPS}

// after
groups={[]}
```

Same cho `src/app/admin/teams/page.tsx`:

```tsx
groups={[]}
```

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/_groups-section.tsx src/app/admin/_components.tsx src/app/admin/doubles/page.tsx src/app/admin/teams/page.tsx
git commit -m "refactor(admin): extract GroupsSection to new file with GroupResolved type"
```

---

### Task C2: GroupEntriesDialog component (UI only, no network)

**Files:**
- Modify: `src/app/admin/_groups-section.tsx`

- [ ] **Step 1: Append dialog scaffold tới `_groups-section.tsx`**

Append imports (near top):

```tsx
import { useState } from "react";
import { Check, Square } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
```

Append dialog component at end of file:

```tsx
type AllEntry = { id: string; label: string };

export function GroupEntriesDialog({
  group,
  kind,
  allEntries,
  otherGroups,
  onSubmit,
}: {
  group: GroupResolved;
  kind: "doubles" | "teams";
  allEntries: AllEntry[];
  otherGroups: GroupResolved[];
  onSubmit: (entries: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(group.entries.map((e) => e.id)),
  );

  const otherGroupMap = new Map<string, string>();
  for (const g of otherGroups) {
    if (g.id === group.id) continue;
    for (const e of g.entries) otherGroupMap.set(e.id, g.name);
  }

  const reset = () =>
    setSelected(new Set(group.entries.map((e) => e.id)));

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) reset();
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setPending(true);
    try {
      await onSubmit(Array.from(selected));
      setOpen(false);
    } catch {
      /* parent toasts, don't close */
    } finally {
      setPending(false);
    }
  };

  const entityLabel = kind === "doubles" ? "cặp" : "đội";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Sửa entries"
            className="bg-muted hover:bg-muted/70"
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa entries · {group.name}</DialogTitle>
          <DialogDescription>
            Chọn {entityLabel} thuộc {group.name}. {entityLabel} đang ở bảng
            khác phải xóa khỏi bảng đó trước.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <ul className="flex flex-col gap-1">
            {allEntries.map((e) => {
              const inOther = otherGroupMap.get(e.id);
              const isSelected = selected.has(e.id);
              const isDisabled = inOther !== undefined;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={isDisabled || pending}
                    onClick={() => toggle(e.id)}
                    className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                      isSelected
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-transparent hover:bg-muted"
                    } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {isSelected ? (
                      <Check className="size-4 text-emerald-600" />
                    ) : (
                      <Square className="size-4 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{e.label}</span>
                    {inOther && (
                      <Badge variant="secondary" className="shrink-0">
                        {inOther}
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" type="button" disabled={pending} />}
          >
            Huỷ
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_groups-section.tsx
git commit -m "feat(admin): add GroupEntriesDialog component (UI only)"
```

---

### Task C3: Wire PATCH to GroupsSection with optimistic

**Files:**
- Modify: `src/app/admin/_groups-section.tsx`

- [ ] **Step 1: Refactor GroupsSection — add useOptimistic + useTransition + PATCH wire**

Replace entire `GroupsSection` function with:

```tsx
export function GroupsSection({
  kind,
  groups,
  pairs,
  teams,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  pairs?: PairWithNames[];
  teams?: TeamWithNames[];
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(groups, reducer);
  const [, startTransition] = useTransition();

  const entryLabel = kind === "doubles" ? "cặp" : "đội";
  const base =
    kind === "doubles" ? "/admin/doubles/groups" : "/admin/teams/groups";
  const apiBase =
    kind === "doubles" ? "/api/doubles/groups" : "/api/teams/groups";

  const allEntries: AllEntry[] =
    kind === "doubles"
      ? (pairs ?? []).map((p) => ({
          id: p.id,
          label: `${p.p1.name} – ${p.p2.name}`,
        }))
      : (teams ?? []).map((t) => ({ id: t.id, label: t.name }));

  const handleSave = (groupId: string, entries: string[]) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        const labelMap = new Map(allEntries.map((a) => [a.id, a.label]));
        const nextEntries = entries.map((id) => ({
          id,
          label: labelMap.get(id) ?? "?",
        }));
        setOptimistic({ type: "updateEntries", id: groupId, entries: nextEntries });
        try {
          const res = await fetch(`${apiBase}/${groupId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ entries }),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Có lỗi");
          toast.success("Đã lưu");
          router.refresh();
          resolve();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Có lỗi";
          toast.error(msg, { duration: 6000 });
          reject(e);
        }
      });
    });

  return (
    <div>
      <SectionHeader
        title="Bảng đấu"
        subtitle={`${optimistic.length} bảng · bấm để xem lịch`}
      />
      <div className="flex flex-col gap-3">
        {optimistic.map((g) => {
          const c = groupColor(g.id);
          return (
            <Card key={g.id} className={`p-4 ${c.border} ${c.bg}`}>
              <div className="mb-3 flex items-center justify-between">
                <Link
                  href={`${base}/${g.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg font-semibold ${c.badge}`}
                  >
                    {g.name.replace(/^Bảng\s*/i, "")}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {g.entries.length} {entryLabel} · xem lịch vòng bảng
                    </div>
                  </div>
                  <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                </Link>
                <div className="ml-2 flex gap-0.5">
                  <GroupEntriesDialog
                    group={g}
                    kind={kind}
                    allEntries={allEntries}
                    otherGroups={optimistic}
                    onSubmit={(entries) => handleSave(g.id, entries)}
                  />
                </div>
              </div>
              <ul className="space-y-1.5 text-sm">
                {g.entries.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-2">
                    <span className="inline-flex size-5 items-center justify-center rounded bg-muted text-sm text-muted-foreground">
                      {i + 1}
                    </span>
                    {e.label}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

Add imports at top of file:

```tsx
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
```

Add reducer ngay trước `GroupsSection` function:

```tsx
type OptAction = {
  type: "updateEntries";
  id: string;
  entries: GroupResolved["entries"];
};

function reducer(
  state: GroupResolved[],
  action: OptAction,
): GroupResolved[] {
  switch (action.type) {
    case "updateEntries":
      return state.map((g) =>
        g.id === action.id ? { ...g, entries: action.entries } : g,
      );
  }
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_groups-section.tsx
git commit -m "feat(admin): wire GroupEntriesDialog PATCH with optimistic + sonner"
```

---

### Task C4: Admin pages RSC fetch groups

**Files:**
- Modify: `src/app/admin/doubles/page.tsx`
- Modify: `src/app/admin/teams/page.tsx`

- [ ] **Step 1: Update `admin/doubles/page.tsx`**

Replace content:

```tsx
// src/app/admin/doubles/page.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentWorkspace } from "../_components";
import { MOCK_DOUBLES_KO } from "../_mock";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchPairs } from "@/lib/db/pairs";
import { fetchDoublesGroups } from "@/lib/db/groups";
import type { Player } from "../_mock";

export const dynamic = "force-dynamic";

async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabaseServer
    .from("doubles_players")
    .select("id, name, phone, gender, club")
    .order("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone ?? "",
    gender: r.gender,
    club: r.club ?? "",
  }));
}

export default async function DoublesAdminPage() {
  const [players, pairs, groups] = await Promise.all([
    fetchPlayers(),
    fetchPairs(),
    fetchDoublesGroups(),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="flex items-center gap-2">
        <Button
          nativeButton={false}
          render={<Link href="/admin" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Nội dung Đôi</h1>
          <p className="text-sm text-muted-foreground">VĐV, cặp đôi và bảng đấu</p>
        </div>
      </header>

      <ContentWorkspace
        kind="doubles"
        players={players}
        pairs={pairs}
        groups={groups}
        knockout={MOCK_DOUBLES_KO}
      />
    </main>
  );
}
```

- [ ] **Step 2: Update `admin/teams/page.tsx`**

Replace content:

```tsx
// src/app/admin/teams/page.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentWorkspace } from "../_components";
import { MOCK_TEAM_KO, TEAM_FINAL_NOTE } from "../_mock";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchTeams } from "@/lib/db/teams";
import { fetchTeamGroups } from "@/lib/db/groups";
import type { Player } from "../_mock";

export const dynamic = "force-dynamic";

async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id, name, phone, gender, club")
    .order("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone ?? "",
    gender: r.gender,
    club: r.club ?? "",
  }));
}

export default async function TeamsAdminPage() {
  const [players, teams, groups] = await Promise.all([
    fetchPlayers(),
    fetchTeams(),
    fetchTeamGroups(),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="flex items-center gap-2">
        <Button
          nativeButton={false}
          render={<Link href="/admin" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Nội dung Đồng đội</h1>
          <p className="text-sm text-muted-foreground">VĐV, đội và bảng đấu</p>
        </div>
      </header>

      <ContentWorkspace
        kind="teams"
        players={players}
        teams={teams}
        groups={groups}
        knockout={MOCK_TEAM_KO}
        knockoutNote={TEAM_FINAL_NOTE}
      />
    </main>
  );
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/doubles/page.tsx src/app/admin/teams/page.tsx
git commit -m "feat(admin): fetch groups from DB in doubles/teams RSC pages"
```

---

### Task C5: Admin detail pages RSC fetch by id

**Files:**
- Modify: `src/app/admin/doubles/groups/[id]/page.tsx`
- Modify: `src/app/admin/teams/groups/[id]/page.tsx`

- [ ] **Step 1: Update `admin/doubles/groups/[id]/page.tsx`**

Replace content:

```tsx
// src/app/admin/doubles/groups/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoublesSchedule } from "../../../_components";
import { MOCK_DOUBLES_MATCHES } from "../../../_mock";
import { fetchDoublesGroupById } from "@/lib/db/groups";

export const dynamic = "force-dynamic";

export default async function DoublesGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await fetchDoublesGroupById(id);
  if (!group) notFound();

  const matches = MOCK_DOUBLES_MATCHES.filter((m) => m.groupId === id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="flex items-center gap-2">
        <Button
          nativeButton={false}
          render={<Link href="/admin/doubles" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">Nội dung Đôi · vòng bảng</p>
        </div>
      </header>

      <DoublesSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries.map((e) => e.label)}
        matches={matches}
      />
    </main>
  );
}
```

- [ ] **Step 2: Update `admin/teams/groups/[id]/page.tsx`**

Replace content (uses `TeamSchedule` component, not `TeamsSchedule`):

```tsx
// src/app/admin/teams/groups/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamSchedule } from "../../../_components";
import { MOCK_TEAM_MATCHES } from "../../../_mock";
import { fetchTeamGroupById } from "@/lib/db/groups";

export const dynamic = "force-dynamic";

export default async function TeamGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await fetchTeamGroupById(id);
  if (!group) notFound();

  const matches = MOCK_TEAM_MATCHES.filter((m) => m.groupId === id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="sticky top-0 z-20 -mx-4 -mt-4 flex items-center gap-2 bg-background px-4 pb-3 pt-4">
        <Button
          nativeButton={false}
          render={<Link href="/admin/teams?tab=groups" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">Nội dung Đồng đội · vòng bảng</p>
        </div>
      </header>

      <TeamSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries.map((e) => e.label)}
        matches={matches}
      />
    </main>
  );
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/doubles/groups/\[id\]/page.tsx src/app/admin/teams/groups/\[id\]/page.tsx
git commit -m "feat(admin): fetch group by id in detail RSC pages"
```

---

### Task C6: Skeleton loading extend

**Files:**
- Modify: `src/app/admin/doubles/loading.tsx`
- Modify: `src/app/admin/teams/loading.tsx`

- [ ] **Step 1: Check current teams/loading.tsx to mirror pattern**

```bash
cat src/app/admin/teams/loading.tsx
```

- [ ] **Step 2: Update `admin/doubles/loading.tsx` — add Groups tab placeholder**

Replace content (mirror existing players/pairs pattern, thêm group card rows):

```tsx
// src/app/admin/doubles/loading.tsx
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-md" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-44" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={`player-${i}`} className="flex flex-row items-center gap-3 p-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={`pair-${i}`} className="flex flex-row items-center gap-3 p-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={`group-${i}`} className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3.5 w-44" />
              </div>
              <Skeleton className="size-8 rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Update `admin/teams/loading.tsx` với group skeleton (2 bảng)**

Replace content:

```tsx
// src/app/admin/teams/loading.tsx
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-md" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-44" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={`player-${i}`} className="flex flex-row items-center gap-3 p-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={`team-${i}`} className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={`group-${i}`} className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3.5 w-44" />
              </div>
              <Skeleton className="size-8 rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/doubles/loading.tsx src/app/admin/teams/loading.tsx
git commit -m "feat(admin): extend skeleton loading with Groups tab placeholder"
```

---

### Task C7: Checkpoint C verification

- [ ] **Step 1: Run test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Manual smoke test (admin flow)**

```bash
npm run dev
```

Steps:
1. Open http://localhost:3000/admin/login → password `123456`
2. Navigate `/admin/doubles` → tab "Bảng" → check 4 group cards render với entries từ DB
3. Click pencil on Bảng A → dialog mở, thấy toàn bộ 18 pairs với checkboxes
4. Pair của Bảng B phải disabled + badge "Bảng B"
5. Toggle 1 pair hiện có in Bảng A → Save → toast "Đã lưu" → refresh → persist
6. Mở lại Bảng A → verify checkbox state
7. Mở Bảng B → cố toggle 1 pair của Bảng A (bây giờ đã disabled cross-group) → không click được
8. `/admin/teams` → tab "Bảng" → 2 bảng gtA/gtB, edit entries → OK

- [ ] **Step 4: Tag checkpoint**

```bash
git tag -a phase4-checkpoint-c -m "Phase 4 Checkpoint C — admin UI complete"
```

**STOP — Review Checkpoint C before proceeding.** Admin UI hoạt động end-to-end.

---

## CHECKPOINT D — Public migration

Migrate `/d`, `/t`, detail pages sang RSC fetch. Update `_publicGroup.tsx` + `_home.ts getStandings`.

### Task D1: Public list pages RSC fetch

**Files:**
- Modify: `src/app/d/page.tsx`
- Modify: `src/app/t/page.tsx`
- Modify: `src/app/_ContentHome.tsx`
- Modify: `src/app/_publicGroup.tsx`
- Modify: `src/app/_home.ts`

- [ ] **Step 1: Update `src/app/_ContentHome.tsx` — accept groups prop**

Replace content:

```tsx
// src/app/_ContentHome.tsx
import Link from "next/link";
import { Shield, Swords, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GroupStageTabs } from "./_publicGroup";
import { PublicKnockoutSection } from "./_publicKnockout";
import {
  MOCK_DOUBLES_KO,
  MOCK_TEAM_KO,
  TEAM_FINAL_NOTE,
} from "./admin/_mock";
import type { GroupResolved } from "@/lib/schemas/group";

export function ContentHome({
  kind,
  groups,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
}) {
  const isDoubles = kind === "doubles";
  const ko = isDoubles ? MOCK_DOUBLES_KO : MOCK_TEAM_KO;

  const titleColor = isDoubles
    ? "text-blue-600 dark:text-blue-400"
    : "text-violet-600 dark:text-violet-400";
  const Icon = isDoubles ? Users : Shield;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Icon className={`size-5 ${titleColor}`} />
          <h1 className="text-xl font-semibold leading-tight">
            Nội dung {isDoubles ? "Đôi" : "Đồng đội"}
          </h1>
        </div>
        <Badge variant="secondary">Đang diễn ra</Badge>
      </header>

      <div className="border-l-2 border-emerald-500/50 pl-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          CLB Bóng Bàn Bình Tân
        </p>
        <p className="mt-0.5 text-sm leading-snug text-foreground/80">
          Giải Bóng Bàn Kỷ niệm 51 năm ngày thống nhất đất nước
        </p>
      </div>

      <Section
        icon={<Trophy className={`size-4 ${titleColor}`} />}
        title="Vòng bảng"
        subtitle="Chọn bảng để xem"
      >
        <GroupStageTabs kind={kind} groups={groups} />
      </Section>

      <Section
        icon={<Swords className="size-4 text-amber-500" />}
        title="Vòng loại trực tiếp"
        subtitle="Lịch & kết quả"
      >
        <PublicKnockoutSection
          kind={kind}
          matches={ko}
          note={isDoubles ? undefined : TEAM_FINAL_NOTE}
        />
      </Section>

      <footer className="mt-auto flex items-center justify-end pt-6 text-sm text-muted-foreground">
        <Link href="/admin/login" className="underline-offset-4 hover:underline">
          Admin
        </Link>
      </footer>
    </main>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-end justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Update `src/app/d/page.tsx`**

Replace content:

```tsx
// src/app/d/page.tsx
import { ContentHome } from "../_ContentHome";
import { fetchDoublesGroups } from "@/lib/db/groups";

export const dynamic = "force-dynamic";

export default async function DoublesPublicPage() {
  const groups = await fetchDoublesGroups();
  return <ContentHome kind="doubles" groups={groups} />;
}
```

- [ ] **Step 3: Update `src/app/t/page.tsx`**

Replace content:

```tsx
// src/app/t/page.tsx
import { ContentHome } from "../_ContentHome";
import { fetchTeamGroups } from "@/lib/db/groups";

export const dynamic = "force-dynamic";

export default async function TeamsPublicPage() {
  const groups = await fetchTeamGroups();
  return <ContentHome kind="teams" groups={groups} />;
}
```

- [ ] **Step 4: Update `src/app/_home.ts` getStandings signature**

Find `getStandings` function. Change signature để nhận `entries: string[]` arg. Replace function body:

```ts
// src/app/_home.ts (replace getStandings)
export function getStandings(
  kind: "doubles" | "teams",
  groupId: string,
  entries: string[],
): StandingRow[] {
  const isDoubles = kind === "doubles";
  const matches = isDoubles
    ? MOCK_DOUBLES_MATCHES.filter((m) => m.groupId === groupId)
    : MOCK_TEAM_MATCHES.filter((m) => m.groupId === groupId);
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [
      e,
      { entry: e, played: 0, won: 0, lost: 0, diff: 0, points: 0 },
    ]),
  );
  for (const m of matches) {
    if (m.status !== "done") continue;
    const a = isDoubles ? setsSummary((m as DoublesMatch).sets).a : (m as TeamMatch).scoreA;
    const b = isDoubles ? setsSummary((m as DoublesMatch).sets).b : (m as TeamMatch).scoreB;
    const sideA = isDoubles ? (m as DoublesMatch).pairA : (m as TeamMatch).teamA;
    const sideB = isDoubles ? (m as DoublesMatch).pairB : (m as TeamMatch).teamB;
    const ra = rows.get(sideA);
    const rb = rows.get(sideB);
    if (!ra || !rb) continue;
    ra.played += 1;
    rb.played += 1;
    ra.diff += a - b;
    rb.diff += b - a;
    if (a > b) {
      ra.won += 1;
      rb.lost += 1;
      ra.points += 2;
    } else if (b > a) {
      rb.won += 1;
      ra.lost += 1;
      rb.points += 2;
    }
  }
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.diff - x.diff || y.won - x.won,
  );
}
```

Gỡ luôn dòng lookup mock group trong getStandings (dòng tìm `MOCK_DOUBLES_GROUPS.find(...)` và `if (!group) return [];`). Caller responsibility bây giờ là pass entries.

- [ ] **Step 5: Update `src/app/_publicGroup.tsx` — accept groups prop + call getStandings với labels**

Replace imports block (bỏ `MOCK_DOUBLES_GROUPS`, `MOCK_TEAM_GROUPS`, `type Group` nếu `Group` type chỉ dùng trong file này; còn `MOCK_DOUBLES_MATCHES`, `MOCK_TEAM_MATCHES`, `TEAM_MATCH_TEMPLATE` giữ):

```tsx
import {
  MOCK_DOUBLES_MATCHES,
  MOCK_TEAM_MATCHES,
  TEAM_MATCH_TEMPLATE,
  type DoublesMatch,
  type IndividualMatch,
  type SetScore,
  type TeamMatch,
} from "./admin/_mock";
import type { GroupResolved } from "@/lib/schemas/group";
```

Update `GroupStageTabs` signature + internals:

```tsx
export function GroupStageTabs({
  kind,
  groups,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
}) {
  const entryLabel = kind === "doubles" ? "cặp" : "đội";
  const [active, setActive] = useState(groups[0]?.id ?? "");
  const activeGroup = groups.find((g) => g.id === active) ?? groups[0];

  if (!activeGroup) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        Chưa có bảng đấu.
      </div>
    );
  }

  return (
    <div>
      <div
        role="tablist"
        className="inline-flex w-full items-center gap-1 rounded-lg bg-muted p-1"
      >
        {groups.map((g) => {
          const c = groupColor(g.id);
          const isActive = g.id === active;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(g.id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium transition-all ${
                isActive ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
              style={{ touchAction: "manipulation" }}
            >
              <span
                className={`pointer-events-none flex size-5 items-center justify-center rounded text-xs font-semibold ${c.badge}`}
              >
                {g.name.replace(/^Bảng\s*/i, "")}
              </span>
              <span className="pointer-events-none hidden sm:inline">{g.name}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <GroupTabContent kind={kind} group={activeGroup} entryLabel={entryLabel} />
      </div>
    </div>
  );
}
```

Update `GroupTabContent` + inner standings/dialog to accept `GroupResolved`:

```tsx
function GroupTabContent({
  kind,
  group,
  entryLabel,
}: {
  kind: "doubles" | "teams";
  group: GroupResolved;
  entryLabel: string;
}) {
  const c = groupColor(group.id);
  const entryLabels = group.entries.map((e) => e.label);
  const standings = getStandings(kind, group.id, entryLabels);
  const played = standings.some((s) => s.played > 0);
  const top1 = standings[0];
  const top2 = standings[1];

  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-3 ${c.border} ${c.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`flex size-8 items-center justify-center rounded-lg font-semibold ${c.badge}`}>
            {group.name.replace(/^Bảng\s*/i, "")}
          </span>
          <span className="font-semibold">{group.name}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {group.entries.length} {entryLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <TopEntryCard
          rank={1}
          row={top1}
          empty={!played}
          tone="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
        />
        <TopEntryCard
          rank={2}
          row={top2}
          empty={!played}
          tone="bg-slate-400/20 text-slate-600 dark:text-slate-300"
        />
      </div>

      <div className="rounded-md bg-background/60 p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Danh sách {group.entries.length} {entryLabel}
        </div>
        <ol className="space-y-1 text-sm">
          {group.entries.map((e, i) => (
            <li key={e.id} className="flex items-center gap-2">
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                {i + 1}
              </span>
              <span className="truncate">{e.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <MatchesAccordion group={group} kind={kind} />
      <StandingsDialog group={group} kind={kind} entries={entryLabels} />
    </div>
  );
}
```

Update `StandingsDialog` signature to take `entries`:

```tsx
function StandingsDialog({
  group,
  kind,
  entries,
}: {
  group: GroupResolved;
  kind: "doubles" | "teams";
  entries: string[];
}) {
  const standings = getStandings(kind, group.id, entries);
  const diffLabel = kind === "doubles" ? "Hiệu số ván" : "Hiệu số trận cá nhân";
  // ... rest unchanged (use standings as before)
```

Update `MatchesAccordion` signature — nhận `group: GroupResolved` (chỉ dùng `group.id`, không dùng `group.entries` trong this function → just type swap):

```tsx
function MatchesAccordion({
  group,
  kind,
}: {
  group: GroupResolved;
  kind: "doubles" | "teams";
}) {
  // body unchanged (uses group.id only)
```

- [ ] **Step 6: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/d/page.tsx src/app/t/page.tsx src/app/_ContentHome.tsx src/app/_publicGroup.tsx src/app/_home.ts
git commit -m "feat(public): RSC fetch groups for /d /t, refactor getStandings signature"
```

---

### Task D2: Public detail pages RSC fetch

**Files:**
- Modify: `src/app/d/[id]/page.tsx`
- Modify: `src/app/t/[id]/page.tsx`

- [ ] **Step 1: Update `src/app/d/[id]/page.tsx`**

Replace content:

```tsx
// src/app/d/[id]/page.tsx
import { notFound } from "next/navigation";
import { PublicHeader } from "../../_public";
import { DoublesSchedule } from "../../admin/_components";
import { MOCK_DOUBLES_MATCHES } from "../../admin/_mock";
import { fetchDoublesGroupById } from "@/lib/db/groups";

export const dynamic = "force-dynamic";

export default async function PublicDoublesGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await fetchDoublesGroupById(id);
  if (!group) notFound();
  const matches = MOCK_DOUBLES_MATCHES.filter((m) => m.groupId === id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <PublicHeader title={group.name} subtitle="Nội dung Đôi · vòng bảng" backHref="/d" />
      <DoublesSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries.map((e) => e.label)}
        matches={matches}
        readOnly
      />
    </main>
  );
}
```

- [ ] **Step 2: Update `src/app/t/[id]/page.tsx`**

Replace content:

```tsx
// src/app/t/[id]/page.tsx
import { notFound } from "next/navigation";
import { PublicHeader } from "../../_public";
import { TeamSchedule } from "../../admin/_components";
import { MOCK_TEAM_MATCHES } from "../../admin/_mock";
import { fetchTeamGroupById } from "@/lib/db/groups";

export const dynamic = "force-dynamic";

export default async function PublicTeamGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await fetchTeamGroupById(id);
  if (!group) notFound();
  const matches = MOCK_TEAM_MATCHES.filter((m) => m.groupId === id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <PublicHeader title={group.name} subtitle="Nội dung Đồng đội · vòng bảng" backHref="/t" />
      <TeamSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries.map((e) => e.label)}
        matches={matches}
        readOnly
      />
    </main>
  );
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/d/\[id\]/page.tsx src/app/t/\[id\]/page.tsx
git commit -m "feat(public): RSC fetch group by id for detail pages"
```

---

### Task D3: Checkpoint D — Full test + smoke test

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Manual smoke test (end-to-end)**

```bash
npm run dev
```

Admin flow:
1. Login `/admin/login` password `123456`
2. `/admin/doubles` tab Bảng → 4 cards, entries labels hiển thị đúng
3. Edit Bảng A → toggle 1 pair → Save → toast + persist
4. Pair cross-group phải disabled + badge "Bảng X"
5. `/admin/teams` tab Bảng → 2 cards, flow tương tự
6. `/admin/doubles/groups/gA` → group name + entries + matches mock

Public flow:
7. `/d` → 4 tabs A-D, bấm vào từng bảng → entries hiển thị đúng labels
8. `/d/gA` → group name + `DoublesSchedule` với entries + matches mock
9. `/t` → 2 tabs gtA/gtB, flow tương tự
10. `/t/gtA` → team group + matches

Cross-group validation (UI check — direct API test already covered in B3/B5 unit tests):
11. `/admin/doubles` → Bảng A → Edit → pair ở Bảng B phải hiện disabled + badge "Bảng B" → không click được. Pass.

- [ ] **Step 4: Home page sanity check**

Open `/` → home page với feed + leaders. Đây là home page KHÔNG migrate, phải hoạt động nguyên vẹn với mock groups/matches. Verify không regression.

- [ ] **Step 5: Tag checkpoint + Phase 4 complete**

```bash
git tag -a phase4-checkpoint-d -m "Phase 4 Checkpoint D — public migration + smoke test complete"
git tag -a phase4-complete -m "Phase 4 complete: Groups API + public UI migration"
```

---

## Merge

- [ ] **Step 1: Rebase onto latest main**

```bash
git fetch origin
git rebase origin/main
```

Resolve conflicts if any.

- [ ] **Step 2: Squash merge PR or direct merge (theo Phase 2-3 precedent)**

Option A (PR flow):
```bash
git push -u origin feat/supabase-phase-4
# Create PR, squash merge via GitHub
```

Option B (direct squash, nếu solo mode):
```bash
git checkout main
git merge --squash feat/supabase-phase-4
git commit -m "feat: supabase integration phase 4 (groups API + public UI migration)

- PATCH-only admin CRUD for doubles_groups + team_groups (no POST/DELETE)
- Cross-group rejection (409) với detail pair/team ID + group name
- New GroupResolved type alongside mock Group (Phase 3 precedent)
- RSC migration of /d /t + detail pages to fetch from DB
- getStandings signature refactor: accept entries labels via arg
- Skeleton loading extend for Groups tab
- 32 new unit tests (schema + DB helpers + routes)
- Mock MOCK_*_GROUPS kept for home page / _home.ts internals (Phase 7 cleanup)"
git push origin main
git branch -D feat/supabase-phase-4
```

- [ ] **Step 3: Clean up tags (optional)**

```bash
# Nếu không muốn giữ checkpoint tags:
git tag -d phase4-checkpoint-a phase4-checkpoint-b phase4-checkpoint-c phase4-checkpoint-d
```

- [ ] **Step 4: Update checkpoint doc**

Save `/checkpoint` after merge với note: Phase 5 (Matches + Standings DB view + tiebreaker) là next.

---

## Summary of coverage vs spec

| Spec section | Implementation task |
|---|---|
| 1. Mục tiêu — PATCH entries, /d /t migration, matches mock | A1–D3 |
| 2. Decision #1 scope | A, D |
| 2. Decision #2 PATCH only | B1–B5 (không POST/DELETE route) |
| 2. Decision #3 cross-group reject + duplicate + exists | A1 (dupe zod), B2 (exists), B3 (cross-group) |
| 2. Decision #4 dialog + full-replace PATCH | C2, C3 |
| 2. Decision #5 RSC data flow | C4, D1, D2 |
| 2. Decision #6 {id, label} shape | A1 (type), A2/A3 (resolver) |
| 2. Decision #7 dual GroupResolved + mock Group | A1 (new type), D1 (_home.ts unchanged internals) |
| 2. Decision #8 no GET endpoints | (intentional skip) |
| 2. Decision #10 IdSchema | B1 (params), A1 (entries via IdSchema) |
| 4. API + zod | A1, B1–B5 |
| 5. Admin UI | C1–C6 |
| 6. Public UI migration | D1, D2 |
| 8. Testing | Every task TDD; D3 smoke |
| 9. Rollout A/B/C/D | Checkpoint tags A–D |
| 10. Non-goals | (none implemented) |
