import { groupColor } from "../_groupColors";
import { MatchCard } from "./_MatchCard";
import { entryCodes } from "@/lib/live/groups";
import { matchTimeAt, shortGroupName } from "@/lib/live/format";
import { GROUP_STAGE } from "@/lib/tournament";
import type { GroupResolved } from "@/lib/schemas/group";
import type { MatchResolved } from "@/lib/schemas/match";

export function GroupSchedule({
  group,
  matches,
}: {
  group: GroupResolved;
  matches: readonly MatchResolved[];
}) {
  const letter = shortGroupName(group.name);
  const c = groupColor(group.id);
  const codes = entryCodes(group);

  const played = matches.filter(
    (m) => m.status === "done" || m.status === "forfeit",
  ).length;
  const percent = matches.length ? Math.round((played / matches.length) * 100) : 0;

  // Số bàn nằm ở từng trận, không ở bảng — lấy bàn của trận đầu làm bàn của bảng.
  const table = matches.find((m) => m.table !== null)?.table ?? null;
  const bestOf = matches[0]?.bestOf;

  return (
    <>
      <section className={`rounded-2xl border p-3 ${c.border} ${c.bg}`}>
        <div className="flex items-center gap-2.5">
          <span
            className={`flex size-10 items-center justify-center rounded-xl text-[1.25rem] font-bold ${c.badge}`}
          >
            {letter}
          </span>
          <h2 className="text-[1.3rem] font-bold tracking-tight">{group.name}</h2>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {table !== null && <Chip>Bàn {table}</Chip>}
          <Chip>
            {group.entries.length} cặp · {matches.length} trận
          </Chip>
          {bestOf && (
            <Chip>
              BO{bestOf} — thắng {Math.floor(bestOf / 2) + 1} ván
            </Chip>
          )}
          <Chip>{GROUP_STAGE.advancePerGroup} cặp đầu đi tiếp</Chip>
        </div>

        {matches.length > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[0.78rem] font-semibold text-muted-foreground">
              <span>
                Đã đấu {played}/{matches.length} trận
              </span>
              <span className="tabular-nums">{percent}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/10">
              <div
                className={`h-full rounded-full ${c.badge}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <SectionLabel>Các cặp trong bảng</SectionLabel>
      <ul className="grid grid-cols-2 gap-2">
        {group.entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-2 rounded-xl border bg-card px-2.5 py-2"
          >
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[0.7rem] font-bold ${c.badge}`}
            >
              {codes.get(entry.id)}
            </span>
            <span className="min-w-0 text-[0.95rem] font-semibold leading-tight break-words">
              {entry.label}
            </span>
          </li>
        ))}
      </ul>

      <SectionLabel>Lịch thi đấu &amp; kết quả</SectionLabel>
      {matches.length === 0 ? (
        <p className="rounded-xl border border-dashed p-5 text-center text-muted-foreground">
          Bảng này chưa có lịch thi đấu.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {matches.map((m, i) => (
            <MatchCard
              key={m.id}
              match={m}
              no={i + 1}
              time={matchTimeAt(
                GROUP_STAGE.startTime,
                GROUP_STAGE.slotMinutes,
                i,
              )}
              codeA={codes.get(m.pairA.id) ?? "?"}
              codeB={codes.get(m.pairB.id) ?? "?"}
            />
          ))}
        </div>
      )}

      <p className="px-2 text-center text-[0.75rem] leading-relaxed text-muted-foreground">
        Giờ ghi trên mỗi trận là <strong className="font-semibold">giờ dự kiến</strong>,
        tính từ {GROUP_STAGE.startTime} và {GROUP_STAGE.slotMinutes} phút mỗi trận.
        Thực tế có thể xê dịch.
      </p>
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border bg-background/70 px-2.5 py-1 text-[0.72rem] font-semibold text-foreground/80">
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
