# Thiết kế: Ràng buộc nghỉ khi xếp lịch vòng bảng

Ngày: 2026-08-20
Trạng thái: **chờ duyệt**

## 1. Vấn đề

`generatePairings()` (`src/lib/matches/round-robin.ts:4`) sinh cặp đấu bằng vòng lặp lồng nhau.
Với bảng 4 cặp `[A1, A2, A3, A4]` kết quả là:

| # | Trận |
|---|---|
| 1 | A1 – A2 |
| 2 | A1 – A3 |
| 3 | A1 – A4 |
| 4 | A2 – A3 |
| 5 | A2 – A4 |
| 6 | A3 – A4 |

A1 đá 3 trận đầu liên tiếp. Thứ tự này không chỉ là thứ tự trong bộ nhớ — mã trận
(`dm01`, `dm02`, …) được cấp theo đúng thứ tự sinh, và màn hình lịch sắp theo mã trận
(`src/lib/db/matches.ts:91` — `.order("id")`). Nên thứ tự sinh **chính là** thứ tự thi đấu
mà BTC và VĐV nhìn thấy.

## 2. Yêu cầu

Hai mức, hệ thống luôn cố đạt mức mạnh trước:

**Mức ưu tiên — không cặp nào đá 2 trận liên tiếp.** Đạt được với bảng **từ 5 cặp trở lên**.
**Mức tối thiểu (bắt buộc) — không cặp nào xuất hiện trong 3 trận liên tiếp.** Đạt được với
mọi bảng từ 3 cặp trở lên.

Đã kiểm chứng bằng vét cạn cho bảng 3–8 cặp:

| Cỡ bảng | Tránh được 3 trận liên tiếp | Tránh được 2 trận liên tiếp |
|---|---|---|
| 3 cặp | có | **không tồn tại** |
| 4 cặp | có | **không tồn tại** |
| 5–8 cặp | có | có |

Lý do bảng 4 cặp bất khả thi: hai trận liền nhau cần 4 cặp khác nhau, tức trận sau phải là
phần bù của trận trước; mà phần bù là duy nhất nên trận thứ 3 buộc lặp lại trận thứ 1.

**Giải 2/9 chia 4 bảng × 5 cặp** (`docs/draw-result.md`) nên trên thực tế luôn chạy ở mức ưu tiên.

## 3. Thuật toán

Tìm kiếm có quay lui, chạy tối đa hai lượt:

1. **Lượt 1** — tìm lịch thỏa mức ưu tiên (chuỗi tối đa 1).
2. **Lượt 2** — nếu lượt 1 không có nghiệm, hạ xuống mức tối thiểu (chuỗi tối đa 2).

Trong mỗi lượt, ở từng vị trí của dãy:

- **Lọc theo luật.** Với ngưỡng chuỗi `k`, xét `k` trận vừa xếp: nếu chúng có chung một cặp
  thì trận kế tiếp không được chứa cặp đó.
- **Sắp ứng viên còn lại theo tham lam.** Điểm của một trận = khoảng nghỉ nhỏ nhất trong hai
  cặp của nó, với khoảng nghỉ = vị trí hiện tại trừ vị trí lần đá gần nhất (chưa đá lần nào
  thì coi là vô cực). Điểm cao xếp trước.
- **Tie-break theo khóa chuẩn hóa của trận** để kết quả ổn định — chạy lại luôn ra lịch y hệt.
- **Quay lui** nếu đi vào ngõ cụt.

Bảng lớn nhất thực tế là 6 cặp = 15 trận nên không có vấn đề tốc độ.

### Kết quả kỳ vọng — bảng 5 cặp

| # | Trận | # | Trận |
|---|---|---|---|
| 1 | P1 – P2 | 6 | P1 – P3 |
| 2 | P3 – P4 | 7 | P2 – P4 |
| 3 | P1 – P5 | 8 | P3 – P5 |
| 4 | P2 – P3 | 9 | P1 – P4 |
| 5 | P4 – P5 | 10 | P2 – P5 |

Không cặp nào đá 2 trận liền nhau.

### Kết quả kỳ vọng — bảng 4 cặp (mức tối thiểu)

