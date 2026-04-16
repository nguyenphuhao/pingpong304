# Phase 4: Groups API + Public UI Migration — Design

**Date:** 2026-04-16
**Status:** Approved, ready for implementation planning
**Parent spec:** `docs/superpowers/specs/2026-04-16-supabase-integration-design.md`
**Sibling phase:** `docs/superpowers/specs/2026-04-16-phase-3-pairs-teams-api-design.md`
**Branch (planned):** `feat/supabase-phase-4`

## 1. Mục tiêu

Thay mock Groups (`MOCK_DOUBLES_GROUPS`, `MOCK_TEAM_GROUPS`) bằng Supabase, cho admin PATCH entries của từng bảng, và migrate public pages `/d` + `/t` đọc groups từ DB. Sau phase này:

- Admin có thể sửa entries (pairs/teams) trong từng bảng đã seed. Tên bảng và số lượng bảng giữ cố định (không POST/DELETE).
- Public pages `/d` và `/t` hiển thị groups từ DB (name + entries resolved với labels).
- Admin group detail pages `/admin/{kind}/groups/[id]` đọc group từ DB.
- Matches / KO / standings-derivation cho home page `/` **vẫn là mock** (defer đến Phase 5).
- Mock `MOCK_DOUBLES_GROUPS` / `MOCK_TEAM_GROUPS` giữ nguyên để home page `/` và `_home.ts` internals (leaders/feed/search) tiếp tục hoạt động cho đến Phase 5+.

Mirror pattern Phase 3: shared zod schema + RSC fetch helpers + `requireAdmin` + optimistic UI + sonner toast + skeleton loading + colocated unit tests.

## 2. Decisions (đã chốt với user)

| # | Hạng mục | Quyết định | Lý do |
|---|---|---|---|
| 1 | Scope | Groups CRUD + public migration trong 1 phase. Matches/KO vẫn mock. | Theo plan Phase 4 gốc trong checkpoint. |
| 2 | Admin CRUD | **PATCH entries only** — không POST/DELETE group. | Giải 51 năm có 4 bảng doubles + 2 bảng teams cố định, đã seed. |
| 3 | Entry validation | Cross-group reject: nếu pair/team đã ở group khác → 409, admin tự xóa khỏi bảng cũ trước. Duplicate trong cùng group reject ở zod. Entries tồn tại check qua `.or()`. | 1 pair/1 bảng là invariant. Safe và minh bạch. |
| 4 | Edit UX | Dialog list toàn bộ pairs/teams với checkbox (custom visual, không thêm dep). Save = PATCH entries full-replace. Disable + badge "Bảng X" với pair/team đang ở group khác. | 1 round-trip, type-safe, mirror Phase 3 dialog pattern. |
| 5 | Data flow | RSC fetch (`fetchDoublesGroups`, `fetchTeamGroups`) → props xuống client components. Zero client fetch public. | Next 15 pattern, mirror Phase 2-3. |
| 6 | Entry shape | `GroupResolved.entries: Array<{id: string; label: string}>`. | Rich shape serve cả admin (id cho logic) + public (label cho display). |
| 7 | Type strategy | New `GroupResolved` type coexist với mock `Group`. Migrate minimal callers (chỉ `getStandings` refactor nhận entries labels qua arg). | Phase 3 precedent (`PairWithNames` alongside `Pair`). Risk thấp, matches mock chưa migrate vẫn reference labels. |
| 8 | API endpoints | 2 PATCH (`/api/doubles/groups/[id]`, `/api/teams/groups/[id]`). GET endpoints **skip** — RSC helpers đủ cho current usage. | YAGNI, add sau nếu cần. |
| 9 | ID format | Groups giữ `gA..gD` (doubles), `gtA..gtB` (teams) — đã seed, không generate mới. | Không POST group. |
| 10 | Validation helpers | `IdSchema` (reuse Phase 3) validate params.id + mỗi entry ID. | Defense-in-depth cho `.or()`/`.eq()` interpolation. |
| 11 | Response shape | `{ data, error }`. Entries resolved trả sau PATCH. | Consistent Phase 2-3. |
| 12 | Testing | Unit với mock Supabase, colocated tests. Manual smoke test cuối phase. | Mirror Phase 3. |
| 13 | Mock boundary | `MOCK_DOUBLES_GROUPS`/`MOCK_TEAM_GROUPS` giữ nguyên cho home page `/` + `_home.ts` internals (leaders/feed/search/topN/leaderOf). | Matches mock còn reference entries bằng label. Gỡ ở Phase 7 cleanup. |

