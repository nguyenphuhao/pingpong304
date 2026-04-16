# Phase 3: Pairs (Doubles) + Teams API + Admin UI Swap — Design

**Date:** 2026-04-16
**Status:** Approved, ready for implementation planning
**Parent spec:** `docs/superpowers/specs/2026-04-16-supabase-integration-design.md`
**Sibling phase:** `docs/superpowers/specs/2026-04-16-phase-2-players-api-design.md`
**Branch (planned):** `feat/supabase-phase-3`

## 1. Mục tiêu

Thay mock Pairs (`MOCK_PAIRS`) + Teams (`MOCK_TEAMS`) bằng Supabase, thêm CRUD UI cho cả 2 entity ở admin. Sau phase này: admin có thể tạo/sửa/xoá cặp đôi và đội thật, data lưu DB. Groups / Matches / KO **vẫn là mock** (defer đến Phase 4+).

Mirror nguyên pattern Phase 2: API + zod shared + auth helper + optimistic UI + sonner toast + skeleton loading + colocated unit tests.

## 2. Decisions (đã chốt với user)

| # | Hạng mục | Quyết định | Lý do |
|---|---|---|---|
| 1 | Scope | Pairs (doubles) + Teams trong 1 phase, 10 endpoints | Mirror Phase 2; giảm số PR review |
| 2 | Team size | **Fixed 3 VĐV/đội**, enforce ở zod + UI 3 slot | Business rule của giải hiện tại; DB vẫn để `text[]` để mở rộng sau |
| 3 | Pair gender | Không enforce | Mock data đã có M-F (mixed doubles được); admin tự quyết |
| 4 | ID format | `p19+` cho pairs, `T01+` cho teams, zero-pad 2 digits | Continue từ seed; retry-on-23505 max 3 lần |
| 5 | Data shape API | Resolved names kèm ID: `{id, p1:{id,name}, p2:{id,name}}` | UI đỡ round-trip, server là nơi authoritative để join |
| 6 | Picker UX | `<Select>` base-ui (không search), disable-already-picked | 36 players/content, scroll OK; zero new dep |
| 7 | Downstream | Groups/Matches/KO còn mock — `ContentWorkspace` props split new/legacy | Cách ly rõ, Phase 4 sẽ migrate tiếp |
| 8 | Delete pre-check | Query cả `matches` + `groups.entries` → 409 với detail | DB là nguồn chân lý; seed data đã có ref |
| 9 | ID regex validate | Shared `IdSchema` ở params, apply cho players (fix Phase 2 debt) + pairs + teams | Defense-in-depth cho `.or()` / `.contains()` interpolation |
| 10 | PATCH | Không pre-check FK (cho phép thay người trong pair/team) | Pair là "slot identity", không phải historical snapshot |
| 11 | Auth | `requireAdmin()` helper từ Phase 2 | Đã có, dùng lại |
| 12 | Validation | Zod shared client+server, refine rules (p1≠p2, members length=3 distinct) | Type-safe, dùng được 2 nơi |
| 13 | Response shape | `{ data, error }` | Consistent Phase 2 |
| 14 | Delete | Hard delete (không soft-delete) | Không có use case audit |
| 15 | Pagination | Skip — GET trả full array | Pairs < 50, teams < 20 |
| 16 | Testing | Unit với mock Supabase, colocated | Mirror Phase 2 |

## 3. Kiến trúc

```
Admin page (RSC)
  ↓ fetchPairs()/fetchTeams() via supabaseServer (JOIN hoặc 2-step)  [read]
ContentWorkspace (Client Component)
  ↓ props: pairs (new shape), teams (new shape), players,
          legacyPairs + legacyTeams (cho Groups/Matches/KO mock)
PairsSection / TeamsSection ("use client", extracted files)
  ↓ fetch('/api/{kind}/pairs' or '/api/teams/teams', POST/PATCH/DELETE)
Route Handler
  ↓ requireAdmin() → zod parse → id-regex validate → supabaseServer write
  ↓                                                 → FK pre-check
Supabase (Postgres)
```

