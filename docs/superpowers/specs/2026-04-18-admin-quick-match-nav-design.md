# Admin Quick Match Navigation — Design Spec

**Ngày:** 2026-04-18
**Chủ đề:** Cho BTC search nhanh một trận đấu từ bất kỳ trang admin nào để nhập điểm.

## 1. Mục tiêu & phạm vi

### Vấn đề
Hiện tại để nhập điểm một trận, BTC phải đi 3-4 cấp: `/admin` → chọn nội dung → tab `groups` → mở bảng → cuộn tìm trận → mở dialog. Ngày giải chạy song song nhiều bàn, việc này tốn thời gian và dễ chọn nhầm bảng.

### User chính
**BTC chạy tổng** (điều phối nhiều bàn cùng lúc), chủ yếu dùng điện thoại. *Không* nhằm vào trọng tài bàn hay khán giả — các vai đó có thể có spec riêng sau.

### Scope
- Search xuyên trang admin, tìm ra 1 **trận** (match), tap → navigate tới trang bảng chứa trận và auto-open dialog nhập điểm.
- Chỉ search trong **kind hiện tại** (Đôi khi đang ở `/admin/doubles*`, Đồng đội khi ở `/admin/teams*`). Ở `/admin` root không có icon search.
- Tất cả status (`scheduled`, `live`, `done`, `forfeit`), sort `live → scheduled → done → forfeit`.
- Match theo tên VĐV / cặp / đội, **bỏ dấu** tiếng Việt.

### Out of scope
- Bottom nav tổng thể cho admin — xứng đáng spec riêng, không gộp vào đây.
- Search player / pair / team như entity độc lập — spec này result luôn là match.
- Deep link sub-match trong trận đồng đội (chỉ mở dialog trận chính).
- Auto-refresh list khi user khác thay đổi status — chỉ refresh thủ công.
- Highlight/strikethrough diacritics trong result.
- Conflict handling khi nhiều BTC mở cùng 1 trận — giữ behavior hiện tại.

## 2. Architecture overview

```
[AdminSearchSheet]
  ├── Trigger: <SearchIconButton /> (trong header admin pages có kind)
  ├── Sheet content (Dialog fullscreen trên mobile):
  │     ├── Input (không cần debounce)
  │     ├── Filter + sort client-side
  │     └── List flat (~100 items max)
  └── Tap result: router.push(`/admin/<kind>/groups/<groupId>?match=<id>`)

[DoublesGroupDetailPage / TeamsGroupDetailPage]
  └── searchParams.match → autoOpenMatchId prop
      → DoublesSchedule / TeamsSchedule (client)
          → match row có id === autoOpenMatchId
              → EditMatchDialog useEffect open + scrollIntoView
              → sau khi mount, router.replace xoá ?match= khỏi URL
```

**Quyết định kiến trúc:**
- **Approach A** (client-filter, fetch-on-open). Scale giải hiện tại ~30-100 trận, không cần server search.
- **Cache** list trong `useRef` theo `kind`, giữ suốt session. Có nút refresh thủ công.
- **Sheet reuse `Dialog` primitive** từ `@/components/ui/dialog` (đã dùng trong admin), không thêm Sheet primitive mới.
- **Kind resolve từ pathname** trong component client.

## 3. Components & files

### Mới

- `src/app/admin/_search-sheet.tsx` (client)
  - Export: `AdminSearchSheet`, `SearchIconButton`.
  - State: `open`, `query`, `items`, `loading`, `error`.
  - Cache: `useRef<Map<MatchKind, MatchIndexItem[]>>`.
  - Pure helper (export riêng để test): `filterAndSortMatches(items, query): MatchIndexItem[]`.

- `src/app/admin/_search-actions.ts` (server)
  - `"use server"` directive.
  - `export async function fetchMatchIndexForKind(kind: "doubles" | "teams"): Promise<MatchIndexItem[]>`.
  - Phải re-check auth theo pattern hiện có trong các `fetchDoublesGroups` / `fetchPairs`.

- `src/lib/text/normalize.ts`
  - `export function normalizeVi(s: string): string` — lowercase, NFD, strip combining marks, thay `đ`/`Đ` → `d`, collapse whitespace.
