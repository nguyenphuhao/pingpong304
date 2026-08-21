# Thiết kế: Public view `/live` — lịch, sơ đồ và xếp hạng

Ngày: 2026-08-21
Trạng thái: **chờ duyệt**
Bản dựng thử: https://claude.ai/code/artifact/3d6c9ebd-d184-4d47-8634-2844b5740156

## 1. Vấn đề

Người xem tại nhà thi đấu — phần lớn trên 50 tuổi, cầm điện thoại — cần đúng ba thứ:
lịch và kết quả vòng bảng, sơ đồ vòng loại trực tiếp, bảng xếp hạng từng bảng.

Public view hiện tại (`/d` → `src/app/_ContentHome.tsx`) không phục vụ tốt việc đó:

| Vấn đề | Vị trí |
|---|---|
| Gộp sáu khối: chung cuộc, đang đấu, BXH tóm tắt, kết quả gần nhất, lịch bảng, lịch KO | `_ContentHome.tsx:270` |
| Tên cặp cỡ `text-base`, cỡ chữ gốc mặc định 17px | `_MatchCard.tsx:67`, `globals.css:73` |
| Vòng loại trực tiếp là danh sách theo vòng, không phải sơ đồ nhánh | `_publicKnockout.tsx:41` |
| Điều khiển cỡ chữ nằm trong tab thứ tư “Cài đặt” — người lớn tuổi không tìm ra | `_BottomNav.tsx:53` |
| Hàng trận nằm ngang (`tên A — vs — tên B`), tràn ngang khi chữ to | `_ScheduleList.tsx` |

## 2. Phạm vi

Ba màn hình công khai, **chỉ đọc**. Không có màn nhập liệu, không đụng `/admin`,
không đổi schema, không thêm dependency.

Việc **ghi kết quả** làm bằng cách prompt Claude trong terminal cập nhật thẳng Supabase —
nằm ngoài spec này. `/d`, `/t` và toàn bộ `/admin` giữ nguyên, chưa xoá.

## 3. Kiến trúc và điều hướng

| Route | Màn | Nhãn tab |
|---|---|---|
| `/live` | Lịch thi đấu và kết quả vòng bảng | Vòng bảng |
| `/live/so-do` | Sơ đồ nhánh vòng loại trực tiếp | Loại trực tiếp |
| `/live/bxh` | Bảng xếp hạng từng bảng | BXH |

Ba route thật, không phải tab client-side. Lý do: chia sẻ link Zalo tới đúng màn, nút Back
của trình duyệt chạy đúng, mỗi màn có `loading.tsx` riêng.

`src/app/live/layout.tsx` dựng ba thứ dùng chung:

- **Thanh trên dính** — tên giải hai dòng, và **`A−` / `A+` ngay cạnh tiêu đề**. Điều khiển
  cỡ chữ phải nhìn thấy được, không giấu trong Cài đặt. Vẫn ghi vào `localStorage` qua
  `writeFontSize()` sẵn có nên `/d`, `/t` dùng chung lựa chọn.
- **Bottom nav ba tab** — cao 64px, icon 26px, nhãn chữ luôn hiện, tab đang mở tô màu và
  gạch chân. Không dùng cử chỉ vuốt để đổi tab.
- **Tự làm mới 30 giây** — client component gọi `router.refresh()`, kèm dòng
  “Cập nhật lúc HH:MM” để người xem biết dữ liệu còn tươi.

`src/app/_BottomNav.tsx` thêm một dòng early-return cho `/live`, đúng pattern nó đang dùng
cho `/admin` (`_BottomNav.tsx:13`).

## 4. Màn 1 — Vòng bảng

Bố cục poster là hàng ngang. Ở 19px trên máy 360px hàng đó tràn ngang, nên đổi sang **thẻ dọc**.

