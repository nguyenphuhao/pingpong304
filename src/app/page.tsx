import { redirect } from "next/navigation";

/**
 * Trang chủ đưa thẳng vào màn xem giải.
 *
 * Người xem mở app trong nhà thi đấu chỉ cần lịch, sơ đồ và bảng xếp hạng —
 * bắt họ đi qua một trang giới thiệu là thêm một lần chạm không cần thiết.
 *
 * Nội dung giới thiệu cũ (giải 30/4: ngày 19/04, điểm danh 7h00, nội dung Đồng
 * đội, giải thưởng riêng) đã sai so với giải đang chạy nên bỏ hẳn thay vì dời
 * sang route khác — giữ lại là giữ thông tin sai. Lấy lại được ở
 * `git show f3bb217:src/app/page.tsx` nếu cần dựng lại cho giải sau.
 *
 * Dùng redirect() ở page chứ không phải `redirects` trong next.config: redirect
 * ở config không áp cho điều hướng client-side, mà tab "Trang chủ" của nav gốc
 * là một <Link href="/">.
 */
export default function Home() {
  redirect("/live");
}
