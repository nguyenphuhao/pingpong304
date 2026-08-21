import { FONT_SIZE_LEVELS, type FontSize } from "@/lib/preferences";

export type LiveTabId = "lich" | "sodo" | "bxh";

export type LiveTab = {
  id: LiveTabId;
  href: string;
  /** Luôn hiện kèm icon — icon trần làm người lớn tuổi phải đoán. */
  label: string;
};

export const LIVE_TABS: readonly LiveTab[] = [
  { id: "lich", href: "/live", label: "Vòng bảng" },
  { id: "sodo", href: "/live/so-do", label: "Loại trực tiếp" },
  { id: "bxh", href: "/live/bxh", label: "BXH" },
];

/**
 * Tab đang mở theo pathname. So khớp href dài nhất trước để "/live/so-do"
 * không rơi nhầm về tab gốc "/live".
 */
export function activeTabId(pathname: string): LiveTabId | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const byLongest = [...LIVE_TABS].sort((a, b) => b.href.length - a.href.length);
  const hit = byLongest.find(
    (tab) => path === tab.href || path.startsWith(`${tab.href}/`),
  );
  return hit?.id ?? null;
}

/** Lùi hoặc tiến một bậc cỡ chữ, chạm biên thì đứng yên. */
export function stepFontSize(current: FontSize, delta: number): FontSize {
  const i = FONT_SIZE_LEVELS.indexOf(current);
  const next = Math.min(FONT_SIZE_LEVELS.length - 1, Math.max(0, i + delta));
  return FONT_SIZE_LEVELS[next];
}