**Boundaries:**
- **Read:** RSC gọi helpers `fetchPairs`/`fetchTeams` trong `src/lib/db/` — dùng chung cho RSC + API route
- **Write:** Client `fetch` → Route Handler → `supabaseServer`
- **Auth:** Cookie `pp_admin` check qua `requireAdmin()` trước mọi POST/PATCH/DELETE (reuse Phase 2)
- **Validation:** Zod schema shared, parse ở client (pre-submit) + server (body)
- **ID safety:** `IdSchema` regex validate `params.id` trước khi dùng trong `.or()` / `.contains()` (defense-in-depth cho string interpolation)
- **Error:** Response `{ data, error }`, client map sang sonner toast

## 4. API Endpoints

### 4.1. Doubles — Pairs (5 endpoints)

```
GET    /api/doubles/pairs           → { data: PairWithNames[], error: null }        200
POST   /api/doubles/pairs           → body: {p1: string, p2: string}
                                      → { data: PairWithNames, error: null }        201
GET    /api/doubles/pairs/[id]      → { data: PairWithNames | null, error }         200/404
PATCH  /api/doubles/pairs/[id]      → body partial {p1?, p2?}
                                      → { data: PairWithNames, error }              200
DELETE /api/doubles/pairs/[id]      → { data: null, error: null }                   200
                                      → { data: null, error: "..." }                409 nếu còn ref
```

### 4.2. Teams — Teams (5 endpoints)

```
GET    /api/teams/teams             → { data: TeamWithNames[], error: null }        200
POST   /api/teams/teams             → body: {name, members: [id1, id2, id3]}
                                      → { data: TeamWithNames, error: null }        201
GET    /api/teams/teams/[id]        → { data: TeamWithNames | null, error }         200/404
PATCH  /api/teams/teams/[id]        → body partial {name?, members?}
                                      → { data: TeamWithNames, error }              200
DELETE /api/teams/teams/[id]        → { data: null, error: null }                   200
                                      → { data: null, error: "..." }                409 nếu còn ref
```

Route path `/api/teams/teams` giữ pattern `/{kind}/{entity}` để scale tới Phase 4+ (groups, matches, ko) consistent.

### 4.3. HTTP status codes

| Code | Khi nào |
|---|---|
| 200 | GET / PATCH / DELETE OK |
| 201 | POST OK |
| 400 | Zod validation fail hoặc id-regex fail hoặc FK không tồn tại (p1/p2/member ID không có trong bảng players) |
| 401 | Không có cookie `pp_admin` |
| 404 | `GET /[id]` không tồn tại |
| 409 | Delete FK restrict (pair/team đang ref trong matches hoặc groups.entries) |
| 500 | Unhandled error |

### 4.4. Auto-compute trong POST

1. Parse zod (`PairInputSchema` hoặc `TeamInputSchema`)
2. Verify FK exist: với pair, check `doubles_players` có `p1` + `p2`; với team, check `team_players` có tất cả 3 `members` — 400 nếu không
3. `nextId(table, prefix, padLen)` — query max id filter by prefix, +1, zero-pad
4. Insert, nếu 23505 (duplicate key) → retry max 3 lần
5. Sau insert: re-select với join (hoặc map) → trả `PairWithNames` / `TeamWithNames` 201

### 4.5. Delete pre-check logic

**Doubles pairs:**
```ts
// 1. Validate id format
IdSchema.parse(params.id);

// 2. Matches reference (FK restrict)
const { data: matches } = await supabaseServer
  .from("doubles_matches")
  .select("id")
  .or(`pair_a.eq.${params.id},pair_b.eq.${params.id}`);

// 3. Groups reference (soft: text[] contains)
const { data: groups } = await supabaseServer
  .from("doubles_groups")
  .select("id, name")
  .contains("entries", [params.id]);

const refs: string[] = [];
if (matches.length > 0) refs.push(`${matches.length} trận đấu`);
if (groups.length > 0) refs.push(`bảng ${groups.map(g => g.name).join(", ")}`);
if (refs.length > 0) return err(`Cặp đang dùng trong ${refs.join(" và ")} — xoá các tham chiếu trước`, 409);

// 4. Delete
```

**Teams (mirror):**
```ts
IdSchema.parse(params.id);
const { data: matches } = await supabaseServer
  .from("team_matches")
  .select("id")
  .or(`team_a.eq.${params.id},team_b.eq.${params.id}`);
const { data: groups } = await supabaseServer
  .from("team_groups")
  .select("id, name")
  .contains("entries", [params.id]);
// ... same err() logic
```

