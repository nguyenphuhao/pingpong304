# Phase 3: Pairs + Teams API + Admin UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay mock Pairs (doubles) + Teams bằng Supabase, thêm CRUD UI ở admin cho cả 2 entity (10 endpoints, mirror Phase 2 pattern).

**Architecture:** RSC fetch trực tiếp qua `supabaseServer` (với resolved name shape). Client CRUD qua Route Handler với `requireAdmin` + zod + `IdSchema` regex guard + FK pre-check (matches + groups.entries) → 409 detail. Picker UX dùng base-ui `<Select>` (no cmdk, no new dep) với disable-already-picked.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Supabase (`@supabase/supabase-js`), Zod 4, Vitest 4, `@base-ui/react` primitives, sonner toasts, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-04-16-phase-3-pairs-teams-api-design.md`

**Branch:** `feat/supabase-phase-3` (create from `main` ở step 0)

---

## Pre-flight

- [ ] **Step 0: Create branch**

```bash
git checkout main
git pull origin main 2>/dev/null || true
git checkout -b feat/supabase-phase-3
```

Expected: switched to new branch `feat/supabase-phase-3`.

---

## CHECKPOINT A — Foundations

Shared schemas, types, DB helpers. Zero UI impact. Cho phép test riêng lẻ trước khi làm endpoints.

### Task A1: Shared IdSchema

**Files:**
- Create: `src/lib/schemas/id.ts`
- Test: `src/lib/schemas/id.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/schemas/id.test.ts
import { describe, expect, test } from "vitest";
import { IdSchema } from "./id";

