# Phase 5A: Matches API + Schema Seed + Admin Migration (Group Stage) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate group-stage matches (doubles round-robin + teams round-robin) khỏi mock và đặt nền API + admin UX. Sau phase: schema seed + 4 routes + admin group detail pages đọc matches từ DB. Public + home vẫn mock đến 5B/5C. Knockout là Phase 6.

**Architecture:** Pure TS modules cho diff/derivation logic (round-robin pairings, winner derivation). Server-side resolution shape `MatchResolved`/`TeamMatchResolved` mirror Phase 4 `GroupResolved`. PATCH endpoints full-replace, server-derive `sets_a/sets_b/score_a/score_b/winner`. POST regenerate-matches diff-aware (giữ matches có cặp tồn tại). Admin client minimal-swap: types from mock → resolved, thêm fetch PATCH calls, optimistic UI + sonner.

**Tech Stack:** Next.js 16 (RSC), React 19 (`useOptimistic`, `useTransition`), TypeScript strict, Supabase JS, Zod 4, Vitest 4, `@base-ui/react` (Dialog), `sonner` toasts, Tailwind 4, `lucide-react`, nanoid.

**Spec:** `docs/superpowers/specs/2026-04-16-phase-5a-matches-api-design.md`

**Branch:** `feat/supabase-phase-5a` (create from `main` ở Pre-flight)

---

## File Structure

**New files:**
- `src/lib/schemas/match.ts` — zod `SetScoreSchema`, `StatusSchema`, `BestOfSchema`, `SubMatchSchema`, `DoublesMatchPatchSchema`, `TeamMatchPatchSchema` + types `MatchResolved`, `SubMatchResolved`, `TeamMatchResolved`
- `src/lib/schemas/match.test.ts` — schema unit tests
- `src/lib/matches/derive.ts` — pure: `deriveSetCounts`, `deriveDoublesWinner`, `deriveSubMatchWinner`, `deriveTeamScore`, `deriveTeamWinner`
- `src/lib/matches/derive.test.ts` — pure unit tests
- `src/lib/matches/round-robin.ts` — pure: `generatePairings`, `computeMatchDiff`, `nextMatchId` (wraps existing `nextId` pattern but pure for tests)
- `src/lib/matches/round-robin.test.ts` — pure unit tests
- `src/lib/db/matches.ts` — `fetchDoublesMatchesByGroup`, `fetchDoublesMatchById`, `fetchTeamMatchesByGroup`, `fetchTeamMatchById`
- `src/lib/db/matches.test.ts` — DB helper tests
- `src/app/api/doubles/matches/[id]/route.ts` — PATCH handler (doubles)
- `src/app/api/doubles/matches/[id]/route.test.ts`
- `src/app/api/teams/matches/[id]/route.ts` — PATCH handler (teams)
- `src/app/api/teams/matches/[id]/route.test.ts`
- `src/app/api/doubles/groups/[id]/regenerate-matches/route.ts` — POST handler (doubles)
- `src/app/api/doubles/groups/[id]/regenerate-matches/route.test.ts`
- `src/app/api/teams/groups/[id]/regenerate-matches/route.ts` — POST handler (teams)
- `src/app/api/teams/groups/[id]/regenerate-matches/route.test.ts`
- `supabase/migrations/0003_seed_matches.sql` — initial round-robin seed
- `src/app/admin/_match-actions.ts` — client fetch helpers `patchDoublesMatch`, `patchTeamMatch`, `regenerateMatches`
- `src/app/admin/_group-regenerate-button.tsx` — client component
- `src/app/admin/_player-picker.tsx` — client component (1-N player dropdown)

**Modified:**
- `src/app/admin/_components.tsx` — refactor `DoublesSchedule`, `DoublesMatchCard`, `EditMatchDialog`, `TeamSchedule`, `TeamMatchCard`, `IndividualMatchRow` to use resolved types + PATCH calls. Status switcher in dialog. Wrapper `resolvedToMockShape` cho legacy `computeStandings`.
- `src/app/admin/doubles/groups/[id]/page.tsx` — fetch matches từ DB qua `fetchDoublesMatchesByGroup` thay `MOCK_DOUBLES_MATCHES`
- `src/app/admin/teams/groups/[id]/page.tsx` — fetch matches từ DB qua `fetchTeamMatchesByGroup`
- `package.json` — add `nanoid` dep (for sub-match IDs)

**Unchanged (intentional):**
- `MOCK_DOUBLES_MATCHES`, `MOCK_TEAM_MATCHES`, `MOCK_*_KO`, `TEAM_MATCH_TEMPLATE` trong `_mock.ts` — public + `_home.ts` còn dùng, defer cleanup.
- `src/app/d/[id]/page.tsx`, `src/app/t/[id]/page.tsx`, `src/app/_publicGroup.tsx` — public migration là 5B.
- `src/app/_home.ts` — 5B/5C scope.
- KO sections trong `_components.tsx`.

---

## Pre-flight

- [ ] **Step 0: Create branch from main**

```bash
git checkout main
git pull origin main 2>/dev/null || true
git checkout -b feat/supabase-phase-5a
```

Expected: switched to `feat/supabase-phase-5a`.

- [ ] **Step 1: Add nanoid dep**

```bash
bun add nanoid
```

Expected: `package.json` updated, lockfile updated.

- [ ] **Step 2: Verify baseline tests pass**

```bash
bun test
```

Expected: 165 tests pass (Phase 4 baseline). If not, stop and investigate.

- [ ] **Step 3: Commit pre-flight**

```bash
git add package.json bun.lockb 2>/dev/null || git add package.json bun.lock
git commit -m "chore: add nanoid for phase 5a sub-match ids"
```

---

## CHECKPOINT A — Foundations (schemas + pure modules + DB helpers)

Pure modules + types đầu tiên. Zero DB / UI impact. Mỗi task tự đứng vững.

### Task A1: Match schema + types (`src/lib/schemas/match.ts`)

**Files:**
- Create: `src/lib/schemas/match.ts`
- Create: `src/lib/schemas/match.test.ts`

- [ ] **Step 1: Write failing schema tests**

```ts
// src/lib/schemas/match.test.ts
import { describe, expect, test } from "vitest";
import {
  SetScoreSchema,
  SubMatchSchema,
  DoublesMatchPatchSchema,
  TeamMatchPatchSchema,
} from "./match";

describe("SetScoreSchema", () => {
  test("accepts valid score", () => {
    expect(SetScoreSchema.parse({ a: 11, b: 8 })).toEqual({ a: 11, b: 8 });
  });
  test("rejects negative", () => {
    expect(() => SetScoreSchema.parse({ a: -1, b: 0 })).toThrow();
  });
  test("rejects non-int", () => {
    expect(() => SetScoreSchema.parse({ a: 1.5, b: 0 })).toThrow();
  });
  test("rejects > 99", () => {
    expect(() => SetScoreSchema.parse({ a: 100, b: 0 })).toThrow();
  });
});

describe("SubMatchSchema", () => {
  const valid = {
    id: "tm01-d",
    label: "Đôi",
    kind: "doubles" as const,
    playersA: ["t01", "t02"],
    playersB: ["t04", "t05"],
    bestOf: 3 as const,
    sets: [],
  };
  test("accepts valid doubles sub", () => {
    expect(SubMatchSchema.parse(valid)).toEqual(valid);
  });
  test("rejects singles with 2 players", () => {
    expect(() =>
      SubMatchSchema.parse({ ...valid, kind: "singles", playersA: ["t01", "t02"] }),
    ).toThrow(/Số VĐV/);
  });
  test("rejects doubles with 1 player", () => {
    expect(() =>
      SubMatchSchema.parse({ ...valid, playersA: ["t01"] }),
    ).toThrow(/Số VĐV/);
  });
  test("rejects sets > bestOf", () => {
    const sets = Array(6).fill({ a: 11, b: 0 });
    expect(() => SubMatchSchema.parse({ ...valid, sets })).toThrow();
  });
  test("accepts sets <= bestOf", () => {
    const sets = [{ a: 11, b: 8 }, { a: 11, b: 7 }];
    expect(SubMatchSchema.parse({ ...valid, sets }).sets).toHaveLength(2);
  });
});

describe("DoublesMatchPatchSchema", () => {
  test("accepts empty body", () => {
    expect(DoublesMatchPatchSchema.parse({})).toEqual({});
  });
  test("accepts sets only", () => {
    expect(DoublesMatchPatchSchema.parse({ sets: [{ a: 11, b: 8 }] })).toEqual({
      sets: [{ a: 11, b: 8 }],
    });
  });
  test("rejects forfeit without winner", () => {
    expect(() =>
      DoublesMatchPatchSchema.parse({ status: "forfeit" }),
    ).toThrow(/Forfeit yêu cầu winner/);
  });
  test("accepts forfeit with winner", () => {
    expect(
      DoublesMatchPatchSchema.parse({ status: "forfeit", winner: "p01" }),
    ).toEqual({ status: "forfeit", winner: "p01" });
  });
  test("rejects winner with bad ID", () => {
    expect(() =>
      DoublesMatchPatchSchema.parse({ status: "forfeit", winner: "bad id!" }),
    ).toThrow();
  });
  test("accepts winner=null when not forfeit", () => {
    expect(
      DoublesMatchPatchSchema.parse({ status: "scheduled", winner: null }),
    ).toEqual({ status: "scheduled", winner: null });
  });
  test("rejects table=0", () => {
    expect(() => DoublesMatchPatchSchema.parse({ table: 0 })).toThrow();
  });
});

describe("TeamMatchPatchSchema", () => {
  const sub = {
    id: "tm01-d",
    label: "Đôi",
    kind: "doubles" as const,
    playersA: ["t01", "t02"],
    playersB: ["t04", "t05"],
    bestOf: 3 as const,
    sets: [],
  };
  test("accepts empty body", () => {
    expect(TeamMatchPatchSchema.parse({})).toEqual({});
  });
  test("accepts individual array", () => {
    const r = TeamMatchPatchSchema.parse({ individual: [sub] });
    expect(r.individual).toHaveLength(1);
  });
  test("rejects empty individual", () => {
    expect(() => TeamMatchPatchSchema.parse({ individual: [] })).toThrow();
  });
  test("rejects > 7 subs", () => {
    const subs = Array(8).fill(sub).map((s, i) => ({ ...s, id: `tm01-${i}` }));
    expect(() => TeamMatchPatchSchema.parse({ individual: subs })).toThrow();
  });
  test("rejects forfeit without winner", () => {
    expect(() =>
      TeamMatchPatchSchema.parse({ status: "forfeit" }),
    ).toThrow(/Forfeit yêu cầu winner/);
  });
  test("rejects duplicate sub IDs", () => {
    const dup = [sub, { ...sub }];
    expect(() => TeamMatchPatchSchema.parse({ individual: dup })).toThrow(
      /Sub-match ID trùng/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/lib/schemas/match.test.ts
```

Expected: FAIL `Cannot find module './match'`.

