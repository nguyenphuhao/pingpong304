# Admin Quick Match Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BTC gõ tên VĐV / cặp / đội trong ô search bất kỳ trang admin nào, tap một kết quả → navigate tới trang bảng chứa trận đó và auto-open dialog nhập điểm (hoặc cuộn card team match vào view).

**Architecture:** Một client component `<AdminSearchSheet>` gắn trong header của các admin page có `kind` rõ ràng. Sheet fetch 1 lần per session thông qua server action trả về danh sách match nhẹ (`id`, `kind`, `groupId`, `groupName`, `sideA`, `sideB`, `status`), rồi filter + sort client-side. Tap result → `router.push('/admin/<kind>/groups/<groupId>?match=<id>')`. Group page đọc `searchParams.match`, truyền `autoOpenMatchId` xuống schedule component; match row tương ứng `useEffect` mở dialog (doubles) hoặc scroll vào view (teams), sau đó clear `?match=` khỏi URL.

**Tech Stack:** Next.js 16 App Router (async `searchParams`), React 19, TypeScript strict, vitest, Supabase (server), `@/components/ui/dialog` (base-ui), `lucide-react`, Tailwind.

**Spec reference:** `docs/superpowers/specs/2026-04-18-admin-quick-match-nav-design.md`

**Scale assumption:** <200 trận/kind. Client-side filter đủ mượt ở quy mô này.

**Kind handling (quan trọng):**
- `/admin/doubles*` → `kind="doubles"`, dialog auto-open (có `EditDoublesMatchDialog`).
- `/admin/teams*` → `kind="teams"`, **không có dialog riêng** — `TeamMatchCard` render inline luôn. Auto-open = scroll card vào view.
- `/admin` (root) → **không hiện icon search**.

---

## File structure

**Mới:**
- `src/lib/text/normalize.ts` — `normalizeVi(s)` utility (no client/server marker, pure).
- `src/lib/text/normalize.test.ts` — unit tests.
- `src/app/admin/_search-filter.ts` — export `MatchIndexItem` type + pure `filterAndSortMatches(items, query)`. No "use client", no "use server".
- `src/app/admin/_search-filter.test.ts` — unit tests.
- `src/app/admin/_search-actions.ts` — `"use server"`, export `fetchMatchIndexForKind(kind)`.
- `src/app/admin/_search-sheet.tsx` — `"use client"`, export `SearchIconButton` + `AdminSearchSheet` (SearchIconButton opens the sheet internally).

**Sửa:**
- `src/app/admin/doubles/page.tsx` — chèn `<SearchIconButton kind="doubles" />` vào header.
- `src/app/admin/teams/page.tsx` — chèn `<SearchIconButton kind="teams" />` vào header.
- `src/app/admin/doubles/groups/[id]/page.tsx` — đọc async `searchParams.match` → truyền `autoOpenMatchId`; chèn `<SearchIconButton kind="doubles" />` vào sticky header.
- `src/app/admin/teams/groups/[id]/page.tsx` — tương tự cho teams.
- `src/app/admin/_components.tsx`:
  - `DoublesSchedule`: thêm prop `autoOpenMatchId?: string`, forward xuống `DoublesMatchCard`.
  - `TeamSchedule`: thêm prop `autoOpenMatchId?: string`, forward xuống `TeamMatchCard`.
  - `DoublesMatchCard`: thêm prop `autoOpen?: boolean`, forward xuống `EditDoublesMatchDialog`; wrap trong `<div ref>` để `scrollIntoView`.
  - `TeamMatchCard`: thêm prop `autoOpen?: boolean`, wrap card trong `<div ref>` để `scrollIntoView` khi prop true.
  - `EditDoublesMatchDialog`: thêm prop `autoOpen?: boolean` + `useEffect` + "đã dùng" guard ref để chỉ open 1 lần.
- Trong schedule component (cả doubles và teams): sau khi `autoOpenMatchId` đã được "dùng" (mount + effect fire), gọi `router.replace` để xoá `?match=` (giữ các param khác nếu có, ví dụ `?tab=groups`).

---

## Task 1: normalizeVi utility (TDD)