describe("IdSchema", () => {
  test("accepts seed-like ids", () => {
    for (const id of ["d01", "t36", "p18", "T01", "gA", "tA1", "tko-sf1", "dko_qf2"]) {
      expect(IdSchema.safeParse(id).success).toBe(true);
    }
  });

  test("rejects empty", () => {
    expect(IdSchema.safeParse("").success).toBe(false);
  });

  test("rejects sql-like payloads", () => {
    for (const id of ["a;b", "p01' OR '1'='1", "a.b", "a,b", "a b", "a/b", "../x"]) {
      expect(IdSchema.safeParse(id).success).toBe(false);
    }
  });

  test("rejects non-string", () => {
    expect(IdSchema.safeParse(123).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/schemas/id.test.ts`
Expected: FAIL — `Cannot find module './id'`.

- [ ] **Step 3: Implement IdSchema**

```ts
// src/lib/schemas/id.ts
import { z } from "zod";

export const IdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/, "ID không hợp lệ");
```

- [ ] **Step 4: Run test — PASS**

Run: `npm test -- src/lib/schemas/id.test.ts`
Expected: 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/id.ts src/lib/schemas/id.test.ts
git commit -m "feat(schemas): add shared IdSchema with regex guard"
```

---

### Task A2: Pair zod schemas + type

**Files:**
- Create: `src/lib/schemas/pair.ts`
- Test: `src/lib/schemas/pair.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/schemas/pair.test.ts
import { describe, expect, test } from "vitest";
import { PairInputSchema, PairPatchSchema } from "./pair";

describe("PairInputSchema", () => {
  test("accepts valid", () => {
    expect(PairInputSchema.safeParse({ p1: "d01", p2: "d02" }).success).toBe(true);
  });

  test("rejects p1=p2", () => {
    const r = PairInputSchema.safeParse({ p1: "d01", p2: "d01" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toContain("khác nhau");
      expect(r.error.issues[0].path).toEqual(["p2"]);
    }
  });

  test("rejects missing p1", () => {
    expect(PairInputSchema.safeParse({ p2: "d02" }).success).toBe(false);
  });

  test("rejects invalid id format", () => {
    expect(PairInputSchema.safeParse({ p1: "d 01", p2: "d02" }).success).toBe(false);
  });
});

describe("PairPatchSchema", () => {
  test("accepts empty patch", () => {
    expect(PairPatchSchema.safeParse({}).success).toBe(true);
  });

  test("accepts partial p1 only", () => {
    expect(PairPatchSchema.safeParse({ p1: "d03" }).success).toBe(true);
  });

  test("rejects p1=p2 when both set", () => {
    expect(PairPatchSchema.safeParse({ p1: "d01", p2: "d01" }).success).toBe(false);
  });

  test("accepts p1 only even if duplicates existing p2 (can't check without row)", () => {
    // refine only fires when both fields present
    expect(PairPatchSchema.safeParse({ p1: "d01" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — FAIL**

Run: `npm test -- src/lib/schemas/pair.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement pair schemas**

```ts
// src/lib/schemas/pair.ts
import { z } from "zod";
import { IdSchema } from "./id";

export const PairInputSchema = z
  .object({
    p1: IdSchema,
    p2: IdSchema,
  })
  .refine((d) => d.p1 !== d.p2, {
    message: "2 VĐV phải khác nhau",
    path: ["p2"],
  });

export const PairPatchSchema = z
  .object({
    p1: IdSchema.optional(),
    p2: IdSchema.optional(),
  })
  .refine((d) => !d.p1 || !d.p2 || d.p1 !== d.p2, {
    message: "2 VĐV phải khác nhau",
    path: ["p2"],
  });

export type PairInput = z.infer<typeof PairInputSchema>;
export type PairPatch = z.infer<typeof PairPatchSchema>;

export type PairWithNames = {
  id: string;
  p1: { id: string; name: string };
  p2: { id: string; name: string };
};
```

- [ ] **Step 4: Run test — PASS**

Run: `npm test -- src/lib/schemas/pair.test.ts`
Expected: 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/pair.ts src/lib/schemas/pair.test.ts
git commit -m "feat(schemas): add pair input/patch zod schemas and PairWithNames type"
```

---

### Task A3: Team zod schemas + type

**Files:**
- Create: `src/lib/schemas/team.ts`
- Test: `src/lib/schemas/team.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/schemas/team.test.ts
import { describe, expect, test } from "vitest";
import { TeamInputSchema, TeamPatchSchema } from "./team";

describe("TeamInputSchema", () => {
  test("accepts valid", () => {
    const r = TeamInputSchema.safeParse({
      name: "Đội A",
      members: ["t01", "t02", "t03"],
    });
    expect(r.success).toBe(true);
  });

  test("rejects empty name", () => {
    const r = TeamInputSchema.safeParse({
      name: "",
      members: ["t01", "t02", "t03"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects name over 60 chars", () => {
    const r = TeamInputSchema.safeParse({
      name: "x".repeat(61),
      members: ["t01", "t02", "t03"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects 2 members", () => {
    const r = TeamInputSchema.safeParse({
      name: "A",
      members: ["t01", "t02"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects 4 members", () => {
    const r = TeamInputSchema.safeParse({
      name: "A",
      members: ["t01", "t02", "t03", "t04"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects duplicate members", () => {
    const r = TeamInputSchema.safeParse({
      name: "A",
      members: ["t01", "t02", "t01"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects invalid id in members", () => {
    const r = TeamInputSchema.safeParse({
      name: "A",
      members: ["t 01", "t02", "t03"],
    });
    expect(r.success).toBe(false);
  });

  test("trims name", () => {
    const r = TeamInputSchema.safeParse({
      name: "  Đội A  ",
      members: ["t01", "t02", "t03"],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Đội A");
  });
});

describe("TeamPatchSchema", () => {
  test("accepts empty", () => {
    expect(TeamPatchSchema.safeParse({}).success).toBe(true);
  });

  test("accepts name only", () => {
    expect(TeamPatchSchema.safeParse({ name: "Mới" }).success).toBe(true);
  });

  test("accepts members only (valid)", () => {
    expect(
      TeamPatchSchema.safeParse({ members: ["t04", "t05", "t06"] }).success,
    ).toBe(true);
  });

  test("rejects partial members (length 2)", () => {
    expect(TeamPatchSchema.safeParse({ members: ["t01", "t02"] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/lib/schemas/team.test.ts`
Expected: FAIL module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/schemas/team.ts
import { z } from "zod";
import { IdSchema } from "./id";

const membersSchema = z
  .array(IdSchema)
  .length(3, "Đội phải có đúng 3 VĐV")
  .refine((arr) => new Set(arr).size === arr.length, {
    message: "VĐV không được trùng",
  });

export const TeamInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên đội không được để trống")
    .max(60, "Tên đội tối đa 60 ký tự"),
  members: membersSchema,
});

export const TeamPatchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên đội không được để trống")
    .max(60, "Tên đội tối đa 60 ký tự")
    .optional(),
  members: membersSchema.optional(),
});

export type TeamInput = z.infer<typeof TeamInputSchema>;
export type TeamPatch = z.infer<typeof TeamPatchSchema>;

export type TeamWithNames = {
  id: string;
  name: string;
  members: Array<{ id: string; name: string }>;
};
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/lib/schemas/team.test.ts`
Expected: 12 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/team.ts src/lib/schemas/team.test.ts
git commit -m "feat(schemas): add team input/patch zod schemas and TeamWithNames type"
```

---

### Task A4: Re-export new types from `src/lib/db/types.ts`

**Files:**
- Modify: `src/lib/db/types.ts`

- [ ] **Step 1: Update file**

```ts
// src/lib/db/types.ts
// Single source of truth for DB entity types.
// Legacy types (Content, Player, Pair, Team, Group, etc.) re-export from _mock
// (will be deleted in Phase 7). New DB-shape types live in src/lib/schemas/.
export type {
  Content,
  Player,
  Pair,
  Team,
  Group,
  SetScore,
  MatchStatus,
  DoublesMatch,
  IndividualMatch,
  TeamSlot,
  OppSlot,
  TeamLineup,
  KnockoutRound,
  KnockoutMatch,
  TeamMatch,
} from "@/app/admin/_mock";

export type { PairWithNames } from "@/lib/schemas/pair";
export type { TeamWithNames } from "@/lib/schemas/team";
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/types.ts
git commit -m "feat(types): re-export PairWithNames and TeamWithNames from db/types"
```

---

### Task A5: Shared `nextId()` helper

**Files:**
- Create: `src/lib/db/next-id.ts`
- Test: `src/lib/db/next-id.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/db/next-id.test.ts
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { nextId } from "./next-id";

function mockIds(ids: string[]) {
  const chain = makeSupabaseChain({
    data: ids.map((id) => ({ id })),
    error: null,
  });
  vi.mocked(supabaseServer.from).mockReturnValue(
    chain as unknown as ReturnType<typeof supabaseServer.from>,
  );
  return chain;
}

describe("nextId", () => {
  test("returns {prefix}01 when table empty", async () => {
    mockIds([]);
    expect(await nextId("doubles_pairs", "p", 2)).toBe("p01");
  });

  test("increments from max", async () => {
    mockIds(["p01", "p05", "p18"]);
    expect(await nextId("doubles_pairs", "p", 2)).toBe("p19");
  });

  test("pads below threshold, overflows above", async () => {
    mockIds(["p99"]);
    expect(await nextId("doubles_pairs", "p", 2)).toBe("p100");
  });

  test("ignores ids with non-numeric suffix", async () => {
    mockIds(["p01", "pXYZ", "p03"]);
    expect(await nextId("doubles_pairs", "p", 2)).toBe("p04");
  });

  test("uses prefix 'T' case-sensitive (does not match 'tA1')", async () => {
    // Caller passes "T" — LIKE should be 'T%', not match lowercase 't'.
    // Mock returns only rows that matched LIKE, so we simulate empty.
    const chain = mockIds([]);
    expect(await nextId("teams", "T", 2)).toBe("T01");
    expect(chain.like).toHaveBeenCalledWith("id", "T%");
  });

  test("throws on supabase error", async () => {
    const chain = makeSupabaseChain({ data: null, error: { message: "boom" } });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    await expect(nextId("doubles_pairs", "p", 2)).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/lib/db/next-id.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/db/next-id.ts
import { supabaseServer } from "@/lib/supabase/server";

export async function nextId(
  table: string,
  prefix: string,
  padLen: number,
): Promise<string> {
  const { data, error } = await supabaseServer
    .from(table)
    .select("id")
    .like("id", `${prefix}%`);
  if (error) throw new Error(error.message);
  const nums = (data ?? [])
    .map((r: { id: string }) => Number(r.id.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(padLen, "0")}`;
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/lib/db/next-id.test.ts`
Expected: 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/next-id.ts src/lib/db/next-id.test.ts
git commit -m "feat(db): add shared nextId helper for sequential ids with prefix"
```

---

### Task A6: `fetchPairs` / `fetchPairById` helpers

**Files:**
- Create: `src/lib/db/pairs.ts`
- Test: `src/lib/db/pairs.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/db/pairs.test.ts
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { fetchPairs, fetchPairById } from "./pairs";

describe("fetchPairs", () => {
  test("returns resolved shape", async () => {
    const rows = [
      { id: "p01", p1: { id: "d01", name: "A" }, p2: { id: "d02", name: "B" } },
    ];
    const chain = makeSupabaseChain({ data: rows, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const out = await fetchPairs();
    expect(out).toEqual(rows);
    expect(supabaseServer.from).toHaveBeenCalledWith("doubles_pairs");
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining("doubles_players"));
    expect(chain.order).toHaveBeenCalledWith("id");
  });

  test("returns [] when data is null", async () => {
    const chain = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchPairs()).toEqual([]);
  });

  test("throws on error", async () => {
    const chain = makeSupabaseChain({ data: null, error: { message: "boom" } });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    await expect(fetchPairs()).rejects.toThrow("boom");
  });
});

describe("fetchPairById", () => {
  test("returns pair when found", async () => {
    const row = { id: "p01", p1: { id: "d01", name: "A" }, p2: { id: "d02", name: "B" } };
    const chain = makeSupabaseChain({ data: row, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchPairById("p01")).toEqual(row);
  });

  test("returns null when not found", async () => {
    const chain = makeSupabaseChain({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchPairById("p99")).toBeNull();
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/lib/db/pairs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/db/pairs.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { PairWithNames } from "@/lib/schemas/pair";

const SELECT =
  "id, p1:doubles_players!p1(id,name), p2:doubles_players!p2(id,name)";

export async function fetchPairs(): Promise<PairWithNames[]> {
  const { data, error } = await supabaseServer
    .from("doubles_pairs")
    .select(SELECT)
    .order("id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown) as PairWithNames[];
}

export async function fetchPairById(id: string): Promise<PairWithNames | null> {
  const chain = supabaseServer.from("doubles_pairs").select(SELECT).eq("id", id);
  const maybeSingle = (chain as unknown as { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  return (data as PairWithNames | null) ?? null;
}
```

> **Note:** `maybeSingle` isn't on the mock chain by default. The test adds it explicitly. In runtime it's a real Supabase method; the `any`/`unknown` cast above avoids fighting the SDK types without loose typing leaking further.

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/lib/db/pairs.test.ts`
Expected: 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/pairs.ts src/lib/db/pairs.test.ts
git commit -m "feat(db): add fetchPairs and fetchPairById helpers with FK-joined shape"
```

---

### Task A7: `fetchTeams` / `fetchTeamById` helpers

**Files:**
- Create: `src/lib/db/teams.ts`
- Test: `src/lib/db/teams.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/db/teams.test.ts
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { fetchTeams, fetchTeamById } from "./teams";

describe("fetchTeams", () => {
  test("maps team + members to resolved names", async () => {
    // 1st from() → teams select; 2nd from() → team_players select (lookup map)
    const teams = [
      { id: "T01", name: "Đội 1", members: ["t01", "t02", "t03"] },
    ];
    const players = [
      { id: "t01", name: "An" },
      { id: "t02", name: "Bình" },
      { id: "t03", name: "Cường" },
    ];
    const teamsChain = makeSupabaseChain({ data: teams, error: null });
    const playersChain = makeSupabaseChain({ data: players, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamsChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);

    const out = await fetchTeams();
    expect(out).toEqual([
      {
        id: "T01",
        name: "Đội 1",
        members: [
          { id: "t01", name: "An" },
          { id: "t02", name: "Bình" },
          { id: "t03", name: "Cường" },
        ],
      },
    ]);
  });

  test("uses '?' placeholder when member id missing in players", async () => {
    const teams = [{ id: "T01", name: "A", members: ["t01", "t99", "t03"] }];
    const players = [{ id: "t01", name: "An" }, { id: "t03", name: "Cường" }];
    const teamsChain = makeSupabaseChain({ data: teams, error: null });
    const playersChain = makeSupabaseChain({ data: players, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamsChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);

    const out = await fetchTeams();
    expect(out[0].members[1]).toEqual({ id: "t99", name: "?" });
  });

  test("returns [] when no teams", async () => {
    const teamsChain = makeSupabaseChain({ data: [], error: null });
    const playersChain = makeSupabaseChain({ data: [], error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamsChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);
    expect(await fetchTeams()).toEqual([]);
  });

  test("throws on teams fetch error", async () => {
    const teamsChain = makeSupabaseChain({ data: null, error: { message: "teams boom" } });
    const playersChain = makeSupabaseChain({ data: [], error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamsChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);
    await expect(fetchTeams()).rejects.toThrow("teams boom");
  });
});

describe("fetchTeamById", () => {
  test("returns team with resolved names when found", async () => {
    const team = { id: "T01", name: "Đội 1", members: ["t01", "t02", "t03"] };
    const players = [
      { id: "t01", name: "An" },
      { id: "t02", name: "Bình" },
      { id: "t03", name: "Cường" },
    ];
    const teamChain = makeSupabaseChain({ data: team, error: null });
    teamChain.maybeSingle = vi.fn().mockResolvedValue({ data: team, error: null });
    const playersChain = makeSupabaseChain({ data: players, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(teamChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(playersChain as unknown as ReturnType<typeof supabaseServer.from>);

    const out = await fetchTeamById("T01");
    expect(out?.members).toHaveLength(3);
    expect(out?.members[0]).toEqual({ id: "t01", name: "An" });
  });

  test("returns null when not found", async () => {
    const teamChain = makeSupabaseChain({ data: null, error: null });
    teamChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(
      teamChain as unknown as ReturnType<typeof supabaseServer.from>,
    );
    expect(await fetchTeamById("T99")).toBeNull();
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/lib/db/teams.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/db/teams.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { TeamWithNames } from "@/lib/schemas/team";

async function playerMap(): Promise<Map<string, string>> {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id, name");
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
}

function resolveMembers(ids: string[], map: Map<string, string>) {
  return ids.map((id) => ({ id, name: map.get(id) ?? "?" }));
}

export async function fetchTeams(): Promise<TeamWithNames[]> {
  const { data: teams, error } = await supabaseServer
    .from("teams")
    .select("id, name, members")
    .order("id");
  if (error) throw new Error(error.message);
  const map = await playerMap();
  return ((teams ?? []) as { id: string; name: string; members: string[] }[]).map(
    (t) => ({
      id: t.id,
      name: t.name,
      members: resolveMembers(t.members, map),
    }),
  );
}

export async function fetchTeamById(id: string): Promise<TeamWithNames | null> {
  const chain = supabaseServer.from("teams").select("id, name, members").eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: { id: string; name: string; members: string[] } | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (!data) return null;
  const map = await playerMap();
  return { id: data.id, name: data.name, members: resolveMembers(data.members, map) };
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/lib/db/teams.test.ts`
Expected: 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/teams.ts src/lib/db/teams.test.ts
git commit -m "feat(db): add fetchTeams and fetchTeamById with 2-step lookup map"
```

---

### Task A8: Checkpoint A Gate

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all Phase 2 tests (48) + Phase 3 Foundation tests (~40) pass. Zero failures.

- [ ] **Step 2: Run typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. One pre-existing warning `Card` unused in `src/app/_ContentHome.tsx` is OK.

- [ ] **Step 3: STOP for user verify**

Tell user: "Checkpoint A xong (foundations: IdSchema + pair/team schemas + nextId + fetchPairs/fetchTeams). Chạy test/lint đều pass. Verify tests output rồi cho tôi proceed Checkpoint B (Pairs API)."

---

## CHECKPOINT B — Pairs API

5 endpoints `/api/doubles/pairs/*`. Mỗi endpoint là 1 task với full TDD cycle.

### Task B1: GET /api/doubles/pairs

**Files:**
- Create: `src/app/api/doubles/pairs/route.ts`
- Test: `src/app/api/doubles/pairs/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/doubles/pairs/route.test.ts
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
import { GET } from "./route";

function mockAdminCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ value: "ok", name: "pp_admin" }),
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
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/app/api/doubles/pairs/route.test.ts`
Expected: FAIL module not found.

- [ ] **Step 3: Implement GET**

```ts
// src/app/api/doubles/pairs/route.ts
import { err, ok } from "@/lib/api/response";
import { fetchPairs } from "@/lib/db/pairs";

export async function GET() {
  try {
    const data = await fetchPairs();
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/app/api/doubles/pairs/route.test.ts`
Expected: 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/pairs/route.ts src/app/api/doubles/pairs/route.test.ts
git commit -m "feat(api): GET /api/doubles/pairs returns resolved pairs"
```

---

### Task B2: POST /api/doubles/pairs

**Files:**
- Modify: `src/app/api/doubles/pairs/route.ts`
- Modify: `src/app/api/doubles/pairs/route.test.ts`

- [ ] **Step 1: Append failing tests**

Add to `route.test.ts` (after existing GET tests):

```ts
import { POST } from "./route";

function mockNoCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

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
    // First call: verify players exist → returns only d01 (d02 missing)
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
    // 1) verify players: return both d01, d02
    const verifyChain = makeSupabaseChain({
      data: [{ id: "d01" }, { id: "d02" }],
      error: null,
    });
    // 2) nextId: scan p% → return [p01]
    const scanChain = makeSupabaseChain({
      data: [{ id: "p01" }],
      error: null,
    });
    // 3) insert → return row
    const inserted = { id: "p02" };
    const insertChain = makeSupabaseChain({ data: inserted, error: null });
    insertChain.single = vi.fn().mockResolvedValue({ data: inserted, error: null });
    // 4) re-fetch with join
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
    // 1st insert fails
    const insertFail = makeSupabaseChain({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    insertFail.single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    // retry: scan + insert OK
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
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/app/api/doubles/pairs/route.test.ts`
Expected: FAIL — `POST` not exported.

- [ ] **Step 3: Implement POST**

Replace `route.ts` with:

```ts
// src/app/api/doubles/pairs/route.ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchPairById, fetchPairs } from "@/lib/db/pairs";
import { nextId } from "@/lib/db/next-id";
import { PairInputSchema, type PairInput } from "@/lib/schemas/pair";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const data = await fetchPairs();
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

async function verifyPlayersExist(ids: string[]): Promise<void> {
  const { data, error } = await supabaseServer
    .from("doubles_players")
    .select("id")
    .or(ids.map((id) => `id.eq.${id}`).join(","));
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r: { id: string }) => r.id));
  for (const id of ids) {
    if (!found.has(id)) throw new ZodLikeError(`VĐV không tồn tại: ${id}`);
  }
}

class ZodLikeError extends Error {
  status = 400;
  constructor(msg: string) {
    super(msg);
    this.name = "ZodLikeError";
  }
}

async function insertWithRetry(body: PairInput, attempt = 0): Promise<string> {
  if (attempt >= 3) throw new Error("Không sinh được id sau 3 lần thử");
  const id = await nextId("doubles_pairs", "p", 2);
  const { data, error } = await supabaseServer
    .from("doubles_pairs")
    .insert({ id, p1: body.p1, p2: body.p2 })
    .select()
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return insertWithRetry(body, attempt + 1);
    }
    throw new Error(error.message);
  }
  return (data as { id: string }).id;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = PairInputSchema.parse(body);
    await verifyPlayersExist([parsed.p1, parsed.p2]);
    const id = await insertWithRetry(parsed);
    const resolved = await fetchPairById(id);
    return ok(resolved, 201);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    if (e instanceof ZodLikeError) return err(e.message, 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/app/api/doubles/pairs/route.test.ts`
Expected: 7 tests passed (2 GET + 5 POST).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/pairs/route.ts src/app/api/doubles/pairs/route.test.ts
git commit -m "feat(api): POST /api/doubles/pairs with FK verify, nextId, retry"
```

---

### Task B3: GET /api/doubles/pairs/[id]

**Files:**
- Create: `src/app/api/doubles/pairs/[id]/route.ts`
- Test: `src/app/api/doubles/pairs/[id]/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/doubles/pairs/[id]/route.test.ts
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
import { GET } from "./route";

function mockAdminCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ value: "ok", name: "pp_admin" }),
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
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/app/api/doubles/pairs/[id]/route.test.ts`
Expected: FAIL module not found.

- [ ] **Step 3: Implement GET**

```ts
// src/app/api/doubles/pairs/[id]/route.ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { fetchPairById } from "@/lib/db/pairs";
import { IdSchema } from "@/lib/schemas/id";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    IdSchema.parse(id);
    const data = await fetchPairById(id);
    if (!data) return err("Not found", 404);
    return ok(data);
  } catch (e) {
    if (e instanceof z.ZodError) return err("ID không hợp lệ", 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/app/api/doubles/pairs/[id]/route.test.ts`
Expected: 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/pairs/[id]/route.ts src/app/api/doubles/pairs/[id]/route.test.ts
git commit -m "feat(api): GET /api/doubles/pairs/[id] with IdSchema guard"
```

---

### Task B4: PATCH /api/doubles/pairs/[id]

**Files:**
- Modify: `src/app/api/doubles/pairs/[id]/route.ts`
- Modify: `src/app/api/doubles/pairs/[id]/route.test.ts`

- [ ] **Step 1: Append failing tests**

Add to `[id]/route.test.ts`:

```ts
import { PATCH } from "./route";

function mockNoCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

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
    // verify FK
    const verifyChain = makeSupabaseChain({
      data: [{ id: "d03" }],
      error: null,
    });
    // update
    const updateChain = makeSupabaseChain({ data: { id: "p01" }, error: null });
    updateChain.single = vi.fn().mockResolvedValue({ data: { id: "p01" }, error: null });
    // re-fetch resolved
    const resolved = {
      id: "p01",
      p1: { id: "d03", name: "C" },
      p2: { id: "d02", name: "B" },
    };
    const reFetchChain = makeSupabaseChain({ data: resolved, error: null });
    reFetchChain.maybeSingle = vi.fn().mockResolvedValue({ data: resolved, error: null });

    vi.mocked(supabaseServer.from)
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

  test("returns 404 when update hits PGRST116", async () => {
    mockAdminCookie();
    const verifyChain = makeSupabaseChain({ data: [{ id: "d03" }], error: null });
    const updateChain = makeSupabaseChain({
      data: null,
      error: { code: "PGRST116", message: "not found" },
    });
    updateChain.single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "not found" },
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(verifyChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(updateChain as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/doubles/pairs/p99", {
      method: "PATCH",
      body: JSON.stringify({ p1: "d03" }),
    });
    const res = await PATCH(req, ctx("p99"));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/app/api/doubles/pairs/[id]/route.test.ts`
Expected: FAIL — PATCH not exported.

- [ ] **Step 3: Implement PATCH (extend existing route.ts)**

Replace file with:

```ts
// src/app/api/doubles/pairs/[id]/route.ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchPairById } from "@/lib/db/pairs";
import { IdSchema } from "@/lib/schemas/id";
import { PairPatchSchema } from "@/lib/schemas/pair";
import { supabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

async function verifyPlayersExist(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { data, error } = await supabaseServer
    .from("doubles_players")
    .select("id")
    .or(ids.map((id) => `id.eq.${id}`).join(","));
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r: { id: string }) => r.id));
  for (const id of ids) {
    if (!found.has(id)) throw new BadRequestError(`VĐV không tồn tại: ${id}`);
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    IdSchema.parse(id);
    const data = await fetchPairById(id);
    if (!data) return err("Not found", 404);
    return ok(data);
  } catch (e) {
    if (e instanceof z.ZodError) return err("ID không hợp lệ", 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);
    const body = await req.json();
    const parsed = PairPatchSchema.parse(body);

    const verifyIds: string[] = [];
    if (parsed.p1) verifyIds.push(parsed.p1);
    if (parsed.p2) verifyIds.push(parsed.p2);
    await verifyPlayersExist(verifyIds);

    const update: Record<string, unknown> = {};
    if (parsed.p1 !== undefined) update.p1 = parsed.p1;
    if (parsed.p2 !== undefined) update.p2 = parsed.p2;

    const { error } = await supabaseServer
      .from("doubles_pairs")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") return err("Not found", 404);
      return err(error.message);
    }
    const resolved = await fetchPairById(id);
    return ok(resolved);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    if (e instanceof BadRequestError) return err(e.message, 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/app/api/doubles/pairs/[id]/route.test.ts`
Expected: 8 tests passed (3 GET + 5 PATCH).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/pairs/[id]/route.ts src/app/api/doubles/pairs/[id]/route.test.ts
git commit -m "feat(api): PATCH /api/doubles/pairs/[id] with FK verify and IdSchema guard"
```

---

### Task B5: DELETE /api/doubles/pairs/[id]

**Files:**
- Modify: `src/app/api/doubles/pairs/[id]/route.ts`
- Modify: `src/app/api/doubles/pairs/[id]/route.test.ts`

- [ ] **Step 1: Append failing tests**

Add to `[id]/route.test.ts`:

```ts
import { DELETE } from "./route";

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
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/app/api/doubles/pairs/[id]/route.test.ts`
Expected: FAIL — DELETE not exported.

- [ ] **Step 3: Implement DELETE**

Append to existing `[id]/route.ts`:

```ts
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const { data: matches, error: mErr } = await supabaseServer
      .from("doubles_matches")
      .select("id")
      .or(`pair_a.eq.${id},pair_b.eq.${id}`);
    if (mErr) return err(mErr.message);

    const { data: groups, error: gErr } = await supabaseServer
      .from("doubles_groups")
      .select("id, name")
      .contains("entries", [id]);
    if (gErr) return err(gErr.message);

    const refs: string[] = [];
    if (matches && matches.length > 0) refs.push(`${matches.length} trận đấu`);
    if (groups && groups.length > 0) {
      const names = groups.map((g: { name: string }) => g.name).join(", ");
      refs.push(`bảng ${names}`);
    }
    if (refs.length > 0) {
      return err(
        `Cặp đang dùng trong ${refs.join(" và ")} — xoá các tham chiếu trước`,
        409,
      );
    }

    const { error } = await supabaseServer
      .from("doubles_pairs")
      .delete()
      .eq("id", id);
    if (error) return err(error.message);
    return ok(null);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) return err("ID không hợp lệ", 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/app/api/doubles/pairs/[id]/route.test.ts`
Expected: 14 tests passed (3 GET + 5 PATCH + 6 DELETE).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/pairs/[id]/route.ts src/app/api/doubles/pairs/[id]/route.test.ts
git commit -m "feat(api): DELETE /api/doubles/pairs/[id] with FK pre-check (matches + groups)"
```

---

### Task B6: Checkpoint B Gate

- [ ] **Step 1: Run full suite**

Run: `npm test`
Expected: all tests pass (A + B).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: STOP for user verify**

Tell user: "Checkpoint B xong (5 endpoints `/api/doubles/pairs/*`). Verify tests output rồi cho tôi proceed Checkpoint C (Teams API + fix Phase 2 IdSchema debt)."

---

## CHECKPOINT C — Teams API + Phase 2 debt

5 endpoints `/api/teams/teams/*` mirror pattern Pairs + fix Phase 2 DELETE handlers với `IdSchema` guard.

### Task C1: GET /api/teams/teams

**Files:**
- Create: `src/app/api/teams/teams/route.ts`
- Test: `src/app/api/teams/teams/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/teams/teams/route.test.ts
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
import { GET } from "./route";

function mockAdminCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ value: "ok", name: "pp_admin" }),
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
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/app/api/teams/teams/route.test.ts`
Expected: FAIL module not found.

- [ ] **Step 3: Implement GET**

```ts
// src/app/api/teams/teams/route.ts
import { err, ok } from "@/lib/api/response";
import { fetchTeams } from "@/lib/db/teams";

export async function GET() {
  try {
    const data = await fetchTeams();
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/app/api/teams/teams/route.test.ts`
Expected: 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/teams/route.ts src/app/api/teams/teams/route.test.ts
git commit -m "feat(api): GET /api/teams/teams returns resolved teams"
```

---

### Task C2: POST /api/teams/teams

**Files:**
- Modify: `src/app/api/teams/teams/route.ts`
- Modify: `src/app/api/teams/teams/route.test.ts`

- [ ] **Step 1: Append failing tests**

Add to `route.test.ts`:

```ts
import { POST } from "./route";

function mockNoCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

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
    // re-fetch by id: 1 team + 1 players map
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
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/app/api/teams/teams/route.test.ts`
Expected: FAIL — POST not exported.

- [ ] **Step 3: Implement POST**

Replace `route.ts` with:

```ts
// src/app/api/teams/teams/route.ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchTeamById, fetchTeams } from "@/lib/db/teams";
import { nextId } from "@/lib/db/next-id";
import { TeamInputSchema, type TeamInput } from "@/lib/schemas/team";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const data = await fetchTeams();
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

async function verifyPlayersExist(ids: string[]): Promise<void> {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id")
    .or(ids.map((id) => `id.eq.${id}`).join(","));
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r: { id: string }) => r.id));
  for (const id of ids) {
    if (!found.has(id)) throw new BadRequestError(`VĐV không tồn tại: ${id}`);
  }
}

async function insertWithRetry(body: TeamInput, attempt = 0): Promise<string> {
  if (attempt >= 3) throw new Error("Không sinh được id sau 3 lần thử");
  const id = await nextId("teams", "T", 2);
  const { data, error } = await supabaseServer
    .from("teams")
    .insert({ id, name: body.name, members: body.members })
    .select()
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return insertWithRetry(body, attempt + 1);
    }
    throw new Error(error.message);
  }
  return (data as { id: string }).id;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = TeamInputSchema.parse(body);
    await verifyPlayersExist(parsed.members);
    const id = await insertWithRetry(parsed);
    const resolved = await fetchTeamById(id);
    return ok(resolved, 201);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    if (e instanceof BadRequestError) return err(e.message, 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/app/api/teams/teams/route.test.ts`
Expected: 6 tests passed (2 GET + 4 POST).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/teams/route.ts src/app/api/teams/teams/route.test.ts
git commit -m "feat(api): POST /api/teams/teams with FK verify, nextId, retry"
```

---

### Task C3: GET /api/teams/teams/[id]

**Files:**
- Create: `src/app/api/teams/teams/[id]/route.ts`
- Test: `src/app/api/teams/teams/[id]/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/teams/teams/[id]/route.test.ts
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
import { GET } from "./route";

function mockAdminCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ value: "ok", name: "pp_admin" }),
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
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/app/api/teams/teams/[id]/route.test.ts`
Expected: FAIL module not found.

- [ ] **Step 3: Implement GET**

```ts
// src/app/api/teams/teams/[id]/route.ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { fetchTeamById } from "@/lib/db/teams";
import { IdSchema } from "@/lib/schemas/id";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    IdSchema.parse(id);
    const data = await fetchTeamById(id);
    if (!data) return err("Not found", 404);
    return ok(data);
  } catch (e) {
    if (e instanceof z.ZodError) return err("ID không hợp lệ", 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/app/api/teams/teams/[id]/route.test.ts`
Expected: 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/teams/[id]/route.ts src/app/api/teams/teams/[id]/route.test.ts
git commit -m "feat(api): GET /api/teams/teams/[id] with IdSchema guard"
```

---

### Task C4: PATCH /api/teams/teams/[id]

**Files:**
- Modify: `src/app/api/teams/teams/[id]/route.ts`
- Modify: `src/app/api/teams/teams/[id]/route.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import { PATCH } from "./route";

function mockNoCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

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
    // re-fetch
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
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/app/api/teams/teams/[id]/route.test.ts`
Expected: FAIL — PATCH not exported.

- [ ] **Step 3: Implement PATCH**

Replace `route.ts` with:

```ts
// src/app/api/teams/teams/[id]/route.ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchTeamById } from "@/lib/db/teams";
import { IdSchema } from "@/lib/schemas/id";
import { TeamPatchSchema } from "@/lib/schemas/team";
import { supabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

async function verifyPlayersExist(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id")
    .or(ids.map((id) => `id.eq.${id}`).join(","));
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r: { id: string }) => r.id));
  for (const id of ids) {
    if (!found.has(id)) throw new BadRequestError(`VĐV không tồn tại: ${id}`);
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    IdSchema.parse(id);
    const data = await fetchTeamById(id);
    if (!data) return err("Not found", 404);
    return ok(data);
  } catch (e) {
    if (e instanceof z.ZodError) return err("ID không hợp lệ", 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);
    const body = await req.json();
    const parsed = TeamPatchSchema.parse(body);

    if (parsed.members) await verifyPlayersExist(parsed.members);

    const update: Record<string, unknown> = {};
    if (parsed.name !== undefined) update.name = parsed.name;
    if (parsed.members !== undefined) update.members = parsed.members;

    const { error } = await supabaseServer
      .from("teams")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") return err("Not found", 404);
      return err(error.message);
    }
    const resolved = await fetchTeamById(id);
    return ok(resolved);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    if (e instanceof BadRequestError) return err(e.message, 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/app/api/teams/teams/[id]/route.test.ts`
Expected: 8 tests passed (3 GET + 5 PATCH).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/teams/[id]/route.ts src/app/api/teams/teams/[id]/route.test.ts
git commit -m "feat(api): PATCH /api/teams/teams/[id] with FK verify"
```

---

### Task C5: DELETE /api/teams/teams/[id]

**Files:**
- Modify: `src/app/api/teams/teams/[id]/route.ts`
- Modify: `src/app/api/teams/teams/[id]/route.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import { DELETE } from "./route";

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
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/app/api/teams/teams/[id]/route.test.ts`
Expected: FAIL — DELETE not exported.

- [ ] **Step 3: Implement DELETE**

Append to existing `route.ts`:

```ts
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const { data: matches, error: mErr } = await supabaseServer
      .from("team_matches")
      .select("id")
      .or(`team_a.eq.${id},team_b.eq.${id}`);
    if (mErr) return err(mErr.message);

    const { data: groups, error: gErr } = await supabaseServer
      .from("team_groups")
      .select("id, name")
      .contains("entries", [id]);
    if (gErr) return err(gErr.message);

    const refs: string[] = [];
    if (matches && matches.length > 0) refs.push(`${matches.length} trận đấu`);
    if (groups && groups.length > 0) {
      const names = groups.map((g: { name: string }) => g.name).join(", ");
      refs.push(`bảng ${names}`);
    }
    if (refs.length > 0) {
      return err(
        `Đội đang dùng trong ${refs.join(" và ")} — xoá các tham chiếu trước`,
        409,
      );
    }

    const { error } = await supabaseServer.from("teams").delete().eq("id", id);
    if (error) return err(error.message);
    return ok(null);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) return err("ID không hợp lệ", 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/app/api/teams/teams/[id]/route.test.ts`
Expected: 13 tests passed (3 GET + 5 PATCH + 5 DELETE).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/teams/[id]/route.ts src/app/api/teams/teams/[id]/route.test.ts
git commit -m "feat(api): DELETE /api/teams/teams/[id] with FK pre-check"
```

---

### Task C6: Fix Phase 2 IdSchema debt — doubles players DELETE

**Files:**
- Modify: `src/app/api/doubles/players/[id]/route.ts`
- Modify: `src/app/api/doubles/players/[id]/route.test.ts`

- [ ] **Step 1: Add failing test**

Append to existing `src/app/api/doubles/players/[id]/route.test.ts`:

```ts
describe("DELETE /api/doubles/players/[id] — id guard", () => {
  test("returns 400 on invalid id format", async () => {
    // Reuse existing mockAdminCookie helper from file
    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      { params: Promise.resolve({ id: "a;b" }) },
    );
    expect(res.status).toBe(400);
  });
});
```

> **Note:** the file already imports `DELETE` and `cookies` mock. If `mockAdminCookie()` isn't called immediately before this test (i.e., leftover state), prefix it.

- [ ] **Step 2: Run — FAIL**

Run: `npm test -- src/app/api/doubles/players/\\[id\\]/route.test.ts`
Expected: the new test fails (current handler doesn't validate id format; it would reach DB query).

- [ ] **Step 3: Apply IdSchema to all 3 handlers**

Replace the 3 handlers in `src/app/api/doubles/players/[id]/route.ts`. Add import + `IdSchema.parse(id)` after `await ctx.params;` in GET, PATCH, DELETE. Add `if (e instanceof z.ZodError) return err("ID không hợp lệ", 400);` to each catch (GET currently has no catch — wrap the body in try/catch). Final file:

```ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { IdSchema } from "@/lib/schemas/id";
import { PlayerPatchSchema } from "@/lib/schemas/player";
import { supabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    IdSchema.parse(id);
    const { data, error } = await supabaseServer
      .from("doubles_players")
      .select("id, name, phone, gender, club")
      .eq("id", id)
      .single();
    if (error) {
      if ((error as { code?: string }).code === "PGRST116") return err("Not found", 404);
      return err(error.message);
    }
    return ok(data);
  } catch (e) {
    if (e instanceof z.ZodError) return err("ID không hợp lệ", 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);
    const body = await req.json();
    const parsed = PlayerPatchSchema.parse(body);

    const update: Record<string, unknown> = {};
    if (parsed.name !== undefined) update.name = parsed.name;
    if (parsed.gender !== undefined) update.gender = parsed.gender;
    if (parsed.club !== undefined) update.club = parsed.club;
    if (parsed.phone !== undefined) {
      update.phone = parsed.phone && parsed.phone.length > 0 ? parsed.phone : null;
    }

    const { data, error } = await supabaseServer
      .from("doubles_players")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") return err("Not found", 404);
      return err(error.message);
    }
    return ok(data);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const { data: pairs, error: checkErr } = await supabaseServer
      .from("doubles_pairs")
      .select("id, p1, p2")
      .or(`p1.eq.${id},p2.eq.${id}`);
    if (checkErr) return err(checkErr.message);

    if (pairs && pairs.length > 0) {
      const labels = pairs.map((p: { id: string }) => p.id).join(", ");
      return err(
        `VĐV đang trong ${pairs.length} cặp: ${labels} — xoá cặp trước`,
        409,
      );
    }

    const { error } = await supabaseServer.from("doubles_players").delete().eq("id", id);
    if (error) return err(error.message);
    return ok(null);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) return err("ID không hợp lệ", 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test -- src/app/api/doubles/players/\\[id\\]/route.test.ts`
Expected: all existing tests + new test pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/players/[id]/route.ts src/app/api/doubles/players/[id]/route.test.ts
git commit -m "fix(api): apply IdSchema to doubles players [id] handlers (phase 2 debt)"
```

---

### Task C7: Fix Phase 2 IdSchema debt — teams players DELETE

**Files:**
- Modify: `src/app/api/teams/players/[id]/route.ts`
- Modify: `src/app/api/teams/players/[id]/route.test.ts`

- [ ] **Step 1: Read existing handler to mirror pattern**

Run: `cat src/app/api/teams/players/[id]/route.ts`
Expected: file exists with GET/PATCH/DELETE handlers for team_players. Structure should mirror doubles players [id]/route.ts.

- [ ] **Step 2: Add failing test**

Append to `src/app/api/teams/players/[id]/route.test.ts`:

```ts
describe("DELETE /api/teams/players/[id] — id guard", () => {
  test("returns 400 on invalid id format", async () => {
    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      { params: Promise.resolve({ id: "a;b" }) },
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run — FAIL**

Run: `npm test -- src/app/api/teams/players/\\[id\\]/route.test.ts`
Expected: new test fails.

- [ ] **Step 4: Apply IdSchema pattern to all 3 handlers**

Same edit as Task C6 but on `src/app/api/teams/players/[id]/route.ts`:
- Add `import { IdSchema } from "@/lib/schemas/id";`
- Wrap GET body in try/catch
- Add `IdSchema.parse(id);` after `const { id } = await ctx.params;` in all 3 handlers
- Add `if (e instanceof z.ZodError) return err("ID không hợp lệ", 400);` in all catches
- For DELETE, the pre-check query uses `teams.members @> ARRAY[id]` via `.contains('members', [id])` — keep existing logic, just add guard

The structure is otherwise identical to C6. Mirror the same code shape.

- [ ] **Step 5: Run — PASS**

Run: `npm test -- src/app/api/teams/players/\\[id\\]/route.test.ts`
Expected: all existing + new test pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/teams/players/[id]/route.ts src/app/api/teams/players/[id]/route.test.ts
git commit -m "fix(api): apply IdSchema to teams players [id] handlers (phase 2 debt)"
```

---

### Task C8: Checkpoint C Gate

- [ ] **Step 1: Run full suite**

Run: `npm test`
Expected: all tests pass (A + B + C, ~120 tests total).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: STOP for user verify**

Tell user: "Checkpoint C xong (5 endpoints `/api/teams/teams/*` + fix Phase 2 IdSchema debt). Verify test output rồi cho tôi proceed Checkpoint D (UI + wiring)."

---

## CHECKPOINT D — UI + Wiring

Extract PairsSection + TeamsSection thành file riêng, wire ContentWorkspace props split, update admin pages, skeleton, smoke verify manual.

### Task D1: Extract PairsSection + PairFormDialog

**Files:**
- Create: `src/app/admin/_pairs-section.tsx`

- [ ] **Step 1: Write full component**

```tsx
// src/app/admin/_pairs-section.tsx
"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Player } from "./_mock";
import type { PairWithNames } from "@/lib/schemas/pair";
import { PairInputSchema, type PairInput } from "@/lib/schemas/pair";
import { ConfirmDeleteButton, SectionHeader } from "./_components";

type OptAction =
  | { type: "add"; pair: PairWithNames }
  | { type: "update"; id: string; patch: Partial<PairWithNames> }
  | { type: "remove"; id: string };

function reducer(state: PairWithNames[], action: OptAction): PairWithNames[] {
  switch (action.type) {
    case "add":
      return [...state, action.pair];
    case "update":
      return state.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p));
    case "remove":
      return state.filter((p) => p.id !== action.id);
  }
}

const GHOST_ID = "__pending__";
const API_BASE = "/api/doubles/pairs";

export function PairsSection({
  pairs,
  players,
}: {
  pairs: PairWithNames[];
  players: Player[];
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(pairs, reducer);
  const [, startTransition] = useTransition();

  const lookup = (id: string) =>
    players.find((p) => p.id === id)?.name ?? id;

  const handleCreate = (input: PairInput) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        const ghost: PairWithNames = {
          id: GHOST_ID,
          p1: { id: input.p1, name: lookup(input.p1) },
          p2: { id: input.p2, name: lookup(input.p2) },
        };
        setOptimistic({ type: "add", pair: ghost });
        try {
          const res = await fetch(API_BASE, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Có lỗi");
          toast.success(`Đã thêm cặp ${ghost.p1.name} / ${ghost.p2.name}`);
          router.refresh();
          resolve();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Có lỗi";
          toast.error(msg, { duration: 6000 });
          reject(e);
        }
      });
    });

  const handleUpdate = (id: string, input: PairInput) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        setOptimistic({
          type: "update",
          id,
          patch: {
            p1: { id: input.p1, name: lookup(input.p1) },
            p2: { id: input.p2, name: lookup(input.p2) },
          },
        });
        try {
          const res = await fetch(`${API_BASE}/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
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

  const handleDelete = (id: string) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        setOptimistic({ type: "remove", id });
        try {
          const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Có lỗi");
          toast.success("Đã xoá cặp");
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
        title="Danh sách cặp đôi"
        subtitle={`${optimistic.length} cặp đã ghép`}
        action={<PairFormDialog mode="create" players={players} onSubmitCreate={handleCreate} />}
      />
      <div className="flex flex-col gap-2">
        {optimistic.length === 0 && (
          <Card className="p-4 text-center text-sm text-muted-foreground">
            Chưa có cặp đôi. Bấm <strong>Thêm</strong> để tạo cặp đầu tiên.
          </Card>
        )}
        {optimistic.map((pair, i) => {
          const isGhost = pair.id === GHOST_ID;
          return (
            <Card
              key={`${pair.id}-${i}`}
              className={`flex flex-row items-center gap-3 p-3 ${isGhost ? "opacity-60" : ""}`}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {pair.p1.name} <span className="text-muted-foreground">/</span> {pair.p2.name}
                  {isGhost && (
                    <Loader2 className="ml-1.5 inline size-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Mã cặp · {pair.id.toUpperCase()}
                </div>
              </div>
              {!isGhost && (
                <div className="flex shrink-0 gap-0.5">
                  <PairFormDialog
                    mode="edit"
                    pair={pair}
                    players={players}
                    onSubmitUpdate={handleUpdate}
                  />
                  <ConfirmDeleteButton
                    label={`cặp "${pair.p1.name} / ${pair.p2.name}"`}
                    onConfirm={() => handleDelete(pair.id)}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function PairFormDialog({
  mode,
  pair,
  players,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  mode: "create" | "edit";
  pair?: PairWithNames;
  players: Player[];
  onSubmitCreate?: (input: PairInput) => Promise<void>;
  onSubmitUpdate?: (id: string, input: PairInput) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [p1, setP1] = useState(pair?.p1.id ?? "");
  const [p2, setP2] = useState(pair?.p2.id ?? "");

  const reset = () => {
    setP1(pair?.p1.id ?? "");
    setP2(pair?.p2.id ?? "");
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) reset();
  };

  const handleSubmit = async () => {
    const parsed = PairInputSchema.safeParse({ p1, p2 });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(`${first.path.join(".")}: ${first.message}`);
      return;
    }
    setPending(true);
    try {
      if (mode === "create" && onSubmitCreate) {
        await onSubmitCreate(parsed.data);
      } else if (mode === "edit" && pair && onSubmitUpdate) {
        await onSubmitUpdate(pair.id, parsed.data);
      }
      setOpen(false);
      reset();
    } catch {
      /* handler toasted */
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button size="sm">
              <Plus /> Thêm
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Sửa"
              className="bg-muted hover:bg-muted/70"
            />
          )
        }
      >
        {mode === "edit" ? <Pencil /> : null}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Thêm cặp đôi" : "Sửa cặp đôi"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Chọn 2 VĐV để ghép cặp." : "Đổi VĐV trong cặp."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="p1">VĐV 1</Label>
            <Select value={p1} onValueChange={setP1} disabled={pending}>
              <SelectTrigger id="p1" className="w-full">
                <SelectValue placeholder="Chọn VĐV" />
              </SelectTrigger>
              <SelectContent>
                {players.map((pl) => (
                  <SelectItem key={pl.id} value={pl.id} disabled={pl.id === p2}>
                    {pl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p2">VĐV 2</Label>
            <Select value={p2} onValueChange={setP2} disabled={pending}>
              <SelectTrigger id="p2" className="w-full">
                <SelectValue placeholder="Chọn VĐV" />
              </SelectTrigger>
              <SelectContent>
                {players.map((pl) => (
                  <SelectItem key={pl.id} value={pl.id} disabled={pl.id === p1}>
                    {pl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" disabled={pending} />}>
            Huỷ
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "Thêm" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_pairs-section.tsx
git commit -m "feat(admin): extract PairsSection + PairFormDialog with optimistic CRUD"
```

---

### Task D2: Extract TeamsSection + TeamFormDialog

**Files:**
- Create: `src/app/admin/_teams-section.tsx`

- [ ] **Step 1: Write full component**

```tsx
// src/app/admin/_teams-section.tsx
"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Player } from "./_mock";
import type { TeamWithNames } from "@/lib/schemas/team";
import { TeamInputSchema, type TeamInput } from "@/lib/schemas/team";
import { ConfirmDeleteButton, SectionHeader, teamColor } from "./_components";

type OptAction =
  | { type: "add"; team: TeamWithNames }
  | { type: "update"; id: string; patch: Partial<TeamWithNames> }
  | { type: "remove"; id: string };

function reducer(state: TeamWithNames[], action: OptAction): TeamWithNames[] {
  switch (action.type) {
    case "add":
      return [...state, action.team];
    case "update":
      return state.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t));
    case "remove":
      return state.filter((t) => t.id !== action.id);
  }
}

const GHOST_ID = "__pending__";
const API_BASE = "/api/teams/teams";

export function TeamsSection({
  teams,
  players,
}: {
  teams: TeamWithNames[];
  players: Player[];
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(teams, reducer);
  const [, startTransition] = useTransition();

  const lookup = (id: string) =>
    players.find((p) => p.id === id)?.name ?? id;

  const handleCreate = (input: TeamInput) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        const ghost: TeamWithNames = {
          id: GHOST_ID,
          name: input.name,
          members: input.members.map((id) => ({ id, name: lookup(id) })),
        };
        setOptimistic({ type: "add", team: ghost });
        try {
          const res = await fetch(API_BASE, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Có lỗi");
          toast.success(`Đã thêm đội ${input.name}`);
          router.refresh();
          resolve();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Có lỗi";
          toast.error(msg, { duration: 6000 });
          reject(e);
        }
      });
    });

  const handleUpdate = (id: string, input: TeamInput) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        setOptimistic({
          type: "update",
          id,
          patch: {
            name: input.name,
            members: input.members.map((mid) => ({ id: mid, name: lookup(mid) })),
          },
        });
        try {
          const res = await fetch(`${API_BASE}/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
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

  const handleDelete = (id: string) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        setOptimistic({ type: "remove", id });
        try {
          const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Có lỗi");
          const target = teams.find((t) => t.id === id);
          toast.success(`Đã xoá ${target?.name ?? "đội"}`);
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
        title="Danh sách đội"
        subtitle={`${optimistic.length} đội đã đăng ký`}
        action={<TeamFormDialog mode="create" players={players} onSubmitCreate={handleCreate} />}
      />
      <div className="flex flex-col gap-3">
        {optimistic.length === 0 && (
          <Card className="p-4 text-center text-sm text-muted-foreground">
            Chưa có đội. Bấm <strong>Thêm</strong> để tạo đội đầu tiên.
          </Card>
        )}
        {optimistic.map((team, i) => {
          const isGhost = team.id === GHOST_ID;
          const c = teamColor(i);
          return (
            <Card
              key={`${team.id}-${i}`}
              className={`p-4 ${c.border} ${c.bg} ${isGhost ? "opacity-60" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`flex size-7 items-center justify-center rounded-md ${c.badge}`}>
                    <Users className="size-3.5" />
                  </span>
                  <span className="font-medium">{team.name}</span>
                  {isGhost && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{team.members.length} VĐV</Badge>
                  {!isGhost && (
                    <div className="flex gap-0.5">
                      <TeamFormDialog
                        mode="edit"
                        team={team}
                        players={players}
                        onSubmitUpdate={handleUpdate}
                      />
                      <ConfirmDeleteButton
                        label={`đội "${team.name}"`}
                        onConfirm={() => handleDelete(team.id)}
                      />
                    </div>
                  )}
                </div>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {team.members.map((m) => (
                  <li key={m.id}>• {m.name}</li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function TeamFormDialog({
  mode,
  team,
  players,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  mode: "create" | "edit";
  team?: TeamWithNames;
  players: Player[];
  onSubmitCreate?: (input: TeamInput) => Promise<void>;
  onSubmitUpdate?: (id: string, input: TeamInput) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(team?.name ?? "");
  const [members, setMembers] = useState<string[]>(
    team?.members.map((m) => m.id) ?? ["", "", ""],
  );

  const reset = () => {
    setName(team?.name ?? "");
    setMembers(team?.members.map((m) => m.id) ?? ["", "", ""]);
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) reset();
  };

  const setMember = (i: number, v: string) =>
    setMembers((prev) => prev.map((m, j) => (j === i ? v : m)));

  const handleSubmit = async () => {
    const parsed = TeamInputSchema.safeParse({ name, members });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(`${first.path.join(".")}: ${first.message}`);
      return;
    }
    setPending(true);
    try {
      if (mode === "create" && onSubmitCreate) {
        await onSubmitCreate(parsed.data);
      } else if (mode === "edit" && team && onSubmitUpdate) {
        await onSubmitUpdate(team.id, parsed.data);
      }
      setOpen(false);
      reset();
    } catch {
      /* toasted */
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button size="sm">
              <Plus /> Thêm
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Sửa"
              className="bg-muted hover:bg-muted/70"
            />
          )
        }
      >
        {mode === "edit" ? <Pencil /> : null}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Thêm đội" : "Sửa đội"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Nhập tên và 3 VĐV của đội." : "Đổi tên hoặc thành viên."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="team-name">Tên đội</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Đội A"
              disabled={pending}
            />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid gap-1.5">
              <Label htmlFor={`m${i}`}>{`VĐV ${i + 1}`}</Label>
              <Select
                value={members[i]}
                onValueChange={(v) => setMember(i, v)}
                disabled={pending}
              >
                <SelectTrigger id={`m${i}`} className="w-full">
                  <SelectValue placeholder="Chọn VĐV" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((pl) => (
                    <SelectItem
                      key={pl.id}
                      value={pl.id}
                      disabled={members.some((m, j) => m === pl.id && j !== i)}
                    >
                      {pl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" disabled={pending} />}>
            Huỷ
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "Thêm" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify `teamColor` is exported from `_components.tsx`**

Run: `grep -n "export.*teamColor" src/app/admin/_components.tsx`
Expected: either already exported, or unexported. If not exported, the next task (D3) must export it.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors — may error on `teamColor` import if not yet exported. If so, fix in D3.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/_teams-section.tsx
git commit -m "feat(admin): extract TeamsSection + TeamFormDialog with optimistic CRUD"
```

---

### Task D3: Update ContentWorkspace props + rewire `_components.tsx`

**Files:**
- Modify: `src/app/admin/_components.tsx`

- [ ] **Step 1: Apply edits**

Three changes in `_components.tsx`:

**(a) Update imports at top of file** — add new types, remove unused `Pair`/`Team` if replaced, but keep (Groups/Matches still use them):

```tsx
// Add to existing imports:
import type { PairWithNames } from "@/lib/schemas/pair";
import type { TeamWithNames } from "@/lib/schemas/team";
import { PairsSection } from "./_pairs-section";
import { TeamsSection } from "./_teams-section";
```

**(b) Update `ContentWorkspace` props type** (around line 63):

```tsx
// Before:
//   pairs?: Pair[];
//   teams?: Team[];
// After:
  pairs?: PairWithNames[];        // Phase 3: DB-backed, for PairsSection
  teams?: TeamWithNames[];        // Phase 3: DB-backed, for TeamsSection
  legacyPairs?: Pair[];           // Phase 3: for Groups/Matches/KO mock sections
  legacyTeams?: Team[];           // Phase 3: for Groups/Matches/KO mock sections
```

**(c) Update usage sites** in the `ContentWorkspace` function body. The current line 83 is:

```tsx
{isDoubles ? <PairsSection pairs={pairs ?? []} /> : <TeamsSection teams={teams ?? []} />}
```

Replace with:

```tsx
{isDoubles ? (
  <PairsSection pairs={pairs ?? []} players={players} />
) : (
  <TeamsSection teams={teams ?? []} players={players} />
)}
```

**(d) Delete the local inline `PairsSection` and `TeamsSection`** (lines 121-175 — keep the `/* ---------- Cặp ---------- */` and `/* ---------- Đội ---------- */` comment dividers for readability).

**(e) Any reference to `pairs` or `teams` inside Groups/Matches/KO sections** — replace with `legacyPairs` / `legacyTeams`. Scan the file for `pairs` and `teams` usages beyond `ContentWorkspace`; swap as needed.

**(f) Export `teamColor`** if not already (check Step 2 of D2):

```tsx
// Change "function teamColor(...)" to "export function teamColor(...)"
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all still pass (no UI tests; structural change only).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/_components.tsx
git commit -m "refactor(admin): ContentWorkspace props split new/legacy, wire DB sections"
```

---

### Task D4: Admin doubles page fetch pairs

**Files:**
- Modify: `src/app/admin/doubles/page.tsx`

- [ ] **Step 1: Apply edit**

Replace file:

```tsx
// src/app/admin/doubles/page.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentWorkspace } from "../_components";
import {
  MOCK_DOUBLES_GROUPS,
  MOCK_DOUBLES_KO,
  MOCK_PAIRS,
} from "../_mock";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchPairs } from "@/lib/db/pairs";
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
  const [players, pairs] = await Promise.all([fetchPlayers(), fetchPairs()]);

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
        legacyPairs={MOCK_PAIRS}
        groups={MOCK_DOUBLES_GROUPS}
        knockout={MOCK_DOUBLES_KO}
      />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/doubles/page.tsx
git commit -m "feat(admin): doubles page fetch pairs from supabase (RSC)"
```

---

### Task D5: Admin teams page fetch teams

**Files:**
- Modify: `src/app/admin/teams/page.tsx`

- [ ] **Step 1: Apply edit**

Replace file:

```tsx
// src/app/admin/teams/page.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentWorkspace } from "../_components";
import {
  MOCK_TEAM_GROUPS,
  MOCK_TEAM_KO,
  MOCK_TEAMS,
  TEAM_FINAL_NOTE,
} from "../_mock";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchTeams } from "@/lib/db/teams";
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
  const [players, teams] = await Promise.all([fetchPlayers(), fetchTeams()]);

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
        legacyTeams={MOCK_TEAMS}
        groups={MOCK_TEAM_GROUPS}
        knockout={MOCK_TEAM_KO}
        knockoutNote={TEAM_FINAL_NOTE}
      />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/teams/page.tsx
git commit -m "feat(admin): teams page fetch teams from supabase (RSC)"
```

---

### Task D6: Extend loading skeletons

**Files:**
- Modify: `src/app/admin/doubles/loading.tsx`
- Modify: `src/app/admin/teams/loading.tsx`

- [ ] **Step 1: Update doubles loading.tsx**

Replace file:

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
      {/* Players list skeleton (5 rows) */}
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
      {/* Pairs list skeleton (4 rows) */}
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
    </main>
  );
}
```

- [ ] **Step 2: Update teams loading.tsx**

Replace file:

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
      {/* Players list skeleton (5 rows) */}
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
      {/* Teams list skeleton (3 cards) */}
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
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/doubles/loading.tsx src/app/admin/teams/loading.tsx
git commit -m "feat(admin): extend loading skeletons for pairs + teams sections"
```

---

### Task D7: Checkpoint D Gate + Manual Smoke Verify

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors (1 pre-existing warning OK).

- [ ] **Step 3: Build production bundle**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Start dev server**

Run: `npm run dev` (in separate terminal or background)
Wait for: `Ready`.

- [ ] **Step 5: Manual smoke test (user or CC with browse)**

Browse to `http://localhost:3000/admin/login`, login with password `123456`.

**Checklist for Doubles:**
- [ ] Navigate `/admin/doubles` → sees pairs from DB (18 seed pairs with names resolved)
- [ ] Click "Thêm" in cặp đôi section → dialog opens → pick 2 players → "Thêm" → sees new pair `p19` appear, toast success
- [ ] Click edit on new pair → change p2 → save → sees updated, toast success
- [ ] Click delete on new pair (`p19`, no refs) → confirm → sees it removed, toast success
- [ ] Click delete on seed pair `p01` → 409 toast with "đang dùng trong N trận đấu và Bảng A"
- [ ] Refresh page → data persists from DB

**Checklist for Teams:**
- [ ] Navigate `/admin/teams` → sees 8 teams from DB with member names resolved
- [ ] Click "Thêm" → dialog → pick 3 members (slot 2 disables slot 1 value) → "Thêm" → new team `T01`
- [ ] Edit existing team → change 1 member → save → sees updated
- [ ] Delete new team `T01` (no refs) → success
- [ ] Delete seed `tA1` (has refs) → 409 detail
- [ ] Refresh → persists

**Checklist for Groups/Matches/KO (should still work from mock):**
- [ ] Click into Bảng A (doubles) → schedule renders with mock pair names
- [ ] Click into Bảng A (teams) → schedule renders with mock team names
- [ ] KO section renders for both contents

- [ ] **Step 6: STOP for user sign-off**

Tell user: "Checkpoint D + full Phase 3 xong. Manual smoke all passed (báo cáo cụ thể ở trên). Merge sẵn sàng. Muốn squash merge vào main như Phase 2, hay merge commit?"

---

### Task D8: Merge + cleanup

Pending user choice from D7:

- [ ] **Option A — Squash merge**

```bash
git checkout main
git merge --squash feat/supabase-phase-3
git commit -m "feat: supabase integration phase 3 (pairs + teams API + admin UI)"
git branch -d feat/supabase-phase-3
```

- [ ] **Option B — Merge commit**

```bash
git checkout main
git merge --no-ff feat/supabase-phase-3 -m "merge: supabase integration phase 3"
```

- [ ] **Final verify**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass on `main`.

---

## Self-Review Notes

**Spec coverage:**
- §4.1 Pairs endpoints → Tasks B1–B5 ✓
- §4.2 Teams endpoints → Tasks C1–C5 ✓
- §4.5 Delete pre-check → Tasks B5, C5 (matches + groups.entries) ✓
- §5 Schemas → Tasks A1–A3 ✓
- §6 DB helpers → Tasks A5–A7 ✓
- §7 UI → Tasks D1–D6 ✓
- §8 File structure → mapped in tasks ✓
- §9 Testing coverage table → test cases match ✓
- §10 Risk: IdSchema injection → covered by A1 regex + tests ✓
- §10 Risk: nextId coexistence with lowercase `tA1..tB4` → A5 tests case-sensitive LIKE ✓
- Fix Phase 2 IdSchema debt → Tasks C6, C7 ✓

**No placeholders** — every code block has actual implementation, every test block has actual assertions, every command has expected output.

**Type consistency** — `PairWithNames`, `TeamWithNames`, `IdSchema`, `nextId()` signatures, `fetchPairById`/`fetchTeamById` all consistent across tasks.

**Known gap:** `maybeSingle` is used in `fetchPairById` / `fetchTeamById` but isn't wired into `makeSupabaseChain` by default — each test that needs it adds it inline (`chain.maybeSingle = vi.fn().mockResolvedValue(...)`). Consistent across tests.