- [ ] **Step 3: Implement schema**

```ts
// src/lib/schemas/match.ts
import { z } from "zod";
import { IdSchema } from "./id";

export const SetScoreSchema = z.object({
  a: z.number().int().min(0).max(99),
  b: z.number().int().min(0).max(99),
});

export const StatusSchema = z.enum(["scheduled", "done", "forfeit"]);
export const BestOfSchema = z.union([z.literal(3), z.literal(5)]);

export const SubMatchSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1).max(50),
    kind: z.enum(["singles", "doubles"]),
    playersA: z.array(IdSchema).min(1).max(2),
    playersB: z.array(IdSchema).min(1).max(2),
    bestOf: BestOfSchema,
    sets: z.array(SetScoreSchema).max(5),
  })
  .refine(
    (s) =>
      s.kind === "singles"
        ? s.playersA.length === 1 && s.playersB.length === 1
        : s.playersA.length === 2 && s.playersB.length === 2,
    { message: "Số VĐV không khớp loại sub-match" },
  )
  .refine((s) => s.sets.length <= s.bestOf, {
    message: "Số set vượt quá bestOf",
  });

export const DoublesMatchPatchSchema = z
  .object({
    sets: z.array(SetScoreSchema).max(5).optional(),
    status: StatusSchema.optional(),
    winner: IdSchema.nullable().optional(),
    table: z.number().int().min(1).max(99).nullable().optional(),
    bestOf: BestOfSchema.optional(),
  })
  .refine((d) => d.status !== "forfeit" || d.winner != null, {
    message: "Forfeit yêu cầu winner",
  });

export const TeamMatchPatchSchema = z
  .object({
    individual: z.array(SubMatchSchema).min(1).max(7).optional(),
    status: StatusSchema.optional(),
    winner: IdSchema.nullable().optional(),
    table: z.number().int().min(1).max(99).nullable().optional(),
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

export type SetScore = z.infer<typeof SetScoreSchema>;
export type Status = z.infer<typeof StatusSchema>;
export type BestOf = z.infer<typeof BestOfSchema>;
export type SubMatch = z.infer<typeof SubMatchSchema>;

export type MatchResolved = {
  id: string;
  groupId: string;
  pairA: { id: string; label: string };
  pairB: { id: string; label: string };
  table: number | null;
  bestOf: BestOf;
  sets: SetScore[];
  setsA: number;
  setsB: number;
  status: Status;
  winner: { id: string; label: string } | null;
};

export type SubMatchResolved = {
  id: string;
  label: string;
  kind: "singles" | "doubles";
  playersA: Array<{ id: string; name: string }>;
  playersB: Array<{ id: string; name: string }>;
  bestOf: BestOf;
  sets: SetScore[];
};

export type TeamMatchResolved = {
  id: string;
  groupId: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  table: number | null;
  scoreA: number;
  scoreB: number;
  status: Status;
  winner: { id: string; name: string } | null;
  individual: SubMatchResolved[];
};
```

- [ ] **Step 4: Run tests to verify pass**

```bash
bun test src/lib/schemas/match.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/match.ts src/lib/schemas/match.test.ts
git commit -m "feat(schemas): add match zod schemas and resolved types"
```

---

### Task A2: Pure derive module (`src/lib/matches/derive.ts`)

**Files:**
- Create: `src/lib/matches/derive.ts`
- Create: `src/lib/matches/derive.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/matches/derive.test.ts
import { describe, expect, test } from "vitest";
import {
  deriveSetCounts,
  deriveDoublesWinner,
  deriveSubMatchWinner,
  deriveTeamScore,
  deriveTeamWinner,
} from "./derive";
import type { SubMatch } from "@/lib/schemas/match";

describe("deriveSetCounts", () => {
  test("counts wins per side", () => {
    expect(
      deriveSetCounts([{ a: 11, b: 8 }, { a: 9, b: 11 }, { a: 11, b: 7 }]),
    ).toEqual({ a: 2, b: 1 });
  });
  test("ignores tied sets (a==b)", () => {
    expect(deriveSetCounts([{ a: 11, b: 11 }, { a: 11, b: 8 }])).toEqual({
      a: 1,
      b: 0,
    });
  });
  test("empty → 0/0", () => {
    expect(deriveSetCounts([])).toEqual({ a: 0, b: 0 });
  });
});

describe("deriveDoublesWinner", () => {
  test("bestOf=3, 2-1 → pairA", () => {
    expect(
      deriveDoublesWinner(
        [{ a: 11, b: 8 }, { a: 9, b: 11 }, { a: 11, b: 7 }],
        "p01",
        "p02",
        3,
      ),
    ).toBe("p01");
  });
  test("bestOf=3, 1-2 → pairB", () => {
    expect(
      deriveDoublesWinner(
        [{ a: 9, b: 11 }, { a: 11, b: 8 }, { a: 9, b: 11 }],
        "p01",
        "p02",
        3,
      ),
    ).toBe("p02");
  });
  test("bestOf=3, 1-1 → null (chưa quyết)", () => {
    expect(
      deriveDoublesWinner(
        [{ a: 11, b: 8 }, { a: 9, b: 11 }],
        "p01",
        "p02",
        3,
      ),
    ).toBeNull();
  });
  test("bestOf=5, 2-2 → null", () => {
    expect(
      deriveDoublesWinner(
        [
          { a: 11, b: 8 },
          { a: 9, b: 11 },
          { a: 11, b: 7 },
          { a: 8, b: 11 },
        ],
        "p01",
        "p02",
        5,
      ),
    ).toBeNull();
  });
  test("bestOf=5, 3-0 → pairA", () => {
    expect(
      deriveDoublesWinner(
        [{ a: 11, b: 8 }, { a: 11, b: 7 }, { a: 11, b: 6 }],
        "p01",
        "p02",
        5,
      ),
    ).toBe("p01");
  });
  test("empty sets → null", () => {
    expect(deriveDoublesWinner([], "p01", "p02", 3)).toBeNull();
  });
});

describe("deriveSubMatchWinner", () => {
  const baseSub: SubMatch = {
    id: "tm01-s1",
    label: "Đơn 1",
    kind: "singles",
    playersA: ["t01"],
    playersB: ["t04"],
    bestOf: 3,
    sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }],
  };
  test("singles winner = sideA when count majority", () => {
    expect(deriveSubMatchWinner(baseSub, "tA1", "tA2")).toBe("tA1");
  });
  test("doubles winner = sideB when count majority", () => {
    const sub: SubMatch = {
      ...baseSub,
      kind: "doubles",
      playersA: ["t01", "t02"],
      playersB: ["t04", "t05"],
      sets: [{ a: 8, b: 11 }, { a: 7, b: 11 }],
    };
    expect(deriveSubMatchWinner(sub, "tA1", "tA2")).toBe("tA2");
  });
  test("undecided → null", () => {
    const sub: SubMatch = { ...baseSub, sets: [{ a: 11, b: 8 }] };
    expect(deriveSubMatchWinner(sub, "tA1", "tA2")).toBeNull();
  });
});

describe("deriveTeamScore", () => {
  const mkSub = (a: number, b: number): SubMatch => ({
    id: `s-${a}-${b}`,
    label: "x",
    kind: "singles",
    playersA: ["t01"],
    playersB: ["t04"],
    bestOf: 3,
    sets: [{ a, b }, { a, b }],
  });
  test("counts sub winners", () => {
    const subs = [mkSub(11, 0), mkSub(11, 0), mkSub(0, 11)];
    expect(deriveTeamScore(subs, "tA1", "tA2")).toEqual({
      scoreA: 2,
      scoreB: 1,
    });
  });
  test("undecided subs not counted", () => {
    const subs = [
      mkSub(11, 0),
      { ...mkSub(0, 0), sets: [{ a: 11, b: 8 }] }, // 1-0, undecided
    ];
    expect(deriveTeamScore(subs, "tA1", "tA2")).toEqual({
      scoreA: 1,
      scoreB: 0,
    });
  });
  test("empty individual → 0/0", () => {
    expect(deriveTeamScore([], "tA1", "tA2")).toEqual({ scoreA: 0, scoreB: 0 });
  });
});

describe("deriveTeamWinner", () => {
  const mkSub = (a: number, b: number): SubMatch => ({
    id: `s-${a}-${b}`,
    label: "x",
    kind: "singles",
    playersA: ["t01"],
    playersB: ["t04"],
    bestOf: 3,
    sets: [{ a, b }, { a, b }],
  });
  test("3 subs, 2-1 → teamA", () => {
    const subs = [mkSub(11, 0), mkSub(11, 0), mkSub(0, 11)];
    expect(deriveTeamWinner(subs, "tA1", "tA2")).toBe("tA1");
  });
  test("5 subs, 3-2 → teamB", () => {
    const subs = [
      mkSub(0, 11),
      mkSub(0, 11),
      mkSub(11, 0),
      mkSub(11, 0),
      mkSub(0, 11),
    ];
    expect(deriveTeamWinner(subs, "tA1", "tA2")).toBe("tA2");
  });
  test("3 subs, 1-1 (1 undecided) → null", () => {
    const subs = [
      mkSub(11, 0),
      mkSub(0, 11),
      { ...mkSub(0, 0), sets: [] }, // undecided
    ];
    expect(deriveTeamWinner(subs, "tA1", "tA2")).toBeNull();
  });
  test("empty → null", () => {
    expect(deriveTeamWinner([], "tA1", "tA2")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/lib/matches/derive.test.ts
```

Expected: FAIL `Cannot find module './derive'`.

- [ ] **Step 3: Implement derive**

```ts
// src/lib/matches/derive.ts
import type { SetScore, SubMatch, BestOf } from "@/lib/schemas/match";

export function deriveSetCounts(sets: SetScore[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a += 1;
    else if (s.b > s.a) b += 1;
  }
  return { a, b };
}

function threshold(bestOf: BestOf): number {
  return Math.floor(bestOf / 2) + 1;
}

export function deriveDoublesWinner(
  sets: SetScore[],
  pairAId: string,
  pairBId: string,
  bestOf: BestOf,
): string | null {
  const { a, b } = deriveSetCounts(sets);
  const t = threshold(bestOf);
  if (a >= t) return pairAId;
  if (b >= t) return pairBId;
  return null;
}

export function deriveSubMatchWinner(
  sub: SubMatch,
  sideAId: string,
  sideBId: string,
): string | null {
  return deriveDoublesWinner(sub.sets, sideAId, sideBId, sub.bestOf);
}

export function deriveTeamScore(
  individual: SubMatch[],
  teamAId: string,
  teamBId: string,
): { scoreA: number; scoreB: number } {
  let scoreA = 0;
  let scoreB = 0;
  for (const sub of individual) {
    const w = deriveSubMatchWinner(sub, teamAId, teamBId);
    if (w === teamAId) scoreA += 1;
    else if (w === teamBId) scoreB += 1;
  }
  return { scoreA, scoreB };
}

export function deriveTeamWinner(
  individual: SubMatch[],
  teamAId: string,
  teamBId: string,
): string | null {
  if (individual.length === 0) return null;
  const { scoreA, scoreB } = deriveTeamScore(individual, teamAId, teamBId);
  const t = Math.floor(individual.length / 2) + 1;
  if (scoreA >= t) return teamAId;
  if (scoreB >= t) return teamBId;
  return null;
}
```

