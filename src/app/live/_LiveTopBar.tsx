"use client";

import { FONT_SIZE_LEVELS } from "@/lib/preferences";
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
  const atMin = size === FONT_SIZE_LEVELS[0];
  const atMax = size === FONT_SIZE_LEVELS[FONT_SIZE_LEVELS.length - 1];

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
            disabled={atMin}
            onClick={() => setSize(stepFontSize(size, -1))}
          />
          <FontSizeButton
            label="Tăng cỡ chữ"
            text="A+"
            disabled={atMax}
            onClick={() => setSize(stepFontSize(size, 1))}
          />
        </div>
      </div>
    </header>
  );
}

function FontSizeButton({
  label,
  text,
  disabled,
  onClick,
}: {
  label: string;
  text: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{ touchAction: "manipulation" }}
      className="flex size-11 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-[0.95rem] font-bold transition-colors active:bg-white/25 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
    >
      {text}
    </button>
  );
}
