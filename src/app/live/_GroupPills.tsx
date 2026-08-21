import Link from "next/link";
import { groupColor } from "../_groupColors";
import { shortGroupName } from "@/lib/live/format";
import type { GroupResolved } from "@/lib/schemas/group";

/**
 * Bộ chọn bảng. Dùng <Link> chứ không phải nút client: bảng đang xem nằm trong
 * địa chỉ (?bang=B) nên bấm Back hay tải lại đều giữ nguyên, và màn hình này
 * không cần một dòng JavaScript nào.
 *
 * `scroll={false}` để đổi bảng không nhảy về đầu trang.
 */
export function GroupPills({
  groups,
  activeId,
  progress,
  basePath,
}: {
  groups: readonly GroupResolved[];
  activeId: string;
  /** groupId → "6/10", hiện dưới chữ cái để thấy bảng nào đang tới đâu. */
  progress: Map<string, string>;
  basePath: string;
}) {
  if (groups.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label="Chọn bảng"
      className="grid grid-cols-4 gap-2"
    >
      {groups.map((g) => {
        const letter = shortGroupName(g.name);
        const isActive = g.id === activeId;
        const c = groupColor(g.id);
        return (
          <Link
            key={g.id}
            href={`${basePath}?bang=${letter}`}
            scroll={false}
            role="tab"
            aria-selected={isActive}
            style={{ touchAction: "manipulation" }}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border-[1.5px] transition-colors ${
              isActive
                ? `${c.border} ${c.bg}`
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            <span className="text-[1.15rem] font-bold leading-none">
              {letter}
            </span>
            <span className="text-[0.65rem] font-semibold tabular-nums opacity-80">
              {progress.get(g.id) ?? ""}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
