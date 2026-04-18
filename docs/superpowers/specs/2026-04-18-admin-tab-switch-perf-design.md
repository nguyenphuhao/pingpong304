# Admin tab switch performance

## Problem

Vào `/admin/doubles` hoặc `/admin/teams`:

1. Default tab là **VĐV**, nhưng user thường cần tab **Bảng** ngay → tốn 1 click mỗi lần.
2. Chuyển tab chậm — root cause: `handleTabChange` dùng `router.replace()`, trigger server re-render. Vì page là `force-dynamic`, mỗi lần chuyển tab chạy lại toàn bộ 4 DB query (players, pairs/teams, groups, knockout) dù props không đổi.

## Solution

**Thay đổi duy nhất trong `src/app/admin/_components.tsx`:**

1. `DEFAULT_TAB = "players"` → `DEFAULT_TAB = "groups"`.
2. `handleTabChange` thay `router.replace(...)` bằng `window.history.replaceState({}, "", url)`.
   - URL vẫn cập nhật (`?tab=groups` v.v.) → deep link, refresh, share link vẫn giữ được tab.
   - Không trigger server round-trip → tab switch instant. Data 4 tab đã ở props nên không cần fetch lại.
   - `searchParams` từ `useSearchParams()` vẫn reactive với history API update trong client.

## Không làm

- Không đổi `force-dynamic` (phạm vi rộng, ảnh hưởng initial load logic).
- Không refactor sang Suspense / parallel routes (scope lớn, không giải quyết vấn đề tab switch).
- Không bỏ URL sync (sẽ mất deep-link, refresh không giữ tab).

## Rủi ro

- `useSearchParams` hook đọc URL từ Next.js's internal store. `window.history.replaceState` update browser URL nhưng **không** tự trigger Next.js re-render qua `useSearchParams`. Component `ContentWorkspace` cần tự quản state `tab` bằng `useState` seed từ `searchParams` ban đầu, rồi `setTab(value)` trong `handleTabChange`. URL là side-effect để deep-link/refresh hoạt động, không phải source of truth trong phiên hiện tại.

## Acceptance

- Mở `/admin/doubles` → mặc định hiển thị tab **Bảng**.
- Click sang tab VĐV / Cặp / Knockout → đổi nội dung ngay, không có loading spinner toàn trang, URL đổi tương ứng.
- Refresh trang khi đang ở tab VĐV → vẫn giữ tab VĐV.
- Điều trên áp dụng cho cả `/admin/teams`.