**Lưu ý:** Phase 3 chỉ migrate pairs + teams, nhưng DB đã có seed data cho matches + groups. Pre-check sẽ query DB thật → reference real. Behavior đúng: muốn xoá pair mới tạo (`p19+`, chưa ref ở đâu) → OK; xoá pair cũ (p01–p18) → 409.

### 4.6. PATCH behavior

- Không pre-check FK (cho phép đổi p1/p2 hoặc members)
- Zod refine vẫn apply (p1≠p2, members distinct, length=3)
- Verify FK members/players tồn tại trước insert/update — 400 nếu không
- Pair là "slot identity" — khi đổi p1, mọi match cũ vẫn reference pair ID, display sẽ dùng tên mới (resolved at query time)

## 5. Schemas

### 5.1. `src/lib/schemas/id.ts` (shared)

```ts
import { z } from "zod";

// Allow alphanumeric + underscore + hyphen. Match seed format: "p01", "T01", "d36", "gA".
export const IdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/, "ID không hợp lệ");
```

Apply cho tất cả route `[id]` handlers (pairs + teams + fix players Phase 2 debt).

### 5.2. `src/lib/schemas/pair.ts`

```ts
import { z } from "zod";
import { IdSchema } from "./id";

export const PairInputSchema = z.object({
  p1: IdSchema,
  p2: IdSchema,
}).refine((d) => d.p1 !== d.p2, {
  message: "2 VĐV phải khác nhau",
  path: ["p2"],
});

export const PairPatchSchema = z.object({
  p1: IdSchema.optional(),
  p2: IdSchema.optional(),
}).refine(
  (d) => !d.p1 || !d.p2 || d.p1 !== d.p2,
  { message: "2 VĐV phải khác nhau", path: ["p2"] },
);

export type PairInput = z.infer<typeof PairInputSchema>;
export type PairPatch = z.infer<typeof PairPatchSchema>;

export type PairWithNames = {
  id: string;
  p1: { id: string; name: string };
  p2: { id: string; name: string };
};
```

### 5.3. `src/lib/schemas/team.ts`

```ts
import { z } from "zod";
import { IdSchema } from "./id";

export const TeamInputSchema = z.object({
  name: z.string().trim().min(1, "Tên đội không được để trống").max(60),
  members: z.array(IdSchema)
    .length(3, "Đội phải có đúng 3 VĐV")
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "VĐV không được trùng",
    }),
});

export const TeamPatchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  members: z.array(IdSchema)
    .length(3)
    .refine((arr) => new Set(arr).size === arr.length)
    .optional(),
});

export type TeamInput = z.infer<typeof TeamInputSchema>;
export type TeamPatch = z.infer<typeof TeamPatchSchema>;

export type TeamWithNames = {
  id: string;
  name: string;
  members: Array<{ id: string; name: string }>;
};
```

### 5.4. Type re-exports

`src/lib/db/types.ts` thêm:
```ts
export type { PairWithNames } from "@/lib/schemas/pair";
export type { TeamWithNames } from "@/lib/schemas/team";
```

Legacy `Pair` + `Team` từ `_mock` vẫn giữ — dùng cho Groups/Matches/KO mock sections. Xoá ở Phase 7.

## 6. DB Helpers

### 6.1. `src/lib/db/next-id.ts` (shared)

```ts
import { supabaseServer } from "@/lib/supabase/server";

export async function nextId(
  table: string,
  prefix: string,
  padLen: number,
): Promise<string> {
  const { data, error } = await supabaseServer
    .from(table)
    .select("id")
    .like("id", `${prefix}%`)
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.id;
  const n = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(padLen, "0")}`;
}
```

Usage:
- Pairs: `nextId("doubles_pairs", "p", 2)` → `p19`
- Teams: `nextId("teams", "T", 2)` → `T01` (seed dùng `tA1..tB4` nhưng convention mới sẽ là `T01+`)
- Future: sẽ dùng cho groups/matches/ko nữa

**Lưu ý về team ID:** Seed data hiện có `tA1, tA2, tA3, tA4, tB1, tB2, tB3, tB4` (8 teams, mixed prefix). `nextId("teams", "T", 2)` sẽ scan `T%` → không có → trả `T01`. Có thể trùng với existing `tA1` (case-sensitive `LIKE`). Postgres `LIKE` **là case-sensitive** → OK, `T%` không match `tA1`. Nhưng cần verify + có thể phải migrate seed sang convention mới (ra ngoài scope — nếu cần, ticket Phase 7 cleanup).

**Decision:** Giữ seed ID cũ (`tA1..tB4`), team mới tạo dùng `T01+`. Coexist OK vì không conflict regex và LIKE case-sensitive.

Refactor Phase 2 `nextPlayerId` helper → dùng chung `nextId()` này. Không bắt buộc trong Phase 3 nếu risk cao — có thể để Phase 7 cleanup.

### 6.2. `src/lib/db/pairs.ts`

```ts
import { supabaseServer } from "@/lib/supabase/server";
import type { PairWithNames } from "@/lib/schemas/pair";