```
┌─────────────────────────────────────┐
│  [A] [B] [C] [D]        ← pill 56px │
├─────────────────────────────────────┤
│  A  Bảng A                          │
│  Bàn 1 · 5 cặp · 10 trận · BO3      │
│  ████████░░░░  Đã đấu 6/10   60%    │
├─────────────────────────────────────┤
│  CÁC CẶP TRONG BẢNG                 │
│  A1 Nghiệp / Mạnh   A2 Cường / Hảo  │
│  …                                   │
├─────────────────────────────────────┤
│  Trận 1 · 13:00 · Bàn 1    ✓ Xong   │
│  A1  Nghiệp / Mạnh          2  ✓    │  ← nền xanh nhạt
│  A2  Cường (lớn) / Hảo      0       │
│      11–8 · 11–6                    │
├─────────────────────────────────────┤
│  Trận 2 · 13:15       ● Đang đấu    │
│  Trận 3 · 13:30          Chưa đấu   │  ← tỉ số hiện “—”
└─────────────────────────────────────┘
```

- Chọn bảng bằng pill cao 56px, **không dùng dropdown**. Bảng đang chọn ghi vào query
  `?bang=B`; back và tải lại giữ nguyên.
- Cặp thắng nhận **ba dấu hiệu**: chữ đậm, nền xanh nhạt, dấu tích. Không chỉ dựa vào màu.
- Tỉ số dùng `font-variant-numeric: tabular-nums` để cột số không nhảy.
- Khối “các cặp trong bảng” giữ lại vì nó là chú giải cho mã A1–A5 dùng ở lịch.

**Giờ dự kiến và bàn** hiện ở đầu mỗi thẻ trận. Giờ không nằm trong DB mà suy ra:
`giờ khởi tranh + (số thứ tự trận − 1) × phút mỗi trận`, hai hằng số đặt ở
`src/lib/tournament.ts`. Tờ lịch BTC ngày 21/08 chốt 13:00 và 15 phút/trận, đều cho cả bốn
bảng. Bàn đọc từ cột `table` của `doubles_matches`, điền lúc seed.

Chữ **“dự kiến”** phải hiện cạnh giờ. 47 trận trong một buổi gần như chắc chắn trễ; ghi rõ là
ước tính thì người xem không trách BTC khi lệch.

## 5. Màn 2 — Loại trực tiếp

Giữ **sơ đồ nhánh**, ba cột Tứ kết → Bán kết → Chung kết, cuộn ngang có bám mốc từng cột.
Sơ đồ phá lề ngang của trang để dùng hết bề ngang máy. Dưới sơ đồ có dòng nhắc vuốt.

Đánh đổi phải chấp nhận và đã ghi rõ: ở mức chữ 21px sơ đồ rộng khoảng **2,5 màn hình**.

### 5.1 Thứ tự cột phải suy từ đường nối

Điều lệ §2.3: BK I = thắng TK1 gặp thắng TK3. Nếu vẽ cột tứ kết theo số thứ tự 1·2·3·4 thì
hai đường nối cắt chéo nhau và sơ đồ đọc sai. Cột tứ kết phải xếp **TK1 · TK3 · TK2 · TK4**,
nhãn vẫn ghi đúng số trận.

Thứ tự này **không được đóng cứng**. Hàm thuần trong `src/lib/live/bracket.ts`:

```
orderForBracket(matches) → KoMatch[][]   // mỗi phần tử là một cột
```

Chạy ngược từ vòng cuối: cột chung kết theo thứ tự tự nhiên; cột kề trước sắp theo thứ tự
các trận nạp vào — với mỗi trận ở cột sau, lấy trận nạp `next_slot: "a"` rồi `"b"`. Lặp
tới hết. Với sơ đồ hiện tại ra đúng TK1 · TK3 · TK2 · TK4, và vẫn đúng nếu sau này đổi
đường nối.

Nhờ hai trận nạp cùng một trận luôn nằm cạnh nhau, đường nối dọc suy được từ chỉ số chẵn/lẻ
trong cột: chỉ số chẵn vẽ nửa dưới, lẻ vẽ nửa trên.

