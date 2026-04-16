# Phase 2: Players API + Admin UI Swap — Design

**Date:** 2026-04-16
**Status:** Approved, ready for implementation planning
**Parent spec:** `docs/superpowers/specs/2026-04-16-supabase-integration-design.md`
**Branch:** `feat/supabase-phase-2`

## 1. Mục tiêu

Thay thế mock data player bằng Supabase cho **cả 2 nội dung** (doubles + teams) ở admin UI. Phase này làm xong thì admin có thể thêm/sửa/xoá VĐV thật, dữ liệu lưu DB, còn các section khác (Pairs, Teams, Groups, Matches, KO) vẫn đọc từ `_mock.ts`.

## 2. Decisions (đã chốt với user)

| # | Hạng mục | Quyết định | Lý do |
|---|---|---|---|
| 1 | Data flow | RSC đọc thẳng `supabaseServer`; client ghi qua `/api/...` | Ít hop, admin server-side đã có secret key |
| 2 | ID generation | Server auto sequential (`d37`, `t25`), retry-on-conflict (PG 23505) max 3 lần | Match pattern mock, dễ đọc hơn UUID |
| 3 | Validation | Zod schema shared `src/lib/schemas/player.ts` | Type-safe, dùng được ở cả API + client |
| 4 | Delete safety | Pre-check references trong API, trả 409 với list chi tiết | UX rõ ràng, admin biết xoá cặp nào trước |
| 5 | Auth check | Helper `requireAdmin()` throw `UnauthorizedError` | DRY cho ~45 handler trong tương lai |
| 6 | Phone field | Thêm input optional (≤ 20 ký tự, freeform) | Schema đã có column, tournament VN hay cần sđt |
| 7 | Testing | Unit test với mock Supabase, colocated `*.test.ts` | Logic đơn giản, test mock đủ catch regression |
| 8 | Component structure | Extract `PlayersSection` + `PlayerFormDialog` ra file riêng | Diff rõ, Phase sau extract tiếp các section khác |
| 9 | Loading UX | Skeleton cho initial load (`loading.tsx`), useOptimistic cho mutation | Skeleton = chưa có data; Optimistic = echo input |
| 10 | Notification | Sonner toast, position `top-center` | Mobile-first, ít đụng system UI iOS |
| 11 | PATCH body | Partial (chỉ field muốn update) | Convention REST |
| 12 | Pagination | Skip — GET trả full array | Data < 50 rows |
| 13 | Response shape | `{ data, error }` giống Supabase | Consistent với API style |
| 14 | Delete | Hard delete (không soft-delete) | Không có use case audit hiện tại |
| 15 | Login/Logout | Giữ Server Action hiện tại, KHÔNG migrate `/api/auth/*` | Ngoài scope Phase 2 |

## 3. Kiến trúc

```
Admin page (RSC, server)
  ↓ supabaseServer.from('doubles_players').select()   [read: 1 hop]
ContentWorkspace (Client Component)
  ↓ players prop
PlayersSection ("use client", extracted)
  ↓ fetch('/api/doubles/players', POST/PATCH/DELETE)  [write]
Route Handler (src/app/api/doubles/players/route.ts)
  ↓ requireAdmin() → zod parse → supabaseServer write
Supabase (Postgres)
```

**Boundaries:**
- **Read:** RSC gọi thẳng `supabaseServer` (Phase 2 chỉ dùng ở admin — server-side với secret key)
- **Write:** Client `fetch` → Route Handler → `supabaseServer`
- **Auth:** Cookie `pp_admin` check qua `requireAdmin()` trước mọi POST/PATCH/DELETE
- **Validation:** Zod schema shared, parse ở client (pre-submit) + server (request body)
- **Error:** Response `{ data, error }`, client map sang sonner toast

## 4. API Endpoints

### 4.1. Doubles — Players (5 endpoints)

