"use client";

import Image from "next/image";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { stepFontSize } from "@/lib/live/nav";
import { TOURNAMENT } from "@/lib/tournament";
import { useFontSize } from "../_FontSizeProvider";

/**
 * Thanh trên dính, mang luôn nút chỉnh cỡ chữ.
 *
 * Cỡ chữ để ngoài mặt chứ không giấu trong Cài đặt: người xem lớn tuổi không đi
 * tìm bánh răng ở tab thứ tư. Vẫn ghi vào localStorage như cũ nên /d và /t
 * dùng chung lựa chọn.
 */
export function LiveTopBar() {
  const { size, setSize } = useFontSize();
  const { setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 bg-[#0E2A4E] text-white">
      <div className="mx-auto flex w-full max-w-md items-center gap-3 px-3 py-2.5 md:max-w-3xl md:px-5 lg:max-w-5xl">
        {/*
          alt rỗng vì tên CLB nằm ngay bên cạnh — đọc màn hình mà đọc cả hai là
          lặp. priority vì logo nằm ngay đầu trang, không nên tải trễ.

          unoptimized: Next không tối ưu SVG theo mặc định (SVG chứa được script
          nên là bề mặt tấn công). Bỏ qua hẳn bộ tối ưu thay vì bật
          dangerouslyAllowSVG — ảnh vector vốn không có gì để nén thêm.
        */}
        <Image
          src="/logo-clb.svg"
          alt=""
          width={44}
          height={44}
          priority
          unoptimized
          className="size-11 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.09em] text-sky-200">
            {TOURNAMENT.club}
          </p>
          {/*
            Xuống dòng chứ KHÔNG cắt. Thêm nút đổi nền là ba nút chiếm 144px,
            đo ở khổ 375px thì ô chứa tên còn 220px trong khi tên cần 254px —
            để truncate là hiện "Giải mừng Quốc khán…". Người xem trên 50 tuổi
            mà phải đoán nốt phần bị cắt thì hỏng mục đích của cả màn này.
          */}
          <p className="text-base font-bold leading-tight text-balance">
            {TOURNAMENT.shortName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/*
            Icon đổi bằng CSS chứ không bằng state React. next-themes gắn class
            "dark" lên <html> bằng script chạy trước hydrate, nên biến thể dark:
            đúng ngay khung hình đầu. Cho JSX đọc theme thì server render một
            đằng client một nẻo — đúng lỗi hydrate đã gặp ở nút A−/A+.

            Nhãn cố định "Đổi nền sáng / tối" vì nhãn phụ thuộc nền hiện tại thì
            cũng lệch; câu này đúng ở cả hai chiều.
          */}
          <button
            type="button"
            aria-label="Đổi nền sáng / tối"
            onClick={() =>
              setTheme(
                document.documentElement.classList.contains("dark")
                  ? "light"
                  : "dark",
              )
            }
            style={{ touchAction: "manipulation" }}
            className="flex size-11 items-center justify-center rounded-lg border border-white/30 bg-white/10 transition-colors active:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
          >
            <Sun aria-hidden className="hidden size-[1.15rem] dark:block" />
            <Moon aria-hidden className="size-[1.15rem] dark:hidden" />
          </button>

          <FontSizeButton
            label="Giảm cỡ chữ"
            text="A−"
            atLimitClass="fs-at-min"
            onClick={() => setSize(stepFontSize(size, -1))}
          />
          <FontSizeButton
            label="Tăng cỡ chữ"
            text="A+"
            atLimitClass="fs-at-max"
            onClick={() => setSize(stepFontSize(size, 1))}
          />
        </div>
      </div>
    </header>
  );
}

/**
 * Trạng thái "đã chạm mức lớn/nhỏ nhất" làm mờ bằng CSS bám vào thuộc tính
 * data-font-size trên <html>, KHÔNG bằng prop React.
 *
 * Lý do: FontSizeProvider trên server luôn trả "base" (không đọc được
 * localStorage), client mới biết mức thật — cho JSX phụ thuộc giá trị đó là
 * server và client render lệch nhau, React báo hydration mismatch. Thuộc tính
 * kia do PreferencesScript đặt trước khi hydrate nên CSS đúng ngay từ khung
 * hình đầu tiên.
 *
 * Nút không bị `disabled`: bấm ở mức biên cũng vô hại vì stepFontSize đã chặn.
 */
function FontSizeButton({
  label,
  text,
  atLimitClass,
  onClick,
}: {
  label: string;
  text: string;
  atLimitClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{ touchAction: "manipulation" }}
      className={`${atLimitClass} flex size-11 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-[0.95rem] font-bold transition-colors active:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white`}
    >
      {text}
    </button>
  );
}
