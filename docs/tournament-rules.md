# Điều lệ giải Chào mừng 81 năm Lễ Quốc khánh (2/9/1945 – 2/9/2026)

> File này do BTC viết tay. AI chat sẽ đọc làm nguồn trả lời câu hỏi về điều lệ.
> Nguồn: văn bản CLB Bóng bàn Bình Tân — An Lạc, ngày 05/08/2026.

## 1. Thông tin chung

- Tên giải: Giải bóng bàn CLB Bình Tân — Chào mừng kỷ niệm 81 năm Lễ Quốc khánh (2/9/1945 – 2/9/2026)
- Đơn vị tổ chức: Trung tâm Cung ứng Dịch vụ công Phường An Lạc — CLB Bóng bàn Bình Tân
- Địa điểm: Nhà thi đấu TT Cung ứng Dịch vụ công Phường An Lạc — 565 Kinh Dương Vương (trên tầng 1)
- Ngày thi đấu: **13h00, thứ Bảy 22/08/2026**
- Lệ phí tham dự: 200.000đ / VĐV

### Mốc thời gian

- Đăng ký: từ 05/08/2026 đến **19h00 ngày 18/08/2026**
- Bốc thăm chia bảng: **17h00 ngày 19/08/2026**
- Thi đấu: 13h00 ngày 22/08/2026

### Đối tượng tham gia

- Tất cả VĐV đã từng và đang sinh hoạt tại CLB BB Bình Tân
- VĐV của các CLB đã từng đến giao lưu tại CLB BB Bình Tân

## 2. Nội dung và thể thức thi đấu

Giải năm nay **chỉ có nội dung Đôi** (không có nội dung Đồng đội).

### 2.1 Ghép cặp

- VĐV được BTC phân vào các **nhóm trình A / B / C** (mang tính tương đối)
- Bốc thăm phân cặp ngẫu nhiên
- Mỗi đôi gồm **1 VĐV nhóm trình cao + 1 VĐV nhóm trình thấp**; hoặc đôi nhóm cao chấp banh đôi nhóm thấp
- BTC chọn các cặp đôi hạt giống phân vào các bảng đấu, nhằm tránh chênh lệch trình quá lớn

### 2.2 Vòng bảng

- Đấu vòng tròn
- **3–5 ván/trận, tùy số lượng VĐV đăng ký / số trận đấu**
  - Trận 3 ván: thắng 2 ván
  - Trận 5 ván: thắng 3 ván
- Nhất và nhì mỗi bảng vào vòng loại trực tiếp
- Sơ đồ tứ kết dùng 4 bảng A/B/C/D → 8 cặp vào KO

### 2.3 Vòng loại trực tiếp

Tất cả các trận từ vòng loại trực tiếp: **5 ván thắng 3**.

- **Tứ kết**
  - TK1: Nhất A – Nhì C
  - TK2: Nhì A – Nhất C
  - TK3: Nhất B – Nhì D
  - TK4: Nhì B – Nhất D
- **Bán kết**
  - BK I: Cặp thắng TK1 – Cặp thắng TK3
  - BK II: Cặp thắng TK2 – Cặp thắng TK4
- **Chung kết**: Cặp thắng BK I – Cặp thắng BK II
- Hai cặp thua vòng bán kết **đồng hạng Ba** (không đánh trận tranh hạng 3)

## 3. Luật thi đấu

- Áp dụng Luật bóng bàn hiện hành của Liên đoàn Bóng bàn Việt Nam
- Bóng thi đấu: **Nitaku**

## 4. Xếp hạng trong bảng

> Điều lệ 2/9 không quy định chi tiết cách phân định khi bằng điểm. Đây là cơ chế hệ thống
> đang áp dụng (`src/lib/standings/tiebreaker.ts`), giữ nguyên từ giải trước.

**Tiêu chí đầu tiên và duy nhất để so trực tiếp: số trận thắng.** Ai thắng nhiều hơn xếp trên.
Hiệu số ván không tham gia ở bước này. Chỉ khi bằng số trận thắng mới xét tiếp, và cách xét
khác nhau tùy có bao nhiêu cặp bằng nhau.

### 4.1 Trường hợp CÓ ĐÚNG 2 CẶP bằng số trận thắng

Xét theo thứ tự, dừng ngay khi phân định được:

1. **Đối đầu trực tiếp** — ai thắng trận hai cặp gặp nhau thì xếp trên. **Quyết định luôn**,
   kể cả khi cặp đó có hiệu số ván kém hơn.
2. **Hiệu số ván toàn bảng** — chỉ dùng khi trận đối đầu chưa có kết quả trong hệ thống.
3. **Tổng số ván thắng toàn bảng**.
4. Vẫn bằng → **đồng hạng**.

*Ví dụ:* Cặp 2 và Cặp 3 cùng thắng 2 trận. Cặp 3 hiệu số +3, Cặp 2 hiệu số +1. Nhưng Cặp 2
đã thắng Cặp 3 ở vòng bảng → **Cặp 2 xếp trên**.

### 4.2 Trường hợp CÓ 3 CẶP TRỞ LÊN bằng số trận thắng