```
GET    /api/doubles/players          → { data: Player[], error: null }          200
POST   /api/doubles/players          → body: {name, gender, club, phone?}
                                       → { data: Player, error: null }          201
GET    /api/doubles/players/[id]     → { data: Player | null, error }           200/404
PATCH  /api/doubles/players/[id]     → body partial
                                       → { data: Player, error }                200
DELETE /api/doubles/players/[id]     → { data: null, error: null }              200
                                       → { data: null, error: "..." }           409 nếu trong pair
```

### 4.2. Teams — Players (5 endpoints)

Mirror y hệt, table `team_players`, route `/api/teams/players/...`. Khác biệt:
- Prefix ID = `t` (thay vì `d`)
- Delete pre-check đổi từ `doubles_pairs` sang `teams.members @> ARRAY[id]`

### 4.3. HTTP status codes

| Code | Khi nào |
|---|---|
| 200 | GET / PATCH OK |
| 201 | POST OK |
| 200 | DELETE OK (với body `{data: null, error: null}` để consistent) |
| 400 | Zod validation fail |
| 401 | Không có cookie `pp_admin` |
| 404 | `GET /[id]` không tồn tại |
| 409 | Delete FK restrict (player đang trong pair/team) |
| 500 | Unhandled error |

### 4.4. Auto-compute trong POST

1. Parse zod
2. `nextPlayerId(table)` — query max id, `+1`, zero-pad
3. Insert `{ id, ...body }`, nếu code 23505 → retry max 3 lần (next id có thể đã bị claim)
4. Return `{ data: inserted, error: null }` 201

### 4.5. Delete pre-check logic

**Doubles:**
```ts
const { data: pairs } = await supabaseServer
  .from('doubles_pairs')
  .select('id, p1, p2')
  .or(`p1.eq.${id},p2.eq.${id}`);

if (pairs.length > 0) {
  const labels = pairs.map(p => p.id).join(', ');
  return err(`VĐV đang trong ${pairs.length} cặp: ${labels} — xoá cặp trước`, 409);
}
```

**Teams:**
```ts
const { data: teams } = await supabaseServer
  .from('teams')
  .select('id, name, members')
  .contains('members', [id]);

if (teams.length > 0) {
  const names = teams.map(t => t.name).join(', ');
  return err(`VĐV đang trong ${teams.length} đội: ${names} — xoá khỏi đội trước`, 409);
}
```

## 5. Schema

### 5.1. Zod (`src/lib/schemas/player.ts`)

```ts
import { z } from "zod";

export const PlayerInputSchema = z.object({
  name: z.string().trim().min(1, "Không được để trống").max(80),
  gender: z.enum(["M", "F"], { message: "Chọn Nam hoặc Nữ" }),
  club: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});

export const PlayerPatchSchema = PlayerInputSchema.partial();

export type PlayerInput = z.infer<typeof PlayerInputSchema>;
export type PlayerPatch = z.infer<typeof PlayerPatchSchema>;
```

### 5.2. Response helpers (`src/lib/api/response.ts`)

```ts
import { NextResponse } from "next/server";

export const ok = <T>(data: T, status = 200) =>
  NextResponse.json({ data, error: null }, { status });

export const err = (message: string, status = 500) =>
  NextResponse.json({ data: null, error: message }, { status });
```

### 5.3. Auth helper (thêm vào `src/lib/auth.ts`)

```ts
export class UnauthorizedError extends Error {
  constructor() { super("Unauthorized"); this.name = "UnauthorizedError"; }
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new UnauthorizedError();
}
```

Pattern sử dụng trong handler:

```ts
try {
  await requireAdmin();
  // ... logic
} catch (e) {
  if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
  if (e instanceof z.ZodError) return err(e.issues[0].message, 400);
  console.error(e);
  return err("Internal error", 500);
}
```

## 6. UX — Loading + Optimistic

### 6.1. Skeleton (loading)

**File:** `src/app/admin/doubles/loading.tsx`, `teams/loading.tsx`

Show khi Next.js đang render RSC (reload, nav lần đầu). Skeleton ~5 Card rows với shadcn `<Skeleton />` cho name + club.