## 3. Kiến trúc

```
Admin doubles/teams page (RSC)
  ↓ fetchDoublesGroups() / fetchTeamGroups() [resolved]
Admin groups/[id] page (RSC)
  ↓ fetchDoublesGroupById() / fetchTeamGroupById() [resolved]
Public /d /t page (RSC)
  ↓ fetchDoublesGroups() / fetchTeamGroups() [resolved]

ContentWorkspace (admin, client) / ContentHome (public, server)
  ↓ props: groups: GroupResolved[]

GroupsSection (admin) → GroupEntriesDialog → PATCH /api/{kind}/groups/[id]
GroupStageTabs (public, client) → render group.entries[].label
  ↓ entries.map(e => e.label) → getStandings (mock matches)

Route handler PATCH /api/{kind}/groups/[id]
  ↓ requireAdmin → zod parse → IdSchema → verifyEntriesExist → verifyCrossGroup → supabaseServer update
  ↓                                                                              → fetch resolved

Supabase (Postgres) doubles_groups / team_groups
```

**Boundaries:**

- **Read helpers (`src/lib/db/groups.ts`):** 2-step lookup — load groups → reuse `fetchPairs`/`fetchTeams` → build `id → label` Map → resolve each `group.entries`. Dùng chung cho RSC admin + RSC public + API route PATCH (để trả resolved group sau update).
- **Write:** Client `fetch` PATCH → Route Handler → `supabaseServer` update.
- **Auth:** Cookie `pp_admin` check qua `requireAdmin()` (reuse Phase 2).
- **Validation:** Zod schema `GroupEntriesPatchSchema`. Cross-group check là business rule ở handler (không zod).
- **ID safety:** `IdSchema` validate `params.id` + mỗi entry ID trước khi dùng trong `.or()` / `.eq()` / `.contains()`.
- **Error shape:** `{ data: null, error: string }` với HTTP code phù hợp.
- **Type:** New `GroupResolved` trong `src/lib/schemas/group.ts`, mock `Group` giữ nguyên cho home page / `_home.ts` callers.

## 4. API Endpoints

### GET endpoints (skip Phase 4)

RSC helpers `fetchDoublesGroups` / `fetchTeamGroups` đủ cho admin + public pages. Nếu Phase 5+ cần client polling, add sau.

### PATCH /api/doubles/groups/[id]

**Request:**
```ts
// body
{ entries: string[] }  // array of pair IDs (full replace)
```

**Flow:**
1. `requireAdmin()` → 401 nếu không auth
2. `IdSchema.parse(params.id)` → 400 nếu malformed
3. `supabaseServer.from('doubles_groups').select('id').eq('id', params.id).maybeSingle()` → 404 nếu null
4. `GroupEntriesPatchSchema.parse(body)` → 400 nếu shape sai / duplicate / entry ID malformed
5. `verifyPairsExist(entries)` — `.or(ids.map(id => 'id.eq.' + id).join(','))` query trên `doubles_pairs` → 400 nếu có ID không tồn tại: `"Cặp không tồn tại: p99"`
6. `verifyCrossGroup(entries, params.id)` — `supabaseServer.from('doubles_groups').select('id, name, entries').neq('id', params.id).overlaps('entries', entries)` → 409 với message: `"Cặp p05 đang ở Bảng B, xóa khỏi đó trước"` (list cụ thể pair + group name)
7. `supabaseServer.from('doubles_groups').update({ entries }).eq('id', params.id)`
8. Fetch resolved group qua `fetchDoublesGroupById(id)` → return 200 với `{data: GroupResolved}`

