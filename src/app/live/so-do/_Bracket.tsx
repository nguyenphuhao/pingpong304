import { ArrowRight, Check } from "lucide-react";
import { ScrollArea } from "./_ScrollArea";
import { formatSets, statusLabel } from "@/lib/live/format";
import { orderForBracket } from "@/lib/live/bracket";
import { ROUND_LABEL, type KoRound } from "@/lib/schemas/knockout";
import type { DoublesKoResolved } from "@/lib/schemas/knockout";

/** Mỗi vòng một màu để mắt bám được cột khi cuộn ngang. */
const ROUND_TONE: Record<KoRound, { rail: string; chip: string; head: string }> = {
  qf: {
    rail: "border-l-sky-500",
    chip: "text-sky-700 dark:text-sky-400",
    head: "bg-sky-500/10",
  },
  sf: {
    rail: "border-l-amber-500",
    chip: "text-amber-700 dark:text-amber-400",
    head: "bg-amber-500/10",
  },
  f: {
    rail: "border-l-yellow-500",
    chip: "text-yellow-700 dark:text-yellow-500",
    head: "bg-yellow-500/15",
  },
};

/**
 * Sơ đồ nhánh, cuộn ngang có bám mốc từng cột.
 *
 * Ba cột không vừa máy 360px nên phải cuộn — đổi lại giữ được hình dạng nhánh
 * đấu. Sơ đồ phá lề ngang của trang (-mx-3) để dùng hết bề ngang máy.
 *
 * Thứ tự trong cột do orderForBracket() quyết, suy từ next_match_id/next_slot,
 * nhờ vậy hai trận cùng nạp một trận luôn nằm cạnh nhau và đường nối không cắt
 * chéo. Đường nối dọc vẽ theo chỉ số chẵn/lẻ trong cột.
 */
export function Bracket({ matches }: { matches: readonly DoublesKoResolved[] }) {
  const columns = orderForBracket(matches);

  if (columns.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-5 text-center text-muted-foreground">
        Chưa có sơ đồ vòng loại trực tiếp. Sơ đồ hiện ra khi BTC chốt suất đi tiếp.
      </p>
    );
  }

  return (
    <div className="-mx-3 border-y bg-card md:mx-0 md:rounded-2xl md:border">
      <ScrollArea
        hint={
          <p className="flex items-center justify-center gap-2 border-t bg-muted/40 py-2 text-[0.72rem] font-semibold text-muted-foreground">
            Vuốt ngang để xem bán kết và chung kết
            <ArrowRight aria-hidden className="size-[1.1em]" />
          </p>
        }
      >
        <div className="flex min-w-max items-stretch">
          {columns.map((column, ci) => {
            const round = column[0].round;
            const tone = ROUND_TONE[round];
            const hasNext = ci < columns.length - 1;
            const hasPrev = ci > 0;

            return (
              <section
                key={round}
                className="flex w-[15.5rem] flex-none flex-col [scroll-snap-align:start]"
              >
                <div
                  className={`flex h-11 flex-none items-center justify-center gap-2 border-b ${tone.head}`}
                >
                  <span
                    className={`text-[0.7rem] font-bold uppercase tracking-[0.11em] ${tone.chip}`}
                  >
                    {ROUND_LABEL[round]}
                  </span>
                  <span className="text-[0.65rem] font-semibold text-muted-foreground">
                    {column.length} trận
                  </span>
                </div>

                {column.map((match, mi) => (
                  <div
                    key={match.id}
                    className={`relative flex min-h-[7rem] flex-1 items-center py-1.5 pl-1.5 ${
                      hasNext ? "pr-6" : "pr-1.5"
                    } ${hasPrev ? "pl-6" : ""}`}
                  >
                    {/* Nhánh dọc gộp hai trận liền kề về trận kế tiếp */}
                    {hasNext && (
                      <span
                        aria-hidden
                        className={`absolute right-0 w-0.5 bg-border ${
                          mi % 2 === 0 ? "top-1/2 h-1/2" : "top-0 h-1/2"
                        }`}
                      />
                    )}
                    {/* Cuống ngang nối thẻ ra nhánh dọc, và từ nhánh vào thẻ sau */}
                    {hasNext && (
                      <span
                        aria-hidden
                        className="absolute right-0 top-1/2 h-0.5 w-6 bg-border"
                      />
                    )}
                    {hasPrev && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 h-0.5 w-6 bg-border"
                      />
                    )}

                    <KoCard match={match} tone={tone} />
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function KoCard({
  match,
  tone,
}: {
  match: DoublesKoResolved;
  tone: { rail: string; chip: string; head: string };
}) {
  const decided = match.status === "done" || match.status === "forfeit";
  const winnerId = match.winner?.id ?? null;
  const detail = formatSets(match.sets);

  return (
    <article
      className={`flex-1 overflow-hidden rounded-lg border border-l-[3px] bg-background ${tone.rail}`}
    >
      <div className={`flex items-center justify-between gap-1 px-2 py-1 ${tone.head}`}>
        <span className={`text-[0.62rem] font-bold uppercase tracking-wide ${tone.chip}`}>
          {shortTag(match.id, match.round)}
        </span>
        <span className="text-[0.58rem] font-semibold text-muted-foreground">
          {decided || match.status === "live" ? statusLabel(match.status) : `BO${match.bestOf}`}
        </span>
      </div>

      <KoSide
        source={match.labelA}
        entry={match.entryA}
        score={match.setsA}
        scheduled={!decided && match.status !== "live"}
        won={decided && winnerId === match.entryA?.id}
      />
      <div className="border-t border-dashed" />
      <KoSide
        source={match.labelB}
        entry={match.entryB}
        score={match.setsB}
        scheduled={!decided && match.status !== "live"}
        won={decided && winnerId === match.entryB?.id}
      />

      {detail && (
        <p className="border-t px-2 py-1 text-[0.6rem] font-medium tabular-nums text-muted-foreground">
          {detail}
        </p>
      )}
    </article>
  );
}

/** "dko-qf1" → "TK 1". Rơi về nhãn vòng nếu mã không theo quy ước. */
function shortTag(id: string, round: KoRound): string {
  const n = id.match(/(\d+)$/)?.[1];
  const prefix = { qf: "TK", sf: "BK", f: "CK" }[round];
  return n ? `${prefix} ${n}` : prefix;
}

function KoSide({
  source,
  entry,
  score,
  scheduled,
  won,
}: {
  source: string;
  entry: { id: string; label: string } | null;
  score: number;
  scheduled: boolean;
  won: boolean;
}) {
  return (
    <div className={`px-2 py-1.5 ${won ? "bg-emerald-500/10" : ""}`}>
      <p className="text-[0.58rem] font-bold uppercase tracking-wide text-muted-foreground">
        {source}
      </p>
      <div className="flex items-start gap-1.5">
        <span
          className={`min-w-0 flex-1 text-[0.85rem] leading-tight break-words ${
            entry
              ? won
                ? "font-bold"
                : "font-semibold"
              : "font-medium italic text-muted-foreground"
          }`}
        >
          {entry?.label ?? "chờ xác định"}
        </span>
        {won && (
          <Check
            aria-hidden
            className="size-[0.95rem] shrink-0 text-emerald-600 dark:text-emerald-400"
          />
        )}
        <span
          className={`shrink-0 text-[0.95rem] font-bold tabular-nums ${
            won ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
          }`}
        >
          {scheduled ? "—" : score}
        </span>
      </div>
    </div>
  );
}