- [ ] **Step 4: Run tests**

```bash
bun test src/lib/matches/derive.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matches/derive.ts src/lib/matches/derive.test.ts
git commit -m "feat(matches): add pure winner/score derivation module"
```

---

### Task A3: Pure round-robin module (`src/lib/matches/round-robin.ts`)

**Files:**
- Create: `src/lib/matches/round-robin.ts`
- Create: `src/lib/matches/round-robin.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/matches/round-robin.test.ts
import { describe, expect, test } from "vitest";
import {
  generatePairings,
  computeMatchDiff,
  nextMatchId,
} from "./round-robin";

describe("generatePairings", () => {
  test("4 entries → 6 pairings (i<j)", () => {
    const r = generatePairings(["p01", "p02", "p03", "p04"]);
    expect(r).toEqual([
      { a: "p01", b: "p02" },
      { a: "p01", b: "p03" },
      { a: "p01", b: "p04" },
      { a: "p02", b: "p03" },
      { a: "p02", b: "p04" },
      { a: "p03", b: "p04" },
    ]);
  });
  test("empty → []", () => {
    expect(generatePairings([])).toEqual([]);
  });
  test("single → []", () => {
    expect(generatePairings(["p01"])).toEqual([]);
  });
  test("2 entries → 1 pairing", () => {
    expect(generatePairings(["p01", "p02"])).toEqual([{ a: "p01", b: "p02" }]);
  });
});

describe("computeMatchDiff", () => {
  test("first run (no current) → add all", () => {
    const r = computeMatchDiff(
      [],
      [{ a: "p01", b: "p02" }, { a: "p01", b: "p03" }],
    );
    expect(r.keep).toEqual([]);
    expect(r.delete).toEqual([]);
    expect(r.add).toEqual([
      { a: "p01", b: "p02" },
      { a: "p01", b: "p03" },
    ]);
  });
  test("idempotent re-run → keep all", () => {
    const current = [
      { id: "dm01", a: "p01", b: "p02" },
      { id: "dm02", a: "p01", b: "p03" },
    ];
    const r = computeMatchDiff(current, [
      { a: "p01", b: "p02" },
      { a: "p01", b: "p03" },
    ]);
    expect(r.keep.map((m) => m.id)).toEqual(["dm01", "dm02"]);
    expect(r.delete).toEqual([]);
    expect(r.add).toEqual([]);
  });
  test("canonical order match (p02-p01 == p01-p02)", () => {
    const current = [{ id: "dm01", a: "p02", b: "p01" }];
    const r = computeMatchDiff(current, [{ a: "p01", b: "p02" }]);
    expect(r.keep.map((m) => m.id)).toEqual(["dm01"]);
    expect(r.delete).toEqual([]);
    expect(r.add).toEqual([]);
  });
  test("entries changed → keep matching, delete stale, add new", () => {
    const current = [
      { id: "dm01", a: "p01", b: "p02" },
      { id: "dm02", a: "p01", b: "p03" },
      { id: "dm03", a: "p02", b: "p03" },
    ];
    // Swap p03 → p04
    const r = computeMatchDiff(current, [
      { a: "p01", b: "p02" },
      { a: "p01", b: "p04" },
      { a: "p02", b: "p04" },
    ]);
    expect(r.keep.map((m) => m.id).sort()).toEqual(["dm01"]);
    expect(r.delete.sort()).toEqual(["dm02", "dm03"]);
    expect(r.add).toEqual([
      { a: "p01", b: "p04" },
      { a: "p02", b: "p04" },
    ]);
  });
  test("empty target → delete all", () => {
    const current = [{ id: "dm01", a: "p01", b: "p02" }];
    const r = computeMatchDiff(current, []);
    expect(r.delete).toEqual(["dm01"]);
    expect(r.add).toEqual([]);
  });
});

describe("nextMatchId", () => {
  test("empty → first ID with prefix", () => {
    expect(nextMatchId("dm", [])).toBe("dm01");
  });
  test("max+1 (no hole reuse)", () => {
    expect(nextMatchId("dm", ["dm01", "dm03"])).toBe("dm04");
  });
  test("respects pad length", () => {
    expect(nextMatchId("tm", ["tm09"])).toBe("tm10");
  });
  test("ignores non-matching prefix", () => {
    expect(nextMatchId("dm", ["tm01", "tm02"])).toBe("dm01");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/lib/matches/round-robin.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement round-robin**

```ts
// src/lib/matches/round-robin.ts

export type Pairing = { a: string; b: string };
export type CurrentMatch = { id: string; a: string; b: string };

export function generatePairings(entries: string[]): Pairing[] {
  const out: Pairing[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      out.push({ a: entries[i], b: entries[j] });
    }
  }
  return out;
}

function canonKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export type DiffResult = {
  keep: CurrentMatch[];
  delete: string[];
  add: Pairing[];
};

export function computeMatchDiff(
  current: CurrentMatch[],
  target: Pairing[],
): DiffResult {
  const targetKeys = new Set(target.map((p) => canonKey(p.a, p.b)));
  const currentKeys = new Map(
    current.map((m) => [canonKey(m.a, m.b), m]),
  );

  const keep: CurrentMatch[] = [];
  const del: string[] = [];
  for (const m of current) {
    if (targetKeys.has(canonKey(m.a, m.b))) keep.push(m);
    else del.push(m.id);
  }

  const add: Pairing[] = [];
  for (const p of target) {
    if (!currentKeys.has(canonKey(p.a, p.b))) add.push(p);
  }

  return { keep, delete: del, add };
}

export function nextMatchId(prefix: string, existing: string[]): string {
  const nums = existing
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run tests**

```bash
bun test src/lib/matches/round-robin.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matches/round-robin.ts src/lib/matches/round-robin.test.ts
git commit -m "feat(matches): add pure round-robin pairing/diff module"
```

---

### Task A4: DB helper `src/lib/db/matches.ts`

**Files:**
- Create: `src/lib/db/matches.ts`
- Create: `src/lib/db/matches.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/db/matches.test.ts
import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import {
  fetchDoublesMatchesByGroup,
  fetchDoublesMatchById,
  fetchTeamMatchesByGroup,
  fetchTeamMatchById,
} from "./matches";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchDoublesMatchesByGroup", () => {
  test("resolves pair labels", async () => {
    const matchChain = makeSupabaseChain({
      data: [
        {
          id: "dm01",
          group_id: "gA",
          pair_a: "p01",
          pair_b: "p02",
          table: null,
          best_of: 3,
          sets: [],
          status: "scheduled",
          winner: null,
          sets_a: 0,
          sets_b: 0,
        },
      ],
      error: null,
    });
    const pairsChain = makeSupabaseChain({
      data: [
        {
          id: "p01",
          p1: { id: "d01", name: "A" },
          p2: { id: "d02", name: "B" },
        },
        {
          id: "p02",
          p1: { id: "d03", name: "C" },
          p2: { id: "d04", name: "D" },
        },
      ],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchChain as never)
      .mockReturnValueOnce(pairsChain as never);

    const r = await fetchDoublesMatchesByGroup("gA");
    expect(r).toHaveLength(1);
    expect(r[0].pairA).toEqual({ id: "p01", label: "A – B" });
    expect(r[0].pairB).toEqual({ id: "p02", label: "C – D" });
    expect(r[0].setsA).toBe(0);
    expect(r[0].winner).toBeNull();
  });

  test("unknown pair ID → label '?'", async () => {
    const matchChain = makeSupabaseChain({
      data: [
        {
          id: "dm01",
          group_id: "gA",
          pair_a: "p99",
          pair_b: "p02",
          table: null,
          best_of: 3,
          sets: [],
          status: "scheduled",
          winner: null,
          sets_a: 0,
          sets_b: 0,
        },
      ],
      error: null,
    });
    const pairsChain = makeSupabaseChain({
      data: [
        {
          id: "p02",
          p1: { id: "d03", name: "C" },
          p2: { id: "d04", name: "D" },
        },
      ],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchChain as never)
      .mockReturnValueOnce(pairsChain as never);

    const r = await fetchDoublesMatchesByGroup("gA");
    expect(r[0].pairA).toEqual({ id: "p99", label: "?" });
  });

  test("returns winner resolved when set", async () => {
    const matchChain = makeSupabaseChain({
      data: [
        {
          id: "dm01",
          group_id: "gA",
          pair_a: "p01",
          pair_b: "p02",
          table: 3,
          best_of: 3,
          sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }],
          status: "done",
          winner: "p01",
          sets_a: 2,
          sets_b: 0,
        },
      ],
      error: null,
    });
    const pairsChain = makeSupabaseChain({
      data: [
        { id: "p01", p1: { id: "d01", name: "A" }, p2: { id: "d02", name: "B" } },
        { id: "p02", p1: { id: "d03", name: "C" }, p2: { id: "d04", name: "D" } },
      ],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchChain as never)
      .mockReturnValueOnce(pairsChain as never);

    const r = await fetchDoublesMatchesByGroup("gA");
    expect(r[0].winner).toEqual({ id: "p01", label: "A – B" });
    expect(r[0].table).toBe(3);
  });

  test("throws on supabase error", async () => {
    const matchChain = makeSupabaseChain({
      data: null,
      error: { message: "boom" },
    });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(matchChain as never);
    await expect(fetchDoublesMatchesByGroup("gA")).rejects.toThrow("boom");
  });
});

describe("fetchDoublesMatchById", () => {
  test("returns null when not found", async () => {
    const chain = makeSupabaseChain({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(chain as never);
    const r = await fetchDoublesMatchById("dm99");
    expect(r).toBeNull();
  });
});

describe("fetchTeamMatchesByGroup", () => {
  test("resolves teams + sub-match players", async () => {
    const matchChain = makeSupabaseChain({
      data: [
        {
          id: "tm01",
          group_id: "gtA",
          team_a: "tA1",
          team_b: "tA2",
          table: null,
          status: "scheduled",
          score_a: 0,
          score_b: 0,
          winner: null,
          individual: [
            {
              id: "tm01-d",
              label: "Đôi",
              kind: "doubles",
              playersA: ["t01", "t02"],
              playersB: ["t04", "t05"],
              bestOf: 3,
              sets: [],
            },
          ],
        },
      ],
      error: null,
    });
    const teamsChain = makeSupabaseChain({
      data: [
        { id: "tA1", name: "Bình Tân 1", members: ["t01", "t02", "t03"] },
        { id: "tA2", name: "Bình Tân 2", members: ["t04", "t05", "t06"] },
      ],
      error: null,
    });
    const playersChain = makeSupabaseChain({
      data: [
        { id: "t01", name: "Quốc" },
        { id: "t02", name: "Quy" },
        { id: "t04", name: "Hảo" },
        { id: "t05", name: "Hưởng" },
      ],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(matchChain as never)
      .mockReturnValueOnce(teamsChain as never)
      .mockReturnValueOnce(playersChain as never);

    const r = await fetchTeamMatchesByGroup("gtA");
    expect(r).toHaveLength(1);
    expect(r[0].teamA.name).toBe("Bình Tân 1");
    expect(r[0].individual[0].playersA).toEqual([
      { id: "t01", name: "Quốc" },
      { id: "t02", name: "Quy" },
    ]);
  });
});

describe("fetchTeamMatchById", () => {
  test("returns null when not found", async () => {
    const chain = makeSupabaseChain({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(chain as never);
    const r = await fetchTeamMatchById("tm99");
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/lib/db/matches.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement DB helper**

```ts
// src/lib/db/matches.ts
import { supabaseServer } from "@/lib/supabase/server";
import type {
  MatchResolved,
  TeamMatchResolved,
  SubMatchResolved,
  SetScore,
  Status,
  BestOf,
} from "@/lib/schemas/match";

type DoublesMatchRow = {
  id: string;
  group_id: string;
  pair_a: string;
  pair_b: string;
  table: number | null;
  best_of: BestOf;
  sets: SetScore[];
  status: Status;
  winner: string | null;
  sets_a: number;
  sets_b: number;
};

type TeamMatchRow = {
  id: string;
  group_id: string;
  team_a: string;
  team_b: string;
  table: number | null;
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
};

const DOUBLES_SELECT =
  "id, group_id, pair_a, pair_b, table, best_of, sets, status, winner, sets_a, sets_b";
const TEAMS_SELECT =
  "id, group_id, team_a, team_b, table, status, score_a, score_b, winner, individual";

async function buildPairLabelMap(): Promise<Map<string, string>> {
  const { data, error } = await supabaseServer
    .from("doubles_pairs")
    .select("id, p1:doubles_players!p1(id,name), p2:doubles_players!p2(id,name)");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    id: string;
    p1: { id: string; name: string };
    p2: { id: string; name: string };
  }>;
  return new Map(rows.map((r) => [r.id, `${r.p1.name} – ${r.p2.name}`]));
}

