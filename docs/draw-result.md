# Kết quả bốc thăm & chia bảng — Giải 2/9 (22/08/2026)

> Chép tay từ 2 tờ kết quả bốc thăm của BTC. **Chưa được BTC xác nhận lại** —
> cần đối chiếu trước khi nhập vào hệ thống.

## 1. Kết quả bốc thăm — 20 cặp

| Stt | Cặp VĐV | Bảng |
|---|---|---|
| 1 | Nghiệp – Mạnh | A-P1 |
| 2 | Mỹ – Hạnh | B-P1 |
| 3 | Hoài Nam – Tuyền | D-P1 |
| 4 | Thi – Dũng (AP) | C-P2 |
| 5 | Bảo Vinh – Nghĩa | B-P3 |
| 6 | Hoà – Quý | D-P3 |
| 7 | Cường (nhỏ) – Quang Vinh | C-P1 |
| 8 | Dũng – Phượng | A-P4 |
| 9 | H'Lim – Phương | A-P3 |
| 10 | Thái Sơn – Viết Tài | A-P5 |
| 11 | Hồng Nam – Bạch | B-P4 |
| 12 | Sinh – Phúc | D-P5 |
| 13 | Quân – Minh | B-P2 |
| 14 | Chung – Tuấn Anh | D-P2 |
| 15 | Sĩ – Hùng | D-P4 |
| 16 | Dân – Trọng | C-P5 |
| 17 | Giang – Bá Sơn | B-P5 |
| 18 | Sang – Tiến | C-P3 |
| 19 | Hoàng – Hưởng | C-P4 |
| 20 | Cường (lớn) – Hảo | A-P2 |

**Dự bị:** Quy – Lợi

Đã đối chiếu: cả 20 cặp đều có mặt trong bảng, không trùng, không sót.

## 2. Chia bảng

Bốn bảng, mỗi bảng **5 cặp**. Ký hiệu P1–P5 dùng cho lịch thi đấu ở mục 4.

| | Bảng A | Bảng B | Bảng C | Bảng D |
|---|---|---|---|---|
| **P1** | Nghiệp / Mạnh | Mỹ / Hạnh | Cường (nhỏ) / Quang Vinh | Hoài Nam / Tuyền |
| **P2** | Cường (lớn) / Hảo | Quân / Minh | Thi / Dũng (AP) | Chung / Tuấn Anh |
| **P3** | H'Lim / Phương | Bảo Vinh / Nghĩa | Sang / Tiến | Hoà / Quý |
| **P4** | Dũng / Phượng | Hồng Nam / Bạch | Hoàng / Hưởng | Sĩ / Hùng |
| **P5** | Thái Sơn / Viết Tài | Giang / Bá Sơn | Dân / Trọng | Sinh / Phúc |

## 3. Cảnh báo trùng tên khi nhập liệu

Tờ chia bảng viết tắt tên, dễ nhập nhầm thành cùng một người. Sáu chỗ cần phân biệt:

| Tên viết tắt | Là hai người khác nhau | Vị trí |
|---|---|---|
| Cường | Cường (lớn) — Cường (nhỏ) | A-P2 và C-P1 |
| Vinh | Bảo Vinh — Quang Vinh | B-P3 và C-P1 |
| Nam | Hồng Nam — Hoài Nam | B-P4 và D-P1 |
| Sơn | Thái Sơn — Bá Sơn | A-P5 và B-P5 |
| Dũng | Dũng — Dũng (AP) | A-P4 và C-P2 |
| Phương / Phượng | hai người khác nhau | A-P3 và A-P4 — **cùng bảng** |

**Đã sửa sau khi đối chiếu:** tờ bốc thăm viết `Nga`, thực tế VĐV tên đầy đủ là
**Trọng** (giải 30/4 ghi là "Trọng Nga" — xem `supabase/seed.sql`). BTC xác nhận ngày
21/08 rằng **Trọng** là đúng. Danh sách trong file này đã cập nhật; `scripts/seed-giai-02-09.ts`
cũng vậy, nên seed lại không ghi đè nhầm.

Phương và Phượng cùng nằm bảng A là rủi ro cao nhất: sai một dấu là ghi nhầm kết quả
cho cặp khác. Nên nhập tên đầy đủ kèm phần trong ngoặc, không viết tắt.

## 4. Thứ tự thi đấu đề xuất

> **Chưa áp dụng trong app.** Hệ thống hiện sinh trận theo thứ tự khác — xem
> `docs/superpowers/specs/2026-08-20-group-schedule-rest-design.md`.