`router.refresh()` background sau mutation: silent (list giữ data cũ, diff silently khi RSC re-render xong).

### 6.2. Optimistic mutation

**State:** `useOptimistic<Player[], Action>(initialPlayers, reducer)` + `useTransition()`

**Create:**
1. User submit form
2. Client zod parse. Invalid → toast field error, không fetch.
3. `startTransition(() => setOptimistic(prev => [...prev, ghostPlayer]))` — ghostPlayer có id tạm `"__pending__"`, opacity-60 trong UI
4. `await fetch(POST)`
5. OK 201 → `toast.success("Đã thêm {name}")` → `router.refresh()` → dialog close → optimistic state drops khi transition end, RSC đã có row thật
6. Error → `toast.error(msg)` → transition throws/ends → optimistic revert → dialog giữ mở

**Update:**
1. Mở dialog edit, form prefill
2. Sửa, submit
3. `startTransition(() => setOptimistic(prev => prev.map(p => p.id === id ? {...p, ...patch} : p)))`
4. `await fetch(PATCH)`
5. OK → toast + refresh + dialog close
6. Error → rollback + dialog stay

**Delete:**
1. Click Xoá → confirm dialog
2. Confirm → `startTransition(() => setOptimistic(prev => prev.filter(p => p.id !== id)))`
3. `await fetch(DELETE)`
4. OK → toast + refresh
5. Error (409 FK hoặc khác) → rollback + toast chi tiết

### 6.3. Toast spec (sonner)

**Position:** `top-center` — set tại `<Toaster position="top-center" />` trong `src/app/layout.tsx`

**Duration:**
- Success: 3000ms
- Error: 6000ms (dài hơn để đọc message)

**Text chuẩn:**

| Case | Text |
|---|---|
| Create OK | `Đã thêm VĐV {name}` |
| Update OK | `Đã lưu` |
| Delete OK | `Đã xoá {name}` |
| Validation (zod) | `{field}: {zod message}` |
| 401 | `Phiên đăng nhập hết hạn` + `setTimeout(() => router.push('/admin/login'), 1000)` |
| 409 FK delete | Message từ server (đã có chi tiết) |
| Network/timeout | `Mất kết nối — thử lại` |
| 500 | `Có lỗi — thử lại` |

### 6.4. Button + row pending state

- Button submit (Thêm/Lưu/Xoá): disabled + spinner icon khi `isPending`
- Row đang mutate: `opacity-60`, disable các nút Sửa/Xoá trên row đó để tránh double action
- Dialog: disable inputs + close button trong lúc pending

## 7. File Structure

### 7.1. Files mới

```
src/app/api/doubles/players/route.ts                 # GET, POST
src/app/api/doubles/players/[id]/route.ts            # GET, PATCH, DELETE
src/app/api/teams/players/route.ts                   # GET, POST
src/app/api/teams/players/[id]/route.ts              # GET, PATCH, DELETE

src/lib/schemas/player.ts                            # zod schema
src/lib/api/response.ts                              # ok() / err() helpers

src/app/admin/_players-section.tsx                   # extracted PlayersSection + PlayerFormDialog
src/app/admin/doubles/loading.tsx                    # skeleton
src/app/admin/teams/loading.tsx                      # skeleton

# Tests (colocated):
src/app/api/doubles/players/route.test.ts
src/app/api/doubles/players/[id]/route.test.ts
src/app/api/teams/players/route.test.ts
src/app/api/teams/players/[id]/route.test.ts
src/lib/schemas/player.test.ts
src/lib/auth.test.ts

# Vitest config:
vitest.config.ts
```

### 7.2. Files modified

```
src/lib/auth.ts                   # add UnauthorizedError + requireAdmin()
src/app/admin/_components.tsx     # remove PlayersSection + PlayerFormDialog, import từ _players-section
src/app/admin/doubles/page.tsx    # async, fetch players từ supabaseServer
src/app/admin/teams/page.tsx      # async, fetch players từ supabaseServer
src/app/layout.tsx                # <Toaster position="top-center" />
package.json                      # add: zod, vitest, @vitest/ui (dev)
```