const SELECT = "id, p1:doubles_players!p1(id,name), p2:doubles_players!p2(id,name)";

export async function fetchPairs(): Promise<PairWithNames[]> {
  const { data, error } = await supabaseServer
    .from("doubles_pairs")
    .select(SELECT)
    .order("id");
  if (error) throw new Error(error.message);
  return (data ?? []) as PairWithNames[];
}

export async function fetchPairById(id: string): Promise<PairWithNames | null> {
  const { data, error } = await supabaseServer
    .from("doubles_pairs")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PairWithNames | null) ?? null;
}
```

### 6.3. `src/lib/db/teams.ts`

```ts
import { supabaseServer } from "@/lib/supabase/server";
import type { TeamWithNames } from "@/lib/schemas/team";

async function playerMap(): Promise<Map<string, string>> {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id, name");
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((p) => [p.id, p.name]));
}

export async function fetchTeams(): Promise<TeamWithNames[]> {
  const [{ data: teams, error }, map] = await Promise.all([
    supabaseServer.from("teams").select("id, name, members").order("id"),
    playerMap(),
  ]);
  if (error) throw new Error(error.message);
  return (teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    members: (t.members as string[]).map((mid) => ({
      id: mid,
      name: map.get(mid) ?? "?",
    })),
  }));
}

export async function fetchTeamById(id: string): Promise<TeamWithNames | null> {
  const { data, error } = await supabaseServer
    .from("teams")
    .select("id, name, members")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const map = await playerMap();
  return {
    id: data.id,
    name: data.name,
    members: (data.members as string[]).map((mid) => ({
      id: mid,
      name: map.get(mid) ?? "?",
    })),
  };
}
```

`?` placeholder cho tên khi member ID không còn trong `team_players` (dữ liệu inconsistent — không nên xảy ra sau validate FK ở POST/PATCH).

## 7. UI

### 7.1. PairsSection

```
┌──────────────────────────────────────┐
│ Danh sách cặp đôi        [+ Thêm]    │
│ 18 cặp đã ghép                       │
├──────────────────────────────────────┤
│ 1  p01  Minh Quân / Tân Sinh   ✏️ 🗑️│
│ 2  p02  Quang Vinh / Minh Tiên ✏️ 🗑️│
│ ...                                   │
└──────────────────────────────────────┘
```

**Card row:** STT (1-indexed) · pair ID uppercase · `p1.name / p2.name` · edit + delete buttons.

**PairFormDialog:**

```
Thêm cặp đôi
─────────────────
VĐV 1   [Chọn VĐV ▾]
VĐV 2   [Chọn VĐV ▾]  (disable VĐV 1 đã chọn)
             [Huỷ] [Thêm]
```

- `<Select>` base-ui với tất cả `doubles_players` (pass từ props)
- SelectItem `disabled` prop cho player đã pick ở slot khác
- Validate zod ở `handleSubmit`, nếu fail → toast + giữ dialog
- Submit OK → optimistic ghost `{id:"__pending__", p1:{id, name:lookup}, p2:{...}}` → fetch POST → RSC refresh → ghost replaced

### 7.2. TeamsSection

```
┌──────────────────────────────────────┐
│ Danh sách đội        [+ Thêm]        │
│ 8 đội đã đăng ký                     │
├──────────────────────────────────────┤
│ 👥 Bình Tân 1              [3 VĐV]   │
│   • Quốc                              │
│   • Quy                               │
│   • Liêu                              │
│                           ✏️ 🗑️       │
├──────────────────────────────────────┤
│ 👥 Bình Tân 2              [3 VĐV]   │
│ ...                                   │
└──────────────────────────────────────┘
```

Giữ UX cũ: card với team name + badge members count + list members vertical. Thêm edit + delete buttons góc phải.

**TeamFormDialog:**

```
Thêm đội
─────────────────
Tên đội  [__________________]
VĐV 1    [Chọn VĐV ▾]
VĐV 2    [Chọn VĐV ▾]  (disable slot 1)
VĐV 3    [Chọn VĐV ▾]  (disable slot 1, 2)
             [Huỷ] [Thêm]