**Response codes:**
| Code | Khi nào | Body |
|---|---|---|
| 200 | Success | `{data: GroupResolved, error: null}` |
| 400 | Validation / malformed ID / pair ID không tồn tại | `{data: null, error: "..."}` |
| 401 | Không auth | `{data: null, error: "Unauthorized"}` |
| 404 | Group ID không tồn tại | `{data: null, error: "Bảng không tồn tại"}` |
| 409 | Cross-group conflict | `{data: null, error: "Cặp p05 đang ở Bảng B, xóa khỏi đó trước"}` |
| 500 | Lỗi không lường | `{data: null, error: "Internal error" \| err.message}` |

### PATCH /api/teams/groups/[id]

Mirror cho team groups:
- `verifyTeamsExist(entries)` query `teams` thay vì `doubles_pairs`
- `verifyCrossGroup` trên `team_groups`
- Entry ID format `tA1..tB4` (seed) hoặc `T01..` (Phase 3 generated)

### Zod schemas (`src/lib/schemas/group.ts`)

```ts
import { z } from "zod";
import { IdSchema } from "./id";

export const GroupEntriesPatchSchema = z.object({
  entries: z
    .array(IdSchema)
    .refine(
      (arr) => new Set(arr).size === arr.length,
      "entries không được trùng lặp"
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

### DB helpers (`src/lib/db/groups.ts`)

```ts
import { supabaseServer } from "@/lib/supabase/server";
import { fetchPairs } from "./pairs";
import { fetchTeams } from "./teams";
import type { GroupResolved } from "@/lib/schemas/group";

function buildPairLabelMap(pairs: Awaited<ReturnType<typeof fetchPairs>>) {
  return new Map(pairs.map((p) => [p.id, `${p.p1.name} – ${p.p2.name}`]));
}

function buildTeamLabelMap(teams: Awaited<ReturnType<typeof fetchTeams>>) {
  return new Map(teams.map((t) => [t.id, t.name]));
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
  return (groupsResp.data ?? []).map((g: { id: string; name: string; entries: string[] }) => ({
    id: g.id,
    name: g.name,
    entries: g.entries.map((id) => ({ id, label: map.get(id) ?? "?" })),
  }));
}

export async function fetchDoublesGroupById(id: string): Promise<GroupResolved | null> {
  // Similar 2-step, maybeSingle
}

export async function fetchTeamGroups(): Promise<GroupResolved[]> {
  // Same 2-step với fetchTeams + buildTeamLabelMap
}

export async function fetchTeamGroupById(id: string): Promise<GroupResolved | null> {
  // ...
}
```

## 5. Admin UI

### `_groups-section.tsx` (extract từ `_components.tsx`)

Mirror Phase 3 pattern (`_pairs-section.tsx` / `_teams-section.tsx`):

```ts
type OptAction =
  | { type: "updateEntries"; id: string; entries: GroupEntry[] };