function resolveDoublesMatch(
  row: DoublesMatchRow,
  pairMap: Map<string, string>,
): MatchResolved {
  const labelOf = (id: string) => pairMap.get(id) ?? "?";
  return {
    id: row.id,
    groupId: row.group_id,
    pairA: { id: row.pair_a, label: labelOf(row.pair_a) },
    pairB: { id: row.pair_b, label: labelOf(row.pair_b) },
    table: row.table,
    bestOf: row.best_of,
    sets: row.sets ?? [],
    setsA: row.sets_a,
    setsB: row.sets_b,
    status: row.status,
    winner: row.winner ? { id: row.winner, label: labelOf(row.winner) } : null,
  };
}

export async function fetchDoublesMatchesByGroup(
  groupId: string,
): Promise<MatchResolved[]> {
  const { data, error } = await supabaseServer
    .from("doubles_matches")
    .select(DOUBLES_SELECT)
    .eq("group_id", groupId)
    .order("id");
  if (error) throw new Error(error.message);
  const pairMap = await buildPairLabelMap();
  return ((data ?? []) as DoublesMatchRow[]).map((r) =>
    resolveDoublesMatch(r, pairMap),
  );
}

export async function fetchDoublesMatchById(
  id: string,
): Promise<MatchResolved | null> {
  const chain = supabaseServer
    .from("doubles_matches")
    .select(DOUBLES_SELECT)
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: DoublesMatchRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (!data) return null;
  const pairMap = await buildPairLabelMap();
  return resolveDoublesMatch(data, pairMap);
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

function resolveTeamMatch(
  row: TeamMatchRow,
  teamMap: Map<string, string>,
  playerMap: Map<string, string>,
): TeamMatchResolved {
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
    groupId: row.group_id,
    teamA: { id: row.team_a, name: teamLabelOf(row.team_a) },
    teamB: { id: row.team_b, name: teamLabelOf(row.team_b) },
    table: row.table,
    scoreA: row.score_a,
    scoreB: row.score_b,
    status: row.status,
    winner: row.winner
      ? { id: row.winner, name: teamLabelOf(row.winner) }
      : null,
    individual,
  };
}

export async function fetchTeamMatchesByGroup(
  groupId: string,
): Promise<TeamMatchResolved[]> {
  const { data, error } = await supabaseServer
    .from("team_matches")
    .select(TEAMS_SELECT)
    .eq("group_id", groupId)
    .order("id");
  if (error) throw new Error(error.message);
  const [teamMap, playerMap] = await Promise.all([
    buildTeamNameMap(),
    buildTeamPlayerNameMap(),
  ]);
  return ((data ?? []) as TeamMatchRow[]).map((r) =>
    resolveTeamMatch(r, teamMap, playerMap),
  );
}

export async function fetchTeamMatchById(
  id: string,
): Promise<TeamMatchResolved | null> {
  const chain = supabaseServer
    .from("team_matches")
    .select(TEAMS_SELECT)
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: TeamMatchRow | null;
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
  return resolveTeamMatch(data, teamMap, playerMap);
}
```

- [ ] **Step 4: Run tests**

```bash
bun test src/lib/db/matches.test.ts
```

Expected: all pass.

- [ ] **Step 5: Run all tests so far**

```bash
bun test
```

Expected: 165 (baseline) + ~45 new tests pass. tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/matches.ts src/lib/db/matches.test.ts
git commit -m "feat(db): add matches fetch helpers with resolved labels"
```

**CHECKPOINT A complete.** Foundations solid. Tests pass. No DB / UI impact yet. Stop for review before Checkpoint B.

---

## CHECKPOINT B — API routes (4 endpoints)

PATCH match (doubles + teams) + POST regenerate-matches (doubles + teams). Mỗi route 1 task, TDD-first. Mock supabase.

### Task B1: PATCH `/api/doubles/matches/[id]`

**Files:**
- Create: `src/app/api/doubles/matches/[id]/route.ts`
- Create: `src/app/api/doubles/matches/[id]/route.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/api/doubles/matches/[id]/route.test.ts
import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/db/matches", () => ({
  fetchDoublesMatchById: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { cookies } from "next/headers";
import { fetchDoublesMatchById } from "@/lib/db/matches";
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
  return new Request("http://localhost/api/doubles/matches/dm01", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function mockExisting(row: {
  pair_a?: string;
  pair_b?: string;
  sets?: unknown[];
  best_of?: number;
  status?: string;
  winner?: string | null;
}) {
  const chain = makeSupabaseChain({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: "dm01",
      pair_a: row.pair_a ?? "p01",
      pair_b: row.pair_b ?? "p02",
      sets: row.sets ?? [],
      best_of: row.best_of ?? 3,
      status: row.status ?? "scheduled",
      winner: row.winner ?? null,
    },
    error: null,
  });
  return chain;
}
function mockNotFound() {
  const chain = makeSupabaseChain({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  return chain;
}
function mockUpdate() {
  return makeSupabaseChain({ data: null, error: null });
}
function mockUpdateError() {
  return makeSupabaseChain({ data: null, error: { message: "db boom" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchDoublesMatchById).mockResolvedValue({
    id: "dm01",
    groupId: "gA",
    pairA: { id: "p01", label: "A – B" },
    pairB: { id: "p02", label: "C – D" },
    table: null,
    bestOf: 3,
    sets: [],
    setsA: 0,
    setsB: 0,
    status: "scheduled",
    winner: null,
  });
});

describe("PATCH /api/doubles/matches/[id]", () => {
  test("401 when not admin", async () => {
    mockNoCookie();
    const res = await PATCH(patchReq({}), makeCtx("dm01"));
    expect(res.status).toBe(401);
  });

  test("400 when id malformed", async () => {
    mockAdminCookie();
    const res = await PATCH(patchReq({}), makeCtx("bad id!"));
    expect(res.status).toBe(400);
  });

  test("404 when match not found", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from).mockReturnValueOnce(mockNotFound() as never);
    const res = await PATCH(patchReq({}), makeCtx("dm99"));
    expect(res.status).toBe(404);
  });

  test("200 PATCH sets only re-derives setsA/setsB", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting({}) as never)
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }] }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(200);
  });

  test("400 status='done' but sets tied", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from).mockReturnValueOnce(mockExisting({}) as never);
    const res = await PATCH(
      patchReq({
        sets: [{ a: 11, b: 8 }, { a: 9, b: 11 }],
        status: "done",
      }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Chưa đủ set/i);
  });

  test("200 status='done' with sets enough → derives winner", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting({}) as never)
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({
        sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }],
        status: "done",
      }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(200);
  });

  test("400 status='forfeit' without winner", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from).mockReturnValueOnce(mockExisting({}) as never);
    const res = await PATCH(
      patchReq({ status: "forfeit" }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(400);
  });

  test("400 status='forfeit' winner not in {pair_a, pair_b}", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from).mockReturnValueOnce(mockExisting({}) as never);
    const res = await PATCH(
      patchReq({ status: "forfeit", winner: "p99" }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Winner.*pair/i);
  });

  test("200 status='forfeit' with valid winner", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting({}) as never)
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ status: "forfeit", winner: "p02" }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(200);
  });

  test("200 status='scheduled' → resets winner=null", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting({ status: "done", winner: "p01" }) as never)
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ status: "scheduled" }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(200);
  });

  test("200 PATCH table=null clears table", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting({}) as never)
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(patchReq({ table: null }), makeCtx("dm01"));
    expect(res.status).toBe(200);
  });

  test("200 bestOf=5 re-derives winner with new threshold", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(
        mockExisting({
          sets: [{ a: 11, b: 0 }, { a: 11, b: 0 }, { a: 11, b: 0 }],
          best_of: 3,
          status: "done",
          winner: "p01",
        }) as never,
      )
      .mockReturnValueOnce(mockUpdate() as never);
    const res = await PATCH(
      patchReq({ bestOf: 5, status: "done" }),
      makeCtx("dm01"),
    );
    // 3-0 still meets threshold for bestOf=5 (need 3) → ok
    expect(res.status).toBe(200);
  });

  test("500 on supabase update error", async () => {
    mockAdminCookie();
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(mockExisting({}) as never)
      .mockReturnValueOnce(mockUpdateError() as never);
    const res = await PATCH(
      patchReq({ sets: [{ a: 11, b: 8 }] }),
      makeCtx("dm01"),
    );
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/app/api/doubles/matches/
```

Expected: FAIL `Cannot find module './route'`.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/doubles/matches/[id]/route.ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchDoublesMatchById } from "@/lib/db/matches";
import { IdSchema } from "@/lib/schemas/id";
import {
  DoublesMatchPatchSchema,
  type SetScore,
  type Status,
  type BestOf,
} from "@/lib/schemas/match";
import { supabaseServer } from "@/lib/supabase/server";
import {
  deriveDoublesWinner,
  deriveSetCounts,
} from "@/lib/matches/derive";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

