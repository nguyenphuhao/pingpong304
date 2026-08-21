"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { groupColor } from "../_groupColors";
import { shortGroupName } from "@/lib/live/format";
import type { GroupResolved } from "@/lib/schemas/group";

/**
 * Bộ chọn bảng, kèm skeleton cho vùng nội dung khi đang tải.
 *
 * Trước đây pill là <Link> thuần. Đổi `?bang=` là điều hướng mềm nên Next giữ
 * nguyên nội dung cũ cho tới khi dữ liệu mới về — không có loading.tsx, không có
 * gì nhúc nhích. Trên mạng 3G trong nhà thi đấu, người xem bấm rồi tưởng máy
 * treo và bấm tiếp.
 *
 * Nay dùng useTransition: pill vẫn hiện và đổi màu NGAY sang bảng vừa bấm (nhờ
 * trạng thái lạc quan), còn vùng nội dung thay bằng skeleton cho tới khi server
 * trả về. `children` là nội dung do server component dựng, truyền xuống đây.
 */
export function GroupSwitcher({
  groups,
  activeId,
  progress,
  basePath,
  skeleton,
  children,
}: {
  groups: readonly GroupResolved[];
  activeId: string;
  /** groupId → "6/10" */
  progress: Map<string, string>;
  basePath: string;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clickedId, setClickedId] = useState<string | null>(null);

  // Đang chờ thì tô bảng vừa bấm; xong thì theo địa chỉ thật.
  const shownId = pending && clickedId ? clickedId : activeId;

  const go = (g: GroupResolved) => {
    if (g.id === activeId) return;
    setClickedId(g.id);
    startTransition(() => {
      router.replace(`${basePath}?bang=${shortGroupName(g.name)}`, {
        scroll: false,
      });
    });
  };

  return (
    <>
      {groups.length > 1 && (
        <div role="tablist" aria-label="Chọn bảng" className="grid grid-cols-4 gap-2">
          {groups.map((g) => {
            const letter = shortGroupName(g.name);
            const isActive = g.id === shownId;
            const c = groupColor(g.id);
            return (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-busy={pending && clickedId === g.id}
                onClick={() => go(g)}
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
              </button>
            );
          })}
        </div>
      )}

      <div aria-busy={pending} aria-live="polite">
        {pending ? skeleton : children}
      </div>
    </>
  );
}