### 5.2 Ô chưa có tên

`entry_a`/`entry_b` được ghi lúc seed (`buildDoublesBracket`), **không tự suy khi đọc**.
Nên ô nào chưa seed thì hiện nhãn nguồn `label_a`/`label_b` — “Nhất bảng A”, “Thắng TK1”.
Đây là hành vi đúng, không phải thiếu sót: BTC chốt suất đi tiếp rồi mới seed.

### 5.3 Thứ hạng chung cuộc

Khối dưới sơ đồ, xếp dọc: Vô địch · Á quân · hai cặp đồng hạng Ba (thua bán kết, không đánh
trận tranh hạng 3 — điều lệ §2.3). Chưa xong thì hiện “chờ xác định”.

### 5.4 Việc đã làm trước spec này

`src/lib/knockout/seed.ts` ghi nhãn bán kết không khớp đường nối: BK1 nhận TK1 và TK3 nhưng
`label_b` ghi “Thắng TK 2”. Màn này hiển thị đúng hai nhãn đó nên đã sửa, kèm test suy nhãn
từ `next_match_id`/`next_slot` thay vì so chuỗi viết tay.

> Sửa code không sửa hàng đã có trong Supabase. Bracket phải **seed lại** mới lấy nhãn mới.
> Dữ liệu giải sắp tới là dữ liệu mới nên sẽ seed từ đầu, không cần vá dữ liệu cũ.

## 6. Màn 3 — Bảng xếp hạng

Bảy cột (Hạng · Cặp · Trận · Thắng · Thua · Ván · Hiệu số) ở 19px chắc chắn tràn ngang.
Đổi sang **thẻ**, số liệu thành chip xuống dòng — không bao giờ tràn ở bất kỳ mức cỡ chữ nào.

```
┌─────────────────────────────────────┐
│ ①  A3  H'Lim / Phương    [ĐI TIẾP]  │  ← viền vàng
│     4 trận · 4 thắng · 0 thua       │
│     Ván 8–1        Hiệu số +7       │
└─────────────────────────────────────┘
```

- Hạng 1–2 viền vàng/bạc, nhãn **ĐI TIẾP** chỉ hiện khi **bảng đã đấu xong toàn bộ**.
  Chưa xong thì thay bằng chip “Còn N trận · chưa chốt”.
- Hiệu số dương xanh, âm đỏ, kèm dấu `+`/`−` để không chỉ dựa vào màu.
- Cuối trang có `<details>` “Cách xếp hạng”, trích `tournament-rules.md §4`: số trận thắng →
  đối đầu trực tiếp (khi đúng 2 cặp bằng nhau) → hiệu số ván.
- Dùng **cùng bộ pill** như màn 1, cùng query `?bang=`, để mô hình thao tác đồng nhất.

Thứ hạng lấy nguyên từ `fetchAllGroupStandings()` — **không tính lại**. Luật phân định đã có
test ở `src/lib/standings/__tests__`.

## 7. Chữ, màu, thao tác

- **Giữ Be Vietnam Pro**, đã nạp sẵn ở `layout.tsx:11`, dấu tiếng Việt đầy đủ. Không thêm font.
- Cỡ chữ gốc mặc định lên **19px** (mức `lg`). Vẫn giữ đủ bốn mức sm/base/lg/xl.
- Thang cỡ trong `/live` viết bằng `em`/`rem` để co giãn theo lựa chọn: tên cặp `1.25rem`,
  tỉ số `1.5rem` đậm, nhãn phụ `0.875rem` (trên ngưỡng 12px), chi tiết ván `1rem`.
  Line-height 1.5.
- Màu dùng semantic token shadcn sẵn có. Màu bảng lấy `_groupColors.ts` — A lục · B lam ·
  C hổ phách · D hồng. **Không đổi bảng màu**: nó dùng chung với `/admin` và `/d`.
