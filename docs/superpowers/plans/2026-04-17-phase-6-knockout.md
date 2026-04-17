# Phase 6 — Knockout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire knockout brackets to real API + DB for both doubles (8 entries, QF→SF→F) and teams (4 entries, SF→F), with auto-seed from standings and auto-advance on winner.

**Architecture:** New schemas + DB queries + API routes mirroring the existing matches pattern. Reuse `deriveDoublesWinner`, `deriveTeamScore`, `deriveTeamWinner` from `src/lib/matches/derive.ts`. Seeding uses `computeDoublesStandings`/`computeTeamStandings` from `src/lib/standings/compute.ts`. UI already has shell components (`KnockoutSection`, `KnockoutMatchCard`, `PublicKnockoutSection`) — wire them to API.

**Tech Stack:** Next.js Route Handlers, Supabase, Zod, Vitest, React (functional)

**Spec:** `docs/superpowers/specs/2026-04-17-phase-6-knockout-design.md`

---

## File Structure

**New files:**
- `src/lib/schemas/knockout.ts` — Zod schemas (`DoublesKoPatchSchema`, `TeamKoPatchSchema`) + resolved types
- `src/lib/db/knockout.ts` — DB query/fetch functions for `doubles_ko` and `team_ko`
- `src/lib/knockout/advance.ts` — auto-advance and auto-retract logic
- `src/lib/knockout/seed.ts` — seeding logic (create bracket from standings)
- `src/lib/knockout/__tests__/advance.test.ts` — advance/retract unit tests
- `src/lib/knockout/__tests__/seed.test.ts` — seed logic unit tests
- `src/lib/schemas/knockout.test.ts` — schema validation tests
- `src/app/api/doubles/ko/route.ts` — GET all + DELETE all
- `src/app/api/doubles/ko/seed/route.ts` — POST seed
- `src/app/api/doubles/ko/[id]/route.ts` — GET + PATCH single
- `src/app/api/teams/ko/route.ts` — GET all + DELETE all
- `src/app/api/teams/ko/seed/route.ts` — POST seed
- `src/app/api/teams/ko/[id]/route.ts` — GET + PATCH single

**Modified files:**
- `src/app/admin/_components.tsx` — wire `KnockoutMatchCard` to API, add seed/reset buttons, entry swap
- `src/app/admin/doubles/page.tsx` — fetch KO from API instead of mock
- `src/app/admin/teams/page.tsx` — fetch KO from API instead of mock
- `src/app/_publicKnockout.tsx` — use resolved types from API
- `src/app/d/page.tsx` — add KO section with data from API
- `src/app/t/page.tsx` — add KO section with data from API

---

### Task 1: Schemas + Types

**Files:**
- Create: `src/lib/schemas/knockout.ts`
- Create: `src/lib/schemas/knockout.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `src/lib/schemas/knockout.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { DoublesKoPatchSchema, TeamKoPatchSchema } from "./knockout";

describe("DoublesKoPatchSchema", () => {
  test("accepts empty body", () => {
    expect(DoublesKoPatchSchema.parse({})).toEqual({});
  });
  test("accepts sets only", () => {
    const r = DoublesKoPatchSchema.parse({ sets: [{ a: 11, b: 8 }] });
    expect(r.sets).toHaveLength(1);
  });
  test("accepts entry swap", () => {
    const r = DoublesKoPatchSchema.parse({ entryA: "pair-1" });
    expect(r.entryA).toBe("pair-1");
  });
  test("accepts null entry (clear)", () => {
    const r = DoublesKoPatchSchema.parse({ entryA: null });
    expect(r.entryA).toBeNull();
  });
  test("rejects forfeit without winner", () => {
    expect(() =>
      DoublesKoPatchSchema.parse({ status: "forfeit" }),
    ).toThrow(/Forfeit yêu cầu winner/);
  });
  test("accepts bestOf change", () => {
    const r = DoublesKoPatchSchema.parse({ bestOf: 5 });
    expect(r.bestOf).toBe(5);
  });
});

