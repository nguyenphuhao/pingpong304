import { Medal } from "lucide-react";
import { finalRanking } from "@/lib/live/bracket";
import type { DoublesKoResolved } from "@/lib/schemas/knockout";

const RANK_STYLE = [
  "bg-yellow-500 text-white",
  "bg-slate-400 text-white",
  "border bg-muted text-muted-foreground",
];

/**
 * Thứ hạng chung cuộc. Luôn hiện — chưa có kết quả thì để "chờ xác định" cho
 * người xem biết giải còn những giải thưởng nào, thay vì trống trơn.
 */
export function FinalRanking({
  matches,
}: {
  matches: readonly DoublesKoResolved[];
}) {
  const result = finalRanking(matches);

  const rows: Array<{ rank: number; title: string; name: string | null }> = [
    { rank: 1, title: "Vô địch", name: result?.champion ?? null },
    { rank: 2, title: "Á quân", name: result?.runnerUp ?? null },
    { rank: 3, title: "Đồng hạng ba", name: result?.thirds[0] ?? null },
    { rank: 3, title: "Đồng hạng ba", name: result?.thirds[1] ?? null },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-yellow-500/50 bg-yellow-500/5">
      <div className="flex items-center gap-2 border-b border-yellow-500/40 bg-yellow-500/10 px-3 py-2.5">
        <Medal aria-hidden className="size-[1.15rem] text-yellow-600 dark:text-yellow-500" />
        <h2 className="text-[0.78rem] font-bold uppercase tracking-[0.09em] text-yellow-700 dark:text-yellow-500">
          {result ? "Thứ hạng chung cuộc" : "Chốt sau chung kết"}
        </h2>
      </div>

      <ul>
        {rows.map((row, i) => (
          <li
            key={i}
            className="flex items-center gap-3 border-b bg-card px-3 py-2.5 last:border-b-0"
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[0.95rem] font-bold tabular-nums ${
                RANK_STYLE[Math.min(row.rank, 3) - 1]
              }`}
            >
              {row.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                {row.title}
              </p>
              <p
                className={`text-[1rem] leading-tight break-words ${
                  row.name
                    ? "font-bold"
                    : "font-medium italic text-muted-foreground"
                }`}
              >
                {row.name ?? "chờ xác định"}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="border-t bg-muted/40 px-3 py-2 text-[0.7rem] leading-relaxed text-muted-foreground">
        Hai cặp thua bán kết đồng hạng Ba — không đánh trận tranh hạng 3.
      </p>
    </section>
  );
}
