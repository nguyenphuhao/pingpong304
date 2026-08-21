import { ChevronRight } from "lucide-react";
import { advancesToKo, diffLabel } from "@/lib/live/format";
import { entryCodes } from "@/lib/live/groups";
import { GROUP_STAGE } from "@/lib/tournament";
import { groupColor } from "../../_groupColors";
import type { GroupResolved } from "@/lib/schemas/group";
import type { StandingRow } from "@/lib/db/standings";

/**
 * Xếp hạng dạng thẻ, không phải bảng.
 *
 * Bảy cột (Hạng · Cặp · Trận · Thắng · Thua · Ván · Hiệu số) ở cỡ chữ 19px trên
 * máy 360px chắc chắn tràn ngang. Số liệu thành chip xuống dòng thì không bao
 * giờ tràn, ở bất kỳ mức cỡ chữ nào.
 *
 * Thứ hạng lấy nguyên từ fetchAllGroupStandings() — không tính lại. Luật phân
 * định đã có test ở src/lib/standings/__tests__.
 */
export function StandingsCards({
  group,
  rows,
  complete,
  remaining,
}: {
  group: GroupResolved;
  rows: readonly StandingRow[];
  complete: boolean;
  remaining: number;
}) {
  const codes = entryCodes(group);

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-5 text-center text-muted-foreground">
        Bảng này chưa có thứ hạng.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-3">
      {rows.map((row) => {
        const advances = advancesToKo(
          row.rank,
          complete,
          GROUP_STAGE.advancePerGroup,
        );
        const accent =
          complete && row.rank === 1
            ? "border-yellow-500 border-l-[5px]"
            : complete && row.rank === 2
              ? "border-slate-400 border-l-[5px]"
              : "";
        // Màu huy chương chỉ dùng khi bảng đã đấu hết. Bảng đang dở mà tô
        // vàng/bạc thì trông như đã chốt, trong khi thứ hạng còn đổi.
        const chipTone =
          complete && row.rank === 1
            ? "bg-yellow-500 text-white"
            : complete && row.rank === 2
              ? "bg-slate-400 text-white"
              : "border bg-muted text-muted-foreground";

        return (
          <article
            key={row.entryId}
            className={`flex gap-2.5 rounded-xl border bg-card p-2.5 ${accent}`}
          >
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-[1.05rem] font-bold tabular-nums ${chipTone}`}
            >
              {row.rank}
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[0.7rem] font-bold ${groupColor(group.id).badge}`}
                >
                  {codes.get(row.entryId)}
                </span>
                <span className="min-w-0 text-[1.05rem] font-bold leading-tight break-words">
                  {row.entry}
                </span>
                {advances && (
                  <span className="shrink-0 rounded border border-emerald-600 bg-emerald-500/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    Đi tiếp
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Stat>
                  <b>{row.played}</b> trận
                </Stat>
                <Stat>
                  <b>{row.won}</b> thắng
                </Stat>
                <Stat>
                  <b>{row.lost}</b> thua
                </Stat>
                <Stat>
                  Ván{" "}
                  <b>
                    {row.setsWon}–{row.setsLost}
                  </b>
                </Stat>
                <Stat tone={row.diff > 0 ? "pos" : row.diff < 0 ? "neg" : undefined}>
                  Hiệu số <b>{diffLabel(row.diff)}</b>
                </Stat>
              </div>
            </div>
          </article>
        );
      })}

      {!complete && (
        <p className="px-2 text-center text-[0.75rem] leading-relaxed text-muted-foreground md:col-span-2">
          Còn {remaining} trận. Thứ hạng thay đổi cho tới trận cuối cùng của bảng.
        </p>
      )}

      <details className="group rounded-xl border bg-card md:col-span-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[0.85rem] font-bold text-muted-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden
            className="size-[1em] transition-transform group-open:rotate-90"
          />
          Cách xếp hạng
        </summary>
        <ol className="flex list-decimal flex-col gap-1.5 px-3 pb-3 pl-8 text-[0.82rem] leading-relaxed text-muted-foreground">
          <li>
            <strong className="font-semibold text-foreground">Số trận thắng</strong> —
            ai thắng nhiều hơn xếp trên. Hiệu số ván không xét ở bước này.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Đối đầu trực tiếp</strong> —
            khi đúng 2 cặp bằng số trận thắng, ai thắng trận gặp nhau thì xếp trên.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Hiệu số ván</strong> toàn
            bảng — dùng khi từ 3 cặp trở lên bằng nhau.
          </li>
        </ol>
      </details>
    </div>
  );
}

function Stat({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "pos" | "neg";
}) {
  // Tone mặc định: chữ đậm tô đậm hơn nền chip cho dễ bắt số.
  // Tone pos/neg: để nguyên màu của tone, đừng ghi đè bằng foreground.
  const style =
    tone === "pos"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : tone === "neg"
        ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
        : "bg-muted/60 text-muted-foreground [&>b]:text-foreground";
  return (
    <span
      className={`rounded-lg border px-2 py-1 text-[0.78rem] font-semibold tabular-nums [&>b]:font-bold ${style}`}
    >
      {children}
    </span>
  );
}
