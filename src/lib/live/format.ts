import type { SetScore, Status } from "@/lib/schemas/match";

/** "11–8 · 11–6". Trận chưa đá trả về chuỗi rỗng. */
export function formatSets(sets: readonly SetScore[]): string {
  return sets.map((s) => `${s.a}–${s.b}`).join(" · ");
}

/**
 * Giờ dự kiến của trận thứ `index` (0-based) trong bảng.
 * Giờ không nằm trong DB — suy từ giờ khởi tranh và độ dài một lượt.
 */
export function matchTimeAt(
  startTime: string,
  slotMinutes: number,
  index: number,
): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + index * slotMinutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * "13:05" theo giờ Việt Nam.
 *
 * Múi giờ ghim cứng chứ không lấy theo máy: server chạy UTC, người xem ở TP.HCM —
 * để mặc định thì mốc "cập nhật lúc" lệch 7 tiếng.
 */
export function timeLabel(at: Date): string {
  return at.toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Hiệu số ván kèm dấu: "+7", "-3", "0". */
export function diffLabel(diff: number): string {
  return diff > 0 ? `+${diff}` : String(diff);
}

/** "Bảng A" → "A", dùng cho badge chữ cái. */
export function shortGroupName(name: string): string {
  return name.replace(/^Bảng\s*/i, "");
}

const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Chưa đấu",
  live: "Đang đấu",
  done: "Xong",
  forfeit: "Bỏ cuộc",
};

export function statusLabel(status: Status): string {
  return STATUS_LABEL[status];
}

/** Bảng đã đấu xong toàn bộ — điều kiện để chốt suất đi tiếp. */
export function isGroupComplete(
  matches: readonly { status: Status }[],
): boolean {
  return (
    matches.length > 0 &&
    matches.every((m) => m.status === "done" || m.status === "forfeit")
  );
}

export type Qualification =
  /** Bảng chưa đấu xong — thứ hạng còn đổi, chưa gắn nhãn gì. */
  | "pending"
  /** Chắc suất vào vòng loại trực tiếp. */
  | "advance"
  /** Đồng hạng ngay chỗ cắt suất — hệ thống không tự chọn, BTC bốc thăm. */
  | "drawLots"
  /** Không còn cơ hội. */
  | "out";

/**
 * Cặp này đi tiếp, phải bốc thăm, hay bị loại.
 *
 * Không chỉ so `rank <= slots` được: khi bảng con không phân định nổi, nhiều cặp
 * cùng mang một hạng. Ví dụ ba cặp cùng hạng 1 tranh hai suất — so kiểu cũ thì
 * cả ba đều "đi tiếp", màn hình nói ba cặp vào tứ kết trong khi chỉ có hai chỗ.
 *
 * Xét theo số cặp xếp TRÊN và số cặp CÙNG hạng:
 *   - trên + cùng hạng ≤ số suất  → cả nhóm này lọt, chắc suất
 *   - số cặp xếp trên ≥ số suất   → hết chỗ, bị loại
 *   - còn lại                     → nhóm này vắt ngang chỗ cắt, phải bốc thăm
 */
export function qualification(
  allRanks: readonly number[],
  rank: number,
  groupComplete: boolean,
  slots: number,
): Qualification {
  if (!groupComplete) return "pending";
  const better = allRanks.filter((r) => r < rank).length;
  const same = allRanks.filter((r) => r === rank).length;
  if (better + same <= slots) return "advance";
  if (better >= slots) return "out";
  return "drawLots";
}