- Thanh trên nền navy đậm, chữ trắng.
- Vùng chạm ≥ 44px, cách nhau ≥ 8px, `touch-action: manipulation`.
- Sáng/tối: token định nghĩa ở `:root`, chỉ ghi đè giá trị token trong nhánh tối. Đã có
  `next-themes` ở `_Providers.tsx`.
- Tôn trọng `prefers-reduced-motion` cho chấm nhấp nháy “đang đấu” và mũi tên nhắc vuốt.

## 8. Nguồn dữ liệu

Supabase, qua đúng các hàm đang chạy. **Không viết tầng dữ liệu mới.**

| Màn | Hàm | File |
|---|---|---|
| Vòng bảng | `fetchDoublesGroups()` | `src/lib/db/groups.ts` |
| | `fetchAllDoublesMatchesByGroup(ids)` | `src/lib/db/matches.ts` |
| Loại trực tiếp | `fetchDoublesKo()` | `src/lib/db/knockout.ts` |
| BXH | `fetchDoublesGroups()` | `src/lib/db/groups.ts` |
| | `fetchAllGroupStandings("doubles", groups)` | `src/lib/db/standings.ts` |

Cả ba page là server component, `export const dynamic = "force-dynamic"`, giống `/d/page.tsx:11`.

Tên giải, ngày, giờ, địa điểm không có trong DB. Đặt hằng số ở `src/lib/tournament.ts`,
dùng chung cho thanh trên và `metadata` của `layout.tsx`.

## 9. Ràng buộc: viết theo dữ liệu, không đóng cứng

Bốc thăm mới có thể khác bốc thăm cũ. Ba chỗ phải suy từ dữ liệu:

| Chỗ | Suy từ | Không được |
|---|---|---|
| Số pill chọn bảng | `groups.length` | Đóng cứng A/B/C/D. Từ 5 bảng trở lên pill xuống hàng |
| Số trận mỗi bảng | `matches.length` | Đóng cứng 10 |
| Số ván mỗi trận | `match.bestOf` | Đóng cứng BO3 — điều lệ để ngỏ 3–5 ván |

Một chỗ **hiện không co giãn**, cần biết trước khi có dữ liệu mới: `buildDoublesBracket()`
(`seed.ts:47`) destructure đúng bốn bảng — `const [A, B, C, D] = groups`. Nếu bốc thăm mới
không chia 4 bảng thì sơ đồ tứ kết vỡ (nhãn ra “Nhất undefined”), phải sửa hàm seed trước.
Nằm ngoài spec này nhưng là điều kiện tiên quyết nếu số bảng đổi.

## 10. Phạm vi file

**Thêm mới**

| File | Việc |
|---|---|
| `src/app/live/layout.tsx` | Thanh trên, bottom nav, tự làm mới |
| `src/app/live/_LiveTopBar.tsx` | Tên giải, `A−`/`A+` |
| `src/app/live/_LiveBottomNav.tsx` | Ba tab |
| `src/app/live/_GroupPills.tsx` | Chọn bảng qua `?bang=` |
| `src/app/live/_AutoRefresh.tsx` | `router.refresh()` mỗi 30s, mốc giờ cập nhật |
| `src/app/live/page.tsx` | Màn Vòng bảng |
| `src/app/live/_GroupSchedule.tsx` | Khối đầu bảng, danh sách cặp, danh sách trận |
| `src/app/live/_MatchCard.tsx` | Thẻ một trận |
| `src/app/live/so-do/page.tsx` | Màn Loại trực tiếp |
| `src/app/live/so-do/_Bracket.tsx` | Sơ đồ nhánh cuộn ngang |
| `src/app/live/bxh/page.tsx` | Màn BXH |
| `src/app/live/bxh/_StandingsCards.tsx` | Thẻ xếp hạng |
| `src/app/live/{,so-do/,bxh/}loading.tsx` | Ba skeleton |
| `src/lib/live/bracket.ts` | `orderForBracket()` |
| `src/lib/live/format.ts` | Hàm hiển thị thuần |
| `src/lib/tournament.ts` | Hằng số giải |