```

- `members` state = `string[3]`, init `["", "", ""]`
- Mỗi `<Select>` bind vào `members[i]`, `onChange` update index `i`
- `disabled` list computed: `members.filter((_, j) => j !== i)`
- Submit: parse `TeamInputSchema`, optimistic add ghost team, fetch POST

### 7.3. Optimistic + toast + skeleton

100% giống Phase 2:

- `useOptimistic<Pair[]/Team[], Action>` với reducer `{add|update|remove}`
- `useTransition()` wrap async fetch
- Ghost row: `id="__pending__"`, `opacity-60`
- Success → `toast.success(...)`, `router.refresh()`, close dialog
- Error → throw từ handler → transition kết thúc → optimistic revert → toast.error
- Skeleton `loading.tsx`: thêm row skeleton cho Pairs + Teams section (mở rộng từ Phase 2 `loading.tsx`)

### 7.4. Toast text

| Case | Text |
|---|---|
| Create pair OK | `Đã thêm cặp {p1.name} / {p2.name}` |
| Create team OK | `Đã thêm đội {name}` |
| Update OK | `Đã lưu` |
| Delete OK | `Đã xoá {label}` |
| 400 zod | `{field}: {zod message}` |
| 400 FK | `VĐV không tồn tại` |
| 401 | `Phiên đăng nhập hết hạn` → redirect login |
| 409 | Message từ server (đã có detail) |
| Network/500 | `Mất kết nối — thử lại` / `Có lỗi — thử lại` |

### 7.5. ContentWorkspace props changes

```diff
 type ContentWorkspaceProps = {
   kind: Content;
   players: Player[];
-  pairs?: Pair[];
-  teams?: Team[];
+  pairs?: PairWithNames[];       // Phase 3: DB-backed, dùng cho PairsSection
+  teams?: TeamWithNames[];       // Phase 3: DB-backed, dùng cho TeamsSection
+  legacyPairs?: Pair[];          // Phase 3: vẫn mock, dùng cho Groups/Matches/KO sections
+  legacyTeams?: Team[];          // Phase 3: vẫn mock, dùng cho Groups/Matches/KO sections
   groups: Group[];
   knockout: KnockoutMatch[];
   knockoutNote?: string;
 };
```

Admin page pass **cả 2**:
```tsx
// src/app/admin/doubles/page.tsx
<ContentWorkspace
  kind="doubles"
  players={players}
  pairs={pairsFromDb}           // new
  legacyPairs={MOCK_PAIRS}      // mock (cho Groups/Matches/KO)
  groups={MOCK_DOUBLES_GROUPS}
  knockout={MOCK_DOUBLES_KO}
/>
```

Trong `_components.tsx`, Groups/Matches/KO sections dùng `legacyPairs`; PairsSection dùng `pairs` (new shape).

## 8. File Structure

### 8.1. Files mới (13 source + 10 test)

```
src/app/api/doubles/pairs/route.ts              # GET, POST
src/app/api/doubles/pairs/[id]/route.ts         # GET, PATCH, DELETE
src/app/api/teams/teams/route.ts                # GET, POST
src/app/api/teams/teams/[id]/route.ts           # GET, PATCH, DELETE

src/lib/schemas/pair.ts
src/lib/schemas/team.ts
src/lib/schemas/id.ts

src/lib/db/pairs.ts
src/lib/db/teams.ts
src/lib/db/next-id.ts

src/app/admin/_pairs-section.tsx
src/app/admin/_teams-section.tsx