describe("TeamKoPatchSchema", () => {
  const sub = {
    id: "tko-sf1-sub1",
    label: "Đôi",
    kind: "doubles" as const,
    playersA: ["tp1", "tp2"],
    playersB: ["tp3", "tp4"],
    bestOf: 3 as const,
    sets: [],
  };
  test("accepts empty body", () => {
    expect(TeamKoPatchSchema.parse({})).toEqual({});
  });
  test("accepts individual array", () => {
    const r = TeamKoPatchSchema.parse({ individual: [sub] });
    expect(r.individual).toHaveLength(1);
  });
  test("accepts entry swap", () => {
    const r = TeamKoPatchSchema.parse({ entryA: "team-1" });
    expect(r.entryA).toBe("team-1");
  });
  test("rejects forfeit without winner", () => {
    expect(() =>
      TeamKoPatchSchema.parse({ status: "forfeit" }),
    ).toThrow(/Forfeit yêu cầu winner/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/schemas/knockout.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write schemas**

Create `src/lib/schemas/knockout.ts`:

```ts
import { z } from "zod";
import { IdSchema } from "./id";
import {
  SetScoreSchema,
  StatusSchema,
  BestOfSchema,
  SubMatchSchema,
  type SetScore,
  type Status,
  type BestOf,
  type SubMatchResolved,
} from "./match";

// ── Doubles KO ──

export const DoublesKoPatchSchema = z
  .object({
    sets: z.array(SetScoreSchema).max(5).optional(),
    status: StatusSchema.optional(),
    winner: IdSchema.nullable().optional(),
    bestOf: BestOfSchema.optional(),
    table: z.number().int().min(1).max(99).nullable().optional(),
    entryA: IdSchema.nullable().optional(),
    entryB: IdSchema.nullable().optional(),
  })
  .refine((d) => d.status !== "forfeit" || d.winner != null, {
    message: "Forfeit yêu cầu winner",
  });

export type DoublesKoResolved = {
  id: string;
  round: "qf" | "sf" | "f";
  bestOf: BestOf;
  table: number | null;
  labelA: string;
  labelB: string;
  entryA: { id: string; label: string } | null;
  entryB: { id: string; label: string } | null;
  sets: SetScore[];
  setsA: number;
  setsB: number;
  status: Status;
  winner: { id: string; label: string } | null;
  nextMatchId: string | null;
  nextSlot: "a" | "b" | null;
};

// ── Teams KO ──

export const TeamKoPatchSchema = z
  .object({
    individual: z.array(SubMatchSchema).min(1).max(7).optional(),
    status: StatusSchema.optional(),
    winner: IdSchema.nullable().optional(),
    entryA: IdSchema.nullable().optional(),
    entryB: IdSchema.nullable().optional(),
  })
  .refine((d) => d.status !== "forfeit" || d.winner != null, {
    message: "Forfeit yêu cầu winner",
  })
  .refine(
    (d) => {
      if (!d.individual) return true;
      const ids = d.individual.map((s) => s.id);
      return new Set(ids).size === ids.length;
    },
    { message: "Sub-match ID trùng trong array" },
  );

export type TeamKoResolved = {
  id: string;
  round: "qf" | "sf" | "f";
  labelA: string;
  labelB: string;
  entryA: { id: string; name: string } | null;
  entryB: { id: string; name: string } | null;
  scoreA: number;
  scoreB: number;
  status: Status;
  winner: { id: string; name: string } | null;
  individual: SubMatchResolved[];
  nextMatchId: string | null;
  nextSlot: "a" | "b" | null;
};

export type KoRound = "qf" | "sf" | "f";

export const ROUND_LABEL: Record<KoRound, string> = {
  qf: "Tứ kết",
  sf: "Bán kết",
  f: "Chung kết",
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/schemas/knockout.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/knockout.ts src/lib/schemas/knockout.test.ts
git commit -m "feat(ko): add knockout Zod schemas and resolved types"
```

---

### Task 2: DB Query Functions

**Files:**
- Create: `src/lib/db/knockout.ts`

- [ ] **Step 1: Create DB query functions**

Create `src/lib/db/knockout.ts`. Follow the pattern from `src/lib/db/matches.ts` — row types, resolve functions, fetch functions.

```ts
import { supabaseServer } from "@/lib/supabase/server";
import type {
  DoublesKoResolved,
  TeamKoResolved,
} from "@/lib/schemas/knockout";
import type {
  SetScore,
  Status,
  BestOf,
  SubMatchResolved,
} from "@/lib/schemas/match";

// ── Row types ──

type DoublesKoRow = {
  id: string;
  round: "qf" | "sf" | "f";
  best_of: BestOf;
  label_a: string | null;
  label_b: string | null;
  entry_a: string | null;
  entry_b: string | null;
  sets: SetScore[];
  status: Status;
  winner: string | null;
  sets_a: number;
  sets_b: number;
  table: number | null;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
};

type TeamKoRow = {
  id: string;
  round: "qf" | "sf" | "f";
  label_a: string | null;
  label_b: string | null;
  entry_a: string | null;
  entry_b: string | null;
  status: Status;
  score_a: number;
  score_b: number;
  winner: string | null;
  individual: Array<{
    id: string;
    label: string;
    kind: "singles" | "doubles";
    playersA: string[];
    playersB: string[];
    bestOf: BestOf;
    sets: SetScore[];
  }>;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
};

// ── Selects ──

const DOUBLES_KO_SELECT =
  "id, round, best_of, label_a, label_b, entry_a, entry_b, sets, status, winner, sets_a, sets_b, table, next_match_id, next_slot";

const TEAM_KO_SELECT =
  "id, round, label_a, label_b, entry_a, entry_b, status, score_a, score_b, winner, individual, next_match_id, next_slot";

// ── Pair label map (reused from matches.ts pattern) ──

async function buildPairLabelMap(): Promise<Map<string, string>> {
  const { data, error } = await supabaseServer
    .from("doubles_pairs")
    .select("id, p1:doubles_players!p1(id,name), p2:doubles_players!p2(id,name)");
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown) as Array<{
    id: string;
    p1: { id: string; name: string };
    p2: { id: string; name: string };
  }>;
  return new Map(rows.map((r) => [r.id, `${r.p1.name} – ${r.p2.name}`]));
}

async function buildTeamNameMap(): Promise<Map<string, string>> {
  const { data, error } = await supabaseServer
    .from("teams")
    .select("id, name");
  if (error) throw new Error(error.message);
  return new Map(
    ((data ?? []) as Array<{ id: string; name: string }>).map((t) => [t.id, t.name]),
  );
}

async function buildTeamPlayerNameMap(): Promise<Map<string, string>> {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id, name");
  if (error) throw new Error(error.message);
  return new Map(
    ((data ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]),
  );
}

// ── Resolve ──

function resolveDoublesKo(
  row: DoublesKoRow,
  pairMap: Map<string, string>,
): DoublesKoResolved {
  const labelOf = (id: string) => pairMap.get(id) ?? "?";
  return {
    id: row.id,
    round: row.round,
    bestOf: row.best_of,
    table: row.table ?? null,
    labelA: row.label_a ?? "",
    labelB: row.label_b ?? "",
    entryA: row.entry_a ? { id: row.entry_a, label: labelOf(row.entry_a) } : null,
    entryB: row.entry_b ? { id: row.entry_b, label: labelOf(row.entry_b) } : null,
    sets: row.sets ?? [],
    setsA: row.sets_a,
    setsB: row.sets_b,
    status: row.status,
    winner: row.winner ? { id: row.winner, label: labelOf(row.winner) } : null,
    nextMatchId: row.next_match_id,
    nextSlot: row.next_slot,
  };
}

function resolveTeamKo(
  row: TeamKoRow,
  teamMap: Map<string, string>,
  playerMap: Map<string, string>,
): TeamKoResolved {
  const teamLabelOf = (id: string) => teamMap.get(id) ?? "?";
  const playerLabelOf = (id: string) => playerMap.get(id) ?? "?";
  const individual: SubMatchResolved[] = (row.individual ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    kind: s.kind,
    playersA: (s.playersA ?? []).map((id) => ({ id, name: playerLabelOf(id) })),
    playersB: (s.playersB ?? []).map((id) => ({ id, name: playerLabelOf(id) })),
    bestOf: s.bestOf,
    sets: s.sets ?? [],
  }));
  return {
    id: row.id,
    round: row.round,
    labelA: row.label_a ?? "",
    labelB: row.label_b ?? "",
    entryA: row.entry_a ? { id: row.entry_a, name: teamLabelOf(row.entry_a) } : null,
    entryB: row.entry_b ? { id: row.entry_b, name: teamLabelOf(row.entry_b) } : null,
    scoreA: row.score_a,
    scoreB: row.score_b,
    status: row.status,
    winner: row.winner ? { id: row.winner, name: teamLabelOf(row.winner) } : null,
    individual,
    nextMatchId: row.next_match_id,
    nextSlot: row.next_slot,
  };
}

// ── Fetch functions ──

export async function fetchDoublesKo(): Promise<DoublesKoResolved[]> {
  const { data, error } = await supabaseServer
    .from("doubles_ko")
    .select(DOUBLES_KO_SELECT)
    .order("id");
  if (error) throw new Error(error.message);
  const pairMap = await buildPairLabelMap();
  return ((data ?? []) as DoublesKoRow[]).map((r) => resolveDoublesKo(r, pairMap));
}

export async function fetchDoublesKoById(id: string): Promise<DoublesKoResolved | null> {
  const chain = supabaseServer
    .from("doubles_ko")
    .select(DOUBLES_KO_SELECT)
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: DoublesKoRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (!data) return null;
  const pairMap = await buildPairLabelMap();
  return resolveDoublesKo(data, pairMap);
}

export async function fetchTeamKo(): Promise<TeamKoResolved[]> {
  const { data, error } = await supabaseServer
    .from("team_ko")
    .select(TEAM_KO_SELECT)
    .order("id");
  if (error) throw new Error(error.message);
  const [teamMap, playerMap] = await Promise.all([
    buildTeamNameMap(),
    buildTeamPlayerNameMap(),
  ]);
  return ((data ?? []) as TeamKoRow[]).map((r) => resolveTeamKo(r, teamMap, playerMap));
}

export async function fetchTeamKoById(id: string): Promise<TeamKoResolved | null> {
  const chain = supabaseServer
    .from("team_ko")
    .select(TEAM_KO_SELECT)
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: TeamKoRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [teamMap, playerMap] = await Promise.all([
    buildTeamNameMap(),
    buildTeamPlayerNameMap(),
  ]);
  return resolveTeamKo(data, teamMap, playerMap);
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/knockout.ts
git commit -m "feat(ko): add knockout DB query and resolve functions"
```

---

### Task 3: Seed Logic

**Files:**
- Create: `src/lib/knockout/seed.ts`
- Create: `src/lib/knockout/__tests__/seed.test.ts`

- [ ] **Step 1: Write failing seed tests**

Create `src/lib/knockout/__tests__/seed.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  buildDoublesBracket,
  buildTeamBracket,
  type SeedEntry,
} from "../seed";

describe("buildDoublesBracket", () => {
  // 4 groups (A, B, C, D), each with rank 1 and rank 2
  const seeds: SeedEntry[] = [
    { groupName: "A", rank: 1, entryId: "a1" },
    { groupName: "A", rank: 2, entryId: "a2" },
    { groupName: "B", rank: 1, entryId: "b1" },
    { groupName: "B", rank: 2, entryId: "b2" },
    { groupName: "C", rank: 1, entryId: "c1" },
    { groupName: "C", rank: 2, entryId: "c2" },
    { groupName: "D", rank: 1, entryId: "d1" },
    { groupName: "D", rank: 2, entryId: "d2" },
  ];

  test("creates 7 matches", () => {
    const bracket = buildDoublesBracket(seeds);
    expect(bracket).toHaveLength(7);
  });

  test("QF cross-group: A1 vs D2, C1 vs B2, B1 vs C2, D1 vs A2", () => {
    const bracket = buildDoublesBracket(seeds);
    const qf = bracket.filter((m) => m.round === "qf");
    expect(qf).toHaveLength(4);
    expect(qf[0]).toMatchObject({ entry_a: "a1", entry_b: "d2" });
    expect(qf[1]).toMatchObject({ entry_a: "c1", entry_b: "b2" });
    expect(qf[2]).toMatchObject({ entry_a: "b1", entry_b: "c2" });
    expect(qf[3]).toMatchObject({ entry_a: "d1", entry_b: "a2" });
  });

  test("SF and F have null entries", () => {
    const bracket = buildDoublesBracket(seeds);
    const sf = bracket.filter((m) => m.round === "sf");
    const f = bracket.filter((m) => m.round === "f");
    expect(sf).toHaveLength(2);
    expect(f).toHaveLength(1);
    for (const m of [...sf, ...f]) {
      expect(m.entry_a).toBeNull();
      expect(m.entry_b).toBeNull();
    }
  });

  test("next_match_id links QF→SF→F", () => {
    const bracket = buildDoublesBracket(seeds);
    const byId = new Map(bracket.map((m) => [m.id, m]));
    // QF1 + QF2 → SF1
    expect(byId.get("dko-qf1")!.next_match_id).toBe("dko-sf1");
    expect(byId.get("dko-qf1")!.next_slot).toBe("a");
    expect(byId.get("dko-qf2")!.next_match_id).toBe("dko-sf1");
    expect(byId.get("dko-qf2")!.next_slot).toBe("b");
    // QF3 + QF4 → SF2
    expect(byId.get("dko-qf3")!.next_match_id).toBe("dko-sf2");
    expect(byId.get("dko-qf3")!.next_slot).toBe("a");
    expect(byId.get("dko-qf4")!.next_match_id).toBe("dko-sf2");
    expect(byId.get("dko-qf4")!.next_slot).toBe("b");
    // SF1 + SF2 → F
    expect(byId.get("dko-sf1")!.next_match_id).toBe("dko-f");
    expect(byId.get("dko-sf1")!.next_slot).toBe("a");
    expect(byId.get("dko-sf2")!.next_match_id).toBe("dko-f");
    expect(byId.get("dko-sf2")!.next_slot).toBe("b");
    // F → null
    expect(byId.get("dko-f")!.next_match_id).toBeNull();
  });

  test("labels are correct", () => {
    const bracket = buildDoublesBracket(seeds);
    const byId = new Map(bracket.map((m) => [m.id, m]));
    expect(byId.get("dko-qf1")!.label_a).toBe("Nhất bảng A");
    expect(byId.get("dko-qf1")!.label_b).toBe("Nhì bảng D");
    expect(byId.get("dko-sf1")!.label_a).toBe("Thắng TK 1");
    expect(byId.get("dko-f")!.label_a).toBe("Thắng BK 1");
  });

  test("all matches best_of 5", () => {
    const bracket = buildDoublesBracket(seeds);
    for (const m of bracket) {
      expect(m.best_of).toBe(5);
    }
  });
});

describe("buildTeamBracket", () => {
  const seeds: SeedEntry[] = [
    { groupName: "A", rank: 1, entryId: "ta1" },
    { groupName: "A", rank: 2, entryId: "ta2" },
    { groupName: "B", rank: 1, entryId: "tb1" },
    { groupName: "B", rank: 2, entryId: "tb2" },
  ];

  test("creates 3 matches", () => {
    const bracket = buildTeamBracket(seeds);
    expect(bracket).toHaveLength(3);
  });

  test("SF cross-group: A1 vs B2, B1 vs A2", () => {
    const bracket = buildTeamBracket(seeds);
    const sf = bracket.filter((m) => m.round === "sf");
    expect(sf).toHaveLength(2);
    expect(sf[0]).toMatchObject({ entry_a: "ta1", entry_b: "tb2" });
    expect(sf[1]).toMatchObject({ entry_a: "tb1", entry_b: "ta2" });
  });

  test("each match has 3 individual sub-matches", () => {
    const bracket = buildTeamBracket(seeds);
    for (const m of bracket) {
      expect(m.individual).toHaveLength(3);
      expect(m.individual[0].label).toBe("Đôi");
      expect(m.individual[0].kind).toBe("doubles");
      expect(m.individual[1].label).toBe("Đơn 1");
      expect(m.individual[1].kind).toBe("singles");
      expect(m.individual[2].label).toBe("Đơn 2");
      expect(m.individual[2].kind).toBe("singles");
    }
  });

  test("SF→F links", () => {
    const bracket = buildTeamBracket(seeds);
    const byId = new Map(bracket.map((m) => [m.id, m]));
    expect(byId.get("tko-sf1")!.next_match_id).toBe("tko-f");
    expect(byId.get("tko-sf1")!.next_slot).toBe("a");
    expect(byId.get("tko-sf2")!.next_match_id).toBe("tko-f");
    expect(byId.get("tko-sf2")!.next_slot).toBe("b");
    expect(byId.get("tko-f")!.next_match_id).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/knockout/__tests__/seed.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement seed logic**

Create `src/lib/knockout/seed.ts`:

```ts
export type SeedEntry = {
  groupName: string;
  rank: number;
  entryId: string;
};

type DoublesKoInsert = {
  id: string;
  round: "qf" | "sf" | "f";
  best_of: number;
  label_a: string;
  label_b: string;
  entry_a: string | null;
  entry_b: string | null;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
};

type TeamKoInsert = {
  id: string;
  round: "qf" | "sf" | "f";
  label_a: string;
  label_b: string;
  entry_a: string | null;
  entry_b: string | null;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
  individual: Array<{
    id: string;
    label: string;
    kind: "singles" | "doubles";
    playersA: string[];
    playersB: string[];
    bestOf: 3 | 5;
    sets: Array<{ a: number; b: number }>;
  }>;
};

function findEntry(seeds: SeedEntry[], group: string, rank: number): string | null {
  return seeds.find((s) => s.groupName === group && s.rank === rank)?.entryId ?? null;
}

export function buildDoublesBracket(seeds: SeedEntry[]): DoublesKoInsert[] {
  const groups = [...new Set(seeds.map((s) => s.groupName))].sort();
  // Expect 4 groups: [A, B, C, D]
  const [A, B, C, D] = groups;

  return [
    // QF
    {
      id: "dko-qf1", round: "qf", best_of: 5,
      label_a: `Nhất bảng ${A}`, label_b: `Nhì bảng ${D}`,
      entry_a: findEntry(seeds, A, 1), entry_b: findEntry(seeds, D, 2),
      next_match_id: "dko-sf1", next_slot: "a",
    },
    {
      id: "dko-qf2", round: "qf", best_of: 5,
      label_a: `Nhất bảng ${C}`, label_b: `Nhì bảng ${B}`,
      entry_a: findEntry(seeds, C, 1), entry_b: findEntry(seeds, B, 2),
      next_match_id: "dko-sf1", next_slot: "b",
    },
    {
      id: "dko-qf3", round: "qf", best_of: 5,
      label_a: `Nhất bảng ${B}`, label_b: `Nhì bảng ${C}`,
      entry_a: findEntry(seeds, B, 1), entry_b: findEntry(seeds, C, 2),
      next_match_id: "dko-sf2", next_slot: "a",
    },
    {
      id: "dko-qf4", round: "qf", best_of: 5,
      label_a: `Nhất bảng ${D}`, label_b: `Nhì bảng ${A}`,
      entry_a: findEntry(seeds, D, 1), entry_b: findEntry(seeds, A, 2),
      next_match_id: "dko-sf2", next_slot: "b",
    },
    // SF
    {
      id: "dko-sf1", round: "sf", best_of: 5,
      label_a: "Thắng TK 1", label_b: "Thắng TK 2",
      entry_a: null, entry_b: null,
      next_match_id: "dko-f", next_slot: "a",
    },
    {
      id: "dko-sf2", round: "sf", best_of: 5,
      label_a: "Thắng TK 3", label_b: "Thắng TK 4",
      entry_a: null, entry_b: null,
      next_match_id: "dko-f", next_slot: "b",
    },
    // F
    {
      id: "dko-f", round: "f", best_of: 5,
      label_a: "Thắng BK 1", label_b: "Thắng BK 2",
      entry_a: null, entry_b: null,
      next_match_id: null, next_slot: null,
    },
  ];
}

function teamSubMatches(matchId: string): TeamKoInsert["individual"] {
  return [
    { id: `${matchId}-sub1`, label: "Đôi", kind: "doubles", playersA: [], playersB: [], bestOf: 3, sets: [] },
    { id: `${matchId}-sub2`, label: "Đơn 1", kind: "singles", playersA: [], playersB: [], bestOf: 3, sets: [] },
    { id: `${matchId}-sub3`, label: "Đơn 2", kind: "singles", playersA: [], playersB: [], bestOf: 3, sets: [] },
  ];
}

export function buildTeamBracket(seeds: SeedEntry[]): TeamKoInsert[] {
  const groups = [...new Set(seeds.map((s) => s.groupName))].sort();
  const [A, B] = groups;

  return [
    // SF
    {
      id: "tko-sf1", round: "sf",
      label_a: `Nhất bảng ${A}`, label_b: `Nhì bảng ${B}`,
      entry_a: findEntry(seeds, A, 1), entry_b: findEntry(seeds, B, 2),
      next_match_id: "tko-f", next_slot: "a",
      individual: teamSubMatches("tko-sf1"),
    },
    {
      id: "tko-sf2", round: "sf",
      label_a: `Nhất bảng ${B}`, label_b: `Nhì bảng ${A}`,
      entry_a: findEntry(seeds, B, 1), entry_b: findEntry(seeds, A, 2),
      next_match_id: "tko-f", next_slot: "b",
      individual: teamSubMatches("tko-sf2"),
    },
    // F
    {
      id: "tko-f", round: "f",
      label_a: "Thắng BK 1", label_b: "Thắng BK 2",
      entry_a: null, entry_b: null,
      next_match_id: null, next_slot: null,
      individual: teamSubMatches("tko-f"),
    },
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/knockout/__tests__/seed.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/knockout/seed.ts src/lib/knockout/__tests__/seed.test.ts
git commit -m "feat(ko): add bracket seeding logic with cross-group pattern"
```

---

### Task 4: Auto-Advance Logic

**Files:**
- Create: `src/lib/knockout/advance.ts`
- Create: `src/lib/knockout/__tests__/advance.test.ts`

- [ ] **Step 1: Write failing advance tests**

Create `src/lib/knockout/__tests__/advance.test.ts`:

```ts
import { describe, expect, test, vi, beforeEach } from "vitest";

// Mock supabase before import
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockSelect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: {
    from: vi.fn().mockReturnValue({
      update: mockUpdate,
      select: mockSelect,
    }),
  },
}));

import { advanceWinner, retractWinner } from "../advance";

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
});

describe("advanceWinner", () => {
  test("no-op when nextMatchId is null", async () => {
    await advanceWinner("doubles_ko", null, null, "winner-id");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("sets entry_a when nextSlot is a", async () => {
    await advanceWinner("doubles_ko", "dko-sf1", "a", "pair-1");
    expect(mockUpdate).toHaveBeenCalledWith({ entry_a: "pair-1" });
  });

  test("sets entry_b when nextSlot is b", async () => {
    await advanceWinner("doubles_ko", "dko-sf1", "b", "pair-2");
    expect(mockUpdate).toHaveBeenCalledWith({ entry_b: "pair-2" });
  });
});

describe("retractWinner", () => {
  test("clears entry_a when nextSlot is a", async () => {
    // Mock: next match is not done
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { status: "scheduled" },
          error: null,
        }),
      }),
    });
    await retractWinner("doubles_ko", "dko-sf1", "a");
    expect(mockUpdate).toHaveBeenCalledWith({ entry_a: null });
  });

  test("throws if next match already done", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { status: "done" },
          error: null,
        }),
      }),
    });
    await expect(
      retractWinner("doubles_ko", "dko-sf1", "a"),
    ).rejects.toThrow(/trận tiếp đã hoàn thành/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/knockout/__tests__/advance.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement advance logic**

Create `src/lib/knockout/advance.ts`:

```ts
import { supabaseServer } from "@/lib/supabase/server";

type KoTable = "doubles_ko" | "team_ko";

export async function advanceWinner(
  table: KoTable,
  nextMatchId: string | null,
  nextSlot: "a" | "b" | null,
  winnerId: string,
): Promise<void> {
  if (!nextMatchId || !nextSlot) return;
  const update = nextSlot === "a" ? { entry_a: winnerId } : { entry_b: winnerId };
  const { error } = await supabaseServer
    .from(table)
    .update(update)
    .eq("id", nextMatchId);
  if (error) throw new Error(error.message);
}

export async function retractWinner(
  table: KoTable,
  nextMatchId: string,
  nextSlot: "a" | "b",
): Promise<void> {
  // Check if next match is already done
  const chain = supabaseServer
    .from(table)
    .select("status")
    .eq("id", nextMatchId);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: { status: string } | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (data?.status === "done" || data?.status === "forfeit") {
    throw new Error("Không thể mở lại, trận tiếp đã hoàn thành");
  }

  const update = nextSlot === "a" ? { entry_a: null } : { entry_b: null };
  const { error: updErr } = await supabaseServer
    .from(table)
    .update(update)
    .eq("id", nextMatchId);
  if (updErr) throw new Error(updErr.message);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/knockout/__tests__/advance.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/knockout/advance.ts src/lib/knockout/__tests__/advance.test.ts
git commit -m "feat(ko): add auto-advance and retract logic"
```

---

### Task 5: Doubles KO API Routes

**Files:**
- Create: `src/app/api/doubles/ko/route.ts`
- Create: `src/app/api/doubles/ko/seed/route.ts`
- Create: `src/app/api/doubles/ko/[id]/route.ts`

- [ ] **Step 1: Create GET + DELETE route**

Create `src/app/api/doubles/ko/route.ts`:

```ts
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchDoublesKo } from "@/lib/db/knockout";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const matches = await fetchDoublesKo();
    return ok(matches);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
    const { error } = await supabaseServer
      .from("doubles_ko")
      .delete()
      .neq("id", "");
    if (error) return err(error.message);
    return ok({ deleted: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 2: Create seed route**

Create `src/app/api/doubles/ko/seed/route.ts`:

```ts
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchDoublesGroups } from "@/lib/db/groups";
import { fetchDoublesMatchesByGroup } from "@/lib/db/matches";
import { computeDoublesStandings } from "@/lib/standings/compute";
import { buildDoublesBracket, type SeedEntry } from "@/lib/knockout/seed";
import { fetchDoublesKo } from "@/lib/db/knockout";

