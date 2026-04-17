# Phase 5C — Home Feed Migration & Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate public-facing `/d/` and `/t/` tabs from mock data to Supabase and redesign the layout with swipeable carousels, inline standings, and compact schedule lists.

**Architecture:** Server components fetch all data via `src/lib/db/` functions, pass props to client components. New `standings.ts` computes BXH server-side. New UI components use CSS scroll-snap for swipe, IntersectionObserver for dots. A DB migration adds `updated_at` to enable "recent results" sorting.

**Tech Stack:** Next.js (App Router), Supabase (PostgreSQL), Tailwind CSS, Vitest, TypeScript strict mode.

**Spec:** `docs/superpowers/specs/2026-04-17-phase-5c-home-feed-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/0005_add_updated_at.sql` | Create | Add `updated_at` column to 4 tables |
| `src/lib/db/standings.ts` | Create | `fetchGroupStandings`, `fetchAllGroupStandings` — compute BXH from matches |
| `src/lib/db/standings.test.ts` | Create | Tests for standings computation |
| `src/lib/db/matches.ts` | Modify | Add `fetchLiveMatches`, `fetchRecentResults`, `fetchAllMatchesByGroup` |
| `src/lib/db/matches.test.ts` | Modify | Add tests for new functions |
| `src/lib/db/search.ts` | Create | `searchPlayers`, `searchMatches` — Supabase ILIKE search |
| `src/lib/db/search.test.ts` | Create | Tests for search functions |
| `src/app/api/doubles/matches/[id]/route.ts` | Modify | Add `updated_at: new Date().toISOString()` to updates object |
| `src/app/api/teams/matches/[id]/route.ts` | Modify | Same |
| `src/app/api/doubles/ko/[id]/route.ts` | Modify | Same |
| `src/app/api/teams/ko/[id]/route.ts` | Modify | Same |
| `src/app/_SwipeCarousel.tsx` | Create | Shared swipe container + dots indicator (client) |
| `src/app/_MatchCard.tsx` | Create | Shared match card for live + results (client) |
| `src/app/_StandingsSummary.tsx` | Create | BXH carousel (client) |
| `src/app/_ScheduleList.tsx` | Create | Group schedule + KO schedule with filter chips (client) |
| `src/app/_ContentHome.tsx` | Rewrite | New server layout using new components |
| `src/app/_publicGroup.tsx` | Modify | Remove mock imports, receive data via props |
| `src/app/d/page.tsx` | Modify | Fetch all data including new queries |
| `src/app/t/page.tsx` | Modify | Same |
| `src/app/search/page.tsx` | Modify | Replace mock search with `src/lib/db/search.ts` |
| `src/app/_home.ts` | Delete | All consumers migrated |
| `src/app/_feedCards.tsx` | Delete | Replaced by new components |

---

### Task 1: DB Migration — Add `updated_at` Column

**Files:**
- Create: `supabase/migrations/0005_add_updated_at.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 0005_add_updated_at.sql
-- Add updated_at to match tables for "recent results" sorting

ALTER TABLE doubles_matches ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE team_matches ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE doubles_ko ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE team_ko ADD COLUMN updated_at timestamptz DEFAULT now();
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db push` or `npx supabase migration up` (use whichever command the project uses — check `package.json` scripts).

If using Supabase local dev: `npx supabase db reset`

Expected: Migration applies without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_add_updated_at.sql
git commit -m "feat(db): add updated_at column to match tables"
```

---

### Task 2: Wire `updated_at` into PATCH API Routes

**Files:**
- Modify: `src/app/api/doubles/matches/[id]/route.ts:~115` (before the `.update(updates)` call)
- Modify: `src/app/api/teams/matches/[id]/route.ts:~161` (before the `.update(updates)` call)
- Modify: `src/app/api/doubles/ko/[id]/route.ts:~139` (before the `.update(updates)` call)
- Modify: `src/app/api/teams/ko/[id]/route.ts:~181` (before the `.update(updates)` call)

- [ ] **Step 1: Add `updated_at` to doubles matches PATCH**

In `src/app/api/doubles/matches/[id]/route.ts`, find the block:

```typescript
    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabaseServer
        .from("doubles_matches")
        .update(updates)
        .eq("id", id);
