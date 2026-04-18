# Homepage HERO Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign khối HERO trong `src/app/page.tsx` theo variant C (scannable list): title block gọn ở trên + 3 info rows (Ngày / Giờ / Địa điểm) ở dưới, thêm giờ điểm danh 7:00 (thông tin mới).

**Architecture:** Pure JSX/Tailwind refactor trong 1 file duy nhất. Không thêm component file, không thêm state, không thêm prop — chỉ trích 1 helper local `HeroInfoRow` trong cùng `page.tsx` (theo pattern `ScheduleRow`, `StatCard`, `PrizeRow` đã có). Icon đổi sang Lucide `Clock` cho row mới (đã import sẵn).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn `Card`, `lucide-react` icons.

**Spec:** `docs/superpowers/specs/2026-04-18-homepage-hero-redesign-design.md`

---

## Pre-flight checks (already verified by plan author)

- `lucide-react` icons cần dùng (`CalendarDays`, `Clock`, `MapPin`, `KeyRound`) đã được import sẵn ở `src/app/page.tsx` dòng 2–14.
- `Badge` import chỉ được dùng 1 chỗ duy nhất (dòng 28 — badge "Sắp diễn ra" sẽ bị bỏ) → sau refactor sẽ remove `Badge` import.
- Project không có component test cho UI (vitest cấu hình node env, không có jsdom/RTL) → verification dựa vào TypeScript build + ESLint + manual browser smoke test.
- Hero ở dòng 22–64 của `src/app/page.tsx`. Các section bên dưới (Thông báo BTC, Lịch sự kiện…) giữ nguyên.
- Địa chỉ giữ nguyên text gốc: `TT CUDV Công Phường An Lạc` + `565 Kinh Dương Vương` — đây là tên thật của địa điểm, không rút gọn.

---

## Task 1: Replace HERO JSX với layout scannable list

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Remove `Badge` import**

Edit `src/app/page.tsx`, xóa dòng 16:

```tsx
import { Badge } from "@/components/ui/badge";
```

(Không thay thế bằng gì — chỉ xóa.)

- [ ] **Step 2: Replace HERO block (dòng 21–64)**

Trong `src/app/page.tsx`, thay thế toàn bộ khối `{/* HERO */}` cũ bằng khối mới:

```tsx
      {/* HERO */}
      <Card className="border-emerald-500/40 bg-emerald-500/10 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              CLB Bóng Bàn Bình Tân
            </p>
            <h1 className="mt-2 text-base font-medium text-muted-foreground">
              Giải bóng bàn chào mừng
            </h1>
            <p className="mt-1 text-xl font-semibold leading-snug text-emerald-700 dark:text-emerald-400">
              Kỷ niệm 51 năm ngày thống nhất đất nước
            </p>
            <p className="mt-2 text-sm text-muted-foreground">30/4/1975 – 30/4/2026</p>
          </div>
          <Link
            href="/admin/login"
            aria-label="Ban Tổ Chức"
            title="Ban Tổ Chức"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <KeyRound className="size-4" />
          </Link>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <HeroInfoRow
            icon={<CalendarDays className="size-4 text-emerald-700 dark:text-emerald-400" />}
            label="Ngày"
            value="Chủ nhật · 19/04/2026"
          />
          <HeroInfoRow
            icon={<Clock className="size-4 text-emerald-700 dark:text-emerald-400" />}
            label="Giờ"
            value="Điểm danh 7:00 sáng"
          />
          <HeroInfoRow
            icon={<MapPin className="size-4 text-emerald-700 dark:text-emerald-400" />}
            label="Địa điểm"
            value={
              <>
                TT CUDV Công Phường An Lạc
                <br />
                <span className="text-muted-foreground">565 Kinh Dương Vương</span>
              </>
            }
          />
        </div>
      </Card>
```

- [ ] **Step 3: Thêm helper component `HeroInfoRow`**

Ở cuối `src/app/page.tsx` (sau `PrizeRow`, trước closing của file), thêm:

```tsx
function HeroInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
        {icon}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-medium leading-snug">{value}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run ESLint**

```bash
npm run lint
```

Expected: exit 0, không có lỗi. Nếu báo unused import (ví dụ `Badge` còn sót), xóa.

- [ ] **Step 5: Run build (TypeScript + Next)**

```bash
npm run build
```

Expected: build thành công, không có lỗi TypeScript.

- [ ] **Step 6: Run test suite (đảm bảo không break gì)**

```bash
npm test
```

Expected: tất cả test pass (project không có test cho `page.tsx` nên suite chủ yếu test lib/API).

- [ ] **Step 7: Manual smoke test — dev server**

```bash
PORT=3009 npm run dev
```

Mở `http://localhost:3009` trên mobile viewport (Chrome DevTools → iPhone SE hoặc 390px width).

Verify:
- Hero hiển thị đủ: club label → title 2 dòng (muted + emerald) → theme sub → 3 info rows.
- 3 info rows theo thứ tự: 📅 NGÀY · ⏰ GIỜ · 📍 ĐỊA ĐIỂM.
- Row "Giờ" show "Điểm danh 7:00 sáng".
- Row "Địa điểm" show "TT CUDV Công Phường An Lạc" + "565 Kinh Dương Vương" (line 2 muted).
- Click icon 🔑 ở góc phải top → vào `/admin/login`.
- Không còn badge "Sắp diễn ra".
- Không còn đường kẻ ngang giữa title và info.
- Toggle dark mode (nếu app có) — màu emerald đổi sang `dark:text-emerald-400`.

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(homepage): redesign hero to scannable list layout

Restructure hero block with a clearer hierarchy: title block on top,
three info rows (date, time, location) below. Add check-in time
(7:00) which was previously only visible after scrolling to the
schedule section. Remove "Sắp diễn ra" filler badge and the divider
between title and info block.

Spec: docs/superpowers/specs/2026-04-18-homepage-hero-redesign-design.md
EOF
)"
```

---

## Self-review checklist (after implementation)

- [ ] Hero hiển thị đủ ngày/giờ/địa điểm trong 3 giây đầu mà không cần scroll.
- [ ] Title không bị wrap awkward trên 375px width.
- [ ] Admin key link vẫn navigate đúng `/admin/login`.
- [ ] Không còn import thừa (`Badge` đã bỏ).
- [ ] `npm run lint` + `npm run build` + `npm test` đều pass.
- [ ] Git log có commit mới với message đúng format của project.
