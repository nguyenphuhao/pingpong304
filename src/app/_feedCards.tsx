import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import type { FeedItem, GroupLeader, GroupTops } from "./_home";
import { groupColor } from "./_groupColors";

const KIND_STYLE = {
  doubles: {
    label: "Đôi",
    chip: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30",
  },
  teams: {
    label: "Đồng đội",
    chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    border: "border-violet-500/30",
  },
} as const;

export function CompactMatchRow({ item }: { item: FeedItem }) {
  const style = KIND_STYLE[item.kind];
  const done = item.status === "done";
  const aWin = done && item.scoreA > item.scoreB;
  const bWin = done && item.scoreB > item.scoreA;

  return (
    <Link href={item.href}>
      <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 active:bg-muted">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 font-medium ${style.chip}`}>
              {style.label}
            </span>
            <span>{item.groupName}</span>
            {item.table != null && <span>· Bàn {item.table}</span>}
          </div>
          {!done && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">vs</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 space-y-0.5 text-sm">
            <div className={`truncate ${aWin ? "font-semibold" : ""}`}>{item.sideA}</div>
            <div className={`truncate ${bWin ? "font-semibold" : ""}`}>{item.sideB}</div>
          </div>
          {done && (
            <div className="flex shrink-0 flex-col items-end text-base font-semibold tabular-nums leading-tight">
              <span className={aWin ? "" : "text-muted-foreground"}>{item.scoreA}</span>
              <span className={bWin ? "" : "text-muted-foreground"}>{item.scoreB}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function GroupLeaderRow({ leader }: { leader: GroupLeader }) {
  const style = KIND_STYLE[leader.kind];
  return (
    <Link href={leader.href}>
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3 active:bg-muted">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">
          <Trophy className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${style.chip}`}>
              {style.label}
            </span>
            <span className="text-sm text-muted-foreground">{leader.groupName}</span>
          </div>
          {leader.leader ? (
            <div className="truncate font-medium">{leader.leader}</div>
          ) : (
            <div className="text-sm italic text-muted-foreground">Chưa có trận chốt</div>
          )}
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          {leader.leader && <div className="text-base font-semibold text-foreground">{leader.points} đ</div>}
          <div>
            {leader.played}/{leader.total} trận
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}

export function GroupTopsCard({ tops }: { tops: GroupTops }) {
  const c = groupColor(tops.groupId);
  return (
    <Link href={tops.href}>
      <div className={`rounded-lg border p-3 active:opacity-90 ${c.border} ${c.bg}`}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`flex size-7 items-center justify-center rounded-md font-semibold ${c.badge}`}>
              {tops.groupName.replace(/^Bảng\s*/i, "")}
            </span>
            <span className="font-medium">{tops.groupName}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {tops.played}/{tops.total} trận
          </span>
        </div>
        {tops.played === 0 ? (
          <div className="text-sm italic text-muted-foreground">Chưa có trận chốt</div>
        ) : (
          <ol className="space-y-1.5">
            {tops.top.map((t, i) => (
              <li key={t.entry} className="flex items-center gap-2 text-sm">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.entry}</span>
                <span className="shrink-0 font-semibold tabular-nums">{t.points} đ</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Link>
  );
}
