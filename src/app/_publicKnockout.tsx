import type {
  DoublesKoResolved,
  TeamKoResolved,
  KoRound,
} from "@/lib/schemas/knockout";
import { ROUND_LABEL } from "@/lib/schemas/knockout";

type KoMatch = DoublesKoResolved | TeamKoResolved;

const ROUND_ORDER: KoRound[] = ["qf", "sf", "f"];

const ROUND_STYLE: Record<
  KoRound,
  { chip: string; border: string; bg: string; accent: string }
> = {
  qf: {
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    border: "border-sky-500/30",
    bg: "bg-sky-500/5",
    accent: "border-l-sky-500",
  },
  sf: {
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    accent: "border-l-amber-500",
  },
  f: {
    chip: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
    border: "border-yellow-500/40",
    bg: "bg-yellow-500/10",
    accent: "border-l-yellow-500",
  },
};

function isDoublesKo(m: KoMatch): m is DoublesKoResolved {
  return "sets" in m;
}

export function PublicKnockoutSection({
  kind,
  matches,
}: {
  kind: "doubles" | "teams";
  matches: KoMatch[];
}) {
  if (matches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Chưa có lịch vòng loại trực tiếp.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {ROUND_ORDER.map((round) => {
        const list = matches.filter((m) => m.round === round);
        if (list.length === 0) return null;
        const s = ROUND_STYLE[round];
        return (
          <div key={round} className={`rounded-xl border p-3 ${s.border} ${s.bg}`}>
            <div className="mb-3 flex items-center gap-2">
              <span className={`rounded-md px-2 py-0.5 text-sm font-semibold ${s.chip}`}>
                {ROUND_LABEL[round]}
              </span>
              <span className="text-sm text-muted-foreground">{list.length} trận</span>
            </div>
            <div className="flex flex-col gap-2">
              {list.map((m, i) => (
                <PublicKOCard key={m.id} match={m} index={i + 1} kind={kind} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PublicKOCard({
  match,
  index,
  kind,
}: {
  match: KoMatch;
  index: number;
  kind: "doubles" | "teams";
}) {
  const isDoubles = isDoublesKo(match);
  const accent = ROUND_STYLE[match.round].accent;

  const nameA = isDoubles
    ? (match.entryA?.label ?? match.labelA)
    : ((match as TeamKoResolved).entryA?.name ?? match.labelA);
  const nameB = isDoubles
    ? (match.entryB?.label ?? match.labelB)
    : ((match as TeamKoResolved).entryB?.name ?? match.labelB);
  const placeholderA = isDoubles ? !match.entryA : !(match as TeamKoResolved).entryA;
  const placeholderB = isDoubles ? !match.entryB : !(match as TeamKoResolved).entryB;

  const scoreA = isDoubles ? match.setsA : (match as TeamKoResolved).scoreA;
  const scoreB = isDoubles ? match.setsB : (match as TeamKoResolved).scoreB;
  const done = match.status === "done" || match.status === "forfeit";
  const aWon = done && scoreA > scoreB;
  const bWon = done && scoreB > scoreA;
  const bestOf = isDoubles ? match.bestOf : 0;

  return (
    <div className={`rounded-lg border-l-4 border bg-card p-3 ${accent}`}>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {ROUND_LABEL[match.round]} {index}
          </span>
          {isDoubles && bestOf > 0 && (
            <span>· thắng {Math.ceil(bestOf / 2)}/{bestOf} ván</span>
          )}
        </div>
        {done ? (
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
            Đã xong
          </span>
        ) : match.status === "live" ? (
          <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">
            Đang đấu
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Chưa đấu
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <div
            className={`truncate ${aWon ? "font-semibold" : ""} ${placeholderA ? "italic text-muted-foreground" : ""}`}
          >
            {nameA}
          </div>
          <div
            className={`truncate ${bWon ? "font-semibold" : ""} ${placeholderB ? "italic text-muted-foreground" : ""}`}
          >
            {nameB}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end text-xl font-semibold tabular-nums leading-tight">
          <span className={aWon ? "" : "text-muted-foreground"}>
            {done || scoreA + scoreB > 0 ? scoreA : "–"}
          </span>
          <span className={bWon ? "" : "text-muted-foreground"}>
            {done || scoreA + scoreB > 0 ? scoreB : "–"}
          </span>
        </div>
      </div>

      {!isDoubles && (match as TeamKoResolved).individual.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-t pt-2">
          {(match as TeamKoResolved).individual.map((sub) => {
            let a = 0, b = 0;
            for (const s of sub.sets) {
              if (s.a > s.b) a += 1;
              else if (s.b > s.a) b += 1;
            }
            const hasResult = sub.sets.length > 0;
            const aWonSub = hasResult && a > b;
            const bWonSub = hasResult && b > a;
            const playersA = sub.playersA.map((p) => p.name).join(" / ") || "—";
            const playersB = sub.playersB.map((p) => p.name).join(" / ") || "—";
            return (
              <li key={sub.id} className="rounded-md bg-muted/40 p-2">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{sub.label}</span>
                  <span>thắng {Math.ceil(sub.bestOf / 2)}/{sub.bestOf} ván</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className={`truncate ${aWonSub ? "font-semibold" : "text-muted-foreground"}`}>
                      {playersA}
                    </div>
                    <div className={`truncate ${bWonSub ? "font-semibold" : "text-muted-foreground"}`}>
                      {playersB}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end text-base font-semibold tabular-nums leading-tight">
                    <span className={aWonSub ? "" : "text-muted-foreground"}>{hasResult ? a : "–"}</span>
                    <span className={bWonSub ? "" : "text-muted-foreground"}>{hasResult ? b : "–"}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