```

Add `updated_at` to the updates object right before the `if` block:

```typescript
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length > 0) {
```

You also need to extend the `updates` type. Find where `updates` is declared (likely `const updates: Record<string, unknown> = {}` or a typed object). If it's typed, add `updated_at?: string` to the type. If it's `Record<string, unknown>`, no type change needed.

- [ ] **Step 2: Add `updated_at` to teams matches PATCH**

Same pattern in `src/app/api/teams/matches/[id]/route.ts`. Find the `.update(updates)` call and add `updates.updated_at = new Date().toISOString();` before it.

- [ ] **Step 3: Add `updated_at` to doubles ko PATCH**

Same pattern in `src/app/api/doubles/ko/[id]/route.ts`.

- [ ] **Step 4: Add `updated_at` to teams ko PATCH**

Same pattern in `src/app/api/teams/ko/[id]/route.ts`.

- [ ] **Step 5: Run existing tests to verify no regressions**

Run: `npx vitest run`
Expected: All existing tests pass. The mock chain already handles unknown update keys via `Record<string, unknown>`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/doubles/matches/\[id\]/route.ts src/app/api/teams/matches/\[id\]/route.ts src/app/api/doubles/ko/\[id\]/route.ts src/app/api/teams/ko/\[id\]/route.ts
git commit -m "feat(api): set updated_at on match/ko PATCH"
```

---

### Task 3: `standings.ts` — Server-Side BXH Computation

**Files:**
- Create: `src/lib/db/standings.ts`
- Create: `src/lib/db/standings.test.ts`

- [ ] **Step 1: Write the failing test for `computeStandings`**

The standings logic is pure computation (no DB). Extract it as a pure function first, test it, then wrap with DB fetching.

Create `src/lib/db/standings.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import { computeDoublesStandings, computeTeamStandings } from "./standings";
import type { MatchResolved } from "@/lib/schemas/match";

describe("computeDoublesStandings", () => {
  test("computes W/L/diff/points from done matches", () => {
    const matches: Pick<MatchResolved, "status" | "pairA" | "pairB" | "sets">[] = [
      {
        status: "done",
        pairA: { id: "p01", label: "A – B" },
        pairB: { id: "p02", label: "C – D" },
        sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }], // p01 wins 2-0
      },
      {
        status: "done",
        pairA: { id: "p01", label: "A – B" },
        pairB: { id: "p03", label: "E – F" },
        sets: [{ a: 8, b: 11 }, { a: 11, b: 9 }, { a: 11, b: 7 }], // p01 wins 2-1
      },
      {
        status: "scheduled",
        pairA: { id: "p02", label: "C – D" },
        pairB: { id: "p03", label: "E – F" },
        sets: [],
      },
    ];
    const entries = ["A – B", "C – D", "E – F"];
    const result = computeDoublesStandings(
      matches as MatchResolved[],
      entries,
    );
    expect(result).toHaveLength(3);
    // A – B: 2W 0L, diff = (2-0)+(2-1) = +3
    expect(result[0]).toMatchObject({
      entry: "A – B",
      played: 2,
      won: 2,
      lost: 0,
      diff: 3,
      points: 2,
    });
    // C – D: 0W 1L, diff = (0-2) = -2
    expect(result[1]).toMatchObject({
      entry: "C – D",
      played: 1,
      won: 0,
      lost: 1,
      diff: -2,
      points: 0,
    });
    // E – F: 0W 1L, diff = (1-2) = -1
    expect(result[2]).toMatchObject({
      entry: "E – F",
      played: 1,
      won: 0,
      lost: 1,
      diff: -1,
      points: 0,
    });
  });

  test("ignores scheduled/live matches", () => {
    const matches: Pick<MatchResolved, "status" | "pairA" | "pairB" | "sets">[] = [
      {
        status: "live",
        pairA: { id: "p01", label: "A – B" },
        pairB: { id: "p02", label: "C – D" },
        sets: [{ a: 11, b: 8 }],
      },
    ];
    const result = computeDoublesStandings(
      matches as MatchResolved[],
      ["A – B", "C – D"],
    );
    expect(result[0].played).toBe(0);
    expect(result[0].points).toBe(0);
  });

  test("sorts by points DESC → diff DESC → won DESC", () => {
    const matches: Pick<MatchResolved, "status" | "pairA" | "pairB" | "sets">[] = [
      {
        status: "done",
        pairA: { id: "p01", label: "A" },
        pairB: { id: "p02", label: "B" },
        sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }], // A wins 2-0
      },
      {
        status: "done",
        pairA: { id: "p02", label: "B" },
        pairB: { id: "p03", label: "C" },
        sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }], // B wins 2-0
      },
      {
        status: "done",
        pairA: { id: "p03", label: "C" },
        pairB: { id: "p01", label: "A" },
        sets: [{ a: 11, b: 8 }, { a: 11, b: 7 }], // C wins 2-0
      },
    ];
    const result = computeDoublesStandings(
      matches as MatchResolved[],
      ["A", "B", "C"],
    );
    // All 1W 1L, 1pt each. Diff: A=(2-0)+(0-2)=0, B=(2-0)+(0-2)=0, C=(2-0)+(0-2)=0
    // All tied — should be stable sort
    expect(result.every((r) => r.points === 1)).toBe(true);
  });

  test("returns empty standings for entries with no matches", () => {
    const result = computeDoublesStandings([], ["A", "B"]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ played: 0, won: 0, lost: 0, diff: 0, points: 0 });
  });
});

describe("computeTeamStandings", () => {
  test("uses scoreA/scoreB instead of sets", () => {
    const matches = [
      {
        status: "done" as const,
        teamA: { id: "tA1", name: "Team 1" },
        teamB: { id: "tA2", name: "Team 2" },
        scoreA: 2,
        scoreB: 1,
      },
    ];
    const result = computeTeamStandings(
      matches as any,
      ["Team 1", "Team 2"],
    );
    expect(result[0]).toMatchObject({
      entry: "Team 1",
      won: 1,
      diff: 1,
      points: 1,
    });
    expect(result[1]).toMatchObject({
      entry: "Team 2",
      won: 0,
      diff: -1,
      points: 0,
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/lib/db/standings.test.ts`
Expected: FAIL — module `./standings` not found.

- [ ] **Step 3: Implement `standings.ts`**

Create `src/lib/db/standings.ts`:

```typescript
import type { MatchResolved, TeamMatchResolved, SetScore } from "@/lib/schemas/match";
import type { GroupResolved } from "@/lib/schemas/group";
import { fetchDoublesMatchesByGroup, fetchTeamMatchesByGroup } from "./matches";

export type StandingRow = {
  entry: string;
  played: number;
  won: number;
  lost: number;
  diff: number;
  points: number;
};

function setsSummary(sets: SetScore[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a += 1;
    else if (s.b > s.a) b += 1;
  }
  return { a, b };
}

export function computeDoublesStandings(
  matches: MatchResolved[],
  entries: string[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [e, { entry: e, played: 0, won: 0, lost: 0, diff: 0, points: 0 }]),
  );
  for (const m of matches) {
    if (m.status !== "done" && m.status !== "forfeit") continue;
    const { a, b } = setsSummary(m.sets);
    const ra = rows.get(m.pairA.label);
    const rb = rows.get(m.pairB.label);
    if (!ra || !rb) continue;
    ra.played += 1;
    rb.played += 1;
    ra.diff += a - b;
    rb.diff += b - a;
    if (a > b) {
      ra.won += 1;
      rb.lost += 1;
      ra.points += 1;
    } else if (b > a) {
      rb.won += 1;
      ra.lost += 1;
      rb.points += 1;
    }
  }
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.diff - x.diff || y.won - x.won,
  );
}

export function computeTeamStandings(
  matches: TeamMatchResolved[],
  entries: string[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [e, { entry: e, played: 0, won: 0, lost: 0, diff: 0, points: 0 }]),
  );
  for (const m of matches) {
    if (m.status !== "done" && m.status !== "forfeit") continue;
    const ra = rows.get(m.teamA.name);
    const rb = rows.get(m.teamB.name);
    if (!ra || !rb) continue;
    ra.played += 1;
    rb.played += 1;
    ra.diff += m.scoreA - m.scoreB;
    rb.diff += m.scoreB - m.scoreA;
    if (m.scoreA > m.scoreB) {
      ra.won += 1;
      rb.lost += 1;
      ra.points += 1;
    } else if (m.scoreB > m.scoreA) {
      rb.won += 1;
      ra.lost += 1;
      rb.points += 1;
    }
  }
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.diff - x.diff || y.won - x.won,
  );
}

export async function fetchGroupStandings(
  kind: "doubles" | "teams",
  groupId: string,
  entries: string[],
): Promise<StandingRow[]> {
  if (kind === "doubles") {
    const matches = await fetchDoublesMatchesByGroup(groupId);
    return computeDoublesStandings(matches, entries);
  }
  const matches = await fetchTeamMatchesByGroup(groupId);
  return computeTeamStandings(matches, entries);
}

export async function fetchAllGroupStandings(
  kind: "doubles" | "teams",
  groups: GroupResolved[],
): Promise<Map<string, StandingRow[]>> {
  const results = await Promise.all(
    groups.map(async (g) => {
      const entries = g.entries.map((e) => e.label);
      const standings = await fetchGroupStandings(kind, g.id, entries);
      return [g.id, standings] as const;
    }),
  );
  return new Map(results);
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx vitest run src/lib/db/standings.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/standings.ts src/lib/db/standings.test.ts
git commit -m "feat(db): add standings computation from Supabase matches"
```

---

### Task 4: `matches.ts` — Add `fetchLiveMatches`, `fetchRecentResults`, `fetchAllMatchesByGroup`

**Files:**
- Modify: `src/lib/db/matches.ts`
- Modify: `src/lib/db/matches.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/lib/db/matches.test.ts`:

```typescript
import {
  fetchDoublesMatchesByGroup,
  fetchDoublesMatchById,
  fetchTeamMatchesByGroup,
  fetchTeamMatchById,
  fetchLiveDoubles,
  fetchLiveTeams,
  fetchRecentDoubles,
  fetchRecentTeams,
  fetchAllDoublesMatchesByGroup,
  fetchAllTeamMatchesByGroup,
} from "./matches";

// ... keep existing tests ...

describe("fetchLiveDoubles", () => {
  test("returns only live matches", async () => {
    const matchChain = makeSupabaseChain({
      data: [
        {
          id: "dm05",
          group_id: "gA",
          pair_a: "p01",
          pair_b: "p02",
          table: 3,
          best_of: 3,
          sets: [{ a: 11, b: 8 }],
          status: "live",
          winner: null,
          sets_a: 1,
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

    const r = await fetchLiveDoubles();
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe("live");
    expect(r[0].pairA.label).toBe("A – B");
  });
});

describe("fetchRecentDoubles", () => {
  test("returns done matches with limit", async () => {
    const matchChain = makeSupabaseChain({
      data: [
        {
          id: "dm01",
          group_id: "gA",
          pair_a: "p01",
          pair_b: "p02",
          table: null,
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

    const r = await fetchRecentDoubles(5);
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe("done");
  });
});
```

- [ ] **Step 2: Add `.in()` method to supabase mock if missing**

Check `src/test/supabase-mock.ts` — it should already have `chain.in`. If not, add it alongside the other chainable methods. The mock already has `chain.in` so this should be a no-op.

Also add `chain.ilike` if it doesn't exist:

```typescript
chain.ilike = vi.fn(chainable);
```

- [ ] **Step 3: Run tests — verify they fail**

Run: `npx vitest run src/lib/db/matches.test.ts`
Expected: FAIL — `fetchLiveDoubles` is not exported.

- [ ] **Step 4: Implement new functions**

Add to the end of `src/lib/db/matches.ts`:

```typescript
// ── Live matches ──

export async function fetchLiveDoubles(): Promise<MatchResolved[]> {
  const { data, error } = await supabaseServer
    .from("doubles_matches")
    .select(DOUBLES_SELECT)
    .eq("status", "live")
    .order("id");
  if (error) throw new Error(error.message);
  const pairMap = await buildPairLabelMap();
  return ((data ?? []) as DoublesMatchRow[]).map((r) =>
    resolveDoublesMatch(r, pairMap),
  );
}

export async function fetchLiveTeams(): Promise<TeamMatchResolved[]> {
  const { data, error } = await supabaseServer
    .from("team_matches")
    .select(TEAMS_SELECT)
    .eq("status", "live")
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

// ── Recent results ──

export async function fetchRecentDoubles(
  limit: number,
): Promise<MatchResolved[]> {
  const { data, error } = await supabaseServer
    .from("doubles_matches")
    .select(DOUBLES_SELECT)
    .in("status", ["done", "forfeit"])
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const pairMap = await buildPairLabelMap();
  return ((data ?? []) as DoublesMatchRow[]).map((r) =>
    resolveDoublesMatch(r, pairMap),
  );
}

export async function fetchRecentTeams(
  limit: number,
): Promise<TeamMatchResolved[]> {
  const { data, error } = await supabaseServer
    .from("team_matches")
    .select(TEAMS_SELECT)
    .in("status", ["done", "forfeit"])
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const [teamMap, playerMap] = await Promise.all([
    buildTeamNameMap(),
    buildTeamPlayerNameMap(),
  ]);
  return ((data ?? []) as TeamMatchRow[]).map((r) =>
    resolveTeamMatch(r, teamMap, playerMap),
  );
}

// ── All matches by group (for schedule lists) ──

export async function fetchAllDoublesMatchesByGroup(
  groupIds: string[],
): Promise<Map<string, MatchResolved[]>> {
  const results = await Promise.all(
    groupIds.map(async (gid) => {
      const matches = await fetchDoublesMatchesByGroup(gid);
      return [gid, matches] as const;
    }),
  );
  return new Map(results);
}

export async function fetchAllTeamMatchesByGroup(
  groupIds: string[],
): Promise<Map<string, TeamMatchResolved[]>> {
  const results = await Promise.all(
    groupIds.map(async (gid) => {
      const matches = await fetchTeamMatchesByGroup(gid);
      return [gid, matches] as const;
    }),
  );
  return new Map(results);
}
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `npx vitest run src/lib/db/matches.test.ts`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/matches.ts src/lib/db/matches.test.ts src/test/supabase-mock.ts
git commit -m "feat(db): add fetchLive, fetchRecent, fetchAllByGroup match queries"
```

---

### Task 5: `_SwipeCarousel.tsx` — Shared Swipe Container + Dots

**Files:**
- Create: `src/app/_SwipeCarousel.tsx`

This is a reusable client component for all 3 carousels (live, BXH, results).

- [ ] **Step 1: Create the component**

Create `src/app/_SwipeCarousel.tsx`:

```typescript
"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

export function SwipeCarousel({
  children,
  dotColor = "bg-foreground",
}: {
  children: ReactNode[];
  dotColor?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const count = children.length;

  useEffect(() => {
    const track = trackRef.current;
    if (!track || count <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Array.from(track.children).indexOf(
              entry.target as HTMLElement,
            );
            if (idx >= 0) setActiveIndex(idx);
          }
        }
      },
      { root: track, threshold: 0.6 },
    );

    for (const child of track.children) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [count]);

  if (count === 0) return null;

  return (
    <div>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {children.map((child, i) => (
          <div key={i} className="w-full shrink-0 snap-start">
            {child}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-colors ${
                i === activeIndex ? dotColor : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build` (or just `npx tsc --noEmit` for type-checking)
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_SwipeCarousel.tsx
git commit -m "feat(ui): add SwipeCarousel component with CSS scroll-snap + dots"
```

---

### Task 6: `_MatchCard.tsx` — Shared Match Card for Live + Results

**Files:**
- Create: `src/app/_MatchCard.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/_MatchCard.tsx`:

```typescript
import { groupColor } from "./_groupColors";
import type { SetScore } from "@/lib/schemas/match";

type MatchCardProps = {
  variant: "live" | "done";
  groupId: string;
  groupName: string;
  table: number | null;
  sideA: string;
  sideB: string;
  scoreA: number;
  scoreB: number;
  sets: SetScore[];
};

export function MatchCard({
  variant,
  groupId,
  groupName,
  table,
  sideA,
  sideB,
  scoreA,
  scoreB,
  sets,
}: MatchCardProps) {
  const isLive = variant === "live";
  const aWon = scoreA > scoreB;
  const bWon = scoreB > scoreA;
  const c = groupColor(groupId);

  return (
    <div
      className={`rounded-xl border p-3 ${
        isLive
          ? "border-green-500/25 bg-green-950"
          : "border-border bg-card"
      }`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        {isLive && (
          <span className="relative mr-1 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>
        )}
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.badge}`}>
          {groupName.replace(/^Bảng\s*/i, "")}
        </span>
        {isLive ? (
          <span className="text-[10px] font-medium text-green-400">LIVE</span>
        ) : (
          <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-medium text-green-400">
            Đã xong
          </span>
        )}
        {table != null && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            Bàn {table}
          </span>
        )}
      </div>

      {/* Names + Scores */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <div className={`truncate ${aWon ? "font-semibold" : ""}`}>{sideA}</div>
          <div className={`truncate ${bWon ? "font-semibold" : "text-muted-foreground"}`}>
            {sideB}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end text-lg font-bold tabular-nums leading-tight">
          <span className={aWon ? (isLive ? "text-green-400" : "") : "text-muted-foreground"}>
            {scoreA}
          </span>
          <span className={bWon ? (isLive ? "text-green-400" : "") : "text-muted-foreground"}>
            {scoreB}
          </span>
        </div>
      </div>

      {/* Set scores */}
      {sets.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {sets.map((s, i) => (
            <span
              key={i}
              className={`inline-flex min-w-[36px] items-center justify-center rounded px-1.5 py-0.5 text-[10px] tabular-nums ${
                isLive ? "bg-green-900/50" : "bg-muted"
              }`}
            >
              {s.a}-{s.b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_MatchCard.tsx
git commit -m "feat(ui): add shared MatchCard component (live + done variants)"
```

---

### Task 7: `_StandingsSummary.tsx` — BXH Carousel

**Files:**
- Create: `src/app/_StandingsSummary.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/_StandingsSummary.tsx`:

```typescript
"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { SwipeCarousel } from "./_SwipeCarousel";
import { groupColor } from "./_groupColors";
import type { StandingRow } from "@/lib/db/standings";
import type { GroupResolved } from "@/lib/schemas/group";

export function StandingsSummary({
  kind,
  groups,
  standings,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  standings: Map<string, StandingRow[]>;
}) {
  const prefix = kind === "doubles" ? "/d" : "/t";

  // chunk groups into pairs for 2-column pages
  const pages: GroupResolved[][] = [];
  for (let i = 0; i < groups.length; i += 2) {
    pages.push(groups.slice(i, i + 2));
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Trophy className="size-4 text-yellow-500" />
        <h2 className="text-sm font-semibold">Bảng xếp hạng</h2>
      </div>

      <SwipeCarousel dotColor="bg-blue-500">
        {pages.map((page, pi) => (
          <div key={pi} className="grid grid-cols-2 gap-2">
            {page.map((g) => {
              const rows = standings.get(g.id) ?? [];
              const top2 = rows.slice(0, 2);
              const c = groupColor(g.id);
              const played = rows.some((r) => r.played > 0);
              return (
                <div key={g.id} className="rounded-lg bg-card p-2.5">
                  <div className={`mb-1.5 text-[10px] font-semibold ${c.badge} inline-block rounded px-1.5 py-0.5`}>
                    {g.name.replace(/^Bảng\s*/i, "")}
                  </div>
                  {!played ? (
                    <div className="text-xs italic text-muted-foreground">
                      Chưa có kết quả
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {top2.map((r, ri) => (
                        <div
                          key={r.entry}
                          className={`flex items-center justify-between text-[11px] ${
                            ri > 0 ? "text-muted-foreground" : ""
                          }`}
                        >
                          <span className="truncate">
                            <span
                              className={
                                ri === 0
                                  ? "text-yellow-500"
                                  : "text-muted-foreground"
                              }
                            >
                              {ri + 1}.
                            </span>{" "}
                            {r.entry}
                          </span>
                          <span className="ml-1 shrink-0 font-semibold">
                            {r.points}đ
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </SwipeCarousel>

      <Link
        href={`${prefix}`}
        className="mt-1.5 block text-center text-[11px] text-blue-500"
      >
        Xem chi tiết từng bảng →
      </Link>
    </section>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_StandingsSummary.tsx
git commit -m "feat(ui): add StandingsSummary carousel (2 groups per page)"
```

---

### Task 8: `_ScheduleList.tsx` — Compact Match + KO Lists with Filter Chips

**Files:**
- Create: `src/app/_ScheduleList.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/_ScheduleList.tsx`:

```typescript
"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, Swords } from "lucide-react";
import { groupColor } from "./_groupColors";
import type { MatchResolved, TeamMatchResolved, SetScore } from "@/lib/schemas/match";
import type { DoublesKoResolved, TeamKoResolved, KoRound, ROUND_LABEL } from "@/lib/schemas/knockout";
import type { GroupResolved } from "@/lib/schemas/group";

// ── Helpers ──

function setsSummary(sets: SetScore[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a += 1;
    else if (s.b > s.a) b += 1;
  }
  return { a, b };
}

function StatusPill({ status, scoreA, scoreB }: { status: string; scoreA?: number; scoreB?: number }) {
  if (status === "done" || status === "forfeit") {
    return (
      <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-medium text-green-600 dark:text-green-400">
        {scoreA != null ? `${scoreA}-${scoreB}` : "Xong"}
      </span>
    );
  }
  if (status === "live") {
    return (
      <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-medium text-red-600 dark:text-red-400">
        Live
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
      Chưa đấu
    </span>
  );
}

function FilterChips({
  options,
  active,
  onSelect,
  activeColor,
}: {
  options: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
  activeColor: string;
}) {
  return (
    <div className="flex gap-1 border-b border-border px-2.5 py-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onSelect(o.id)}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
            active === o.id ? activeColor : "bg-muted text-muted-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Group Schedule ──

type DoublesMatchFlat = MatchResolved & { _groupName: string };
type TeamMatchFlat = TeamMatchResolved & { _groupName: string };

export function GroupScheduleList({
  kind,
  groups,
  matchesByGroup,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  matchesByGroup: Map<string, MatchResolved[]> | Map<string, TeamMatchResolved[]>;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  const allOptions = [
    { id: "all", label: "Tất cả" },
    ...groups.map((g) => ({
      id: g.id,
      label: g.name.replace(/^Bảng\s*/i, ""),
    })),
  ];

  // flatten
  const all: Array<{ id: string; groupId: string; groupName: string; sideA: string; sideB: string; status: string; scoreA: number; scoreB: number; sets: SetScore[] }> = [];
  for (const g of groups) {
    const matches = matchesByGroup.get(g.id) ?? [];
    for (const m of matches) {
      if (kind === "doubles") {
        const dm = m as MatchResolved;
        const { a, b } = setsSummary(dm.sets);
        all.push({
          id: dm.id,
          groupId: g.id,
          groupName: g.name,
          sideA: dm.pairA.label,
          sideB: dm.pairB.label,
          status: dm.status,
          scoreA: a,
          scoreB: b,
          sets: dm.sets,
        });
      } else {
        const tm = m as TeamMatchResolved;
        all.push({
          id: tm.id,
          groupId: g.id,
          groupName: g.name,
          sideA: tm.teamA.name,
          sideB: tm.teamB.name,
          status: tm.status,
          scoreA: tm.scoreA,
          scoreB: tm.scoreB,
          sets: [],
        });
      }
    }
  }

  const filtered = filter === "all" ? all : all.filter((m) => m.groupId === filter);
  const doneCount = all.filter((m) => m.status === "done" || m.status === "forfeit").length;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-3"
      >
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Lịch vòng bảng</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {doneCount}/{all.length} xong
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="rounded-lg bg-card">
          <FilterChips
            options={allOptions}
            active={filter}
            onSelect={setFilter}
            activeColor="bg-blue-500/20 text-blue-600 dark:text-blue-400"
          />
          <div className="divide-y divide-border">
            {filtered.map((m) => (
              <CompactRow
                key={m.id}
                groupId={m.groupId}
                groupName={m.groupName}
                sideA={m.sideA}
                sideB={m.sideB}
                status={m.status}
                scoreA={m.scoreA}
                scoreB={m.scoreB}
                sets={m.sets}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── KO Schedule ──

const ROUND_LABELS: Record<string, string> = {
  qf: "TK",
  sf: "BK",
  f: "CK",
};

export function KnockoutScheduleList({
  kind,
  matches,
}: {
  kind: "doubles" | "teams";
  matches: DoublesKoResolved[] | TeamKoResolved[];
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  const allOptions = [
    { id: "all", label: "Tất cả" },
    { id: "qf", label: "TK" },
    { id: "sf", label: "BK" },
    { id: "f", label: "CK" },
  ];

  const isDoubles = kind === "doubles";
  const doneCount = matches.filter(
    (m) => m.status === "done" || m.status === "forfeit",
  ).length;

  const filtered =
    filter === "all" ? matches : matches.filter((m) => m.round === filter);

  // counter per round for labels
  const roundCount: Record<string, number> = {};

  const rows = filtered.map((m) => {
    const rKey = m.round;
    roundCount[rKey] = (roundCount[rKey] ?? 0) + 1;
    const label = m.round === "f" ? "CK" : `${ROUND_LABELS[m.round]}${roundCount[rKey]}`;
    const sideA = isDoubles
      ? (m as DoublesKoResolved).entryA?.label ?? m.labelA
      : (m as TeamKoResolved).entryA?.name ?? m.labelA;
    const sideB = isDoubles
      ? (m as DoublesKoResolved).entryB?.label ?? m.labelB
      : (m as TeamKoResolved).entryB?.name ?? m.labelB;
    const scoreA = isDoubles
      ? (m as DoublesKoResolved).setsA
      : (m as TeamKoResolved).scoreA;
    const scoreB = isDoubles
      ? (m as DoublesKoResolved).setsB
      : (m as TeamKoResolved).scoreB;

    return {
      id: m.id,
      roundLabel: label,
      sideA: sideA || "—",
      sideB: sideB || "—",
      status: m.status,
      scoreA,
      scoreB,
    };
  });

  if (matches.length === 0) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-3"
      >
        <span className="flex items-center gap-1.5">
          <Swords className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Vòng loại trực tiếp</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {doneCount}/{matches.length} xong
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="rounded-lg bg-card">
          <FilterChips
            options={allOptions}
            active={filter}
            onSelect={setFilter}
            activeColor="bg-orange-500/20 text-orange-600 dark:text-orange-400"
          />
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <KoCompactRow key={r.id} {...r} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Compact Rows ──

function CompactRow({
  groupId,
  groupName,
  sideA,
  sideB,
  status,
  scoreA,
  scoreB,
  sets,
}: {
  groupId: string;
  groupName: string;
  sideA: string;
  sideB: string;
  status: string;
  scoreA: number;
  scoreB: number;
  sets: SetScore[];
}) {
  const [expanded, setExpanded] = useState(false);
  const c = groupColor(groupId);

  // abbreviate: "Minh Quân – Tân Sinh" → "MQ–TS"
  const abbrev = (name: string) =>
    name
      .split(/\s*–\s*/)
      .map((part) =>
        part
          .split(/\s+/)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join(""),
      )
      .join("–");

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-[11px]"
      >
        <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${c.badge}`}>
          {groupName.replace(/^Bảng\s*/i, "")}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">
          {abbrev(sideA)} vs {abbrev(sideB)}
        </span>
        <StatusPill status={status} scoreA={scoreA} scoreB={scoreB} />
        <ChevronRight
          className={`size-3 shrink-0 text-muted-foreground transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>
      {expanded && (
        <div className="border-t border-dashed px-2.5 pb-2.5 pt-2 text-xs">
          <div className="space-y-0.5">
            <div className={scoreA > scoreB ? "font-semibold" : "text-muted-foreground"}>
              {sideA}
            </div>
            <div className={scoreB > scoreA ? "font-semibold" : "text-muted-foreground"}>
              {sideB}
            </div>
          </div>
          {sets.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {sets.map((s, i) => (
                <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                  {s.a}-{s.b}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KoCompactRow({
  roundLabel,
  sideA,
  sideB,
  status,
  scoreA,
  scoreB,
}: {
  id: string;
  roundLabel: string;
  sideA: string;
  sideB: string;
  status: string;
  scoreA: number;
  scoreB: number;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2 text-[11px]">
      <span className="shrink-0 min-w-[24px] text-[9px] font-semibold text-orange-500">
        {roundLabel}
      </span>
      <span className="min-w-0 flex-1 truncate">
        {sideA} vs {sideB}
      </span>
      <StatusPill status={status} scoreA={scoreA} scoreB={scoreB} />
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_ScheduleList.tsx
git commit -m "feat(ui): add GroupScheduleList and KnockoutScheduleList with filter chips"
```

---

### Task 9: Rewrite `_ContentHome.tsx` — New Server Layout

**Files:**
- Rewrite: `src/app/_ContentHome.tsx`

- [ ] **Step 1: Rewrite ContentHome**

Rewrite `src/app/_ContentHome.tsx` entirely:

```typescript
import { Medal, Shield, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SwipeCarousel } from "./_SwipeCarousel";
import { MatchCard } from "./_MatchCard";
import { StandingsSummary } from "./_StandingsSummary";
import { GroupScheduleList, KnockoutScheduleList } from "./_ScheduleList";
import type { GroupResolved } from "@/lib/schemas/group";
import type { MatchResolved, TeamMatchResolved, SetScore } from "@/lib/schemas/match";
import type { DoublesKoResolved, TeamKoResolved } from "@/lib/schemas/knockout";
import type { StandingRow } from "@/lib/db/standings";

function setsSummary(sets: SetScore[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a += 1;
    else if (s.b > s.a) b += 1;
  }
  return { a, b };
}

type Props = {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  knockout: DoublesKoResolved[] | TeamKoResolved[];
  liveMatches: MatchResolved[] | TeamMatchResolved[];
  recentResults: MatchResolved[] | TeamMatchResolved[];
  standings: Map<string, StandingRow[]>;
  matchesByGroup: Map<string, MatchResolved[]> | Map<string, TeamMatchResolved[]>;
};

export function ContentHome({
  kind,
  groups,
  knockout,
  liveMatches,
  recentResults,
  standings,
  matchesByGroup,
}: Props) {
  const isDoubles = kind === "doubles";
  const titleColor = isDoubles
    ? "text-blue-600 dark:text-blue-400"
    : "text-violet-600 dark:text-violet-400";
  const Icon = isDoubles ? Users : Shield;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Icon className={`size-5 ${titleColor}`} />
          <h1 className="text-xl font-semibold leading-tight">
            Nội dung {isDoubles ? "Đôi" : "Đồng đội"}
          </h1>
        </div>
        <Badge variant="secondary">Đang diễn ra</Badge>
      </header>

      {/* Tên giải */}
      <div className="border-l-2 border-emerald-500/50 pl-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          CLB Bóng Bàn Bình Tân
        </p>
        <p className="mt-0.5 text-sm leading-snug text-foreground/80">
          Giải Bóng Bàn Kỷ niệm 51 năm ngày thống nhất đất nước
        </p>
      </div>

      {/* KẾT QUẢ CHUNG CUỘC */}
      <FinalRanking knockout={knockout} />

      {/* 1. ĐANG ĐẤU */}
      <LiveSection kind={kind} matches={liveMatches} groups={groups} />

      {/* 2. BXH */}
      <StandingsSummary kind={kind} groups={groups} standings={standings} />

      {/* 3. KẾT QUẢ GẦN NHẤT */}
      <RecentSection kind={kind} matches={recentResults} groups={groups} />

      {/* Divider */}
      <div className="border-t" />

      {/* 4. LỊCH VÒNG BẢNG */}
      <GroupScheduleList
        kind={kind}
        groups={groups}
        matchesByGroup={matchesByGroup}
      />

      {/* 5. VÒNG LOẠI TRỰC TIẾP */}
      <KnockoutScheduleList kind={kind} matches={knockout} />
    </main>
  );
}

// ── Live Section ──

function LiveSection({
  kind,
  matches,
  groups,
}: {
  kind: "doubles" | "teams";
  matches: MatchResolved[] | TeamMatchResolved[];
  groups: GroupResolved[];
}) {
  if (matches.length === 0) return null;
  const groupNameMap = new Map(groups.map((g) => [g.id, g.name]));

  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-red-500" />
        </span>
        <span className="text-xs font-semibold text-green-500">Đang đấu</span>
        <span className="text-[11px] text-muted-foreground">{matches.length} trận</span>
      </div>
      <SwipeCarousel dotColor="bg-green-500">
        {matches.map((m) => {
          const isDoubles = kind === "doubles";
          const dm = isDoubles ? (m as MatchResolved) : null;
          const tm = !isDoubles ? (m as TeamMatchResolved) : null;
          const groupId = dm?.groupId ?? tm!.groupId;
          const { a, b } = dm ? setsSummary(dm.sets) : { a: tm!.scoreA, b: tm!.scoreB };
          return (
            <MatchCard
              key={m.id}
              variant="live"
              groupId={groupId}
              groupName={groupNameMap.get(groupId) ?? "?"}
              table={dm?.table ?? tm!.table}
              sideA={dm?.pairA.label ?? tm!.teamA.name}
              sideB={dm?.pairB.label ?? tm!.teamB.name}
              scoreA={a}
              scoreB={b}
              sets={dm?.sets ?? []}
            />
          );
        })}
      </SwipeCarousel>
    </section>
  );
}

// ── Recent Section ──

function RecentSection({
  kind,
  matches,
  groups,
}: {
  kind: "doubles" | "teams";
  matches: MatchResolved[] | TeamMatchResolved[];
  groups: GroupResolved[];
}) {
  if (matches.length === 0) return null;
  const groupNameMap = new Map(groups.map((g) => [g.id, g.name]));

  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-xs font-semibold">✅ Kết quả gần nhất</span>
        <span className="text-[11px] text-muted-foreground">{matches.length} trận</span>
      </div>
      <SwipeCarousel dotColor="bg-foreground">
        {matches.map((m) => {
          const isDoubles = kind === "doubles";
          const dm = isDoubles ? (m as MatchResolved) : null;
          const tm = !isDoubles ? (m as TeamMatchResolved) : null;
          const groupId = dm?.groupId ?? tm!.groupId;
          const { a, b } = dm ? setsSummary(dm.sets) : { a: tm!.scoreA, b: tm!.scoreB };
          return (
            <MatchCard
              key={m.id}
              variant="done"
              groupId={groupId}
              groupName={groupNameMap.get(groupId) ?? "?"}
              table={dm?.table ?? tm!.table}
              sideA={dm?.pairA.label ?? tm!.teamA.name}
              sideB={dm?.pairB.label ?? tm!.teamB.name}
              scoreA={a}
              scoreB={b}
              sets={dm?.sets ?? []}
            />
          );
        })}
      </SwipeCarousel>
    </section>
  );
}

// ── Final Ranking (kept from existing, unchanged logic) ──

type KoMatch = DoublesKoResolved | TeamKoResolved;

function isDoublesKo(m: KoMatch): m is DoublesKoResolved {
  return "sets" in m;
}

const MEDAL_STYLES = [
  { emoji: "🥇", label: "Nhất", bg: "bg-yellow-500/15 border-yellow-500/40", text: "text-yellow-700 dark:text-yellow-400" },
  { emoji: "🥈", label: "Nhì", bg: "bg-gray-200/60 border-gray-300/50 dark:bg-gray-700/30 dark:border-gray-600/30", text: "text-gray-700 dark:text-gray-300" },
  { emoji: "🥉", label: "Đồng hạng 3", bg: "bg-amber-600/10 border-amber-600/25", text: "text-amber-700 dark:text-amber-500" },
];

function FinalRanking({ knockout }: { knockout: KoMatch[] }) {
  const final = knockout.find((m) => m.round === "f");
  if (!final || (final.status !== "done" && final.status !== "forfeit")) return null;

  const winnerId = isDoublesKo(final) ? final.winner?.id : (final as TeamKoResolved).winner?.id;
  if (!winnerId) return null;

  const winnerName = isDoublesKo(final) ? final.winner?.label : (final as TeamKoResolved).winner?.name;
  const loserName = isDoublesKo(final)
    ? (final.entryA?.id === winnerId ? final.entryB?.label : final.entryA?.label)
    : ((final as TeamKoResolved).entryA?.id === winnerId
        ? (final as TeamKoResolved).entryB?.name
        : (final as TeamKoResolved).entryA?.name);

  const thirds = knockout
    .filter((m) => m.round === "sf")
    .map((m) => {
      const wId = isDoublesKo(m) ? m.winner?.id : (m as TeamKoResolved).winner?.id;
      if (!wId) return null;
      if (isDoublesKo(m)) {
        return m.entryA?.id === wId ? m.entryB?.label : m.entryA?.label;
      }
      const tm = m as TeamKoResolved;
      return tm.entryA?.id === wId ? tm.entryB?.name : tm.entryA?.name;
    })
    .filter(Boolean) as string[];

  if (!winnerName || !loserName) return null;

  const rows = [
    { ...MEDAL_STYLES[0], name: winnerName },
    { ...MEDAL_STYLES[1], name: loserName },
    ...thirds.map((name) => ({ ...MEDAL_STYLES[2], name })),
  ];

  return (
    <section className="rounded-2xl border-2 border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 via-yellow-500/5 to-transparent p-4">
      <div className="mb-3 flex items-center gap-2">
        <Medal className="size-5 text-yellow-600" />
        <h2 className="text-base font-bold">Kết quả chung cuộc</h2>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${r.bg}`}>
            <span className="text-xl">{r.emoji}</span>
            <div className="min-w-0 flex-1">
              <span className={`text-xs font-semibold uppercase tracking-wide ${r.text}`}>{r.label}</span>
              <p className="text-sm font-medium">{r.name}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: No errors. Note: `/d/page.tsx` and `/t/page.tsx` will have type errors until they're updated in Task 10.

- [ ] **Step 3: Commit**

```bash
git add src/app/_ContentHome.tsx
git commit -m "feat(ui): rewrite ContentHome with new 5-section layout"
```

---

### Task 10: Wire Up `/d/page.tsx` and `/t/page.tsx`

**Files:**
- Modify: `src/app/d/page.tsx`
- Modify: `src/app/t/page.tsx`

- [ ] **Step 1: Update `/d/page.tsx`**

Rewrite `src/app/d/page.tsx`:

```typescript
import { ContentHome } from "../_ContentHome";
import { fetchDoublesGroups } from "@/lib/db/groups";
import { fetchDoublesKo } from "@/lib/db/knockout";
import {
  fetchLiveDoubles,
  fetchRecentDoubles,
  fetchAllDoublesMatchesByGroup,
} from "@/lib/db/matches";
import { fetchAllGroupStandings } from "@/lib/db/standings";

export const dynamic = "force-dynamic";

export default async function DoublesPublicPage() {
  const groups = await fetchDoublesGroups();
  const groupIds = groups.map((g) => g.id);

  const [knockout, liveMatches, recentResults, standings, matchesByGroup] =
    await Promise.all([
      fetchDoublesKo(),
      fetchLiveDoubles(),
      fetchRecentDoubles(10),
      fetchAllGroupStandings("doubles", groups),
      fetchAllDoublesMatchesByGroup(groupIds),
    ]);

  return (
    <ContentHome
      kind="doubles"
      groups={groups}
      knockout={knockout}
      liveMatches={liveMatches}
      recentResults={recentResults}
      standings={standings}
      matchesByGroup={matchesByGroup}
    />
  );
}
```

- [ ] **Step 2: Update `/t/page.tsx`**

Rewrite `src/app/t/page.tsx`:

```typescript
import { ContentHome } from "../_ContentHome";
import { fetchTeamGroups } from "@/lib/db/groups";
import { fetchTeamKo } from "@/lib/db/knockout";
import {
  fetchLiveTeams,
  fetchRecentTeams,
  fetchAllTeamMatchesByGroup,
} from "@/lib/db/matches";
import { fetchAllGroupStandings } from "@/lib/db/standings";

export const dynamic = "force-dynamic";

export default async function TeamsPublicPage() {
  const groups = await fetchTeamGroups();
  const groupIds = groups.map((g) => g.id);

  const [knockout, liveMatches, recentResults, standings, matchesByGroup] =
    await Promise.all([
      fetchTeamKo(),
      fetchLiveTeams(),
      fetchRecentTeams(10),
      fetchAllGroupStandings("teams", groups),
      fetchAllTeamMatchesByGroup(groupIds),
    ]);

  return (
    <ContentHome
      kind="teams"
      groups={groups}
      knockout={knockout}
      liveMatches={liveMatches}
      recentResults={recentResults}
      standings={standings}
      matchesByGroup={matchesByGroup}
    />
  );
}
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/d/page.tsx src/app/t/page.tsx
git commit -m "feat: wire d/ and t/ pages to new ContentHome with all Supabase data"
```

---

### Task 11: Migrate `_publicGroup.tsx` — Remove Mock Imports

**Files:**
- Modify: `src/app/_publicGroup.tsx`

The new `ContentHome` no longer renders `GroupStageTabs` directly (the BXH section uses `StandingsSummary` instead, and the schedule section uses `GroupScheduleList`). However, `_publicGroup.tsx` is still used by the group detail pages (`/d/[id]/page.tsx` and `/t/[id]/page.tsx`). Those pages need to pass data via props instead of having `_publicGroup.tsx` import mocks.

- [ ] **Step 1: Check group detail pages**

Read `src/app/d/[id]/page.tsx` and `src/app/t/[id]/page.tsx` to understand how they use `_publicGroup.tsx`.

- [ ] **Step 2: Update `_publicGroup.tsx` to accept data via props**

Remove all imports from `_home.ts` and `admin/_mock.ts`. Specifically:
- Remove `import { getStandings, type StandingRow } from "./_home";`
- Remove `import { MOCK_DOUBLES_MATCHES, MOCK_TEAM_MATCHES, TEAM_MATCH_TEMPLATE, ... } from "./admin/_mock";`
- Add `StandingRow` import from `@/lib/db/standings`
- Add necessary type imports from `@/lib/schemas/match`

Change `GroupStageTabs` props to accept:
```typescript
export function GroupStageTabs({
  kind,
  groups,
  standings,
  matchesByGroup,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  standings: Map<string, StandingRow[]>;
  matchesByGroup: Map<string, MatchResolved[]> | Map<string, TeamMatchResolved[]>;
})
```

Change `GroupTabContent` to use `standings.get(group.id)` instead of calling `getStandings()`.

Change `MatchesAccordion` to use `matchesByGroup.get(group.id)` instead of filtering `MOCK_DOUBLES_MATCHES`.

Change `StandingsDialog` to accept standings via props instead of calling `getStandings()`.

For `TeamMatchRow` and `SubMatchRow`, import `SetScore` type from `@/lib/schemas/match` instead of `admin/_mock`. Replace `TEAM_MATCH_TEMPLATE` usage — sub-match rows should read from the actual match data.

- [ ] **Step 3: Update group detail pages to pass props**

Update `src/app/d/[id]/page.tsx` and `src/app/t/[id]/page.tsx` to fetch standings and matches, then pass as props to `GroupStageTabs`.

- [ ] **Step 4: Verify type-check + build**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/_publicGroup.tsx src/app/d/\[id\]/page.tsx src/app/t/\[id\]/page.tsx
git commit -m "refactor: remove mock imports from _publicGroup, pass data via props"
```

---

### Task 12: Search Page Migration

**Files:**
- Create: `src/lib/db/search.ts`
- Create: `src/lib/db/search.test.ts`
- Modify: `src/app/search/page.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/lib/db/search.test.ts`:

```typescript
import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { searchPlayers } from "./search";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchPlayers", () => {
  test("returns empty on empty query", async () => {
    const r = await searchPlayers("");
    expect(r).toEqual([]);
  });

  test("queries both doubles and team players", async () => {
    const doublesChain = makeSupabaseChain({
      data: [{ id: "d01", name: "Minh Quân", phone: "0901", gender: "M", club: "BT" }],
      error: null,
    });
    const teamsChain = makeSupabaseChain({
      data: [],
      error: null,
    });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(doublesChain as never)
      .mockReturnValueOnce(teamsChain as never);

    const r = await searchPlayers("minh");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: "d01", name: "Minh Quân", kind: "doubles" });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/lib/db/search.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `search.ts`**

Create `src/lib/db/search.ts`:

```typescript
import { supabaseServer } from "@/lib/supabase/server";

type PlayerResult = {
  id: string;
  name: string;
  phone: string;
  gender: string;
  club: string;
  kind: "doubles" | "teams";
};

export async function searchPlayers(query: string): Promise<PlayerResult[]> {
  const q = query.trim();
  if (!q) return [];

  const pattern = `%${q}%`;

  const [doublesResp, teamsResp] = await Promise.all([
    supabaseServer
      .from("doubles_players")
      .select("id, name, phone, gender, club")
      .like("name", pattern),
    supabaseServer
      .from("team_players")
      .select("id, name, phone, gender, club")
      .like("name", pattern),
  ]);

  if (doublesResp.error) throw new Error(doublesResp.error.message);
  if (teamsResp.error) throw new Error(teamsResp.error.message);

  type Row = { id: string; name: string; phone: string; gender: string; club: string };
  const doubles = ((doublesResp.data ?? []) as Row[]).map((p) => ({ ...p, kind: "doubles" as const }));
  const teams = ((teamsResp.data ?? []) as Row[]).map((p) => ({ ...p, kind: "teams" as const }));
  return [...doubles, ...teams];
}
```

Note: Using `.like()` which does case-sensitive LIKE. If the project needs case-insensitive, use `.ilike()` instead. Check Supabase JS docs for the project's version. The `supabase-mock.ts` chain already supports `.like()`.

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx vitest run src/lib/db/search.test.ts`
Expected: All pass.

- [ ] **Step 5: Update `search/page.tsx`**

Replace mock search with DB search in `src/app/search/page.tsx`:

```typescript
import Link from "next/link";
import { Search, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PublicHeader } from "../_public";
import { SearchInput } from "../_searchInput";
import { searchPlayers } from "@/lib/db/search";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const players = q ? await searchPlayers(q) : [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <PublicHeader title="Tìm VĐV" backHref="/" />
      <SearchInput defaultValue={q} />

      {!q && (
        <Empty
          icon={<Search className="size-6 text-muted-foreground" />}
          title="Gõ tên để tìm"
          desc="Tìm theo tên VĐV (cả nội dung Đôi và Đồng đội)"
        />
      )}

      {q && players.length === 0 && (
        <Empty
          icon={<Search className="size-6 text-muted-foreground" />}
          title={`Không tìm thấy "${q}"`}
          desc="Thử lại với một phần tên khác"
        />
      )}

      {players.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            VĐV ({players.length})
          </h2>
          <div className="flex flex-col gap-2">
            {players.map((p) => (
              <Card key={`${p.kind}-${p.id}`} className="flex flex-row items-center gap-3 p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.kind === "doubles" ? "Nội dung Đôi" : "Nội dung Đồng đội"} · {p.club}
                  </div>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">{p.phone}</span>
              </Card>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto pt-6 text-center text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          ← Về trang chủ
        </Link>
      </footer>
    </main>
  );
}

function Empty({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{desc}</div>
    </div>
  );
}
```

Note: This removes the match search results section. The old mock search searched matches by player name, which required joining matches with player names. This simplification only searches players. If match search is needed later, it can be added in a follow-up.

- [ ] **Step 6: Verify type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/search.ts src/lib/db/search.test.ts src/app/search/page.tsx
git commit -m "feat: migrate search page from mock to Supabase player search"
```

---

### Task 13: Cleanup — Delete `_home.ts` and `_feedCards.tsx`

**Files:**
- Delete: `src/app/_home.ts`
- Delete: `src/app/_feedCards.tsx`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "_home" src/app/ --include="*.ts" --include="*.tsx" | grep -v node_modules`
Run: `grep -r "_feedCards" src/app/ --include="*.ts" --include="*.tsx" | grep -v node_modules`

Expected: No results (all imports were already removed in Tasks 11 and 12). If any remain, fix them first.

- [ ] **Step 2: Delete the files**

```bash
rm src/app/_home.ts src/app/_feedCards.tsx
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add -u src/app/_home.ts src/app/_feedCards.tsx
git commit -m "chore: delete _home.ts and _feedCards.tsx (all consumers migrated)"
```

---

### Task 14: Dev Server Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts without errors.

- [ ] **Step 2: Test `/d` route**

Open `http://localhost:3000/d` in browser.
Expected:
- Header shows "Nội dung Đôi"
- If matches have `live` status: live carousel visible with swipe
- BXH summary section shows top 2 per group in 2-column grid, swipeable
- If any matches are `done`: recent results carousel visible
- Schedule accordion expandable with filter chips
- KO schedule shows bracket matches

- [ ] **Step 3: Test `/t` route**

Open `http://localhost:3000/t` in browser.
Expected: Same layout as `/d` but for teams. Only 2 groups (A+B), so BXH should be 1 page with no dots.

- [ ] **Step 4: Test `/search` route**

Open `http://localhost:3000/search?q=minh`
Expected: Shows player results from Supabase, no match results section.

- [ ] **Step 5: Test swipe behavior on mobile viewport**

Use browser DevTools to simulate iPhone viewport (390x844).
Expected: Cards swipe smoothly, dots update, all sections fit within mobile width.

- [ ] **Step 6: Test edge cases**

- Expand a match in the schedule list → inline detail with full names + sets
- Filter chips work (select "A" → only group A matches shown)
- "Xem chi tiết từng bảng" link navigates to group detail page

- [ ] **Step 7: Final commit if any fixes needed**

If any issues found during testing, fix and commit with descriptive message.