### 7.3. Deps mới

```bash
npm install zod
npm install -D vitest @vitest/ui
```

## 8. Testing

**Runner:** Vitest
**Style:** Unit với mock Supabase, colocated
**Mock pattern:**

```ts
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: {
    from: vi.fn(() => chainable),
  },
}));
```

**Coverage theo file:**

| Test file | Cases |
|---|---|
| `schemas/player.test.ts` | name required, gender enum, phone max 20, PATCH partial OK, empty string phone OK |
| `auth.test.ts` | `requireAdmin()` throw when no cookie, không throw khi có cookie |
| `doubles/players/route.test.ts` (GET) | Trả array |
| `doubles/players/route.test.ts` (POST) | 401 no auth · 400 invalid body · 201 happy · retry khi 23505 · fail sau 3 retry |
| `doubles/players/[id]/route.test.ts` (GET) | 200 found · 404 not found |
| `doubles/players/[id]/route.test.ts` (PATCH) | 401 · 400 · 200 happy · 404 |
| `doubles/players/[id]/route.test.ts` (DELETE) | 401 · 200 happy · 409 khi còn trong pair |
| `teams/players/...test.ts` | Mirror, focus riêng `teams.members @> ARRAY[id]` cho delete check |

**Target:** ≥ 80% coverage cho các file Phase 2 add/modify.

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| 2 admin add player đồng thời → race ID | Retry-on-conflict (PG 23505) max 3 lần trong POST handler |
| `useOptimistic` rollback không trigger | Throw từ fetch handler khi `!res.ok` → transition kết thúc bằng throw → useOptimistic auto-revert |
| `supabaseServer` lỡ import vào Client Component | Code review + optional eslint `no-restricted-imports` (không ép Phase 2) |
| `loading.tsx` flash khi RSC nhanh | Accept (flash ngắn không ảnh hưởng UX) |
| Test mock drift với Supabase real behavior | Manual smoke verify sau khi merge (click add/edit/delete từng content) |
| Zod schema client vs server lệch | Schema import cùng 1 file → không thể lệch |
| Loading component nesting sai layout | Đặt `loading.tsx` ở cấp `/admin/doubles` để skeleton chỉ cover players area, không full page |

## 10. Out of Scope

- Login/logout API (`/api/auth/login`, `/api/auth/logout`) — giữ Server Action
- Pairs, Teams, Groups, Matches, KO — Phase 3+
- Public pages (`/doubles`, `/teams`) — Phase 4+
- Realtime subscriptions
- Soft delete / audit log
- Pagination / search / sort
- Phone format validation chi tiết (chỉ max length)
- Refactor các section khác trong `_components.tsx`
- Avatar upload
- Export CSV danh sách VĐV

## 11. Done Criteria

- [ ] 10 endpoints implemented (5 doubles + 5 teams) + all tests pass
- [ ] `requireAdmin()` + `UnauthorizedError` trong `src/lib/auth.ts`
- [ ] Zod schema shared, parse cả ở client (pre-submit) + server (body)
- [ ] `PlayersSection` + `PlayerFormDialog` extracted ra `_players-section.tsx`
- [ ] Admin page doubles + teams đọc players từ Supabase (RSC)
- [ ] `loading.tsx` skeleton ở `/admin/doubles` + `/admin/teams`
- [ ] `useOptimistic` cho create / update / delete với rollback on error
- [ ] Sonner toast `top-center`, text VN chuẩn
- [ ] Delete pre-check FK → 409 detail
- [ ] Vitest setup + all unit tests pass
- [ ] Manual verify: add/edit/delete VĐV ở cả 2 content, refresh page vẫn thấy data
- [ ] Typecheck + lint pass

## 12. Next Step

Invoke `superpowers:writing-plans` skill để tạo implementation plan chi tiết cho Phase 2, chia thành checkpoint gates cho user verify từng bước (giống Phase 0+1).
