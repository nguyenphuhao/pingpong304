/**
 * Hằng số giải đấu.
 *
 * Những thông tin này không có trong DB (schema chỉ lưu VĐV / cặp / bảng / trận),
 * nên để tập trung một chỗ thay vì rải trong component. Đổi giải thì sửa file này.
 *
 * Nguồn: docs/tournament-rules.md và 4 tờ lịch vòng bảng BTC chốt 21/08/2026.
 */

export const TOURNAMENT = {
  name: "Giải bóng bàn CLB Bình Tân — Chào mừng kỷ niệm 81 năm Lễ Quốc khánh",
  shortName: "Giải mừng Quốc khánh 2/9",
  club: "CLB Bóng bàn Bình Tân",
  ward: "Phường An Lạc",
  event: "Đôi",
  /** ISO, dùng cho thẻ <time>. */
  date: "2026-08-22",
  /** Chuỗi hiển thị viết sẵn — tránh lệ thuộc locale và múi giờ khi render trên server. */
  dateLabel: "Thứ Bảy · 22/08/2026",
  venue: "Nhà thi đấu TT Cung ứng Dịch vụ công Phường An Lạc",
  address: "565 Kinh Dương Vương",
} as const;

export const GROUP_STAGE = {
  /** Giờ trận đầu của mọi bảng — bốn bàn chạy song song. */
  startTime: "13:00",
  /** Khoảng cách giữa hai trận liên tiếp cùng một bàn, dùng để suy giờ dự kiến. */
  slotMinutes: 15,
  /** Số cặp đầu bảng vào vòng loại trực tiếp (điều lệ §2.2). */
  advancePerGroup: 2,
} as const;