type ExistingRow = {
  pair_a: string;
  pair_b: string;
  sets: SetScore[];
  best_of: BestOf;
  status: Status;
  winner: string | null;
};

async function fetchExisting(id: string): Promise<ExistingRow | null> {
  const chain = supabaseServer
    .from("doubles_matches")
    .select("pair_a, pair_b, sets, best_of, status, winner")
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

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const existing = await fetchExisting(id);
    if (!existing) return err("Trận không tồn tại", 404);

    const body = await req.json();
    const parsed = DoublesMatchPatchSchema.parse(body);

    // Forfeit gate
    if (parsed.status === "forfeit") {
      const w = parsed.winner;
      if (w !== existing.pair_a && w !== existing.pair_b) {
        throw new BadRequestError(
          "Winner phải thuộc pair_a hoặc pair_b của trận",
        );
      }
    }

    // Effective values
    const effSets = parsed.sets ?? existing.sets;
    const effBestOf = parsed.bestOf ?? existing.best_of;
    const effStatus: Status = parsed.status ?? existing.status;

    const updates: Record<string, unknown> = {};
    if (parsed.sets !== undefined) {
      updates.sets = parsed.sets;
    }
    if (parsed.bestOf !== undefined) updates.best_of = parsed.bestOf;
    if (parsed.table !== undefined) updates.table = parsed.table;
    if (parsed.status !== undefined) updates.status = parsed.status;

    // Re-derive set counts whenever sets or bestOf changed
    if (parsed.sets !== undefined || parsed.bestOf !== undefined) {
      const { a, b } = deriveSetCounts(effSets);
      updates.sets_a = a;
      updates.sets_b = b;
    }

    // Winner derivation
    if (effStatus === "done") {
      const w = deriveDoublesWinner(
        effSets,
        existing.pair_a,
        existing.pair_b,
        effBestOf,
      );
      if (!w) {
        throw new BadRequestError(
          "Chưa đủ set quyết định, không thể đặt status='done'",
        );
      }
      updates.winner = w;
    } else if (effStatus === "forfeit") {
      updates.winner = parsed.winner ?? existing.winner;
    } else {
      // scheduled
      updates.winner = null;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabaseServer
        .from("doubles_matches")
        .update(updates)
        .eq("id", id);
      if (updErr) return err(updErr.message);
    }

    const resolved = await fetchDoublesMatchById(id);
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

- [ ] **Step 4: Run tests**

```bash
bun test src/app/api/doubles/matches/
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/matches/
git commit -m "feat(api): PATCH /api/doubles/matches/[id] with server-derive winner"
```

---

### Task B2: PATCH `/api/teams/matches/[id]`

**Files:**
- Create: `src/app/api/teams/matches/[id]/route.ts`
- Create: `src/app/api/teams/matches/[id]/route.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/api/teams/matches/[id]/route.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/app/api/teams/matches/
```

Expected: FAIL.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/teams/matches/[id]/route.ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchTeamMatchById } from "@/lib/db/matches";
import { IdSchema } from "@/lib/schemas/id";
import {
  TeamMatchPatchSchema,
  type Status,
  type SubMatch,
} from "@/lib/schemas/match";
import { supabaseServer } from "@/lib/supabase/server";
import {
  deriveTeamScore,
  deriveTeamWinner,
} from "@/lib/matches/derive";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

type ExistingRow = {
  team_a: string;
  team_b: string;
  individual: SubMatch[];
  status: Status;
  winner: string | null;
};

async function fetchExisting(id: string): Promise<ExistingRow | null> {
  const chain = supabaseServer
    .from("team_matches")
    .select("team_a, team_b, individual, status, winner")
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

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const existing = await fetchExisting(id);
    if (!existing) return err("Trận không tồn tại", 404);

    const body = await req.json();
    const parsed = TeamMatchPatchSchema.parse(body);

    // Forfeit gate
    if (parsed.status === "forfeit") {
      const w = parsed.winner;
      if (w !== existing.team_a && w !== existing.team_b) {
        throw new BadRequestError(
          "Winner phải thuộc team_a hoặc team_b của trận",
        );
      }
    }

    const effIndividual = parsed.individual ?? existing.individual;
    const effStatus: Status = parsed.status ?? existing.status;

    // Player membership validation
    if (parsed.individual !== undefined) {
      const members = await fetchTeamsMembers(existing.team_a, existing.team_b);
      validatePlayerMembership(
        parsed.individual,
        members,
        existing.team_a,
        existing.team_b,
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.individual !== undefined) updates.individual = parsed.individual;
    if (parsed.table !== undefined) updates.table = parsed.table;
    if (parsed.status !== undefined) updates.status = parsed.status;

    if (parsed.individual !== undefined) {
      const { scoreA, scoreB } = deriveTeamScore(
        effIndividual,
        existing.team_a,
        existing.team_b,
      );
      updates.score_a = scoreA;
      updates.score_b = scoreB;
    }

    if (effStatus === "done") {
      const w = deriveTeamWinner(
        effIndividual,
        existing.team_a,
        existing.team_b,
      );
      if (!w) {
        throw new BadRequestError(
          "Chưa đủ sub-match quyết định, không thể đặt status='done'",
        );
      }
      updates.winner = w;
    } else if (effStatus === "forfeit") {
      updates.winner = parsed.winner ?? existing.winner;
    } else {
      updates.winner = null;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabaseServer
        .from("team_matches")
        .update(updates)
        .eq("id", id);
      if (updErr) return err(updErr.message);
    }

    const resolved = await fetchTeamMatchById(id);
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

- [ ] **Step 4: Run tests**

```bash
bun test src/app/api/teams/matches/
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/matches/
git commit -m "feat(api): PATCH /api/teams/matches/[id] with player membership + sub derive"
```

---

### Task B3: POST `/api/doubles/groups/[id]/regenerate-matches`

**Files:**
- Create: `src/app/api/doubles/groups/[id]/regenerate-matches/route.ts`
- Create: `src/app/api/doubles/groups/[id]/regenerate-matches/route.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/api/doubles/groups/[id]/regenerate-matches/route.test.ts
import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/db/groups", () => ({
  fetchDoublesGroupById: vi.fn(),
}));
vi.mock("@/lib/db/matches", () => ({
  fetchDoublesMatchesByGroup: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { cookies } from "next/headers";
import { fetchDoublesGroupById } from "@/lib/db/groups";
import { fetchDoublesMatchesByGroup } from "@/lib/db/matches";
import { POST } from "./route";

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
function postReq() {
  return new Request(
    "http://localhost/api/doubles/groups/gA/regenerate-matches",
    { method: "POST", body: JSON.stringify({}) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchDoublesMatchesByGroup).mockResolvedValue([]);
});

describe("POST regenerate-matches doubles", () => {
  test("401 not admin", async () => {
    mockNoCookie();
    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(401);
  });

  test("400 malformed id", async () => {
    mockAdminCookie();
    const res = await POST(postReq(), makeCtx("bad id!"));
    expect(res.status).toBe(400);
  });

  test("404 group not found", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue(null);
    const res = await POST(postReq(), makeCtx("gZ"));
    expect(res.status).toBe(404);
  });

  test("200 empty entries → no-op", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [],
    });
    const fetchChain = makeSupabaseChain({ data: [], error: null });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(fetchChain as never);

    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary).toEqual({ kept: 0, deleted: 0, added: 0 });
  });

  test("200 first run inserts all pairings", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [
        { id: "p01", label: "A" },
        { id: "p02", label: "B" },
        { id: "p03", label: "C" },
      ],
    });
    const fetchCurrent = makeSupabaseChain({ data: [], error: null });
    const fetchAllIds = makeSupabaseChain({ data: [], error: null });
    const insertChain = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(fetchCurrent as never)
      .mockReturnValueOnce(fetchAllIds as never)
      .mockReturnValueOnce(insertChain as never);

    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // 3 entries → C(3,2) = 3 pairings
    expect(body.data.summary).toEqual({ kept: 0, deleted: 0, added: 3 });
  });

  test("200 idempotent re-run keeps all", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [
        { id: "p01", label: "A" },
        { id: "p02", label: "B" },
      ],
    });
    const fetchCurrent = makeSupabaseChain({
      data: [{ id: "dm01", pair_a: "p01", pair_b: "p02" }],
      error: null,
    });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(fetchCurrent as never);

    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary).toEqual({ kept: 1, deleted: 0, added: 0 });
  });

  test("200 entries swap → delete stale + add new + keep matching", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [
        { id: "p01", label: "A" },
        { id: "p02", label: "B" },
        { id: "p04", label: "D" }, // p03 swapped to p04
      ],
    });
    const fetchCurrent = makeSupabaseChain({
      data: [
        { id: "dm01", pair_a: "p01", pair_b: "p02" }, // keep
        { id: "dm02", pair_a: "p01", pair_b: "p03" }, // delete
        { id: "dm03", pair_a: "p02", pair_b: "p03" }, // delete
      ],
      error: null,
    });
    const deleteChain = makeSupabaseChain({ data: null, error: null });
    const fetchAllIds = makeSupabaseChain({
      data: [{ id: "dm01" }, { id: "dm02" }, { id: "dm03" }],
      error: null,
    });
    const insertChain = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(fetchCurrent as never)
      .mockReturnValueOnce(deleteChain as never)
      .mockReturnValueOnce(fetchAllIds as never)
      .mockReturnValueOnce(insertChain as never);

    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary).toEqual({ kept: 1, deleted: 2, added: 2 });
  });

  test("207 partial failure on insert error", async () => {
    mockAdminCookie();
    vi.mocked(fetchDoublesGroupById).mockResolvedValue({
      id: "gA",
      name: "Bảng A",
      entries: [
        { id: "p01", label: "A" },
        { id: "p02", label: "B" },
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

    const res = await POST(postReq(), makeCtx("gA"));
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.error).toMatch(/boom/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/app/api/doubles/groups/[id]/regenerate-matches/
```

Expected: FAIL.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/doubles/groups/[id]/regenerate-matches/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchDoublesGroupById } from "@/lib/db/groups";
import { fetchDoublesMatchesByGroup } from "@/lib/db/matches";
import { IdSchema } from "@/lib/schemas/id";
import { supabaseServer } from "@/lib/supabase/server";
import {
  computeMatchDiff,
  generatePairings,
  nextMatchId,
  type CurrentMatch,
} from "@/lib/matches/round-robin";

type Ctx = { params: Promise<{ id: string }> };

async function fetchCurrentMatches(groupId: string): Promise<CurrentMatch[]> {
  const { data, error } = await supabaseServer
    .from("doubles_matches")
    .select("id, pair_a, pair_b")
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string; pair_a: string; pair_b: string }>).map(
    (r) => ({ id: r.id, a: r.pair_a, b: r.pair_b }),
  );
}

