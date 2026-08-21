import type { GroupResolved } from "@/lib/schemas/group";
import { shortGroupName } from "./format";

/**
 * Mã hiển thị của từng cặp trong bảng: "A1", "A2"… — khớp với tờ lịch BTC in.
 *
 * Suy từ vị trí trong bảng chứ không đọc mã trong DB, để đổi cách đặt mã cặp
 * cũng không làm hỏng nhãn trên màn hình.
 */
export function entryCodes(group: GroupResolved): Map<string, string> {
  const letter = shortGroupName(group.name);
  return new Map(
    group.entries.map((entry, i) => [entry.id, `${letter}${i + 1}`]),
  );
}

/**
 * Bảng đang xem theo tham số `?bang=`. Không khớp thì rơi về bảng đầu — người
 * xem sửa tay địa chỉ vẫn thấy nội dung, không gặp trang trống.
 */
export function resolveGroup(
  groups: readonly GroupResolved[],
  bang: string | undefined,
): GroupResolved | null {
  if (groups.length === 0) return null;
  if (!bang) return groups[0];

  const wanted = bang.trim().toUpperCase();
  const hit = groups.find(
    (g) => shortGroupName(g.name).toUpperCase() === wanted,
  );
  return hit ?? groups[0];
}
