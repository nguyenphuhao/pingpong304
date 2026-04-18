# Homepage HERO Redesign — Design Spec

## Overview

Redesign khối HERO trên homepage (`src/app/page.tsx` dòng 22–64) để thông tin súc tích, dễ đọc, thoáng hơn. Mục tiêu: VĐV/khách mở app thấy ngay **ngày + giờ + địa điểm** trong 3 giây đầu.

**Scope:** chỉ khối HERO. Các section khác (Thông báo BTC, Lịch, Quy mô, Giải thưởng, Thể thức, Thông tin chung) giữ nguyên.

## Target users

- **A.** VĐV sắp thi đấu — cần biết khi nào, ở đâu, giờ mấy điểm danh.
- **B.** Khách/người nhà đến xem — cần biết địa điểm + giờ khai mạc.

Cả A và B cùng cần: **ngày · giờ điểm danh · địa điểm** → đây là info được đẩy lên nổi bật nhất trong hero mới.

## Problems with current HERO

1. Emerald title lớn nhất là **theme** ("Kỷ niệm 51 năm…") chứ không phải info actionable → hierarchy lệch.
2. Ngày + địa điểm đang là text 14px muted → chìm xuống so với theme.
3. 2 cụm ngày ngang hàng ("30/4/1975–30/4/2026" và "Chủ nhật 19/04/2026") dễ lẫn.
4. Badge "Sắp diễn ra" filler — không thêm thông tin.
5. **Thiếu giờ điểm danh** — đây là info VĐV cần nhất mà hero không có; phải scroll tới Schedule mới thấy.

## New design — scannable list (variant C)

```
┌─────────────────────────────────────────┐
│ CLB BÓNG BÀN BÌNH TÂN               🔑 │  ← club label + key admin
│ Giải bóng bàn chào mừng                 │  ← title dòng 1 (muted)
│ Kỷ niệm 51 năm ngày thống nhất đất nước │  ← title dòng 2 (emerald, bold)
│ 30/4/1975 – 30/4/2026                   │  ← theme sub (muted)
│                                         │
│ ┌──┐                                    │
│ │📅│  NGÀY                              │
│ └──┘  Chủ nhật · 19/04/2026            │
│                                         │
│ ┌──┐                                    │
│ │⏰│  GIỜ                               │
│ └──┘  Điểm danh 7:00 sáng              │
│                                         │
│ ┌──┐                                    │
│ │📍│  ĐỊA ĐIỂM                         │
│ └──┘  TT CUDV An Lạc                   │
│       565 Kinh Dương Vương              │
└─────────────────────────────────────────┘
```

### Structure

Card wrapper giữ nguyên: `border-emerald-500/40 bg-emerald-500/10 p-6`.

**Top block (title section):**
- Club label: `"CLB Bóng Bàn Bình Tân"` — `text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400`
- Key admin icon (`KeyRound`) ở top-right của top block — giữ link `/admin/login`, aria/title cũ
- Title line 1: `"Giải bóng bàn chào mừng"` — `text-base font-medium text-muted-foreground`
- Title line 2: `"Kỷ niệm 51 năm ngày thống nhất đất nước"` — `text-xl font-semibold text-emerald-700 dark:text-emerald-400 leading-snug` (giữ đúng text như bản cũ)
- Theme sub: `"30/4/1975 – 30/4/2026"` — `text-sm text-muted-foreground`

**Info grid (3 rows):**

Mỗi row là grid `[icon-box] [label + value]`:
- Icon box: `size-8 rounded-lg bg-emerald-500/15 flex items-center justify-center`, chứa Lucide icon `size-4 text-emerald-700 dark:text-emerald-400`
- Label: `text-xs font-medium uppercase tracking-wide text-muted-foreground`
- Value: `text-sm font-medium`

3 rows:

| Icon (Lucide) | Label | Value |
|---|---|---|
| `CalendarDays` | Ngày | Chủ nhật · 19/04/2026 |
| `Clock` | Giờ | Điểm danh 7:00 sáng |
| `MapPin` | Địa điểm | TT CUDV An Lạc<br>565 Kinh Dương Vương *(muted line 2)* |

Spacing: `gap-3` giữa các row. Top block + info grid cách nhau `mt-5` (không còn border divider).

### Removed

- Badge `"Sắp diễn ra"` (filler)
- `<div className="border-t border-emerald-500/20 pt-4">` divider giữa title và info (thay bằng spacing)
- Cụm `<br />` trong title (title line 2 để tự wrap theo mobile)

### Added

- Row "Giờ" với `Clock` icon + điểm danh 7:00 — info mới trên hero.

### Preserved

- Card color scheme (`border-emerald-500/40 bg-emerald-500/10`)
- Padding `p-6`
- Admin key link (`/admin/login`) với `aria-label="Ban Tổ Chức"` và `KeyRound` icon
- Light/dark mode tokens (emerald-700 / emerald-400)
- Vietnamese text giữ nguyên (không rút gọn "Kỷ niệm 51 năm…")

## Content decisions (đã chốt)

1. **Title giữ đủ text:** `"Giải bóng bàn chào mừng"` + `"Kỷ niệm 51 năm ngày thống nhất đất nước"` — không rút gọn.
2. **Giờ chỉ hiển thị 7:00 điểm danh** — không show khai mạc 7:35 trên hero (vẫn có trong section Schedule ở dưới).

## Out of scope

- Các section khác của homepage (Thông báo BTC, Lịch, Quy mô, Giải thưởng, Thể thức, Thông tin chung).
- Dark mode color tweaks.
- Bottom nav, search, settings sheet.
- Nội dung text ngoài hero.

## Testing

- Verify trên mobile width (375px, 390px, 414px) — info grid không wrap awkward.
- Verify dark mode — màu emerald-400 đủ contrast trên bg-emerald-500/10.
- Verify admin key vẫn click được vào `/admin/login`.
- Visual smoke test: hero cao ≤ viewport 1 màn trên iPhone SE (nếu có thể).

## Files to change

- `src/app/page.tsx` — chỉ khối HERO (dòng 22–64). Import thêm `Clock` từ `lucide-react` nếu chưa có (đã có sẵn, dòng 5). Bỏ import `Badge` nếu không còn dùng ở đâu khác trong file (cần check).