Mỗi bảng 5 cặp → 10 trận, tổng vòng bảng **40 trận**.

Thứ tự dưới đây đã được kiểm chứng bằng vét cạn: **không cặp nào phải đá 2 trận liền
nhau**, mọi cặp đều được nghỉ ít nhất 1 trận giữa hai lần ra sân. Thứ tự này chỉ đúng
khi mỗi bảng chạy trên một bàn cố định.

### Bảng A

| # | Trận |
|---|---|
| 1 | Nghiệp / Mạnh  —  Cường (lớn) / Hảo |
| 2 | H'Lim / Phương  —  Dũng / Phượng |
| 3 | Nghiệp / Mạnh  —  Thái Sơn / Viết Tài |
| 4 | Cường (lớn) / Hảo  —  H'Lim / Phương |
| 5 | Dũng / Phượng  —  Thái Sơn / Viết Tài |
| 6 | Nghiệp / Mạnh  —  H'Lim / Phương |
| 7 | Cường (lớn) / Hảo  —  Dũng / Phượng |
| 8 | H'Lim / Phương  —  Thái Sơn / Viết Tài |
| 9 | Nghiệp / Mạnh  —  Dũng / Phượng |
| 10 | Cường (lớn) / Hảo  —  Thái Sơn / Viết Tài |

### Bảng B

| # | Trận |
|---|---|
| 1 | Mỹ / Hạnh  —  Quân / Minh |
| 2 | Bảo Vinh / Nghĩa  —  Hồng Nam / Bạch |
| 3 | Mỹ / Hạnh  —  Giang / Bá Sơn |
| 4 | Quân / Minh  —  Bảo Vinh / Nghĩa |
| 5 | Hồng Nam / Bạch  —  Giang / Bá Sơn |
| 6 | Mỹ / Hạnh  —  Bảo Vinh / Nghĩa |
| 7 | Quân / Minh  —  Hồng Nam / Bạch |
| 8 | Bảo Vinh / Nghĩa  —  Giang / Bá Sơn |
| 9 | Mỹ / Hạnh  —  Hồng Nam / Bạch |
| 10 | Quân / Minh  —  Giang / Bá Sơn |

### Bảng C

| # | Trận |
|---|---|
| 1 | Cường (nhỏ) / Quang Vinh  —  Thi / Dũng (AP) |
| 2 | Sang / Tiến  —  Hoàng / Hưởng |
| 3 | Cường (nhỏ) / Quang Vinh  —  Dân / Trọng |
| 4 | Thi / Dũng (AP)  —  Sang / Tiến |
| 5 | Hoàng / Hưởng  —  Dân / Trọng |
| 6 | Cường (nhỏ) / Quang Vinh  —  Sang / Tiến |
| 7 | Thi / Dũng (AP)  —  Hoàng / Hưởng |
| 8 | Sang / Tiến  —  Dân / Trọng |
| 9 | Cường (nhỏ) / Quang Vinh  —  Hoàng / Hưởng |
| 10 | Thi / Dũng (AP)  —  Dân / Trọng |

### Bảng D

| # | Trận |
|---|---|
| 1 | Hoài Nam / Tuyền  —  Chung / Tuấn Anh |
| 2 | Hoà / Quý  —  Sĩ / Hùng |
| 3 | Hoài Nam / Tuyền  —  Sinh / Phúc |
| 4 | Chung / Tuấn Anh  —  Hoà / Quý |
| 5 | Sĩ / Hùng  —  Sinh / Phúc |
| 6 | Hoài Nam / Tuyền  —  Hoà / Quý |
| 7 | Chung / Tuấn Anh  —  Sĩ / Hùng |
| 8 | Hoà / Quý  —  Sinh / Phúc |
| 9 | Hoài Nam / Tuyền  —  Sĩ / Hùng |
| 10 | Chung / Tuấn Anh  —  Sinh / Phúc |

## 5. Việc BTC cần chốt

- **Số ván vòng bảng.** Điều lệ để ngỏ 3–5 ván tùy số VĐV. Tổng 40 trận vòng bảng
  cộng 7 trận knockout = 47 trận, khởi tranh 13h00 → nên chốt **3 ván thắng 2** cho
  vòng bảng, 5 ván thắng 3 từ tứ kết như điều lệ quy định.
- **Số bàn thi đấu** và bảng nào chạy bàn nào — thứ tự ở mục 4 giả định mỗi bảng một bàn.
- **Cặp dự bị Quy – Lợi** vào bảng nào nếu có cặp bỏ cuộc.