function reducer(state: GroupResolved[], action: OptAction): GroupResolved[] {
  switch (action.type) {
    case "updateEntries":
      return state.map((g) =>
        g.id === action.id ? { ...g, entries: action.entries } : g
      );
  }
}
```

- Props: `kind: Content`, `groups: GroupResolved[]`, `pairs?: PairWithNames[]`, `teams?: TeamWithNames[]`
- Render card per group, entries list hiển thị `entry.label`
- Nút Pencil → mở `GroupEntriesDialog(group)`
- Nút Delete: **gỡ khỏi UI** (scope PATCH only)
- Link chevron → `/admin/{kind}/groups/{id}` giữ nguyên

### `GroupEntriesDialog`

- Trigger: pencil icon
- Props: `group: GroupResolved`, `allEntries: GroupEntry[]` (từ pairs resolved hoặc teams resolved), `otherGroups: GroupResolved[]` (tất cả groups khác để build cross-group Map)
- Build `Map<entryId, groupName>` cho pair/team đang ở group khác
- Local state: `selectedIds: Set<string>`, init = `group.entries.map(e => e.id)`
- Dialog content:
  - Title: `Sửa entries · ${group.name}`
  - Description: `Chọn cặp thuộc ${group.name}` (hoặc "đội" cho teams)
  - Scrollable list:
    - Row: clickable button (không dùng Checkbox component để không thêm dep)
    - Leading icon: `Check` nếu selected, `Square` nếu không
    - Label: `entry.label`
    - Trailing: badge xám "Bảng B" + disabled nếu entry đang ở group khác
    - Click toggle `selectedIds` (chỉ với available + in-this-group entries)
  - Footer: Cancel + Save
  - Save:
    1. `startTransition(() => setOptimistic({type: "updateEntries", id: group.id, entries: selectedLabels}))`
    2. `fetch PATCH /api/{kind}/groups/${group.id}` với `{entries: Array.from(selectedIds)}`
    3. Response success → `router.refresh()` + toast success + close dialog
    4. Error → revert optimistic + toast error từ `response.error`

### `ContentWorkspace` props update

```ts
export function ContentWorkspace({
  kind,
  players,
  pairs,
  teams,
  groups,  // GroupResolved[] (đổi từ Group[])
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
})
```

### Admin detail pages

**`src/app/admin/doubles/groups/[id]/page.tsx`:**
```ts
const group = await fetchDoublesGroupById(id);
if (!group) notFound();
const matches = MOCK_DOUBLES_MATCHES.filter((m) => m.groupId === id);
return (
  <DoublesSchedule
    groupId={group.id}
    groupName={group.name}
    entries={group.entries.map(e => e.label)}  // pass labels to mock match consumer
    matches={matches}
  />
);
```

Same cho teams.

### Skeleton loading

Extend `admin/doubles/loading.tsx` + `admin/teams/loading.tsx` thêm Groups tab placeholder (rows skeleton), giữ pattern hiện tại cho players/pairs/teams.

## 6. Public UI Migration

### `/d/page.tsx` + `/t/page.tsx` → RSC

```ts
// /d/page.tsx
import { fetchDoublesGroups } from "@/lib/db/groups";
import { ContentHome } from "../_ContentHome";

export const dynamic = "force-dynamic";

export default async function DoublesPublicPage() {
  const groups = await fetchDoublesGroups();
  return <ContentHome kind="doubles" groups={groups} />;
}
```

Same cho `/t/page.tsx`.

### `/d/[id]/page.tsx` + `/t/[id]/page.tsx`

Public detail pages đã tồn tại và hiện đọc `MOCK_DOUBLES_GROUPS.find(...)` để lấy group name + entries. Migrate:

```ts
const group = await fetchDoublesGroupById(id);
if (!group) notFound();
const matches = MOCK_DOUBLES_MATCHES.filter((m) => m.groupId === id);
return (
  <DoublesSchedule
    groupId={group.id}
    groupName={group.name}
    entries={group.entries.map(e => e.label)}
    matches={matches}
    readOnly
  />
);
```

Same cho `/t/[id]/page.tsx`.

### `ContentHome` signature

```ts
export function ContentHome({ kind, groups }: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
})
```

Pass `groups` xuống `<GroupStageTabs groups={groups} kind={kind}/>`.

### `GroupStageTabs` client component

- Nhận `groups: GroupResolved[]` qua props (gỡ import `MOCK_DOUBLES_GROUPS`/`MOCK_TEAM_GROUPS`)
- Tab active state client giữ nguyên (useState)
- Render entries: `group.entries.map(e => <li key={e.id}>{e.label}</li>)`
- Pass `group.entries.map(e => e.label)` vào `getStandings(kind, group.id, entryLabels)` và `leaderOf` nếu có call

### `_home.ts` `getStandings` refactor

```ts
// Before
export function getStandings(kind, groupId): StandingRow[]