| # | Trận | Ghi chú |
|---|---|---|
| 1 | P1 – P2 | |
| 2 | P3 – P4 | không trùng cặp nào |
| 3 | P1 – P3 | P3 đá liền 2 trận |
| 4 | P2 – P4 | |
| 5 | P1 – P4 | P4 đá liền 2 trận |
| 6 | P2 – P3 | |

Chuỗi dài nhất = 2. Đây là tối ưu cho cỡ bảng này.

## 4. Giao diện

`generatePairings(entries: string[]): Pairing[]` **giữ nguyên chữ ký**, chỉ đổi thứ tự trả về.
Mọi nơi gọi không phải sửa.

Lý do an toàn: `computeMatchDiff()` so sánh bằng khóa chuẩn hóa nên không phụ thuộc thứ tự;
còn `diff.add` được dựng bằng cách duyệt `target` theo thứ tự và lọc, nên thứ tự mới được giữ
nguyên khi cấp mã trận.

Thêm một hàm phụ trợ xuất ra để kiểm thử dùng chung:

`maxConsecutiveRun(pairings: Pairing[]): number` — trả về chuỗi trận liên tiếp dài nhất mà một
cặp bất kỳ phải đá. Luật cứng đạt khi giá trị này ≤ 2.

## 5. Phạm vi file

| File | Việc |
|---|---|
| `src/lib/matches/round-robin.ts` | Đổi thứ tự sinh trận, thêm `maxConsecutiveRun` |
| `src/lib/matches/round-robin.test.ts` | Test luật cứng cho bảng 3–8 cặp |
| `src/app/api/doubles/groups/[id]/regenerate-matches/route.ts` | **Đang mở — xem mục 7** |

## 6. Kiểm thử

Với mỗi cỡ bảng từ 3 đến 8 cặp:

- Số trận đúng bằng `n × (n−1) ÷ 2`
- Tập cặp đấu đầy đủ và không trùng — mọi cặp gặp nhau đúng 1 lần
- `maxConsecutiveRun(...) <= 2` (mức tối thiểu, luôn phải đạt)
- Gọi 2 lần trả về dãy giống hệt nhau

Riêng bảng từ 5 cặp trở lên:

- `maxConsecutiveRun(...) === 1` — mức ưu tiên phải đạt

Test riêng:

- Bảng 5 cặp khớp đúng dãy ở mục 3 (giữ cho lịch trong `docs/draw-result.md` luôn đúng)
- Bảng 4 cặp khớp đúng dãy ở mục 3
- Bảng 0, 1, 2 cặp không lỗi
- `maxConsecutiveRun` trả về 3 với dãy sinh theo kiểu vòng lặp lồng nhau cũ

## 7. Quyết định đang mở

Thứ tự thi đấu không có cột riêng trong DB — nó là thứ tự mã trận, cấp lúc tạo. Kéo theo: nếu
BTC **thêm cặp vào bảng đã tạo trận rồi**, `regenerate-matches` giữ nguyên trận cũ và nhét trận
mới vào cuối, nên cặp mới sẽ đá 3–4 trận cuối liền nhau — **vi phạm đúng luật cứng vừa đặt ra**.

Hai lựa chọn:

1. **Chấp nhận**, và hướng dẫn BTC chốt danh sách bảng xong mới tạo trận. Không sửa file thứ 3.
2. **Sửa `regenerate-matches`**: khi bảng chưa có trận nào đá xong thì xóa và tạo lại toàn bộ
   theo thứ tự mới. An toàn vì chưa có kết quả để mất. Bảng đã có trận đá xong giữ nguyên hành
   vi hiện tại.

Đề xuất: **(2)**, vì (1) để lại đúng cái lỗi mà cả thiết kế này sinh ra để tránh.

## 8. Ngoài phạm vi

- Lịch tổng toàn giải: xếp trận vào bàn và khung giờ, kiểm tra nghỉ xuyên bảng
- Thêm cột thứ tự / lượt vào DB
- Cảnh báo trong admin khi lịch vi phạm
- Nội dung Đồng đội (`src/app/api/teams/.../regenerate-matches`) — giải 2/9 không có nội dung này