export async function POST() {
  try {
    await requireAdmin();

    // Check bracket doesn't exist
    const { data: existing } = await supabaseServer
      .from("doubles_ko")
      .select("id")
      .limit(1);
    if (existing && existing.length > 0) {
      return err("Bracket đã tồn tại. Xoá bracket cũ trước khi tạo mới.", 409);
    }

    // Fetch groups + compute standings
    const groups = await fetchDoublesGroups();
    if (groups.length < 2) {
      return err("Cần ít nhất 2 bảng để tạo bracket", 400);
    }

    const seeds: SeedEntry[] = [];
    for (const group of groups) {
      const matches = await fetchDoublesMatchesByGroup(group.id);
      const standings = computeDoublesStandings(
        group.entries.map((e) => ({ id: e.id, label: e.label })),
        matches,
      );
      // Take top 2
      const sorted = standings.filter((s) => s.played > 0).sort((a, b) => a.rank - b.rank);
      for (let i = 0; i < Math.min(2, sorted.length); i++) {
        seeds.push({
          groupName: group.name,
          rank: i + 1,
          entryId: sorted[i].entryId,
        });
      }
    }

    const bracket = buildDoublesBracket(seeds);

    const { error: insertErr } = await supabaseServer
      .from("doubles_ko")
      .insert(bracket);
    if (insertErr) return err(insertErr.message);

    const resolved = await fetchDoublesKo();
    return ok(resolved, 201);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 3: Create PATCH route**

Create `src/app/api/doubles/ko/[id]/route.ts`. Follow the pattern from `src/app/api/doubles/matches/[id]/route.ts`, adding auto-advance and entry swap.

```ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchDoublesKoById } from "@/lib/db/knockout";
import { IdSchema } from "@/lib/schemas/id";
import {
  DoublesKoPatchSchema,
} from "@/lib/schemas/knockout";
import type { SetScore, Status, BestOf } from "@/lib/schemas/match";
import { supabaseServer } from "@/lib/supabase/server";
import { deriveDoublesWinner, deriveSetCounts } from "@/lib/matches/derive";
import { advanceWinner, retractWinner } from "@/lib/knockout/advance";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

type ExistingRow = {
  entry_a: string | null;
  entry_b: string | null;
  sets: SetScore[];
  best_of: BestOf;
  status: Status;
  winner: string | null;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
};

async function fetchExisting(id: string): Promise<ExistingRow | null> {
  const chain = supabaseServer
    .from("doubles_ko")
    .select("entry_a, entry_b, sets, best_of, status, winner, next_match_id, next_slot")
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: ExistingRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const match = await fetchDoublesKoById(id);
    if (!match) return err("Trận không tồn tại", 404);
    return ok(match);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const existing = await fetchExisting(id);
    if (!existing) return err("Trận không tồn tại", 404);

    const body = await req.json();
    const parsed = DoublesKoPatchSchema.parse(body);

    // Entry swap validation
    if (parsed.entryA !== undefined && parsed.entryA !== null) {
      const { data } = await supabaseServer
        .from("doubles_pairs")
        .select("id")
        .eq("id", parsed.entryA)
        .limit(1);
      if (!data?.length) throw new BadRequestError(`Cặp ${parsed.entryA} không tồn tại`);
    }
    if (parsed.entryB !== undefined && parsed.entryB !== null) {
      const { data } = await supabaseServer
        .from("doubles_pairs")
        .select("id")
        .eq("id", parsed.entryB)
        .limit(1);
      if (!data?.length) throw new BadRequestError(`Cặp ${parsed.entryB} không tồn tại`);
    }

    // Forfeit gate
    const effEntryA = parsed.entryA !== undefined ? parsed.entryA : existing.entry_a;
    const effEntryB = parsed.entryB !== undefined ? parsed.entryB : existing.entry_b;
    if (parsed.status === "forfeit") {
      const w = parsed.winner;
      if (w !== effEntryA && w !== effEntryB) {
        throw new BadRequestError("Winner phải thuộc entry_a hoặc entry_b");
      }
    }

    const effSets = parsed.sets ?? existing.sets;
    const effBestOf = parsed.bestOf ?? existing.best_of;
    const effStatus: Status = parsed.status ?? existing.status;

    const updates: Record<string, unknown> = {};
    if (parsed.sets !== undefined) updates.sets = parsed.sets;
    if (parsed.bestOf !== undefined) updates.best_of = parsed.bestOf;
    if (parsed.table !== undefined) updates.table = parsed.table;
    if (parsed.status !== undefined) updates.status = parsed.status;
    if (parsed.entryA !== undefined) updates.entry_a = parsed.entryA;
    if (parsed.entryB !== undefined) updates.entry_b = parsed.entryB;

    // Re-derive set counts
    if (parsed.sets !== undefined || parsed.bestOf !== undefined) {
      const { a, b } = deriveSetCounts(effSets);
      updates.sets_a = a;
      updates.sets_b = b;
    }

    // Winner derivation
    let newWinner: string | null = null;
    if (effStatus === "done") {
      if (!effEntryA || !effEntryB) {
        throw new BadRequestError("Chưa có đủ 2 đội để hoàn thành trận");
      }
      const w = deriveDoublesWinner(effSets, effEntryA, effEntryB, effBestOf);
      if (!w) {
        throw new BadRequestError("Chưa đủ set quyết định");
      }
      newWinner = w;
      updates.winner = w;
    } else if (effStatus === "forfeit") {
      newWinner = (parsed.winner ?? existing.winner)!;
      updates.winner = newWinner;
    } else {
      updates.winner = null;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabaseServer
        .from("doubles_ko")
        .update(updates)
        .eq("id", id);
      if (updErr) return err(updErr.message);
    }

    // Auto-advance / retract
    const hadWinner = existing.winner !== null;
    const hasWinner = newWinner !== null;

    if (!hadWinner && hasWinner && existing.next_match_id) {
      await advanceWinner("doubles_ko", existing.next_match_id, existing.next_slot, newWinner!);
    } else if (hadWinner && !hasWinner && existing.next_match_id && existing.next_slot) {
      await retractWinner("doubles_ko", existing.next_match_id, existing.next_slot);
    }

    const resolved = await fetchDoublesKoById(id);
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

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/ko/
git commit -m "feat(ko): add doubles knockout API routes (GET, POST seed, PATCH, DELETE)"
```

---

### Task 6: Teams KO API Routes

**Files:**
- Create: `src/app/api/teams/ko/route.ts`
- Create: `src/app/api/teams/ko/seed/route.ts`
- Create: `src/app/api/teams/ko/[id]/route.ts`

- [ ] **Step 1: Create GET + DELETE route**

Create `src/app/api/teams/ko/route.ts`:

```ts
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchTeamKo } from "@/lib/db/knockout";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const matches = await fetchTeamKo();
    return ok(matches);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
    const { error } = await supabaseServer
      .from("team_ko")
      .delete()
      .neq("id", "");
    if (error) return err(error.message);
    return ok({ deleted: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 2: Create seed route**

Create `src/app/api/teams/ko/seed/route.ts`:

```ts
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchTeamGroups } from "@/lib/db/groups";
import { fetchTeamMatchesByGroup } from "@/lib/db/matches";
import { computeTeamStandings } from "@/lib/standings/compute";
import { buildTeamBracket, type SeedEntry } from "@/lib/knockout/seed";
import { fetchTeamKo } from "@/lib/db/knockout";

export async function POST() {
  try {
    await requireAdmin();

    const { data: existing } = await supabaseServer
      .from("team_ko")
      .select("id")
      .limit(1);
    if (existing && existing.length > 0) {
      return err("Bracket đã tồn tại. Xoá bracket cũ trước khi tạo mới.", 409);
    }

    const groups = await fetchTeamGroups();
    if (groups.length < 2) {
      return err("Cần ít nhất 2 bảng để tạo bracket", 400);
    }

    const seeds: SeedEntry[] = [];
    for (const group of groups) {
      const matches = await fetchTeamMatchesByGroup(group.id);
      const standings = computeTeamStandings(
        group.entries.map((e) => ({ id: e.id, label: e.label })),
        matches,
      );
      const sorted = standings.filter((s) => s.played > 0).sort((a, b) => a.rank - b.rank);
      for (let i = 0; i < Math.min(2, sorted.length); i++) {
        seeds.push({
          groupName: group.name,
          rank: i + 1,
          entryId: sorted[i].entryId,
        });
      }
    }

    const bracket = buildTeamBracket(seeds);

    const { error: insertErr } = await supabaseServer
      .from("team_ko")
      .insert(bracket);
    if (insertErr) return err(insertErr.message);

    const resolved = await fetchTeamKo();
    return ok(resolved, 201);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 3: Create PATCH route**

Create `src/app/api/teams/ko/[id]/route.ts`. Follow the pattern from `src/app/api/teams/matches/[id]/route.ts`, adding auto-advance and entry swap.

```ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchTeamKoById } from "@/lib/db/knockout";
import { IdSchema } from "@/lib/schemas/id";
import { TeamKoPatchSchema } from "@/lib/schemas/knockout";
import type { Status, SubMatch } from "@/lib/schemas/match";
import { supabaseServer } from "@/lib/supabase/server";
import { deriveTeamScore, deriveTeamWinner } from "@/lib/matches/derive";
import { advanceWinner, retractWinner } from "@/lib/knockout/advance";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

type ExistingRow = {
  entry_a: string | null;
  entry_b: string | null;
  individual: SubMatch[];
  status: Status;
  winner: string | null;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
};

async function fetchExisting(id: string): Promise<ExistingRow | null> {
  const chain = supabaseServer
    .from("team_ko")
    .select("entry_a, entry_b, individual, status, winner, next_match_id, next_slot")
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: ExistingRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  return data;
}

async function fetchTeamsMembers(
  teamAId: string,
  teamBId: string,
): Promise<{ a: Set<string>; b: Set<string> }> {
  const { data, error } = await supabaseServer
    .from("teams")
    .select("id, members")
    .or(`id.eq.${teamAId},id.eq.${teamBId}`);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: string; members: string[] }>;
  const aRow = rows.find((r) => r.id === teamAId);
  const bRow = rows.find((r) => r.id === teamBId);
  return {
    a: new Set(aRow?.members ?? []),
    b: new Set(bRow?.members ?? []),
  };
}

function validatePlayerMembership(
  individual: SubMatch[],
  members: { a: Set<string>; b: Set<string> },
  teamAId: string,
  teamBId: string,
) {
  for (const sub of individual) {
    for (const p of sub.playersA) {
      if (!members.a.has(p)) {
        throw new BadRequestError(
          `VĐV ${p} không thuộc đội ${teamAId} (sub ${sub.id})`,
        );
      }
    }
    for (const p of sub.playersB) {
      if (!members.b.has(p)) {
        throw new BadRequestError(
          `VĐV ${p} không thuộc đội ${teamBId} (sub ${sub.id})`,
        );
      }
    }
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const match = await fetchTeamKoById(id);
    if (!match) return err("Trận không tồn tại", 404);
    return ok(match);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const existing = await fetchExisting(id);
    if (!existing) return err("Trận không tồn tại", 404);

    const body = await req.json();
    const parsed = TeamKoPatchSchema.parse(body);

    // Entry swap validation
    if (parsed.entryA !== undefined && parsed.entryA !== null) {
      const { data } = await supabaseServer
        .from("teams")
        .select("id")
        .eq("id", parsed.entryA)
        .limit(1);
      if (!data?.length) throw new BadRequestError(`Đội ${parsed.entryA} không tồn tại`);
    }
    if (parsed.entryB !== undefined && parsed.entryB !== null) {
      const { data } = await supabaseServer
        .from("teams")
        .select("id")
        .eq("id", parsed.entryB)
        .limit(1);
      if (!data?.length) throw new BadRequestError(`Đội ${parsed.entryB} không tồn tại`);
    }

    const effEntryA = parsed.entryA !== undefined ? parsed.entryA : existing.entry_a;
    const effEntryB = parsed.entryB !== undefined ? parsed.entryB : existing.entry_b;

    // Forfeit gate
    if (parsed.status === "forfeit") {
      const w = parsed.winner;
      if (w !== effEntryA && w !== effEntryB) {
        throw new BadRequestError("Winner phải thuộc entry_a hoặc entry_b");
      }
    }

    const effIndividual = parsed.individual ?? existing.individual;
    const effStatus: Status = parsed.status ?? existing.status;

    // Player membership validation
    if (parsed.individual !== undefined && effEntryA && effEntryB) {
      const members = await fetchTeamsMembers(effEntryA, effEntryB);
      validatePlayerMembership(parsed.individual, members, effEntryA, effEntryB);
    }

    const updates: Record<string, unknown> = {};
    if (parsed.individual !== undefined) updates.individual = parsed.individual;
    if (parsed.status !== undefined) updates.status = parsed.status;
    if (parsed.entryA !== undefined) updates.entry_a = parsed.entryA;
    if (parsed.entryB !== undefined) updates.entry_b = parsed.entryB;

    if (parsed.individual !== undefined && effEntryA && effEntryB) {
      const { scoreA, scoreB } = deriveTeamScore(effIndividual, effEntryA, effEntryB);
      updates.score_a = scoreA;
      updates.score_b = scoreB;
    }

    let newWinner: string | null = null;
    if (effStatus === "done") {
      if (!effEntryA || !effEntryB) {
        throw new BadRequestError("Chưa có đủ 2 đội để hoàn thành trận");
      }
      const w = deriveTeamWinner(effIndividual, effEntryA, effEntryB);
      if (!w) {
        throw new BadRequestError("Chưa đủ sub-match quyết định");
      }
      newWinner = w;
      updates.winner = w;
    } else if (effStatus === "forfeit") {
      newWinner = (parsed.winner ?? existing.winner)!;
      updates.winner = newWinner;
    } else {
      updates.winner = null;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabaseServer
        .from("team_ko")
        .update(updates)
        .eq("id", id);
      if (updErr) return err(updErr.message);
    }

    // Auto-advance / retract
    const hadWinner = existing.winner !== null;
    const hasWinner = newWinner !== null;

    if (!hadWinner && hasWinner && existing.next_match_id) {
      await advanceWinner("team_ko", existing.next_match_id, existing.next_slot, newWinner!);
    } else if (hadWinner && !hasWinner && existing.next_match_id && existing.next_slot) {
      await retractWinner("team_ko", existing.next_match_id, existing.next_slot);
    }

    const resolved = await fetchTeamKoById(id);
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

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/ko/
git commit -m "feat(ko): add teams knockout API routes (GET, POST seed, PATCH, DELETE)"
```

---

### Task 7: Wire Admin Pages to API

**Files:**
- Modify: `src/app/admin/doubles/page.tsx`
- Modify: `src/app/admin/teams/page.tsx`
- Modify: `src/app/admin/_components.tsx`

- [ ] **Step 1: Update doubles admin page**

In `src/app/admin/doubles/page.tsx`:
- Remove `import { MOCK_DOUBLES_KO } from "../_mock"`
- Add `import { fetchDoublesKo } from "@/lib/db/knockout"`
- Replace `knockout={MOCK_DOUBLES_KO}` with data fetched from DB: `const knockout = await fetchDoublesKo();` then `knockout={knockout}`

- [ ] **Step 2: Update teams admin page**

In `src/app/admin/teams/page.tsx`:
- Remove `import { MOCK_TEAM_KO, TEAM_FINAL_NOTE } from "../_mock"`
- Add `import { fetchTeamKo } from "@/lib/db/knockout"`
- Replace `knockout={MOCK_TEAM_KO}` with `const knockout = await fetchTeamKo();` then `knockout={knockout}`
- Remove `knockoutNote={TEAM_FINAL_NOTE}`

- [ ] **Step 3: Update ContentWorkspace knockout prop type**

In `src/app/admin/_components.tsx`, update the `knockout` prop type from `KnockoutMatch[]` (mock type) to `DoublesKoResolved[] | TeamKoResolved[]`. Update `KnockoutSection` and `KnockoutMatchCard` accordingly.

Key changes:
- Import `DoublesKoResolved`, `TeamKoResolved` from `@/lib/schemas/knockout`
- Replace `KnockoutMatch` type usage with union `DoublesKoResolved | TeamKoResolved`
- Add seed button: calls `POST /api/{doubles|teams}/ko/seed`, then `router.refresh()`
- Add reset button: calls `DELETE /api/{doubles|teams}/ko`, then `router.refresh()`
- Wire `KnockoutMatchCard` save to `PATCH /api/{doubles|teams}/ko/[id]` with debounced save pattern (same as `MatchCard`/`TeamMatchCard`)
- Add entry swap dropdown (select from pairs/teams pool) for matches that are still `scheduled`
- After save: `router.refresh()` to reflect auto-advance changes

- [ ] **Step 4: Remove mock KO imports**

Remove `KnockoutMatch`, `MOCK_DOUBLES_KO`, `MOCK_TEAM_KO`, `TEAM_FINAL_NOTE`, `MOCK_TEAMS` references from `_components.tsx`. Keep `ROUND_LABEL` and `TEAM_MATCH_TEMPLATE` but move them to `src/lib/schemas/knockout.ts` (ROUND_LABEL is already there) or keep inline.

- [ ] **Step 5: Type check + test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean types, all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/doubles/page.tsx src/app/admin/teams/page.tsx src/app/admin/_components.tsx
git commit -m "feat(ko): wire admin knockout UI to API, add seed/reset buttons"
```

---

### Task 8: Wire Public Pages

**Files:**
- Modify: `src/app/_publicKnockout.tsx`
- Modify: `src/app/d/page.tsx`
- Modify: `src/app/t/page.tsx`

- [ ] **Step 1: Update PublicKnockoutSection**

In `src/app/_publicKnockout.tsx`:
- Remove imports from `./admin/_mock`
- Import `DoublesKoResolved`, `TeamKoResolved`, `ROUND_LABEL` from `@/lib/schemas/knockout`
- Update `PublicKnockoutSection` props to accept `DoublesKoResolved[] | TeamKoResolved[]`
- Update `PublicKOCard` to use resolved types (`.entryA?.label` / `.entryA?.name` instead of string, `.setsA`/`.setsB` or `.scoreA`/`.scoreB`)
- For teams: use `individual: SubMatchResolved[]` instead of `IndividualMatch[]`

- [ ] **Step 2: Add KO section to doubles public page**

In `src/app/d/page.tsx`:
- Fetch `GET /api/doubles/ko` (or use `fetchDoublesKo()` directly since server component)
- Pass to `PublicKnockoutSection`

- [ ] **Step 3: Add KO section to teams public page**

In `src/app/t/page.tsx`:
- Fetch `GET /api/teams/ko` (or use `fetchTeamKo()` directly)
- Pass to `PublicKnockoutSection`

- [ ] **Step 4: Type check + verify build**

Run: `npx tsc --noEmit && npx next build`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add src/app/_publicKnockout.tsx src/app/d/page.tsx src/app/t/page.tsx
git commit -m "feat(ko): wire public knockout view to API data"
```

---

### Task 9: Manual Verification + Full Test Run

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass, no regressions

- [ ] **Step 2: Start dev server and verify**

Run: `npx next dev`

Verify in browser:
1. Admin doubles → Knockout tab → "Tạo bracket từ BXH" button works
2. Bracket shows 7 matches with correct cross-group seeding
3. Enter sets on a QF match → save → winner auto-advances to SF
4. Undo QF result → SF slot clears
5. Swap an entry manually → saves correctly
6. Admin teams → Knockout tab → seed → 3 matches
7. Teams KO: assign players to sub-matches, enter scores
8. Public `/d` and `/t` pages show knockout bracket
9. Reset bracket → re-seed works

- [ ] **Step 3: Commit any fixes from manual testing**

```bash
git add -A
git commit -m "fix(ko): adjustments from manual testing"
```