# Tests colocated:
src/lib/schemas/pair.test.ts
src/lib/schemas/team.test.ts
src/lib/schemas/id.test.ts
src/lib/db/pairs.test.ts
src/lib/db/teams.test.ts
src/lib/db/next-id.test.ts
src/app/api/doubles/pairs/route.test.ts
src/app/api/doubles/pairs/[id]/route.test.ts
src/app/api/teams/teams/route.test.ts
src/app/api/teams/teams/[id]/route.test.ts
```

### 8.2. Files modified

```
src/lib/db/types.ts                             # + PairWithNames, TeamWithNames
src/app/admin/_components.tsx                   # remove PairsSection + TeamsSection inline;
                                                # import từ _pairs-section, _teams-section;
                                                # update ContentWorkspace props (new + legacy split);
                                                # Groups/Matches/KO sections dùng legacyPairs/legacyTeams
src/app/admin/doubles/page.tsx                  # fetch pairs từ DB via fetchPairs();
                                                # pass cả pairs + legacyPairs vào ContentWorkspace
src/app/admin/teams/page.tsx                    # fetch teams từ DB via fetchTeams();
                                                # pass cả teams + legacyTeams vào ContentWorkspace
src/app/admin/doubles/loading.tsx               # + skeleton cho Pairs section
src/app/admin/teams/loading.tsx                 # + skeleton cho Teams section
src/app/api/doubles/players/[id]/route.ts       # fix: apply IdSchema validate trước query (Phase 2 debt)
src/app/api/teams/players/[id]/route.ts         # fix: apply IdSchema validate trước query (Phase 2 debt)
```

### 8.3. Deps

Không thêm. Dùng sẵn:
- `zod` (Phase 2)
- `@base-ui/react` Select (đã có trong `src/components/ui/select.tsx`)
- `sonner` (Phase 2)
- `vitest` (Phase 2)

## 9. Testing

**Runner:** Vitest (đã setup Phase 2)
**Style:** Unit với mock Supabase, colocated
**Mock pattern:** Reuse `makeSupabaseChain` từ `src/test/supabase-mock.ts` (Phase 2)

**Coverage theo file:**

| Test file | Cases |
|---|---|
| `schemas/id.test.ts` | Accept alphanumeric/`_`/`-`; reject `"a;b"`, empty, path traversal `"../x"`, SQL-like `"a' OR '1"` |
| `schemas/pair.test.ts` | p1 required · p2 required · p1≠p2 refine fail · PATCH partial OK · PATCH cả 2 cùng giá trị fail |
| `schemas/team.test.ts` | name required/max · members exactly 3 · reject 2 hoặc 4 · reject duplicates · PATCH partial OK |
| `db/next-id.test.ts` | Empty → `{prefix}01`; existing `p18` → `p19`; existing `p99` → `p100` (padding overflow OK) |
| `db/pairs.test.ts` | fetchPairs shape khớp `PairWithNames`; fetchPairById 404 returns null |
| `db/teams.test.ts` | 2-step query + lookup; ID không có trong `team_players` → name = `"?"` |
| `api/doubles/pairs/route.test.ts` POST | 401 no auth · 400 invalid body (p1=p2) · 400 FK (p1 không tồn tại) · 201 happy · retry khi 23505 · fail sau 3 retry |
| `api/doubles/pairs/[id]/route.test.ts` GET | 400 invalid id · 200 found · 404 not found |
| `api/doubles/pairs/[id]/route.test.ts` PATCH | 401 · 400 · 200 happy · 404 · 400 khi p1=p2 |
| `api/doubles/pairs/[id]/route.test.ts` DELETE | 401 · 400 invalid id · 200 happy (pair mới, chưa ref) · 409 khi có match ref · 409 khi có group.entries ref · 409 gộp cả 2 |
| `api/teams/teams/*.test.ts` | Mirror, focus: `members` length=3 · distinct · 2-step fetch · `.contains('members', [id])` cho delete |

**Target:** ≥ 80% coverage cho các file Phase 3 add/modify.

**Total:** ~35–40 test cases thêm (Phase 2 có 48).

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Injection qua `.or()` / `.contains()` string interpolation | `IdSchema` regex validate ở đầu handler; cover test với payload malicious |
| FK verify race (player xoá sau check, trước insert) | DB FK restrict sẽ throw 23503 — catch và trả 400 "VĐV không tồn tại"; acceptable vì admin-only, không lock table |
| `nextId("teams", "T", 2)` trả `T01` nhưng seed có `tA1` | LIKE case-sensitive trong Postgres — `T%` không match `tA1`. Verify manual test. |
| Supabase FK select syntax (`p1:doubles_players!p1(id,name)`) không hoạt động đúng | Test bằng mock chain + 1 smoke manual verify sau deploy phase 3 checkpoint A |
| UI ghost pair có ID `"__pending__"` — nếu user bấm edit trước khi 201 về | Disable edit/delete buttons trên ghost row (giống Phase 2) |
| Optimistic update pair p1/p2 rồi server reject FK → rollback | Throw từ fetch handler → transition ends → auto-revert (Phase 2 pattern) |
| PATCH đổi p1/p2 làm match historical mất meaning | Accept: pair là "slot identity", không phải snapshot. Nếu cần snapshot → Phase sau (out of scope) |
| Downstream section còn mock, nhầm import `legacyPairs` vs `pairs` | ESLint rule `no-restricted-imports` optional; hoặc comment rõ trong `ContentWorkspace` props |
| Helper `fetchTeams` 2-step query chậm nếu >1000 players | Acceptable cho Phase 3 (team_players <30). Nếu scale tới 100+ teams, refactor sang RPC. |

## 11. Out of Scope

- Groups API (`/api/doubles/groups`, `/api/teams/groups`) — Phase 4
- Matches API — Phase 5
- Knockout API — Phase 6
- Public pages (`/doubles`, `/teams`) — Phase 4+
- Realtime subscriptions
- Soft delete / audit log
- Pagination / search / sort
- Pair gender rule enforcement (mixed doubles category)
- Team size dynamic (2 hoặc 4 VĐV) — hiện hard-code 3
- Pair/team metadata (seed ranking, notes, tags)
- Bulk operations (create nhiều pair cùng lúc)
- Drag-and-drop reorder (pair order trong card list)
- Export CSV pairs/teams

## 12. Done Criteria

- [ ] 10 endpoints implemented (5 doubles-pairs + 5 teams-teams) + all tests pass
- [ ] `IdSchema` shared, apply cho pairs + teams + fix 2 players DELETE handlers
- [ ] Zod schemas shared (pair.ts, team.ts), parse client + server
- [ ] `fetchPairs`, `fetchPairById`, `fetchTeams`, `fetchTeamById` helpers trong `src/lib/db/`
- [ ] `nextId()` shared helper (pairs + teams; refactor `nextPlayerId` optional)
- [ ] `PairsSection` + `PairFormDialog` trong `_pairs-section.tsx`
- [ ] `TeamsSection` + `TeamFormDialog` trong `_teams-section.tsx`
- [ ] Admin pages đọc pairs + teams từ Supabase (RSC)
- [ ] `ContentWorkspace` props split new/legacy
- [ ] Skeleton cho Pairs + Teams section trong `loading.tsx`
- [ ] `useOptimistic` cho create/update/delete, rollback on error
- [ ] Sonner toast VN chuẩn
- [ ] Delete pre-check FK (matches + groups.entries) → 409 detail
- [ ] Picker `<Select>` với disable-already-picked logic cho cả pair + team
- [ ] Manual verify: add/edit/delete pair + team ở cả 2 content, refresh vẫn thấy data
- [ ] Typecheck + lint pass

## 13. Checkpoint Gates (cho plan phase)

Suggest chia thành 4 checkpoint A/B/C/D như Phase 2:

- **A — Foundations:** IdSchema · nextId refactor · fetchPairs/fetchTeams helpers · pair/team schemas + tests
- **B — Pairs API:** 5 endpoints `/api/doubles/pairs` + tests (GET/POST/GET by id/PATCH/DELETE)
- **C — Teams API:** 5 endpoints `/api/teams/teams` + tests · fix Phase 2 IdSchema debt ở players handlers
- **D — UI + wiring:** PairsSection + TeamsSection extract · ContentWorkspace props split · admin pages fetch DB · skeleton + optimistic · manual smoke verify

User gate giữa mỗi checkpoint (chạy test + smoke manual).

## 14. Next Step

Invoke `superpowers:writing-plans` skill để tạo implementation plan chi tiết cho Phase 3, chia thành checkpoint gates A/B/C/D cho user verify từng bước (giống Phase 2).
