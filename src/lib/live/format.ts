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

/** Chỉ gắn nhãn "đi tiếp" khi bảng đã xong — chưa xong thì thứ hạng còn đổi. */
export function advancesToKo(
  rank: number,
  groupComplete: boolean,
  advancePerGroup: number,
): boolean {
  return groupComplete && rank <= advancePerGroup;
}