// After
export function getStandings(
  kind: "doubles" | "teams",
  groupId: string,
  entries: string[]  // labels passed by caller
): StandingRow[] {
  const matches = (kind === "doubles" ? MOCK_DOUBLES_MATCHES : MOCK_TEAM_MATCHES)
    .filter((m) => m.groupId === groupId);
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [e, { entry: e, played: 0, won: 0, lost: 0, diff: 0, points: 0 }])
  );
  // ... rest unchanged (matches vẫn reference labels)
}
```

Caller trong `_publicGroup.tsx`:
```ts
const entryLabels = group.entries.map(e => e.label);
const standings = getStandings(kind, group.id, entryLabels);
```

Các helpers khác (`leaderOf`, `topNOf`, `getGroupLeaders`, `getGroupTops`, `getFeed`) **không migrate** trong Phase 4 — home page `/` vẫn đọc mock cho tới Phase 5.

## 7. Files changed

**New:**
- `src/lib/schemas/group.ts` + `group.test.ts`
- `src/lib/db/groups.ts` + `groups.test.ts`
- `src/app/api/doubles/groups/[id]/route.ts` + `route.test.ts`
- `src/app/api/teams/groups/[id]/route.ts` + `route.test.ts`
- `src/app/admin/_groups-section.tsx`

**Modified:**
- `src/app/admin/doubles/page.tsx`, `src/app/admin/teams/page.tsx` — thêm `fetchDoublesGroups`/`fetchTeamGroups`
- `src/app/admin/doubles/groups/[id]/page.tsx`, `src/app/admin/teams/groups/[id]/page.tsx` — RSC `fetchDoublesGroupById`/`fetchTeamGroupById`
- `src/app/d/page.tsx`, `src/app/t/page.tsx` — RSC fetch + prop
- `src/app/d/[id]/page.tsx`, `src/app/t/[id]/page.tsx` — RSC fetch by id + `e.label` map
- `src/app/_ContentHome.tsx` — accept `groups` prop
- `src/app/_publicGroup.tsx` — props `groups` + `e.label` + pass labels vào `getStandings`
- `src/app/_home.ts` — `getStandings` signature thêm `entries` arg
- `src/app/admin/_components.tsx` — `ContentWorkspace` props type change, gỡ `GroupsSection` cũ (extract)
- `src/app/admin/doubles/loading.tsx`, `src/app/admin/teams/loading.tsx` — skeleton Groups tab

**Unchanged (intentional):**
- `MOCK_*` exports trong `_mock.ts` — giữ cho home page + `_home.ts` internals
- `src/app/page.tsx` (home), `src/app/search/*`
- Matches / KO sections

## 8. Testing

### Unit tests (colocated)

**`src/lib/schemas/group.test.ts`:**
- `GroupEntriesPatchSchema.parse` thành công với `["p01","p04"]`
- Reject `["p01","p01"]` (duplicate)
- Reject `["p01","bad!"]` (IdSchema regex fail)
- Reject body shape sai

**`src/lib/db/groups.test.ts`:**
- `fetchDoublesGroups` resolve entries với pair labels (mock supabase chain, mock fetchPairs)
- Entry không tìm thấy trong pair map → label "?"
- `fetchDoublesGroupById` trả null nếu `maybeSingle` data null
- `fetchDoublesGroupById` trả resolved group
- `fetchTeamGroups` / `fetchTeamGroupById` tương tự

**`src/app/api/doubles/groups/[id]/route.test.ts`:**
- PATCH 401 không admin
- PATCH 400 shape sai
- PATCH 400 duplicate entries
- PATCH 400 entry ID malformed (IdSchema)
- PATCH 404 group không tồn tại
- PATCH 400 pair trong entries không tồn tại (message include pair ID)
- PATCH 409 cross-group conflict (message include pair ID + group name)
- PATCH 200 success với resolved group trả về
- PATCH 200 với `entries: []` (empty array allowed)

**`src/app/api/teams/groups/[id]/route.test.ts`:** mirror.

### Manual smoke test (cuối phase D)

1. Admin login → `/admin/doubles` → tab Bảng → card Bảng A → Edit → toggle p01 off, p19 on → Save → refresh → persist
2. Bảng A → Edit → cố toggle p05 on (đang ở Bảng B) → row disabled + badge "Bảng B" → không click được
3. Bảng B → Edit → toggle p05 off → Save → Bảng A → Edit → toggle p05 on → Save → OK
4. Public `/d` → Bảng A tab → entries list hiển thị `p19 label` mới, `getStandings` render rows với entries mới (0-0-0 nếu không có match)
5. Admin `/admin/doubles/groups/gA` → render group name + matches mock
6. Public `/t` + admin teams flow tương tự

## 9. Rollout

### Branch
`feat/supabase-phase-4`

### Checkpoints

| | Checkpoint | Acceptance |
|---|---|---|
| A | Schema + DB helpers + tests | `group.ts` schema, `groups.ts` 2 fetch + 2 fetchById, tests pass. Không đụng UI. |
| B | API routes PATCH + tests | 2 routes, cross-group check, verifyExist, tests pass. |
| C | Admin UI | `_groups-section.tsx` extract, `GroupEntriesDialog`, optimistic, sonner, skeleton. Admin flow hoạt động. |
| D | Public migration + smoke | `/d` `/t` RSC, `ContentHome`/`GroupStageTabs` props, `getStandings` refactor. Smoke test pass. |

### Merge

Squash về `main` (follow Phase 2-3 precedent).

### Post-merge

Update checkpoint doc: note Phase 5 (Matches + Standings + tiebreaker) là next, sẽ gỡ mock `MOCK_DOUBLES_GROUPS`/`MOCK_TEAM_GROUPS` cleanup ở Phase 7.

## 10. Non-goals

- POST/DELETE group endpoints (defer — giải hiện tại fixed 4+2 bảng)
- Matches API migration (Phase 5)
- Home page `/` migration sang DB groups (defer, matches mock còn dùng labels)
- `leaderOf` / `topNOf` / `getGroupLeaders` / `getGroupTops` / `getFeed` refactor (defer Phase 5)
- Standings DB view integration (`doubles_standings_raw` / `team_standings_raw`) — dùng Phase 5
- Gỡ `MOCK_DOUBLES_GROUPS` / `MOCK_TEAM_GROUPS` (defer Phase 7 cleanup)

## 11. Risk & mitigation

| Risk | Mitigation |
|---|---|
| Label format mismatch giữa `fetchPairs` resolved và mock pairLabel (`"p1 – p2"`) | Implement `buildPairLabelMap` dùng đúng separator `" – "` (em-dash có space), colocated test verify format với fixture. |
| `_home.ts` getStandings caller không update thống nhất | Chỉ 1 caller duy nhất trong public pipeline (`_publicGroup.tsx`) — grep confirm. TypeScript sẽ báo nếu signature đổi. |
| Cross-group check race (2 admin edit đồng thời) | Low priority. `overlaps` query chạy trước update, không dùng transaction. Accept TOCTOU — hiếm xảy ra ở admin UI. |
| Entries empty `[]` có break public page không | `getStandings` với empty entries → rows Map rỗng → return `[]`. `GroupStageTabs` render "0 cặp" OK. |
| Supabase `overlaps` support cho `text[]` | Pattern đã dùng ở Phase 3 (`contains`). Verify bằng test. Nếu API không support, fallback `.or()` với mỗi entry. |

## 12. Mở rộng sau Phase 4

- Phase 5: Matches API + Standings (dùng DB view) + tiebreaker TS layer
- Phase 6: Knockout API + UI
- Phase 7: Cleanup — gỡ `MOCK_*_GROUPS`, gỡ `MOCK_*_MATCHES`, migrate `_home.ts` hoàn toàn, xóa `_mock.ts`
- Phase 8: Auth migration sang Supabase Auth (optional)
