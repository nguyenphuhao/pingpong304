import { Check } from "lucide-react";
import { formatSets, statusLabel } from "@/lib/live/format";
import type { MatchResolved } from "@/lib/schemas/match";

const STATUS_STYLE: Record<MatchResolved["status"], string> = {
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  forfeit: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  live: "bg-red-500/15 text-red-700 dark:text-red-400",
  scheduled: "border bg-muted text-muted-foreground",
};

/**
 * Một trận, xếp dọc.
 *
 * Poster của BTC xếp ngang (tên A — vs — tên B) nhưng ở cỡ chữ 19px trên máy
 * 360px thì hàng đó tràn. Xếp dọc để tên dài như "Cường (nhỏ) / Quang Vinh"
 * xuống dòng thoải mái ở mọi mức cỡ chữ.
 */
export function MatchCard({
  match,
  no,
  time,
  codeA,
  codeB,
}: {
  match: MatchResolved;
  no: number;
  time: string;
  codeA: string;
  codeB: string;
}) {
  const decided = match.status === "done" || match.status === "forfeit";
  const winnerId = match.winner?.id ?? null;
  const detail = formatSets(match.sets);

  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-foreground">
          Trận {no}
          <span className="font-medium normal-case"> · {time}</span>
          {match.table !== null && (
            <span className="font-medium normal-case"> · Bàn {match.table}</span>
          )}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide ${STATUS_STYLE[match.status]}`}
        >
          {match.status === "live" && (
            <span className="size-[0.45rem] animate-pulse rounded-full bg-current motion-reduce:animate-none" />
          )}
          {statusLabel(match.status)}
        </span>
      </div>

      <SideRow
        code={codeA}
        label={match.pairA.label}
        score={match.setsA}
        scheduled={match.status === "scheduled"}
        won={decided && winnerId === match.pairA.id}
      />
      <div className="border-t" />
      <SideRow
        code={codeB}
        label={match.pairB.label}
        score={match.setsB}
        scheduled={match.status === "scheduled"}
        won={decided && winnerId === match.pairB.id}
      />

      {detail && (
        <p className="border-t px-3 py-1.5 text-[0.75rem] font-medium tabular-nums text-muted-foreground">
          {detail}
        </p>
      )}
    </article>
  );
}

/**
 * Cặp thắng nhận ba dấu hiệu cùng lúc — chữ đậm, nền xanh, dấu tích — để người
 * phân biệt màu kém vẫn đọc được kết quả.
 */
function SideRow({
  code,
  label,
  score,
  scheduled,
  won,
}: {
  code: string;
  label: string;
  score: number;
  scheduled: boolean;
  won: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 ${
        won ? "bg-emerald-500/10" : ""
      }`}
    >
      <span className="shrink-0 rounded-md bg-foreground/85 px-1.5 py-0.5 text-[0.7rem] font-bold text-background">
        {code}
      </span>
      <span
        className={`min-w-0 flex-1 text-[1.05rem] leading-snug break-words ${
          won ? "font-bold" : "font-medium"
        }`}
      >
        {label}
      </span>
      <span
        className={`shrink-0 text-[1.3rem] font-bold tabular-nums ${
          won ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
        }`}
      >
        {scheduled ? "—" : score}
      </span>
      <Check
        aria-hidden
        className={`size-[1.15rem] shrink-0 text-emerald-600 dark:text-emerald-400 ${
          won ? "" : "invisible"
        }`}
      />
    </div>
  );
}