**Files:**
- Create: `src/lib/text/normalize.ts`
- Test: `src/lib/text/normalize.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/text/normalize.test.ts
import { describe, expect, test } from "vitest";
import { normalizeVi } from "./normalize";

describe("normalizeVi", () => {
  test("strips single-char diacritics", () => {
    expect(normalizeVi("Hào")).toBe("hao");
    expect(normalizeVi("Hạo")).toBe("hao");
    expect(normalizeVi("Hảo")).toBe("hao");
  });

  test("handles multi-word uppercase and mixed marks", () => {
    expect(normalizeVi("NGUYỄN Phú Hào")).toBe("nguyen phu hao");
  });

  test("maps đ/Đ to d", () => {
    expect(normalizeVi("Lê Thị Đức")).toBe("le thi duc");
    expect(normalizeVi("đô đốc")).toBe("do doc");
  });

  test("collapses whitespace and trims", () => {
    expect(normalizeVi("  Hào   Đức ")).toBe("hao duc");
    expect(normalizeVi("\tHào\n\nĐức")).toBe("hao duc");
  });

  test("empty and whitespace-only", () => {
    expect(normalizeVi("")).toBe("");
    expect(normalizeVi("   ")).toBe("");
    expect(normalizeVi("\t\n")).toBe("");
  });

  test("leaves latin characters unchanged", () => {
    expect(normalizeVi("abc123")).toBe("abc123");
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npm test -- normalize`
Expected: FAIL "Cannot find module './normalize'".

- [ ] **Step 3: Implement**

```ts
// src/lib/text/normalize.ts
export function normalizeVi(s: string): string {
  if (!s) return "";
  return s
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- normalize`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/text/normalize.ts src/lib/text/normalize.test.ts
git commit -m "feat(text): add normalizeVi for diacritic-insensitive search"
```

---

## Task 2: filterAndSortMatches pure helper (TDD)

**Files:**
- Create: `src/app/admin/_search-filter.ts`
- Test: `src/app/admin/_search-filter.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/admin/_search-filter.test.ts
import { describe, expect, test } from "vitest";
import { filterAndSortMatches, type MatchIndexItem } from "./_search-filter";

function make(overrides: Partial<MatchIndexItem>): MatchIndexItem {
  return {
    id: "m1",
    kind: "doubles",
    groupId: "g1",
    groupName: "Bảng A",
    sideA: "A",
    sideB: "B",
    status: "scheduled",
    ...overrides,
  };
}