- `src/lib/text/normalize.test.ts` — unit tests (xem §6).

### Sửa

- `src/app/admin/doubles/page.tsx`, `src/app/admin/teams/page.tsx`
  - Chèn `<SearchIconButton />` vào `headerSlot`.

- `src/app/admin/doubles/groups/[id]/page.tsx`, `src/app/admin/teams/groups/[id]/page.tsx`
  - Nhận `searchParams` (App Router v16 async), đọc `match` query.
  - Truyền `autoOpenMatchId` xuống schedule component.
  - Chèn `<SearchIconButton />` vào sticky header.

- `src/app/admin/_components.tsx`
  - `DoublesSchedule`: thêm prop `autoOpenMatchId?: string`, forward xuống `IndividualMatchRow`.
  - Team schedule tương đương: thêm prop, forward xuống team match row.
  - `IndividualMatchRow` + team match row: thêm prop `autoOpen?: boolean`, forward xuống dialog.
  - `EditDoublesMatchDialog` + edit team match dialog: thêm prop `autoOpen?: boolean`. Trong component, `useEffect(() => { if (autoOpen) setOpen(true) }, [autoOpen])`. Sau `setOpen(true)`, scroll row vào view (dùng `ref.scrollIntoView({ block: "center", behavior: "smooth" })`).
  - Sau khi dialog mở lần đầu, clear URL param: `router.replace(pathname + currentOtherParams, { scroll: false })`.

### Kiểu dữ liệu

```ts
type MatchKind = "doubles" | "teams";

type MatchIndexItem = {
  id: string;
  kind: MatchKind;
  groupId: string;
  groupName: string;
  sideA: string;   // pairA.label hoặc teamA.name
  sideB: string;   // pairB.label hoặc teamB.name
  status: "scheduled" | "live" | "done" | "forfeit";
};
```

## 4. Data flow

### Mở sheet

1. Tap `<SearchIconButton />` → `setOpen(true)`.
2. Nếu `cache.get(kind)` chưa có → `startTransition(fetchMatchIndexForKind(kind))`, set `loading`.
3. Lưu kết quả vào `cache` và `items`. Lỗi → set `error`, hiện message + nút thử lại.

### Filter + sort

```ts
const q = normalizeVi(input.trim());
const filtered = q === ""
  ? items.filter(m => m.status === "live")
  : items.filter(m =>
      normalizeVi(m.sideA).includes(q) ||
      normalizeVi(m.sideB).includes(q)
    );

const statusRank = { live: 0, scheduled: 1, done: 2, forfeit: 3 };
filtered.sort((a, b) => {
  const s = statusRank[a.status] - statusRank[b.status];
  if (s !== 0) return s;
  return a.groupName.localeCompare(b.groupName, "vi");
});
```

### Tap result

```ts
router.push(`/admin/${item.kind}/groups/${item.groupId}?match=${item.id}`);
setOpen(false);
```

### Group page auto-open

1. Group page đọc `searchParams.match` (async searchParams trong App Router v16) → prop `autoOpenMatchId` xuống schedule.
2. Schedule component dùng `useSearchParams()` (client) để phản ứng khi param đổi *trong cùng route* — đề phòng user tap result khi đã đứng đúng group page.
3. Match row có `match.id === autoOpenMatchId` → truyền `autoOpen={true}` xuống dialog.
4. Dialog `useEffect` mở 1 lần khi `autoOpen` đổi true. Scroll row vào view.
5. Sau khi mở, schedule component gọi `router.replace(pathname, { scroll: false })` (kèm các param khác nếu có, ví dụ `?tab=groups`) để xoá `?match=` — tránh reopen khi user back từ trang khác.

## 5. URL contract & edge cases

### URL schema
- `/admin/doubles/groups/<groupId>?match=<matchId>`
- `/admin/teams/groups/<groupId>?match=<matchId>`
- Param `match` là `id` của match. Không hỗ trợ sub-match ở spec này.

### Edge cases