Không dùng đối đầu trực tiếp ngay, mà lập **bảng con**: bỏ hết các trận với cặp ngoài nhóm,
chỉ giữ các trận **những cặp trong nhóm đánh với nhau**, rồi tính lại từ đầu:

1. Số trận thắng trong bảng con
2. Hiệu số ván trong bảng con
3. Tổng số ván thắng trong bảng con

Sau bước này:

- **Tách được hết** → xong, lấy thứ tự bảng con.
- **Còn đúng 2 cặp bằng nhau** trong bảng con → quay lại quy tắc 4.1, tức xét đối đầu trực tiếp
  giữa 2 cặp đó. Lưu ý: nếu phải xuống tới hiệu số thì hệ thống dùng **hiệu số toàn bảng**,
  không phải hiệu số bảng con.
- **Từ 3 cặp trở lên vẫn bằng nhau hoàn toàn** → hệ thống để **đồng hạng và không tự chọn ai
  đi tiếp**. BTC phải bốc thăm hoặc quyết định thủ công.

*Ví dụ:* Cặp 1, 2, 3 cùng thắng 2 trận. Chỉ lấy 3 trận giữa họ với nhau: Cặp 1 thắng Cặp 2,
Cặp 2 thắng Cặp 3, Cặp 3 thắng Cặp 1 — mỗi cặp thắng 1, hòa vòng. Lúc này so hiệu số ván
của riêng 3 trận đó để phân hạng.

### 4.3 Quy định chung

- **Cặp chưa đá trận nào** bị loại khỏi mọi bước so sánh ở trên, luôn xếp cuối bảng,
  tất cả cùng một hạng, sắp theo tên.
- **Cách đánh số hạng:** hai cặp đồng hạng 2 thì cặp kế tiếp là hạng **4**, không có hạng 3.
- Trận bỏ cuộc (xử thua) vẫn được tính như trận đã đá, có đóng góp vào hiệu số ván.

## 5. Khen thưởng — Kỷ luật

### 5.1 Khen thưởng

| Giải | Tiền thưởng | Kèm theo |
|---|---|---|
| Nhất | 1.500.000đ | HCV + Cờ lưu niệm |
| Nhì | 1.000.000đ | HCB + Cờ lưu niệm |
| Ba | 600.000đ | HCĐ + Cờ lưu niệm |

\* Giá trị giải thưởng có thể tăng lên tùy thuộc vào tổng số đội tham dự và nhà tài trợ giải đấu.

### 5.2 Kỷ luật

VĐV vi phạm quy định của giải, tùy mức độ BTC sẽ xem xét và xử lý: nhắc nhở, cảnh cáo, hoặc truất quyền thi đấu.

## 6. Lệ phí

- 200.000 đồng / 1 VĐV

## 7. Quy định chung

- Tinh thần "vui là chính" — giao lưu học hỏi, không phân biệt giới tính & độ tuổi
- Trang phục: quần sooc thể thao, áo thun tay ngắn (**không có nền toàn màu trắng**), giày thể thao
- VĐV phải có mặt **trước giờ thi đấu 15 phút** để làm thủ tục. Đến giờ thi đấu, sau khi BTC gọi tên **3 lần** mà VĐV không có mặt thì xem như tự ý bỏ cuộc và bị xử thua
- Khiếu nại về chuyên môn do BTC và trọng tài giải quyết ngay trong trận đấu. Sau **15 phút** kể từ khi trận đấu kết thúc, mọi khiếu nại về chuyên môn không còn giá trị
- Trường hợp VĐV của cặp đôi đã đăng ký nhưng vì lý do cá nhân không thể có mặt và **có báo trước ngày thi đấu 1 ngày**: để hạn chế ảnh hưởng quyền lợi VĐV còn lại, BTC sẽ ghép cặp phù hợp theo nhóm trình A/B/C và công bố trước ngày thi đấu
- VĐV không được cố tình gây hấn, khiêu khích đối phương, chơi xấu, phát ngôn thiếu văn hóa
- VĐV tự chịu trách nhiệm về tình hình sức khỏe của bản thân trong suốt quá trình tham gia giải
- VĐV phải tôn trọng mọi quyết định của BTC và trọng tài. Chỉ BTC có quyền thay đổi, bổ sung các nội dung trong điều lệ

## 8. Ban tổ chức

- Ông **Trần Đức Lợi** — Trưởng ban (Chủ nhiệm CLB)
- Ông **Nguyễn Kim Quy** — Phó ban (Phó Chủ nhiệm thường trực)
- Ông **Lê Phú Cường** — Phó ban (Phó Chủ nhiệm ban chuyên môn)
- Ông **Nguyễn Phú Hảo** — Thư ký

## 9. Đăng ký, tiếp nhận tài trợ

- VĐV đăng ký và đóng lệ phí trực tiếp với Ông Trần Đức Lợi / Ông Nguyễn Kim Quy bằng tiền mặt hoặc chuyển khoản
- BTC tiếp nhận và cập nhật liên tục các nguồn tài trợ từ VĐV và MTQ lên Group CLB BB BÌNH TÂN / Group HBBBT
