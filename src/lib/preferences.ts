export const FONT_SIZE_LEVELS = ["sm", "base", "lg", "xl"] as const;
export type FontSize = (typeof FONT_SIZE_LEVELS)[number];

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
  if (typeof value !== "string") return "base";
  return (FONT_SIZE_LEVELS as readonly string[]).includes(value)
    ? (value as FontSize)
    : "base";
}

export function readFontSize(storage: StorageLike): FontSize {
  try {
    return parseFontSize(storage.getItem(FONT_SIZE_STORAGE_KEY));
  } catch {
    return "base";
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
