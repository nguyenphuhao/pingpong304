import type { GroupResolved } from "@/lib/schemas/group";

/**
 * Tìm bảng dựa trên input của AI, chấp nhận cả id chính xác và tên.
 *
 * Thứ tự ưu tiên: (1) id chính xác, (2) tên chính xác (case-insensitive),
 * (3) tên chứa query (case-insensitive) — ví dụ "A" khớp "Bảng A".
 *
 * Nếu không khớp / khớp nhiều → throw NOT_FOUND hoặc AMBIGUOUS kèm danh sách
 * candidate để AI hỏi lại user.
 */
export function resolveGroup(
  query: string,
  groups: GroupResolved[],
): GroupResolved {
  const q = query.trim().toLowerCase();
  if (!q) throw new Error("NOT_FOUND: query rỗng");

  const byId = groups.find((g) => g.id.toLowerCase() === q);
  if (byId) return byId;

  const byName = groups.find((g) => g.name.toLowerCase() === q);
  if (byName) return byName;

  const byContains = groups.filter((g) => g.name.toLowerCase().includes(q));
  if (byContains.length === 1) return byContains[0];

  if (byContains.length > 1) {
    const list = byContains.map((g) => `${g.id} (${g.name})`).join(", ");
    throw new Error(`AMBIGUOUS: "${query}" khớp nhiều bảng: ${list}`);
  }

  const all = groups.map((g) => `${g.id} (${g.name})`).join(", ");
  throw new Error(
    `NOT_FOUND: không tìm thấy bảng "${query}". Các bảng có sẵn: ${all}`,
  );
}
