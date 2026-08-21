export const FONT_SIZE_LEVELS = ["sm", "base", "lg", "xl"] as const;
export type FontSize = (typeof FONT_SIZE_LEVELS)[number];

/**
 * Cỡ chữ khi người dùng chưa chọn gì.
 *
 * Mức "lg" (19px) chứ không phải "base": người xem chính của giải trên 50 tuổi,
 * cầm điện thoại trong nhà thi đấu. Ai thấy to quá vẫn hạ được bằng nút A− trên
 * thanh đầu trang.
 *
 * Giá trị này còn được lặp lại ở hai nơi không import được:
 *   - src/app/globals.css — quy tắc html:not([data-font-size])
 *   - PreferencesScript nạp nó qua nội suy chuỗi, không phải chép tay
 * Đổi ở đây thì nhớ đổi CSS.
 */
export const DEFAULT_FONT_SIZE: FontSize = "lg";

export const FONT_SIZE_STORAGE_KEY = "pingpong:font-size";
export const ONBOARDED_STORAGE_KEY = "pingpong:onboarded";
export const FONT_SIZE_ATTR = "data-font-size";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type DocLike = {
  documentElement: {
    getAttribute: (k: string) => string | null;
    setAttribute: (k: string, v: string) => void;
  };
};

export function parseFontSize(value: unknown): FontSize {
  if (typeof value !== "string") return DEFAULT_FONT_SIZE;
  return (FONT_SIZE_LEVELS as readonly string[]).includes(value)
    ? (value as FontSize)
    : DEFAULT_FONT_SIZE;
}

export function readFontSize(storage: StorageLike): FontSize {
  try {
    return parseFontSize(storage.getItem(FONT_SIZE_STORAGE_KEY));
  } catch {
    return DEFAULT_FONT_SIZE;
  }
}

export function writeFontSize(
  storage: StorageLike,
  doc: DocLike,
  size: FontSize,
): void {
  doc.documentElement.setAttribute(FONT_SIZE_ATTR, size);
  try {
    storage.setItem(FONT_SIZE_STORAGE_KEY, size);
  } catch {
    // Safari Private Mode / quota — DOM attribute still applied.
  }
}

export function isOnboarded(storage: StorageLike): boolean {
  try {
    return storage.getItem(ONBOARDED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboarded(storage: StorageLike): void {
  try {
    storage.setItem(ONBOARDED_STORAGE_KEY, "1");
  } catch {
    // Safari Private Mode / quota — flag simply won't persist this session.
  }
}
