"use client";

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

  return (
    <header className="sticky top-0 z-40 bg-[#0E2A4E] text-white">
      <div className="mx-auto flex w-full max-w-md items-center gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.09em] text-sky-200">
            {TOURNAMENT.club}
          </p>
          <p className="truncate text-base font-bold leading-tight">
            {TOURNAMENT.shortName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
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