**Sửa**

| File | Việc |
|---|---|
| `src/app/_BottomNav.tsx` | Early-return cho `/live` |
| `src/lib/preferences.ts` | `parseFontSize` fallback `"base"` → `"lg"` |
| `src/app/globals.css:73` | `html:not([data-font-size])` 17px → 19px |
| `src/app/layout.tsx` | `metadata` đọc `src/lib/tournament.ts` |

**Không đụng** — `src/lib/db/*`, `src/lib/standings/*`, `src/lib/matches/*`, toàn bộ
`src/app/admin/*` và `src/app/api/*`, `/d`, `/t`, `_groupColors.ts`, schema Supabase.

## 11. Kiểm thử

Logic tách khỏi component, test bằng vitest đang có:

`src/lib/live/bracket.test.ts`
- `orderForBracket()` trả về đúng số cột theo số vòng
- Hai trận nạp cùng một trận luôn nằm cạnh nhau, đúng thứ tự slot `a` rồi `b`
- Sơ đồ hiện tại ra `[TK1, TK3, TK2, TK4]`
- Đổi `next_slot` thì thứ tự đổi theo — không đóng cứng
- Mảng rỗng và sơ đồ thiếu vòng không ném lỗi

`src/lib/live/format.test.ts`
- Đếm ván thắng từ `sets`
- Chuỗi chi tiết ván `"11–8 · 11–6"`, mảng rỗng trả chuỗi rỗng
- Nhãn trạng thái theo `status`
- Điều kiện hiện “ĐI TIẾP”: bảng đã đấu xong **và** hạng ≤ suất đi tiếp
- Hiệu số: dấu `+` khi dương, `−` khi âm, không dấu khi bằng 0

**Không test render component.** Dự án chưa có jsdom và testing-library; thêm vào là đổi
dependency, ngoài phạm vi. Kiểm bằng mắt: `npm run dev`, xem ở 360px và 430px, thử cả bốn
mức cỡ chữ, cả nền sáng và tối.

## 12. Giả định đã chốt

Ba câu hỏi chưa có trả lời. Chọn theo mặc định dưới đây, đổi được bất cứ lúc nào:

| Câu | Chọn | Lý do |
|---|---|---|
| ~~Cột giờ từng trận~~ | **Không còn là giả định** | BTC đã chốt lịch ngày 21/08: 13:00–15:15, 15 phút/trận, bàn 1–4 theo bảng. Xem mục 4 |
| Mặc định 19px có áp cho `/admin` | **Có** | BTC cũng nhập liệu trên điện thoại. Đổi ở một chỗ, không phân nhánh theo route |
| Tên giải cũ (30/4) trong `layout.tsx` và `page.tsx` | **Chỉ sửa `layout.tsx`** | `metadata` dùng chung với `/live`, để lệch là lỗi thấy ngay. `page.tsx` là 336 dòng nội dung giải 30/4 (giải thưởng, lịch 7:00, nội dung Đồng đội) — viết lại là việc riêng, không nhét vào đây |

## 13. Ngoài phạm vi

- Ghi kết quả: prompt Claude trong terminal cập nhật Supabase
- Viết lại `src/app/page.tsx` — trang giới thiệu còn nội dung giải 30/4
- Xoá `/d`, `/t`, `_ContentHome.tsx` và nội dung Đồng đội
- Sửa `buildDoublesBracket()` cho số bảng khác 4
- Thêm cột giờ hoặc thứ tự thi đấu vào DB
- Vá lỗ hổng cookie phiên admin ở `src/lib/auth.ts:4` (giá trị cố định `pp_admin=ok`,
  ai cũng giả được) — không liên quan `/live` nhưng vẫn đang mở
- Test render component