async function fetchAllMatchIds(): Promise<string[]> {
  const { data, error } = await supabaseServer
    .from("doubles_matches")
    .select("id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

export async function POST(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const group = await fetchDoublesGroupById(id);
    if (!group) return err("Bảng không tồn tại", 404);

    const entryIds = group.entries.map((e) => e.id);
    const target = generatePairings(entryIds);
    const current = await fetchCurrentMatches(id);
    const diff = computeMatchDiff(current, target);

    let partialError: string | null = null;

    // Delete stale
    if (diff.delete.length > 0) {
      const { error: delErr } = await supabaseServer
        .from("doubles_matches")
        .delete()
        .in("id", diff.delete);
      if (delErr) partialError = delErr.message;
    }

    // Insert new
    let added = 0;
    if (diff.add.length > 0 && !partialError) {
      const allIds = await fetchAllMatchIds();
      const generated: string[] = [];
      const rows = diff.add.map((p) => {
        const newId = nextMatchId("dm", [...allIds, ...generated]);
        generated.push(newId);
        return {
          id: newId,
          group_id: id,
          pair_a: p.a,
          pair_b: p.b,
          best_of: 3,
          sets: [],
          status: "scheduled",
          sets_a: 0,
          sets_b: 0,
          winner: null,
          table: null,
        };
      });
      const { error: insErr } = await supabaseServer
        .from("doubles_matches")
        .insert(rows);
      if (insErr) partialError = insErr.message;
      else added = rows.length;
    }

    const matches = await fetchDoublesMatchesByGroup(id);
    const summary = {
      kept: diff.keep.length,
      deleted: partialError && diff.delete.length > 0 ? 0 : diff.delete.length,
      added,
    };

    if (partialError) {
      return NextResponse.json(
        { data: { matches, summary }, error: partialError },
        { status: 207 },
      );
    }
    return ok({ matches, summary });
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
```

- [ ] **Step 4: Run tests**

```bash
bun test src/app/api/doubles/groups/[id]/regenerate-matches/
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/groups/[id]/regenerate-matches/
git commit -m "feat(api): POST regenerate-matches doubles (diff-aware)"
```

---

### Task B4: POST `/api/teams/groups/[id]/regenerate-matches`

**Files:**
- Create: `src/app/api/teams/groups/[id]/regenerate-matches/route.ts`
- Create: `src/app/api/teams/groups/[id]/regenerate-matches/route.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/api/teams/groups/[id]/regenerate-matches/route.test.ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/app/api/teams/groups/[id]/regenerate-matches/
```

Expected: FAIL.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/teams/groups/[id]/regenerate-matches/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchTeamGroupById } from "@/lib/db/groups";
import { fetchTeamMatchesByGroup } from "@/lib/db/matches";
import { IdSchema } from "@/lib/schemas/id";
import { supabaseServer } from "@/lib/supabase/server";
import {
  computeMatchDiff,
  generatePairings,
  nextMatchId,
  type CurrentMatch,
} from "@/lib/matches/round-robin";

type Ctx = { params: Promise<{ id: string }> };

function defaultIndividual(matchId: string) {
  return [
    {
      id: `${matchId}-d`,
      label: "Đôi",
      kind: "doubles",
      playersA: [],
      playersB: [],
      bestOf: 3,
      sets: [],
    },
    {
      id: `${matchId}-s1`,
      label: "Đơn 1",
      kind: "singles",
      playersA: [],
      playersB: [],
      bestOf: 3,
      sets: [],
    },
    {
      id: `${matchId}-s2`,
      label: "Đơn 2",
      kind: "singles",
      playersA: [],
      playersB: [],
      bestOf: 3,
      sets: [],
    },
  ];
}

async function fetchCurrentMatches(groupId: string): Promise<CurrentMatch[]> {
  const { data, error } = await supabaseServer
    .from("team_matches")
    .select("id, team_a, team_b")
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string; team_a: string; team_b: string }>).map(
    (r) => ({ id: r.id, a: r.team_a, b: r.team_b }),
  );
}

async function fetchAllMatchIds(): Promise<string[]> {
  const { data, error } = await supabaseServer
    .from("team_matches")
    .select("id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

export async function POST(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const group = await fetchTeamGroupById(id);
    if (!group) return err("Bảng không tồn tại", 404);

    const entryIds = group.entries.map((e) => e.id);
    const target = generatePairings(entryIds);
    const current = await fetchCurrentMatches(id);
    const diff = computeMatchDiff(current, target);

    let partialError: string | null = null;

    if (diff.delete.length > 0) {
      const { error: delErr } = await supabaseServer
        .from("team_matches")
        .delete()
        .in("id", diff.delete);
      if (delErr) partialError = delErr.message;
    }

    let added = 0;
    if (diff.add.length > 0 && !partialError) {
      const allIds = await fetchAllMatchIds();
      const generated: string[] = [];
      const rows = diff.add.map((p) => {
        const newId = nextMatchId("tm", [...allIds, ...generated]);
        generated.push(newId);
        return {
          id: newId,
          group_id: id,
          team_a: p.a,
          team_b: p.b,
          status: "scheduled",
          score_a: 0,
          score_b: 0,
          winner: null,
          table: null,
          individual: defaultIndividual(newId),
        };
      });
      const { error: insErr } = await supabaseServer
        .from("team_matches")
        .insert(rows);
      if (insErr) partialError = insErr.message;
      else added = rows.length;
    }

    const matches = await fetchTeamMatchesByGroup(id);
    const summary = {
      kept: diff.keep.length,
      deleted: partialError && diff.delete.length > 0 ? 0 : diff.delete.length,
      added,
    };

    if (partialError) {
      return NextResponse.json(
        { data: { matches, summary }, error: partialError },
        { status: 207 },
      );
    }
    return ok({ matches, summary });
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
```

- [ ] **Step 4: Run tests**

```bash
bun test src/app/api/teams/groups/[id]/regenerate-matches/
```

Expected: all pass.

- [ ] **Step 5: Run full test suite**

```bash
bun test
```

Expected: 165 (baseline) + ~95 new tests pass. tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/teams/groups/[id]/regenerate-matches/
git commit -m "feat(api): POST regenerate-matches teams (diff-aware + default 3 subs)"
```

**CHECKPOINT B complete.** All 4 routes ship + tested. Stop for review before Checkpoint C.

---

## CHECKPOINT C — Migration 0003 + manual seed verification

Schema seed migration. Idempotent SQL functions. Run trên local DB và verify counts.

### Task C1: Create migration `0003_seed_matches.sql`

**Files:**
- Create: `supabase/migrations/0003_seed_matches.sql`

- [ ] **Step 1: Write migration**

```sql
-- 0003_seed_matches.sql — initial round-robin seed for group-stage matches.
-- Idempotent: only inserts if matches table is empty for the group.
-- Tái tạo logic của reorderRoundRobin() trong _mock.ts (greedy avoid back-to-back)
-- bằng PL/pgSQL function. Insert theo i<j order — không reorder back-to-back ở SQL.
-- Admin có thể PATCH `table` field nếu cần thứ tự cụ thể.

create or replace function seed_round_robin_doubles(p_group_id text)
returns void language plpgsql as $$
declare
  v_entries text[];
  v_pairings record;
  v_n int := 0;
  v_id_seq int;
  v_existing int;
begin
  select count(*) into v_existing from doubles_matches where group_id = p_group_id;
  if v_existing > 0 then return; end if;

  select entries into v_entries from doubles_groups where id = p_group_id;
  if v_entries is null or array_length(v_entries, 1) is null then return; end if;

  select coalesce(max(substring(id from 'dm(\d+)')::int), 0) + 1
    into v_id_seq from doubles_matches;

  for v_pairings in
    select e1.entry as a, e2.entry as b
    from unnest(v_entries) with ordinality e1(entry, ord1)
    cross join unnest(v_entries) with ordinality e2(entry, ord2)
    where e1.ord1 < e2.ord2
    order by e1.ord1, e2.ord2
  loop
    insert into doubles_matches (id, group_id, pair_a, pair_b, best_of, sets, status)
    values (
      'dm' || lpad((v_id_seq + v_n)::text, 2, '0'),
      p_group_id, v_pairings.a, v_pairings.b, 3, '[]'::jsonb, 'scheduled'
    );
    v_n := v_n + 1;
  end loop;
end $$;

create or replace function seed_round_robin_teams(p_group_id text)
returns void language plpgsql as $$
declare
  v_entries text[];
  v_pairings record;
  v_n int := 0;
  v_id_seq int;
  v_existing int;
  v_match_id text;
begin
  select count(*) into v_existing from team_matches where group_id = p_group_id;
  if v_existing > 0 then return; end if;

  select entries into v_entries from team_groups where id = p_group_id;
  if v_entries is null or array_length(v_entries, 1) is null then return; end if;

  select coalesce(max(substring(id from 'tm(\d+)')::int), 0) + 1
    into v_id_seq from team_matches;

  for v_pairings in
    select e1.entry as a, e2.entry as b
    from unnest(v_entries) with ordinality e1(entry, ord1)
    cross join unnest(v_entries) with ordinality e2(entry, ord2)
    where e1.ord1 < e2.ord2
    order by e1.ord1, e2.ord2
  loop
    v_match_id := 'tm' || lpad((v_id_seq + v_n)::text, 2, '0');
    insert into team_matches (id, group_id, team_a, team_b, status, individual)
    values (
      v_match_id, p_group_id, v_pairings.a, v_pairings.b, 'scheduled',
      jsonb_build_array(
        jsonb_build_object('id', v_match_id || '-d',  'label', 'Đôi',
          'kind', 'doubles', 'playersA', '[]'::jsonb, 'playersB', '[]'::jsonb,
          'bestOf', 3, 'sets', '[]'::jsonb),
        jsonb_build_object('id', v_match_id || '-s1', 'label', 'Đơn 1',
          'kind', 'singles', 'playersA', '[]'::jsonb, 'playersB', '[]'::jsonb,
          'bestOf', 3, 'sets', '[]'::jsonb),
        jsonb_build_object('id', v_match_id || '-s2', 'label', 'Đơn 2',
          'kind', 'singles', 'playersA', '[]'::jsonb, 'playersB', '[]'::jsonb,
          'bestOf', 3, 'sets', '[]'::jsonb)
      )
    );
    v_n := v_n + 1;
  end loop;
end $$;

-- Seed all current groups
do $$ declare g record;
begin
  for g in select id from doubles_groups loop
    perform seed_round_robin_doubles(g.id);
  end loop;
  for g in select id from team_groups loop
    perform seed_round_robin_teams(g.id);
  end loop;
end $$;
```

- [ ] **Step 2: Apply migration to local Supabase**

Run (depends on project's migration tooling — adjust if different):

```bash
# Option A: Supabase CLI
supabase db reset 2>/dev/null || supabase migration up

# Option B: psql directly (if local supabase running)
psql "$DATABASE_URL" -f supabase/migrations/0003_seed_matches.sql
```

Expected: migration applies without error.

- [ ] **Step 3: Verify seed counts in DB**

```bash
psql "$DATABASE_URL" -c "select group_id, count(*) from doubles_matches group by group_id order by group_id;"
psql "$DATABASE_URL" -c "select group_id, count(*) from team_matches group by group_id order by group_id;"
```

Expected counts (4 doubles groups gA-gD, 2 team groups gtA-gtB; mock has these entry counts):
- gA: 5 entries → C(5,2) = 10 matches
- gB: 5 entries → 10 matches
- gC: 5 entries → 10 matches
- gD: 5 entries → 10 matches  (wait — recount: 6 entries → 15)
- gtA: 4 teams → C(4,2) = 6 matches
- gtB: 4 teams → 6 matches

NOTE: actual entry counts depend on `doubles_groups.entries` after Phase 4 seed. Verify rather than assume — read actual count from the query above.

- [ ] **Step 4: Verify default sub-matches present in team_matches**

```bash
psql "$DATABASE_URL" -c "select id, jsonb_array_length(individual) from team_matches limit 5;"
```

Expected: each row has `jsonb_array_length` = 3.

- [ ] **Step 5: Re-run migration (idempotent check)**

```bash
psql "$DATABASE_URL" -f supabase/migrations/0003_seed_matches.sql
```

Expected: completes without error, no duplicates created (function guard `existing > 0 → return`).

- [ ] **Step 6: Verify counts unchanged**

```bash
psql "$DATABASE_URL" -c "select count(*) from doubles_matches; select count(*) from team_matches;"
```

Expected: same as Step 3.

- [ ] **Step 7: Commit migration**

```bash
git add supabase/migrations/0003_seed_matches.sql
git commit -m "feat(db): migration 0003 seed group-stage matches (idempotent)"
```

**CHECKPOINT C complete.** DB has matches data. Routes from B ready to PATCH against real data. Stop for review.

---

## CHECKPOINT D — Admin UX (refactor + new components)

Refactor `_components.tsx` minimal-swap (preserve UI, đổi types + thêm fetch). Add 3 new client modules. Wire admin pages.

### Task D1: Client fetch helpers `_match-actions.ts`

**Files:**
- Create: `src/app/admin/_match-actions.ts`

- [ ] **Step 1: Implement fetch helpers**

```ts
// src/app/admin/_match-actions.ts
import type {
  MatchResolved,
  TeamMatchResolved,
  Status,
  SetScore,
  BestOf,
  SubMatch,
} from "@/lib/schemas/match";

type ApiResponse<T> = { data: T | null; error: string | null };

export async function patchDoublesMatch(
  id: string,
  body: {
    sets?: SetScore[];
    status?: Status;
    winner?: string | null;
    table?: number | null;
    bestOf?: BestOf;
  },
): Promise<MatchResolved> {
  const res = await fetch(`/api/doubles/matches/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<MatchResolved>;
  if (!res.ok || !json.data) {
    throw new Error(json.error ?? "Lỗi không xác định");
  }
  return json.data;
}

export async function patchTeamMatch(
  id: string,
  body: {
    individual?: SubMatch[];
    status?: Status;
    winner?: string | null;
    table?: number | null;
  },
): Promise<TeamMatchResolved> {
  const res = await fetch(`/api/teams/matches/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<TeamMatchResolved>;
  if (!res.ok || !json.data) {
    throw new Error(json.error ?? "Lỗi không xác định");
  }
  return json.data;
}

export type RegenerateSummary = { kept: number; deleted: number; added: number };

export async function regenerateMatches(
  kind: "doubles" | "teams",
  groupId: string,
): Promise<{
  matches: MatchResolved[] | TeamMatchResolved[];
  summary: RegenerateSummary;
}> {
  const path = kind === "doubles"
    ? `/api/doubles/groups/${groupId}/regenerate-matches`
    : `/api/teams/groups/${groupId}/regenerate-matches`;
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const json = (await res.json()) as ApiResponse<{
    matches: MatchResolved[] | TeamMatchResolved[];
    summary: RegenerateSummary;
  }>;
  if (!json.data) {
    throw new Error(json.error ?? "Lỗi không xác định");
  }
  if (!res.ok && res.status !== 207) {
    throw new Error(json.error ?? "Lỗi không xác định");
  }
  return json.data;
}
```

- [ ] **Step 2: tsc check**

```bash
bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_match-actions.ts
git commit -m "feat(admin): client fetch helpers for matches PATCH + regenerate"
```

---

### Task D2: GroupRegenerateButton component

**Files:**
- Create: `src/app/admin/_group-regenerate-button.tsx`

- [ ] **Step 1: Implement component**

```tsx
// src/app/admin/_group-regenerate-button.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { regenerateMatches } from "./_match-actions";

export function GroupRegenerateButton({
  kind,
  groupId,
  groupName,
}: {
  kind: "doubles" | "teams";
  groupId: string;
  groupName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        const res = await regenerateMatches(kind, groupId);
        const { kept, deleted, added } = res.summary;
        toast.success(
          `${groupName}: giữ ${kept} / xóa ${deleted} / thêm ${added} trận`,
        );
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lỗi không xác định");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={isPending}>
            <RefreshCw className={isPending ? "animate-spin" : ""} />
            Tạo lại lịch
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đồng bộ lịch theo entries hiện tại?</DialogTitle>
          <DialogDescription>
            Sẽ giữ các trận có cặp/đội còn trong bảng, xóa cặp đã rời, thêm cặp
            mới. Trận đã đấu (sets/winner) được bảo toàn.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={<Button variant="ghost">Hủy</Button>}
          />
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Đang đồng bộ..." : "Đồng bộ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: tsc check**

```bash
bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_group-regenerate-button.tsx
git commit -m "feat(admin): GroupRegenerateButton with confirm dialog"
```

---

### Task D3: PlayerPicker component

**Files:**
- Create: `src/app/admin/_player-picker.tsx`

- [ ] **Step 1: Implement component**

```tsx
// src/app/admin/_player-picker.tsx
"use client";

import { ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";

type Player = { id: string; name: string };

export function PlayerPicker({
  options,
  value,
  onChange,
  count,
  label,
}: {
  options: Player[];
  value: string[]; // selected player IDs
  onChange: (next: string[]) => void;
  count: 1 | 2;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);

  const toggle = (id: string) => {
    setDraft((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= count) {
        // Replace oldest if at limit
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const apply = () => {
    if (draft.length !== count) return;
    onChange(draft);
    setOpen(false);
  };

  const display =
    value.length === 0
      ? "Chọn VĐV"
      : value
          .map((id) => options.find((o) => o.id === id)?.name ?? "?")
          .join(", ");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setDraft(value);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
          >
            <span className="truncate">{display}</span>
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {label} — chọn {count} VĐV
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
          {options.map((p) => {
            const selected = draft.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted ${
                  selected ? "bg-muted" : ""
                }`}
              >
                <span>{p.name}</span>
                {selected ? <Check className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Hủy</Button>} />
          <Button onClick={apply} disabled={draft.length !== count}>
            Chọn ({draft.length}/{count})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: tsc check**

```bash
bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_player-picker.tsx
git commit -m "feat(admin): PlayerPicker dialog (1-2 player select)"
```

---

### Task D4: Refactor `DoublesSchedule` + `DoublesMatchCard` + `EditMatchDialog`

**Files:**
- Modify: `src/app/admin/_components.tsx` — doubles match section

This refactor swaps types from mock (`DoublesMatch` label-based) → resolved (`MatchResolved` ID-based with `pairA: {id, label}`). Adds PATCH calls + status switcher + forfeit winner picker.

- [ ] **Step 1: Read current doubles section**

```bash
# Read lines covering DoublesSchedule, DoublesMatchCard, EditMatchDialog
# (approximately lines 345-980 in current _components.tsx)
```

- [ ] **Step 2: Apply minimal-swap edit**

Replace prop type from `DoublesMatch[]` → `MatchResolved[]`. Update field references:
- `match.pairA` (was string) → `match.pairA.label`
- `match.pairB` → `match.pairB.label`
- `match.bestOf` → `match.bestOf` (unchanged)
- `match.sets` → `match.sets` (unchanged shape)
- `match.status` → `match.status` (now also includes 'forfeit')
- `match.id` → `match.id` (unchanged)

In `STATUS_META` (around line 160), add forfeit entry:

```ts
const STATUS_META: Record<Status, { label: string; className: string }> = {
  scheduled: { label: "Chưa đấu", className: "bg-muted text-muted-foreground" },
  done: { label: "Đã xong", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  forfeit: { label: "Bỏ cuộc", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
};
```

Replace import line 32-44 to use resolved types:

```ts
import type {
  Content,
  KnockoutMatch,
  OppSlot,
  Player,
  Team,
  TeamSlot,
} from "./_mock";
import { MOCK_TEAMS, ROUND_LABEL, TEAM_MATCH_TEMPLATE } from "./_mock";
import type { PairWithNames } from "@/lib/schemas/pair";
import type { TeamWithNames } from "@/lib/schemas/team";
import type { GroupResolved } from "@/lib/schemas/group";
import type {
  MatchResolved,
  TeamMatchResolved,
  Status,
  SetScore,
} from "@/lib/schemas/match";
import { patchDoublesMatch, patchTeamMatch } from "./_match-actions";
import { toast } from "sonner";
```

In `DoublesSchedule` props, change `matches: DoublesMatch[]` → `matches: MatchResolved[]`. Same for `DoublesMatchCard`.

In `EditMatchDialog` (called from `DoublesMatchCard`), change save handler to call `patchDoublesMatch`. Existing dialog prop signature shape: `{ open, onClose, sets, onSave }`. Add new props:
- `matchId: string`
- `pairAId: string`, `pairAlabel: string`
- `pairBId: string`, `pairBlabel: string`
- `currentStatus: Status`
- `currentWinner: string | null`

In dialog body, add status switcher (3 radios scheduled/done/forfeit), and conditional winner picker when status='forfeit' (radio between pairA / pairB).

The implementer should follow this minimal-swap intent. Do not rewrite the entire dialog UI — preserve existing sets editor, just add status + winner controls and replace `onSave` with API call.

In `DoublesMatchCard`, when EditMatchDialog returns updated data (via callback), update local optimistic state:

```tsx
// inside DoublesMatchCard
const [match, setMatch] = useState<MatchResolved>(initialMatch);

const handleSave = async (body: {
  sets?: SetScore[];
  status?: Status;
  winner?: string | null;
}) => {
  const optimistic = { ...match };
  // Optionally apply optimistic body to local state here
  try {
    const updated = await patchDoublesMatch(match.id, body);
    setMatch(updated);
    toast.success("Đã lưu");
  } catch (e) {
    setMatch(optimistic);
    toast.error(e instanceof Error ? e.message : "Lỗi");
  }
};
```

`computeDoublesStandings` (line ~211) accepts `matches: DoublesMatch[]` (label-based). Add a wrapper function in this file:

```ts
function resolvedToLegacyDoublesMatch(m: MatchResolved) {
  return {
    id: m.id,
    groupId: m.groupId,
    pairA: m.pairA.label,
    pairB: m.pairB.label,
    bestOf: m.bestOf,
    sets: m.sets,
    status: m.status === "forfeit" ? "done" : m.status,
    table: m.table ?? undefined,
  };
}
```

Use this wrapper at every call site that passes resolved matches into `computeDoublesStandings`. Don't touch `computeDoublesStandings` body itself — Phase 5B replaces with DB views.

- [ ] **Step 3: Run tsc + tests**

```bash
bunx tsc --noEmit
bun test
```

Expected: tsc clean. Existing tests pass (route + schema + db tests).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/_components.tsx
git commit -m "refactor(admin): DoublesSchedule uses MatchResolved + PATCH + status switcher"
```

---

### Task D5: Refactor `TeamSchedule` + `TeamMatchCard` + `IndividualMatchRow`

**Files:**
- Modify: `src/app/admin/_components.tsx` — teams match section

- [ ] **Step 1: Apply minimal-swap edit**

Change `TeamSchedule` and `TeamMatchCard` prop type from `TeamMatch[]` → `TeamMatchResolved[]`.

Field references:
- `match.teamA` (was string) → `match.teamA.name`
- `match.teamB` → `match.teamB.name`
- `match.scoreA`, `match.scoreB`, `match.status`, `match.id` — unchanged
- `match.individual` — now `SubMatchResolved[]` with `playersA: Array<{id,name}>`

`IndividualMatchRow` prop shape:
- Was: `match: IndividualMatch` with `playerA: string`, `playerB: string`
- Now: `sub: SubMatchResolved` with `playersA: Array<{id,name}>`, `playersB: Array<{id,name}>`, `kind: 'singles'|'doubles'`

Add 2 new props for picker source:
- `teamAPlayers: Array<{id, name}>` (resolved from team_a.members)
- `teamBPlayers: Array<{id, name}>`

These need to be passed down from `TeamMatchCard`. Source: `match.individual` only has selected players, not all team members. Need to fetch team players. Pass from RSC parent (admin page) to `TeamSchedule` to `TeamMatchCard` to `IndividualMatchRow`.

Add a new prop `teamPlayersByTeamId: Record<string, Array<{id, name}>>` to `TeamSchedule`. Each `TeamMatchCard` looks up by `match.teamA.id` and `match.teamB.id`.

In `IndividualMatchRow`, replace the static `playerA: "—"` rendering with `<PlayerPicker>` for each side. On change → update `sub.playersA` / `sub.playersB` in local state. Save coalesces all subs into single PATCH.

Add "+ Thêm sub" button at end of subs list:

```tsx
import { nanoid } from "nanoid";

const handleAddSub = () => {
  setSubs((prev) => [
    ...prev,
    {
      id: `${match.id}-${nanoid(6)}`,
      label: "Sub mới",
      kind: "singles",
      playersA: [],
      playersB: [],
      bestOf: 3,
      sets: [],
    },
  ]);
};
```

Each sub row gets a delete button (disabled if `subs.length <= 1`).

Save handler:

```tsx
const handleSave = async () => {
  try {
    const updated = await patchTeamMatch(match.id, {
      individual: subs,
      status: status,
      winner: status === "forfeit" ? winnerPick : null,
    });
    setMatch(updated);
    toast.success("Đã lưu");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Lỗi");
  }
};
```

Update `computeTeamStandings` (line ~245) wrapper similar to D4 — keep function body untouched, wrap input.

```ts
function resolvedToLegacyTeamMatch(m: TeamMatchResolved) {
  return {
    id: m.id,
    groupId: m.groupId,
    teamA: m.teamA.name,
    teamB: m.teamB.name,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    status: m.status === "forfeit" ? "done" : m.status,
    individual: [],
    table: m.table ?? undefined,
  };
}
```

- [ ] **Step 2: Run tsc + tests**

```bash
bunx tsc --noEmit
bun test
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_components.tsx
git commit -m "refactor(admin): TeamSchedule with player picker + variable subs + PATCH"
```

---

### Task D6: Wire admin group detail pages

**Files:**
- Modify: `src/app/admin/doubles/groups/[id]/page.tsx`
- Modify: `src/app/admin/teams/groups/[id]/page.tsx`

- [ ] **Step 1: Update doubles page**

Replace mock import with DB fetch + add regenerate button:

```tsx
// src/app/admin/doubles/groups/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoublesSchedule } from "../../../_components";
import { GroupRegenerateButton } from "../../../_group-regenerate-button";
import { fetchDoublesGroupById } from "@/lib/db/groups";
import { fetchDoublesMatchesByGroup } from "@/lib/db/matches";

export const dynamic = "force-dynamic";

export default async function DoublesGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group, matches] = await Promise.all([
    fetchDoublesGroupById(id),
    fetchDoublesMatchesByGroup(id),
  ]);
  if (!group) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="sticky top-0 z-20 -mx-4 -mt-4 flex items-center gap-2 bg-background px-4 pb-3 pt-4">
        <Button
          nativeButton={false}
          render={<Link href="/admin/doubles?tab=groups" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">Nội dung Đôi · vòng bảng</p>
        </div>
        <GroupRegenerateButton
          kind="doubles"
          groupId={group.id}
          groupName={group.name}
        />
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

- [ ] **Step 2: Update teams page**

```tsx
// src/app/admin/teams/groups/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamSchedule } from "../../../_components";
import { GroupRegenerateButton } from "../../../_group-regenerate-button";
import { fetchTeamGroupById } from "@/lib/db/groups";
import { fetchTeamMatchesByGroup } from "@/lib/db/matches";
import { fetchTeams } from "@/lib/db/teams";

export const dynamic = "force-dynamic";

export default async function TeamsGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group, matches, allTeams] = await Promise.all([
    fetchTeamGroupById(id),
    fetchTeamMatchesByGroup(id),
    fetchTeams(),
  ]);
  if (!group) notFound();

  // Build teamPlayersByTeamId map for player picker
  const teamPlayersByTeamId: Record<string, Array<{ id: string; name: string }>> = {};
  for (const t of allTeams) {
    teamPlayersByTeamId[t.id] = t.members;
  }

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
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">Nội dung Đồng đội · vòng bảng</p>
        </div>
        <GroupRegenerateButton
          kind="teams"
          groupId={group.id}
          groupName={group.name}
        />
      </header>

      <TeamSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries.map((e) => e.label)}
        matches={matches}
        teamPlayersByTeamId={teamPlayersByTeamId}
      />
    </main>
  );
}
```

- [ ] **Step 3: Run tsc + build**

```bash
bunx tsc --noEmit
bun run build
```

Expected: tsc clean. Build successful with 22+ routes (Phase 4 = 18 + 4 new).

- [ ] **Step 4: Run all tests**

```bash
bun test
```

Expected: all pass (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/doubles/groups/[id]/page.tsx src/app/admin/teams/groups/[id]/page.tsx
git commit -m "feat(admin): wire group detail pages to DB matches + regenerate button"
```

**CHECKPOINT D complete.** Admin UX migrated. Stop for manual smoke test.

---

## Manual smoke test (cuối phase)

Run on local dev server with applied 0003 migration.

- [ ] **Smoke 1:** `bun run dev` → login admin (`/admin/login`, password `123456`).
- [ ] **Smoke 2:** Navigate `/admin/doubles/groups/gA` → thấy danh sách trận round-robin (số trận = C(N,2) với N = số entries của gA).
- [ ] **Smoke 3:** Click trận đầu → edit dialog → input sets `11-8, 11-7` → status='done' → Save → verify winner = pairA, toast success.
- [ ] **Smoke 4:** Re-open same match → đổi sets `11-8, 9-11, 11-5` → save → winner vẫn pairA, setsA=2 setsB=1.
- [ ] **Smoke 5:** Status='scheduled' → save → winner cleared.
- [ ] **Smoke 6:** Status='forfeit' không pick winner → 400 error toast (red).
- [ ] **Smoke 7:** Status='forfeit' + pick winner=pairB → save → winner=pairB.
- [ ] **Smoke 8:** Navigate `/admin/teams/groups/gtA` → trận đầu → edit individual: sub Đôi pick 2 players từ team A + 2 từ team B → input sets → save → verify subMatch winner derived.
- [ ] **Smoke 9:** Click "+ Thêm sub" → kind=singles, pick 1 player mỗi bên → save → verify 4 sub.
- [ ] **Smoke 10:** Click "Tạo lại lịch" → confirm → verify toast `"giữ N / xóa 0 / thêm 0 trận"`.
- [ ] **Smoke 11:** Vào `/admin/doubles?tab=groups`, swap pair p05 từ gB sang gA → quay lại `/admin/doubles/groups/gA` → click "Tạo lại lịch" → verify toast với số trận thêm tương ứng.
- [ ] **Smoke 12:** Status='done' với sets tied (1-1) → 400 error toast.

If any smoke fails, fix and re-run that smoke + the smoke after it.

---

## Final ship

- [ ] **Step 1: Run all checks**

```bash
bunx tsc --noEmit
bun test
bun run build
```

Expected: tsc clean, ~250 tests pass (165 baseline + ~85 new), build successful.

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/supabase-phase-5a
```

- [ ] **Step 3: Create PR**

Use `gh` to create PR with title `feat: supabase integration phase 5a (matches API + admin migration)` and body summarizing:
- 4 routes new (PATCH match × 2 + POST regenerate × 2)
- Pure modules: derive + round-robin
- Migration 0003 seed
- Admin UX refactor minimal-swap
- Public + standings + home defer 5B/5C

- [ ] **Step 4: Squash merge after review**

---

## Self-review checklist

Sau khi viết xong plan, kiểm tra lại spec:

- [x] Spec section 1 (mục tiêu/scope) → covered by Pre-flight + entire plan
- [x] Spec section 2 (decisions table) → reflected in route/schema/component design
- [x] Spec section 3 (schema seed) → Task C1
- [x] Spec section 4 (architecture/boundaries) → Tasks A1-A4 (foundations) + B1-B4 (routes) + D1-D6 (UX)
- [x] Spec section 5 (API endpoints) → Tasks B1-B4
- [x] Spec section 6 (admin UX) → Tasks D1-D6
- [x] Spec section 7 (testing) → tests in each task + manual smoke
- [x] Spec section 8 (out of scope + risks) → defer notes in plan, risks mitigated by structure (pure functions, idempotent diff, server-derive)

No placeholders. Type names consistent across tasks (`MatchResolved`, `SubMatchResolved`, `TeamMatchResolved`, `Status`, `SubMatch`, `SetScore`, `BestOf`). Function names consistent (`patchDoublesMatch`, `patchTeamMatch`, `regenerateMatches`, `deriveDoublesWinner`, `computeMatchDiff`, `nextMatchId`, `generatePairings`).