| Case | Xử lý |
|------|-------|
| `?match=<id>` nhưng id không có trong `matches` | Bỏ qua, không auto-open, không error. `console.warn` trong dev. |
| Match bị xoá giữa chừng (regenerate) | Như trên. |
| User tap result khi đang ở đúng group page | `useSearchParams()` trong schedule phản ứng với param mới → autoOpen state update → dialog mở. |
| Fetch lỗi | Sheet hiện error + nút thử lại. Không crash trang. |
| Sheet đang mở, user navigate (back gesture) | Đóng sheet trong `useEffect` theo `pathname` change. |
| List rỗng | "Chưa có trận. Tạo bảng trước ở tab Bảng." |
| Không có live + chưa gõ | "Chưa có trận đang đá. Gõ để tìm." |
| Input toàn space / dấu câu | `normalizeVi` → empty → rơi về default "live only". |

### Auth
- `fetchMatchIndexForKind` phải re-check auth session theo pattern các fetcher hiện có. Kiểm tra `src/lib/db/groups.ts`, `src/lib/db/matches.ts` khi implement.

## 6. Testing

### Unit (vitest, chạy `npm test`)

**`src/lib/text/normalize.test.ts`:**
- `normalizeVi("Hào")` → `"hao"`.
- `normalizeVi("NGUYỄN Phú Hào")` → `"nguyen phu hao"`.
- `normalizeVi("Lê Thị Đức")` → `"le thi duc"` (xử lý `đ`/`Đ` riêng — NFD không tách).
- `normalizeVi("  Hào   Đức ")` → `"hao duc"` (trim + collapse).
- `normalizeVi("")` / `normalizeVi("   ")` → `""`.

**`src/app/admin/_search-sheet.test.ts`** (chỉ test pure function, không render):
- Query rỗng + có `live` → chỉ trả `live`.
- Query rỗng + không `live` → `[]`.
- Query `"hao"` match cả `"Hào"`, `"Hạo"`, `"Hảo"`.
- Sort: `live` trước `scheduled` trước `done` trước `forfeit`. Cùng status → `groupName.localeCompare(_, "vi")`.
- Không match → `[]`.

**Không test:** Supabase query trong server action (pattern hiện tại không có test layer DB); không snapshot UI sheet.

**Coverage bar:** pure functions 100%. UI không ép test.

### QA thủ công (checklist post-implementation)

1. Mở `/admin/doubles`, tap 🔍 → sheet mở, hiện trận `live` (nếu có), placeholder "Gõ tên VĐV / cặp…".
2. Gõ "hao" → filter ra VĐV / cặp chứa "Hào", "Hạo", "Hảo".
3. Tap result → navigate `/admin/doubles/groups/<id>?match=<id>` → dialog mở auto, scroll row vào view.
4. Đóng dialog → `?match=` đã được clear khỏi URL; back-refresh không reopen.
5. Đứng `/admin/teams`, tap 🔍 → chỉ search Đồng đội, không lẫn Đôi.
6. Đứng `/admin` root → không thấy icon 🔍.
7. Gõ từ không khớp → empty state message.
8. Refresh thủ công trong sheet → fetch lại.
9. Regenerate bảng rồi mở sheet cũ → tap result cũ không crash, không auto-open.

## 7. Rủi ro & giả định

- **Giả định scale giải:** <200 trận/kind. Nếu vượt, cân nhắc Approach B (server search với debounce).
- **Giả định schema không đổi:** `pair.label`, `team.name`, `group.name` có sẵn và ổn định. Nếu đổi tên field, phải cập nhật fetcher + type.
- **Rủi ro state dialog hiện dùng `open` nội bộ:** việc thêm `autoOpen` prop + `useEffect` có thể xung đột với hành vi hiện có nếu user đóng dialog xong prop `autoOpen` vẫn true. Giải pháp: dùng dependency `[autoOpen]` + `ref` "đã dùng lần nào chưa" để chỉ open 1 lần duy nhất.
- **Rủi ro `router.replace` clear param**: nếu dùng pattern tracking params khác (`?tab=groups`), phải preserve. Đọc `useSearchParams()` và rebuild query string không có `match`.