describe("filterAndSortMatches", () => {
  test("empty query returns only live matches", () => {
    const items = [
      make({ id: "1", status: "live" }),
      make({ id: "2", status: "scheduled" }),
      make({ id: "3", status: "done" }),
    ];
    const result = filterAndSortMatches(items, "");
    expect(result.map((m) => m.id)).toEqual(["1"]);
  });

  test("empty query with no live matches returns empty", () => {
    const items = [
      make({ id: "1", status: "scheduled" }),
      make({ id: "2", status: "done" }),
    ];
    expect(filterAndSortMatches(items, "")).toEqual([]);
  });

  test("diacritic-insensitive match on sideA or sideB", () => {
    const items = [
      make({ id: "1", sideA: "Nguyễn Hào", sideB: "Trần B" }),
      make({ id: "2", sideA: "Lê Hạo", sideB: "Phạm C" }),
      make({ id: "3", sideA: "Võ Hảo", sideB: "Đỗ D" }),
      make({ id: "4", sideA: "Minh", sideB: "Tuấn" }),
    ];
    const result = filterAndSortMatches(items, "hao");
    expect(result.map((m) => m.id).sort()).toEqual(["1", "2", "3"]);
  });

  test("sort by status rank then groupName", () => {
    const items = [
      make({ id: "1", status: "done", groupName: "Bảng A" }),
      make({ id: "2", status: "live", groupName: "Bảng B" }),
      make({ id: "3", status: "scheduled", groupName: "Bảng A" }),
      make({ id: "4", status: "forfeit", groupName: "Bảng A" }),
      make({ id: "5", status: "live", groupName: "Bảng A" }),
    ];
    const result = filterAndSortMatches(items, "");
    // query empty → only live; check order live-A before live-B
    expect(result.map((m) => m.id)).toEqual(["5", "2"]);
  });

  test("with query, full status ordering", () => {
    const items = [
      make({ id: "1", status: "done", sideA: "Hào" }),
      make({ id: "2", status: "live", sideA: "Hào" }),
      make({ id: "3", status: "scheduled", sideA: "Hào" }),
      make({ id: "4", status: "forfeit", sideA: "Hào" }),
    ];
    const result = filterAndSortMatches(items, "hao");
    expect(result.map((m) => m.id)).toEqual(["2", "3", "1", "4"]);
  });

  test("no match returns empty", () => {
    const items = [make({ id: "1", sideA: "Minh", sideB: "Tuấn" })];
    expect(filterAndSortMatches(items, "xyz")).toEqual([]);
  });

  test("whitespace-only query treated as empty", () => {
    const items = [
      make({ id: "1", status: "live" }),
      make({ id: "2", status: "scheduled" }),
    ];
    const result = filterAndSortMatches(items, "   ");
    expect(result.map((m) => m.id)).toEqual(["1"]);
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npm test -- _search-filter`
Expected: FAIL "Cannot find module './_search-filter'".

- [ ] **Step 3: Implement**

```ts
// src/app/admin/_search-filter.ts
import { normalizeVi } from "@/lib/text/normalize";

export type MatchKind = "doubles" | "teams";

export type MatchIndexItem = {
  id: string;
  kind: MatchKind;
  groupId: string;
  groupName: string;
  sideA: string;
  sideB: string;
  status: "scheduled" | "live" | "done" | "forfeit";
};

const STATUS_RANK: Record<MatchIndexItem["status"], number> = {
  live: 0,
  scheduled: 1,
  done: 2,
  forfeit: 3,
};

export function filterAndSortMatches(
  items: MatchIndexItem[],
  query: string,
): MatchIndexItem[] {
  const q = normalizeVi(query);
  const filtered =
    q === ""
      ? items.filter((m) => m.status === "live")
      : items.filter(
          (m) =>
            normalizeVi(m.sideA).includes(q) ||
            normalizeVi(m.sideB).includes(q),
        );

  return [...filtered].sort((a, b) => {
    const s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (s !== 0) return s;
    return a.groupName.localeCompare(b.groupName, "vi");
  });
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- _search-filter`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/_search-filter.ts src/app/admin/_search-filter.test.ts
git commit -m "feat(admin): add pure filterAndSortMatches helper for search sheet"
```

---

## Task 3: Server action fetchMatchIndexForKind

**Files:**
- Create: `src/app/admin/_search-actions.ts`

Pattern reference: uses `requireAdmin` like API routes do; uses `supabaseServer` like `fetchDoublesMatchesByGroup` in `src/lib/db/matches.ts`.

- [ ] **Step 1: Create the server action**

```ts
// src/app/admin/_search-actions.ts
"use server";

import { requireAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { MatchIndexItem } from "./_search-filter";

type DoublesRow = {
  id: string;
  group_id: string;
  status: MatchIndexItem["status"];
  pair_a: string;
  pair_b: string;
};

type TeamsRow = {
  id: string;
  group_id: string;
  status: MatchIndexItem["status"];
  team_a: string;
  team_b: string;
};

type GroupRow = { id: string; name: string };

async function fetchDoublesIndex(): Promise<MatchIndexItem[]> {
  const [matchesResp, groupsResp, pairsResp] = await Promise.all([
    supabaseServer
      .from("doubles_matches")
      .select("id, group_id, status, pair_a, pair_b")
      .order("id"),
    supabaseServer.from("doubles_groups").select("id, name"),
    supabaseServer
      .from("doubles_pairs")
      .select("id, p1:doubles_players!p1(id,name), p2:doubles_players!p2(id,name)"),
  ]);
  if (matchesResp.error) throw new Error(matchesResp.error.message);
  if (groupsResp.error) throw new Error(groupsResp.error.message);
  if (pairsResp.error) throw new Error(pairsResp.error.message);

  const groupName = new Map(
    ((groupsResp.data ?? []) as GroupRow[]).map((g) => [g.id, g.name]),
  );
  const pairLabel = new Map(
    (
      (pairsResp.data ?? []) as unknown as Array<{
        id: string;
        p1: { name: string };
        p2: { name: string };
      }>
    ).map((p) => [p.id, `${p.p1.name} – ${p.p2.name}`]),
  );

  return ((matchesResp.data ?? []) as DoublesRow[]).map((r) => ({
    id: r.id,
    kind: "doubles",
    groupId: r.group_id,
    groupName: groupName.get(r.group_id) ?? "?",
    sideA: pairLabel.get(r.pair_a) ?? "?",
    sideB: pairLabel.get(r.pair_b) ?? "?",
    status: r.status,
  }));
}

async function fetchTeamsIndex(): Promise<MatchIndexItem[]> {
  const [matchesResp, groupsResp, teamsResp] = await Promise.all([
    supabaseServer
      .from("team_matches")
      .select("id, group_id, status, team_a, team_b")
      .order("id"),
    supabaseServer.from("team_groups").select("id, name"),
    supabaseServer.from("teams").select("id, name"),
  ]);
  if (matchesResp.error) throw new Error(matchesResp.error.message);
  if (groupsResp.error) throw new Error(groupsResp.error.message);
  if (teamsResp.error) throw new Error(teamsResp.error.message);

  const groupName = new Map(
    ((groupsResp.data ?? []) as GroupRow[]).map((g) => [g.id, g.name]),
  );
  const teamName = new Map(
    ((teamsResp.data ?? []) as Array<{ id: string; name: string }>).map((t) => [
      t.id,
      t.name,
    ]),
  );

  return ((matchesResp.data ?? []) as TeamsRow[]).map((r) => ({
    id: r.id,
    kind: "teams",
    groupId: r.group_id,
    groupName: groupName.get(r.group_id) ?? "?",
    sideA: teamName.get(r.team_a) ?? "?",
    sideB: teamName.get(r.team_b) ?? "?",
    status: r.status,
  }));
}

export async function fetchMatchIndexForKind(
  kind: "doubles" | "teams",
): Promise<MatchIndexItem[]> {
  await requireAdmin();
  return kind === "doubles" ? fetchDoublesIndex() : fetchTeamsIndex();
}
```

- [ ] **Step 2: Verify table names**

Run: `grep -rn "team_groups\\|doubles_groups\\|doubles_pairs\\|team_matches" src/lib/db | head -10`
Expected: confirm `doubles_groups`, `team_groups`, `doubles_pairs`, `teams`, `team_matches`, `doubles_matches` are the actual table names already used.

If `team_groups` is NOT the actual name, open `src/lib/db/groups.ts` and `src/lib/db/teams.ts` and adjust. (Based on current codebase: `fetchTeamGroups` exists — verify its `.from(...)` argument.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Fix if `supabase` type inference complains; use the `as unknown as` pattern already established in `buildPairLabelMap` if needed.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/_search-actions.ts
git commit -m "feat(admin): add fetchMatchIndexForKind server action"
```

---

## Task 4: AdminSearchSheet component

**Files:**
- Create: `src/app/admin/_search-sheet.tsx`

Reuses existing Dialog primitive from `@/components/ui/dialog` (already used across admin).

- [ ] **Step 1: Create the component**

```tsx
// src/app/admin/_search-sheet.tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchMatchIndexForKind } from "./_search-actions";
import {
  filterAndSortMatches,
  type MatchIndexItem,
  type MatchKind,
} from "./_search-filter";

const STATUS_LABEL: Record<MatchIndexItem["status"], string> = {
  live: "Đang đá",
  scheduled: "Sắp đá",
  done: "Đã xong",
  forfeit: "Bỏ cuộc",
};

const STATUS_CLASS: Record<MatchIndexItem["status"], string> = {
  live: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  scheduled: "bg-muted text-foreground/80",
  done: "bg-muted text-muted-foreground",
  forfeit: "bg-muted text-muted-foreground",
};

export function SearchIconButton({ kind }: { kind: MatchKind }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Tìm trận"
            title="Tìm trận"
          />
        }
      >
        <Search className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-w-md gap-0 p-0">
        <AdminSearchSheet
          kind={kind}
          onPick={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AdminSearchSheet({
  kind,
  onPick,
}: {
  kind: MatchKind;
  onPick: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MatchIndexItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cache = useRef<Map<MatchKind, MatchIndexItem[]>>(new Map());

  const load = (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = cache.current.get(kind);
      if (cached) {
        setItems(cached);
        setError(null);
        return;
      }
    }
    setError(null);
    setItems(null);
    startTransition(async () => {
      try {
        const data = await fetchMatchIndexForKind(kind);
        cache.current.set(kind, data);
        setItems(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
      }
    });
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const results = items ? filterAndSortMatches(items, query) : [];
  const emptyState = renderEmptyState({
    loading: isPending || items === null,
    error,
    itemsExists: items !== null && items.length > 0,
    resultsLen: results.length,
    query,
    onRetry: () => load(true),
  });

  return (
    <div className="flex max-h-[85vh] flex-col">
      <DialogHeader className="border-b p-3">
        <DialogTitle className="sr-only">Tìm trận</DialogTitle>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Gõ tên VĐV / cặp / đội…"
              className="h-10 pl-8 pr-8 text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Xoá tìm kiếm"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => load(true)}
            disabled={isPending}
            aria-label="Tải lại"
            title="Tải lại"
          >
            {isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RotateCcw />
            )}
          </Button>
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto p-2">
        {emptyState}
        {!emptyState && (
          <ul className="flex flex-col gap-1">
            {results.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left hover:bg-muted"
                  onClick={() => {
                    router.push(
                      `/admin/${m.kind}/groups/${m.groupId}?match=${m.id}`,
                    );
                    onPick();
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {m.sideA} <span className="text-muted-foreground">vs</span> {m.sideB}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {m.groupName}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 ${STATUS_CLASS[m.status]}`}
                  >
                    {STATUS_LABEL[m.status]}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function renderEmptyState({
  loading,
  error,
  itemsExists,
  resultsLen,
  query,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  itemsExists: boolean;
  resultsLen: number;
  query: string;
  onRetry: () => void;
}): React.ReactNode | null {
  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Đang tải…
      </p>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-sm">
        <p className="text-muted-foreground">{error}</p>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Thử lại
        </Button>
      </div>
    );
  }
  if (!itemsExists) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Chưa có trận. Tạo bảng trước ở tab Bảng.
      </p>
    );
  }
  if (resultsLen === 0 && query.trim() === "") {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Chưa có trận đang đá. Gõ để tìm.
      </p>
    );
  }
  if (resultsLen === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Không tìm thấy trận nào.
      </p>
    );
  }
  return null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `DialogTrigger render={...}` API differs from what's used in `_components.tsx`, mirror the exact pattern from `EditDoublesMatchDialog` (see line ~2179 for the pattern used for dialogs in this repo).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_search-sheet.tsx
git commit -m "feat(admin): add AdminSearchSheet + SearchIconButton"
```

---

## Task 5: Wire SearchIconButton into admin kind pages

**Files:**
- Modify: `src/app/admin/doubles/page.tsx`
- Modify: `src/app/admin/teams/page.tsx`

- [ ] **Step 1: Edit doubles page header**

In `src/app/admin/doubles/page.tsx`, locate the `header` JSX inside `headerSlot` (currently shows a back button + title). Insert `<SearchIconButton kind="doubles" />` aligned to the right.

Change:

```tsx
// top of file
import { SearchIconButton } from "../_search-sheet";
```

And the header:

```tsx
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
  <div className="flex-1">
    <h1 className="text-xl font-semibold">Nội dung Đôi</h1>
    <p className="text-sm text-muted-foreground">VĐV, cặp đôi và bảng đấu</p>
  </div>
  <SearchIconButton kind="doubles" />
</header>
```

- [ ] **Step 2: Edit teams page header**

Same change in `src/app/admin/teams/page.tsx`, with `kind="teams"`. Read the file first (`Read`), mirror the same structural edit: add the import and place `<SearchIconButton kind="teams" />` at the end of the header flex row; ensure the title wrapper has `flex-1`.

- [ ] **Step 3: Smoke test**

Run: `npm run dev`
Open `/admin/doubles` and `/admin/teams`. Tap 🔍 → sheet opens; at this step the navigation after picking a result won't auto-open anything yet (that's Task 6/7/8), but navigation itself should work.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/doubles/page.tsx src/app/admin/teams/page.tsx
git commit -m "feat(admin): wire SearchIconButton into kind landing pages"
```

---

## Task 6: Wire autoOpen into DoublesMatchCard + EditDoublesMatchDialog

**Files:**
- Modify: `src/app/admin/_components.tsx`

The chain: `DoublesSchedule` → `DoublesMatchCard` → `EditDoublesMatchDialog`.

- [ ] **Step 1: Add `autoOpenMatchId` prop to `DoublesSchedule`**

Locate `DoublesSchedule` (around line 483). Change signature and forward to card:

```tsx
export function DoublesSchedule({
  groupId,
  groupName,
  entries,
  matches: initialMatches,
  readOnly,
  autoOpenMatchId,
}: {
  groupId: string;
  groupName: string;
  entries: { id: string; label: string }[];
  matches: MatchResolved[];
  readOnly?: boolean;
  autoOpenMatchId?: string;
}) {
  // ... existing body unchanged until renderMatch ...
  // In the renderMatch callback, pass autoOpen:
  renderMatch={(m, i) => (
    <DoublesMatchCard
      key={m.id}
      match={m}
      index={i}
      readOnly={readOnly}
      onMatchUpdated={handleMatchUpdated}
      autoOpen={m.id === autoOpenMatchId}
    />
  )}
  // ... rest unchanged ...
}
```

- [ ] **Step 2: Add `autoOpen` prop to `DoublesMatchCard`**

Locate `DoublesMatchCard` (around line 608). Accept `autoOpen?: boolean`, add a `ref` to the outermost `<Card>` element so we can scroll into view.

Change signature:

```tsx
function DoublesMatchCard({
  match: initialMatch,
  index,
  readOnly,
  onMatchUpdated,
  autoOpen,
}: {
  match: MatchResolved;
  index: number;
  readOnly?: boolean;
  onMatchUpdated?: (m: MatchResolved) => void;
  autoOpen?: boolean;
}) {
  // ... existing state ...
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (autoOpen) {
      cardRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [autoOpen]);
  // ... unchanged body ...
  return (
    <Card ref={cardRef} className={/* existing */}>
      {/* ... */}
      <EditDoublesMatchDialog
        title={`Trận ${index}`}
        match={match}
        disabled={pending}
        onSave={save}
        autoOpen={autoOpen}
      />
      {/* ... */}
    </Card>
  );
}
```

Note: `useRef`, `useEffect` are already imported at the top (`_components.tsx:4`). If `Card` does not forward refs, wrap it in a `<div ref={cardRef}>`.

- [ ] **Step 3: Add `autoOpen` prop to `EditDoublesMatchDialog`**

Locate `EditDoublesMatchDialog` (around line 2164). Add `autoOpen?: boolean` prop + one-shot effect:

```tsx
function EditDoublesMatchDialog({
  title,
  match,
  disabled,
  onSave,
  autoOpen,
}: {
  title: string;
  match: MatchResolved;
  disabled?: boolean;
  onSave: (body: {
    sets?: SetScore[];
    status?: Status;
    winner?: string | null;
  }) => Promise<boolean>;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const consumedAutoOpen = useRef(false);
  useEffect(() => {
    if (autoOpen && !consumedAutoOpen.current) {
      consumedAutoOpen.current = true;
      setOpen(true);
    }
  }, [autoOpen]);
  // ... rest of existing body unchanged ...
}
```

The `consumedAutoOpen` guard ensures the dialog does not reopen itself when the user later closes it but the `autoOpen` prop is still `true`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/_components.tsx
git commit -m "feat(admin): add autoOpen wiring for doubles match dialog"
```

---

## Task 7: Wire autoOpen (scroll only) into TeamMatchCard

**Files:**
- Modify: `src/app/admin/_components.tsx`

TeamMatchCard renders inline — there is no dialog. Auto-open = scroll card into view.

- [ ] **Step 1: Add `autoOpenMatchId` prop to `TeamSchedule`**

Locate `TeamSchedule` (around line 731). Add prop and forward:

```tsx
export function TeamSchedule({
  groupId,
  groupName,
  entries,
  matches: initialMatches,
  teamPlayersByTeamId = {},
  readOnly,
  autoOpenMatchId,
}: {
  groupId: string;
  groupName: string;
  entries: { id: string; label: string }[];
  matches: TeamMatchResolved[];
  teamPlayersByTeamId?: Record<string, Array<{ id: string; name: string }>>;
  readOnly?: boolean;
  autoOpenMatchId?: string;
}) {
  // ... unchanged body until renderMatch ...
  renderMatch={(m, i) => (
    <TeamMatchCard
      key={m.id}
      match={m}
      index={i}
      readOnly={readOnly}
      teamAPlayers={teamPlayersByTeamId[m.teamA.id] ?? []}
      teamBPlayers={teamPlayersByTeamId[m.teamB.id] ?? []}
      onMatchUpdated={handleMatchUpdated}
      autoOpen={m.id === autoOpenMatchId}
    />
  )}
  // ... rest unchanged ...
}
```

- [ ] **Step 2: Add `autoOpen` prop to `TeamMatchCard`**

Locate `TeamMatchCard` (around line 858). Add prop, ref, and scroll effect:

```tsx
function TeamMatchCard({
  match: initialMatch,
  index,
  readOnly,
  teamAPlayers,
  teamBPlayers,
  onMatchUpdated,
  autoOpen,
}: {
  match: TeamMatchResolved;
  index: number;
  readOnly?: boolean;
  teamAPlayers: Array<{ id: string; name: string }>;
  teamBPlayers: Array<{ id: string; name: string }>;
  onMatchUpdated?: (m: TeamMatchResolved) => void;
  autoOpen?: boolean;
}) {
  // ... existing state/refs ...
  const cardRef = useRef<HTMLDivElement | null>(null);
  const consumedAutoOpen = useRef(false);
  useEffect(() => {
    if (autoOpen && !consumedAutoOpen.current) {
      consumedAutoOpen.current = true;
      cardRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [autoOpen]);
  // ... unchanged body ...
  return (
    <Card ref={cardRef} className={/* existing */}>
      {/* unchanged */}
    </Card>
  );
}
```

If `Card` does not forward `ref`, wrap the existing `<Card>` in a `<div ref={cardRef}>`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/_components.tsx
git commit -m "feat(admin): scroll team match card into view on autoOpen"
```

---

## Task 8: Group detail pages read `?match=` + inject SearchIconButton

**Files:**
- Modify: `src/app/admin/doubles/groups/[id]/page.tsx`
- Modify: `src/app/admin/teams/groups/[id]/page.tsx`

Current pages already `await params`. Add `searchParams`.

Also: after the schedule auto-opens/scrolls, the `?match=` param must be cleared so a back-navigation does not re-trigger. We do this with a small client-side effect inside the schedule components. Add it in the same pass.

- [ ] **Step 1: Modify `src/app/admin/doubles/groups/[id]/page.tsx`**

Change the file to:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoublesSchedule } from "../../../_components";
import { GroupRegenerateButton } from "../../../_group-regenerate-button";
import { SearchIconButton } from "../../../_search-sheet";
import { fetchDoublesGroupById } from "@/lib/db/groups";
import { fetchDoublesMatchesByGroup } from "@/lib/db/matches";

export const dynamic = "force-dynamic";

export default async function DoublesGroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ match?: string }>;
}) {
  const [{ id }, { match: autoOpenMatchId }] = await Promise.all([
    params,
    searchParams,
  ]);
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
        <SearchIconButton kind="doubles" />
        <GroupRegenerateButton
          kind="doubles"
          groupId={group.id}
          groupName={group.name}
        />
      </header>

      <DoublesSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries}
        matches={matches}
        autoOpenMatchId={autoOpenMatchId}
      />
    </main>
  );
}
```

- [ ] **Step 2: Modify `src/app/admin/teams/groups/[id]/page.tsx`**

Read the file first (`Read`). It mirrors the doubles one but imports `TeamSchedule` and team fetchers. Apply the same changes:

1. Add `searchParams: Promise<{ match?: string }>` param.
2. `const [{ id }, { match: autoOpenMatchId }] = await Promise.all([params, searchParams]);`
3. Add `<SearchIconButton kind="teams" />` to the header (mirror position from Task 8 Step 1).
4. Pass `autoOpenMatchId={autoOpenMatchId}` to `<TeamSchedule />`.

Use the same import path: `import { SearchIconButton } from "../../../_search-sheet";`.

- [ ] **Step 3: Clear `?match=` after consumption (inside schedules)**

Back in `src/app/admin/_components.tsx`, extend both `DoublesSchedule` and `TeamSchedule` to call `router.replace` once after the param is consumed.

In the imports at top of the file, confirm `useRouter`, `usePathname`, `useSearchParams` are already imported (line 3: `usePathname`, `useRouter`, `useSearchParams`). They are.

Add inside `DoublesSchedule` (right after `const color = groupColor(groupId);` or wherever logical near the top of its body):

```tsx
const router = useRouter();
const pathname = usePathname();
const searchParams = useSearchParams();
const clearedRef = useRef(false);
useEffect(() => {
  if (!autoOpenMatchId || clearedRef.current) return;
  clearedRef.current = true;
  const next = new URLSearchParams(searchParams?.toString() ?? "");
  next.delete("match");
  const qs = next.toString();
  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
}, [autoOpenMatchId, pathname, searchParams, router]);
```

Add the exact same block inside `TeamSchedule` (it uses the same prop name).

The `clearedRef` guard ensures we don't re-clear if React re-runs the effect.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Smoke test in browser**

Run: `npm run dev`
1. `/admin/doubles` → 🔍 → gõ tên một VĐV có trận live → tap → route changes to `/admin/doubles/groups/<id>?match=<id>` → dialog mở tự động + card cuộn vào giữa → URL chuyển về `/admin/doubles/groups/<id>` (không `?match=`).
2. Đóng dialog → không reopen.
3. Back button → không reopen.
4. `/admin/teams` → 🔍 → tap một trận → card cuộn vào giữa view (không có dialog vì team dùng inline card).

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/doubles/groups/[id]/page.tsx src/app/admin/teams/groups/[id]/page.tsx src/app/admin/_components.tsx
git commit -m "feat(admin): consume ?match= deep link on group pages"
```

---

## Task 9: Full test pass + QA checklist

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all tests pass. The new `normalize` and `_search-filter` suites should pass; existing suites should be unaffected.

- [ ] **Step 2: Run type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Manual QA checklist (from spec §6)**

Run: `npm run dev`

Walk through each, confirm:

1. [ ] `/admin/doubles`, tap 🔍 → sheet mở, placeholder "Gõ tên VĐV / cặp…", hiện trận `live` (nếu có) hoặc empty message.
2. [ ] Gõ "hao" → filter ra VĐV / cặp chứa "Hào", "Hạo", "Hảo".
3. [ ] Tap result → route tới `/admin/doubles/groups/<id>?match=<id>` → dialog mở auto, card cuộn giữa view. URL sau đó chuyển về `/admin/doubles/groups/<id>`.
4. [ ] Đóng dialog → back-refresh không reopen.
5. [ ] `/admin/teams`, tap 🔍 → search chỉ trận Đồng đội; tap result → card cuộn vào giữa (không có dialog).
6. [ ] `/admin` root → không thấy icon 🔍.
7. [ ] Gõ từ không khớp → "Không tìm thấy trận nào."
8. [ ] Bấm nút refresh trong sheet → fetch lại (cache bị invalidate cho kind hiện tại).
9. [ ] Regenerate bảng rồi mở sheet (không refresh) → tap result cũ → navigate nhưng không auto-open (match id không còn trong `matches`); no crash in console.

- [ ] **Step 4: Commit fix-ups if any**

Nếu có sửa bugs từ QA, fix + commit. Nếu không có gì, skip step này.

---

## Self-review notes

- **Spec coverage:**
  - §1 scope (doubles + teams, kind-only, all statuses, live-first, diacritic-insensitive, name match only) → Tasks 1, 2, 3, 4.
  - §2 architecture (`<AdminSearchSheet>`, icon in header, deep link) → Tasks 4, 5, 8.
  - §3 components & types → Tasks 1-7.
  - §4 data flow (fetch-on-open cache, empty query = live only, tap navigates, group page auto-opens) → Tasks 3, 4, 6, 7, 8.
  - §5 URL contract + edge cases (stale id, fetch error, list empty, param clear) → Task 4 (error states), Task 8 (param clear). Stale-id "no auto-open" is free by design because match row check `m.id === autoOpenMatchId` only fires when the match exists.
  - §6 tests → Tasks 1, 2, 9.
  - §7 risks (dialog reopen guard, preserve other params) → Task 6 (consumedAutoOpen ref), Task 8 (URLSearchParams rebuild preserves other keys).

- **Divergence from spec noted:** Spec §3 says "EditDoublesMatchDialog + edit team match dialog: thêm prop autoOpen". In the codebase, team matches do NOT have an edit dialog — `TeamMatchCard` renders inline with an always-open `<details>`. So "auto-open" for teams becomes scroll-only. This plan reflects that; the spec's §7 "Rủi ro" block should ideally be updated but the behavior is semantically equivalent ("bring the editing surface into focus"). Flag to user if they want the spec amended.

- **No placeholders.** All steps include actual code.

- **Type consistency:** `MatchIndexItem`, `MatchKind`, `autoOpenMatchId`, `autoOpen`, `SearchIconButton` props — names consistent across tasks.
